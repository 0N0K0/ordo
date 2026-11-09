import {
  accountingDocumentInputSchema,
  addDays,
  computeTotals,
  documentNumber,
  dueDateForTerms,
  fromCents,
  formatDay,
  formatMoney,
  parseDay,
  toCents,
  type AccountingDocumentInput,
  type AccountingDocumentType,
  type AccountingLineInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { currentWorkspaceId } from '../workspace-context';
import { Prisma, type AccountingDocument, type AccountingLine, type CompanyProfile } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { attachmentData } from './attachments';
import { getCompanyProfile, usedCounter } from './company';
import { scopeOf, statusOf } from './document-statuses';
import { syncPaymentStatus } from './document-tracking';
import { requirePro } from './workspaces';

export type DocumentWithLines = AccountingDocument & { lines: AccountingLine[] };

/**
 * Line fields of a stored line (decimals as numbers).
 * @param {AccountingLine} line Stored line.
 * @returns {AccountingLineInput} Line.
 */
export function lineInput(line: AccountingLine): AccountingLineInput {
  return {
    kind: line.kind,
    title: line.title,
    description: line.description,
    quantity: Number(line.quantity),
    unit: line.unit,
    unitPrice: Number(line.unitPrice),
    vatRate: Number(line.vatRate),
    discountType: line.discountType,
    discountValue: line.discountValue === null ? null : Number(line.discountValue),
    deductedDocumentId: line.deductedDocumentId,
  };
}

/**
 * Totals of a stored document, in cents.
 * @param {DocumentWithLines} document Document.
 * @returns {ReturnType<typeof computeTotals>} Totals.
 */
export function documentTotals(document: DocumentWithLines) {
  return computeTotals({
    lines: [...document.lines].sort((a, b) => a.position - b.position).map(lineInput),
    globalDiscountType: document.globalDiscountType,
    globalDiscountValue: document.globalDiscountValue === null ? null : Number(document.globalDiscountValue),
    vatApplicable: document.vatApplicable,
  });
}

/**
 * Loads a document with its lines or throws NOT_FOUND.
 * @param {string} id Document id.
 * @returns {Promise<DocumentWithLines>} Document.
 */
export async function findDocument(id: string): Promise<DocumentWithLines> {
  const document = await prisma.accountingDocument.findUnique({ where: { id }, include: { lines: { orderBy: { position: 'asc' } } } });
  if (!document) throw notFound('Document');
  return document;
}

/**
 * Checks that a document can still be edited (drafts and recurring models).
 * @param {AccountingDocument} document Document.
 * @returns {void}
 */
function assertEditable(document: AccountingDocument): void {
  if (document.status === 'FINAL') {
    throw clientError('BAD_USER_INPUT', 'Un document définitif ne peut plus être modifié : corrigez-le par un avoir.');
  }
}

/**
 * Checks the client of a document and the service, contact and project chosen with it.
 * @param {object} refs References.
 * @param {string} refs.clientId Client.
 * @param {string | null} refs.serviceId Service.
 * @param {string | null} refs.contactId Contact.
 * @param {string | null} refs.projectId Project.
 * @returns {Promise<void>}
 */
async function assertParties({ clientId, serviceId, contactId, projectId }: { clientId: string; serviceId: string | null; contactId: string | null; projectId: string | null }) {
  if (!(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) throw notFound('Client');
  const fieldError = (field: string, message: string) => clientError('BAD_USER_INPUT', message, { fields: { [field]: message } });
  if (serviceId && (await prisma.clientService.findUnique({ where: { id: serviceId } }))?.clientId !== clientId) {
    throw fieldError('serviceId', 'Ce service n’appartient pas au client.');
  }
  if (contactId && (await prisma.clientContact.findUnique({ where: { id: contactId } }))?.clientId !== clientId) {
    throw fieldError('contactId', 'Ce contact n’appartient pas au client.');
  }
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw notFound('Projet');
}

/**
 * Checks that the deposits deducted by lines are final deposit invoices of the client of the document.
 * @param {AccountingLineInput[]} lines Lines.
 * @param {string} clientId Client of the document.
 * @returns {Promise<void>}
 */
async function assertDeductions(lines: AccountingLineInput[], clientId: string): Promise<void> {
  const ids = [...new Set(lines.flatMap((line) => (line.kind === 'DEDUCTION' && line.deductedDocumentId ? [line.deductedDocumentId] : [])))];
  if (!ids.length) return;
  const deposits = await prisma.accountingDocument.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, status: true, clientId: true } });
  for (const id of ids) {
    const deposit = deposits.find((item) => item.id === id);
    if (!deposit) throw notFound('Facture d’acompte');
    if (deposit.type !== 'DEPOSIT_INVOICE' || deposit.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Seule une facture d’acompte validée peut être déduite.');
    if (deposit.clientId !== clientId) throw clientError('BAD_USER_INPUT', 'Cette facture d’acompte est celle d’un autre client.');
  }
}

/**
 * Checks that tracked time can be billed on a document: invoices only, finished time, not billed elsewhere.
 * @param {AccountingDocumentType} type Type of the document.
 * @param {string | null} documentId Document (null when created).
 * @param {string[]} ids Time entries.
 * @returns {Promise<void>}
 */
async function assertBillableTime(type: AccountingDocumentType, documentId: string | null, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (type !== 'INVOICE') throw clientError('BAD_USER_INPUT', 'Seule une facture peut facturer du temps.');
  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: ids } },
    select: { duration: true, documentId: true, document: { select: { number: true } } },
  });
  if (entries.length !== new Set(ids).size) throw notFound('Temps');
  if (entries.some((entry) => entry.duration === null)) throw clientError('BAD_USER_INPUT', 'Arrêtez le chrono avant de facturer son temps.');
  const billed = entries.find((entry) => entry.documentId && entry.documentId !== documentId);
  if (billed) throw clientError('BAD_USER_INPUT', `Une partie de ce temps est déjà facturée (${billed.document?.number ?? 'brouillon'}).`);
}

/**
 * Prisma data of the lines of a document.
 * @param {AccountingLineInput[]} lines Lines.
 * @returns {Prisma.AccountingLineCreateWithoutDocumentInput[]} Lines data.
 */
function linesData(lines: AccountingLineInput[]): Prisma.AccountingLineUncheckedCreateWithoutDocumentInput[] {
  return lines.map((line, position) => ({
    ...line,
    // Only a deduction takes off a deposit.
    deductedDocumentId: line.kind === 'DEDUCTION' ? (line.deductedDocumentId ?? null) : null,
    position,
    quantity: new Prisma.Decimal(line.quantity),
    unitPrice: new Prisma.Decimal(line.unitPrice),
    vatRate: new Prisma.Decimal(line.vatRate),
    discountValue: line.discountValue === null ? null : new Prisma.Decimal(line.discountValue),
  }));
}

/**
 * Scalar data of validated document fields, with their totals.
 * @param {ReturnType<typeof accountingDocumentInputSchema.parse>} input Fields.
 * @returns {object} Prisma data.
 */
function documentData(input: ReturnType<typeof accountingDocumentInputSchema.parse>) {
  const { lines, issueDate, dueDate, serviceStart, serviceEnd, globalDiscountValue, depositValue, timeEntryIds: _timeEntryIds, ...rest } = input;
  const totals = computeTotals({ lines, globalDiscountType: input.globalDiscountType, globalDiscountValue, vatApplicable: input.vatApplicable });
  const day = (value: string | null) => (value ? parseDay(value) : null);
  return {
    ...rest,
    issueDate: parseDay(issueDate),
    dueDate: day(dueDate),
    serviceStart: day(serviceStart),
    serviceEnd: day(serviceEnd),
    globalDiscountValue: globalDiscountValue === null ? null : new Prisma.Decimal(globalDiscountValue),
    depositType: depositValue ? input.depositType : null,
    depositValue: depositValue && input.depositType ? new Prisma.Decimal(depositValue) : null,
    totalNet: new Prisma.Decimal(fromCents(totals.totalNet)),
    totalVat: new Prisma.Decimal(fromCents(totals.totalVat)),
    totalGross: new Prisma.Decimal(fromCents(totals.totalGross)),
  };
}

/**
 * Default fields of a new document of a client: the company's terms and mentions, dates from today.
 * @param {AccountingDocumentType} type Type.
 * @param {string} clientId Client.
 * @param {string} issueDate Date of the document.
 * @returns {Promise<AccountingDocumentInput>} Fields.
 */
export async function defaultFields(type: AccountingDocumentType, clientId: string, issueDate: string): Promise<AccountingDocumentInput> {
  const company = await getCompanyProfile();
  const isQuote = type === 'QUOTE';
  const isCreditNote = type === 'CREDIT_NOTE';
  return {
    clientId,
    serviceId: null,
    contactId: null,
    projectId: null,
    issueDate,
    dueDate: isCreditNote
      ? null
      : isQuote
        ? addDays(issueDate, company.quoteValidityDays)
        : (dueDateForTerms(company.paymentTerms, issueDate) ?? addDays(issueDate, company.paymentDays)),
    serviceStart: null,
    serviceEnd: null,
    title: null,
    introduction: null,
    referenceLabel: company.referenceLabel,
    referenceValue: null,
    conclusion: null,
    paymentTerms: isCreditNote ? null : company.paymentTerms,
    paymentMethods: company.paymentMethods,
    depositType: null,
    depositValue: null,
    lateInterest: isCreditNote ? null : company.lateInterest,
    billingSchedule: null,
    otherMentions: company.otherMentions,
    showBankDetails: !isQuote,
    vatApplicable: company.vatApplicable,
    globalDiscountType: null,
    globalDiscountValue: null,
    lines: [],
  };
}

/**
 * Creates a draft.
 * @param {AccountingDocumentType} type Type.
 * @param {AccountingDocumentInput} input Fields.
 * @param {object} [extra] Source document, recurring origin or status. Optional.
 * @returns {Promise<AccountingDocument>} Draft.
 */
export async function createDocument(
  type: AccountingDocumentType,
  input: AccountingDocumentInput,
  extra: { sourceId?: string | null; importedSourceId?: string | null; recurringId?: string | null; status?: 'DRAFT' | 'TEMPLATE' } = {},
): Promise<AccountingDocument> {
  requirePro('facturation');
  const fields = parseInput(accountingDocumentInputSchema, input);
  await assertParties(fields);
  await assertDeductions(fields.lines, fields.clientId);
  const company = await getCompanyProfile();
  if (fields.timeEntryIds?.length && extra.status === 'TEMPLATE') throw clientError('BAD_USER_INPUT', 'Un modèle de facture récurrente ne facture pas de temps.');
  if (fields.timeEntryIds?.length) await assertBillableTime(type, null, fields.timeEntryIds);
  const created = await prisma.accountingDocument.create({
    data: {
      ...documentData(fields),
      type,
      status: extra.status ?? 'DRAFT',
      sourceId: extra.sourceId ?? null,
      importedSourceId: extra.importedSourceId ?? null,
      recurringId: extra.recurringId ?? null,
      vatExemptionText: company.vatExemptionText,
      lines: { create: linesData(fields.lines) },
    },
  });
  if (fields.timeEntryIds?.length) await prisma.timeEntry.updateMany({ where: { id: { in: fields.timeEntryIds } }, data: { documentId: created.id } });
  return created;
}

/**
 * Replaces the fields and lines of a draft (or of a recurring model).
 * @param {string} id Document id.
 * @param {AccountingDocumentInput} input Fields.
 * @returns {Promise<AccountingDocument>} Document.
 */
export async function updateDocument(id: string, input: AccountingDocumentInput): Promise<AccountingDocument> {
  const document = await findDocument(id);
  assertEditable(document);
  const fields = parseInput(accountingDocumentInputSchema, input);
  await assertParties(fields);
  await assertDeductions(fields.lines, fields.clientId);
  const timeEntryIds = fields.timeEntryIds;
  if (timeEntryIds?.length && document.status !== 'DRAFT') throw clientError('BAD_USER_INPUT', 'Un modèle de facture récurrente ne facture pas de temps.');
  if (timeEntryIds) await assertBillableTime(document.type, id, timeEntryIds);
  return prisma.$transaction(async (tx) => {
    if (timeEntryIds) {
      await tx.timeEntry.updateMany({ where: { documentId: id, id: { notIn: timeEntryIds } }, data: { documentId: null } });
      await tx.timeEntry.updateMany({ where: { id: { in: timeEntryIds } }, data: { documentId: id } });
    }
    await tx.accountingLine.deleteMany({ where: { documentId: id } });
    return tx.accountingDocument.update({ where: { id }, data: { ...documentData(fields), lines: { create: linesData(fields.lines) } } });
  });
}

/**
 * Deletes a draft (final documents are kept: they are corrected by a credit note).
 * @param {string} id Document id.
 * @returns {Promise<void>}
 */
export async function deleteDocument(id: string): Promise<void> {
  const document = await findDocument(id);
  if (document.status !== 'DRAFT') throw clientError('BAD_USER_INPUT', 'Seuls les brouillons peuvent être supprimés.');
  if (await prisma.accountingDocument.count({ where: { sourceId: id } })) {
    throw clientError('BAD_USER_INPUT', 'D’autres documents ont été créés à partir de ce brouillon.');
  }
  await prisma.accountingDocument.delete({ where: { id } });
}

export type Seller = Omit<CompanyProfile, 'id' | 'updatedAt'>;
export type Buyer = Awaited<ReturnType<typeof buyerSnapshot>>;

/**
 * Seller as printed: the company profile at the time the document becomes final.
 * @returns {Promise<Seller>} Seller.
 */
export async function sellerSnapshot(): Promise<Seller> {
  const company = await getCompanyProfile();
  const { id: _id, updatedAt: _updatedAt, ...fields } = company;
  return fields;
}

/**
 * Buyer as printed: client details, service and contact at the time the document becomes final.
 * @param {AccountingDocument} document Document.
 * @returns {Promise<object>} Buyer (address of the service if it has one).
 */
export async function buyerSnapshot(document: AccountingDocument) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: document.clientId } });
  const service = document.serviceId ? await prisma.clientService.findUnique({ where: { id: document.serviceId } }) : null;
  const contact = document.contactId ? await prisma.clientContact.findUnique({ where: { id: document.contactId } }) : null;
  return {
    name: client.name,
    kind: client.kind,
    firstName: client.firstName,
    lastName: client.lastName,
    address: service?.address ?? client.address,
    email: client.email,
    phones: client.phones,
    vatNumber: client.vatNumber,
    siren: client.siren,
    siret: client.siret,
    activityCode: client.activityCode,
    service: service ? { name: service.name, email: service.email, phones: service.phones } : null,
    contact: contact ? { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, jobTitle: contact.jobTitle } : null,
  };
}

/**
 * Makes a draft final: the next number of its type and year is given (numbers follow each other without
 * gap), and the seller and buyer are frozen as printed. A final document cannot be changed any more.
 * @param {string} id Draft id.
 * @returns {Promise<AccountingDocument>} Final document.
 */
export async function finalizeDocument(id: string): Promise<AccountingDocument> {
  const document = await findDocument(id);
  if (document.status !== 'DRAFT') throw clientError('BAD_USER_INPUT', 'Seul un brouillon peut être validé.');
  const company = await getCompanyProfile();
  if (!company.name.trim()) throw clientError('BAD_USER_INPUT', 'Renseignez le nom de votre société (Paramètres › Société) avant de valider.');
  if (!document.lines.some((line) => line.kind !== 'TEXT')) throw clientError('BAD_USER_INPUT', 'Le document n’a aucune ligne chiffrée.');
  const totals = documentTotals(document);
  if (totals.totalGross < 0) throw clientError('BAD_USER_INPUT', 'Le total ne peut pas être négatif : établissez plutôt un avoir.');
  const year = document.issueDate.getUTCFullYear();
  const seller = await sellerSnapshot();
  const buyer = await buyerSnapshot(document);
  const toSend = await statusOf(scopeOf(document.type), 'TO_SEND');

  const final = await prisma.$transaction(async (tx) => {
    // The sequence row is locked until the end of the transaction: two validations never get the same number.
    await tx.$executeRaw`INSERT INTO "DocumentSequence" ("workspaceId", "type", "year", "nextNumber") VALUES (${currentWorkspaceId()}, ${document.type}::"AccountingDocumentType", ${year}, 1) ON CONFLICT DO NOTHING`;
    const [sequence] = await tx.$queryRaw<{ nextNumber: number }[]>`
      SELECT "nextNumber" FROM "DocumentSequence" WHERE "workspaceId" = ${currentWorkspaceId()} AND "type" = ${document.type}::"AccountingDocumentType" AND "year" = ${year} FOR UPDATE`;
    const counter = Math.max(sequence.nextNumber, (await usedCounter(document.type, year)) + 1);
    if (counter > 99_999) throw clientError('BAD_USER_INPUT', 'Numérotation épuisée pour cette année.');
    await tx.documentSequence.update({ where: { workspaceId_type_year: { workspaceId: currentWorkspaceId(), type: document.type, year } }, data: { nextNumber: counter + 1 } });
    return tx.accountingDocument.update({
      where: { id },
      data: {
        status: 'FINAL',
        year,
        counter,
        number: documentNumber(document.type, year, counter),
        seller: seller as Prisma.InputJsonValue,
        buyer: buyer as Prisma.InputJsonValue,
        finalizedAt: new Date(),
        trackingStatusId: toSend.id,
      },
    });
  });
  // A credit note settles its invoice (and is itself settled when it only lowers what was due).
  if (document.type === 'CREDIT_NOTE') await syncPaymentStatus([id, document.sourceId]);
  return final;
}

/**
 * Amounts excluding VAT per VAT rate already invoiced on a quote: its final invoices and deposit invoices,
 * minus the final credit notes on them.
 * @param {string} quoteId Quote.
 * @returns {Promise<{ number: string, rates: Map<number, number> }[]>} Invoiced bases (cents) per document.
 */
async function invoicedOnQuote(quoteId: string) {
  const invoices = await prisma.accountingDocument.findMany({
    where: { sourceId: quoteId, status: 'FINAL', type: { in: ['INVOICE', 'DEPOSIT_INVOICE'] } },
    include: { lines: true, derived: { where: { status: 'FINAL', type: 'CREDIT_NOTE' }, include: { lines: true } } },
    orderBy: { issueDate: 'asc' },
  });
  return invoices.map((invoice) => {
    const rates = new Map<number, number>();
    for (const item of documentTotals(invoice).vat) rates.set(item.rate, item.base);
    for (const credit of invoice.derived) {
      for (const item of documentTotals(credit).vat) rates.set(item.rate, (rates.get(item.rate) ?? 0) - item.base);
    }
    return { id: invoice.id, type: invoice.type, number: invoice.number ?? '', rates };
  });
}

/**
 * Amount excluding VAT already invoiced on a quote, in cents.
 * @param {string} quoteId Quote.
 * @returns {Promise<number>} Amount.
 */
export async function invoicedAmount(quoteId: string): Promise<number> {
  return (await invoicedOnQuote(quoteId)).reduce((sum, item) => sum + [...item.rates.values()].reduce((total, base) => total + base, 0), 0);
}

/**
 * Creates a draft from a final document: an invoice from a quote (its lines, minus what was already invoiced
 * on it), a deposit invoice from a quote (see createDepositInvoice), or a credit note from an invoice.
 * @param {string} sourceId Source document.
 * @param {AccountingDocumentType} type Type to create.
 * @param {object} [options] Options. Optional.
 * @param {number} [options.depositPercent] Deposit percentage. Optional.
 * @param {string} [options.issueDate] Date of the new document. Optional.
 * @returns {Promise<AccountingDocument>} Draft.
 */
export async function createFromDocument(
  sourceId: string,
  type: AccountingDocumentType,
  options: { depositPercent?: number | null; issueDate: string },
): Promise<AccountingDocument> {
  requirePro('facturation');
  const source = await findDocument(sourceId);
  if (source.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Validez d’abord le document d’origine.');
  const allowed =
    (source.type === 'QUOTE' && (type === 'INVOICE' || type === 'DEPOSIT_INVOICE')) ||
    ((source.type === 'INVOICE' || source.type === 'DEPOSIT_INVOICE') && type === 'CREDIT_NOTE');
  if (!allowed) throw clientError('BAD_USER_INPUT', 'Ce document ne peut pas être créé à partir de celui-ci.');
  if (type === 'DEPOSIT_INVOICE') return createDepositInvoice({ quoteId: source.id, percent: options.depositPercent ?? 30, issueDate: options.issueDate });

  const defaults = await defaultFields(type, source.clientId, options.issueDate);
  const sourceLines = source.lines.map(lineInput);
  let lines: AccountingLineInput[];
  let title = source.title;

  if (type === 'INVOICE') {
    const deductions: AccountingLineInput[] = (await invoicedOnQuote(source.id)).flatMap(({ id, type: invoicedType, number, rates }) =>
      [...rates.entries()]
        .filter(([, base]) => base !== 0)
        .map(([rate, base]) => ({
          kind: 'DEDUCTION' as const,
          title: `Déjà facturé : ${number}`,
          description: null,
          quantity: 1,
          unit: 'FLAT' as const,
          unitPrice: fromCents(base),
          vatRate: rate,
          discountType: null,
          discountValue: null,
          // A deposit is deducted explicitly, linked to its invoice.
          deductedDocumentId: invoicedType === 'DEPOSIT_INVOICE' ? id : null,
        })),
    );
    lines = [...sourceLines.filter((line) => line.kind !== 'DEDUCTION'), ...deductions];
  } else {
    lines = sourceLines;
    title = `Avoir sur la facture ${source.number}`;
  }

  // An invoice keeps the terms agreed on its quote.
  const fromQuote = source.type === 'QUOTE';
  const paymentTerms = fromQuote ? (source.paymentTerms ?? defaults.paymentTerms) : defaults.paymentTerms;
  return createDocument(
    type,
    {
      ...defaults,
      ...(fromQuote && {
        paymentTerms,
        paymentMethods: source.paymentMethods ?? defaults.paymentMethods,
        lateInterest: source.lateInterest ?? defaults.lateInterest,
        dueDate: dueDateForTerms(paymentTerms ?? null, options.issueDate) ?? defaults.dueDate,
      }),
      serviceId: source.serviceId,
      contactId: source.contactId,
      projectId: source.projectId,
      serviceStart: source.serviceStart ? formatDay(source.serviceStart) : null,
      serviceEnd: source.serviceEnd ? formatDay(source.serviceEnd) : null,
      title,
      referenceLabel: source.referenceLabel,
      referenceValue: source.referenceValue,
      vatApplicable: source.vatApplicable,
      globalDiscountType: source.globalDiscountType,
      globalDiscountValue: source.globalDiscountValue === null ? null : Number(source.globalDiscountValue),
      lines,
    },
    { sourceId: source.id },
  );
}

/**
 * Line of a deposit invoice: « Acompte de 30 % pour le devis D2600004 de 5 100,00 € HT du 12/10/2026 ».
 * @param {number} percent Percentage of the quote.
 * @param {{ number: string | null, totalNet: number, currency: string, issueDate: Date }} quote Quote (total in cents).
 * @param {number} amount Amount excluding VAT, in cents.
 * @param {number} vatRate VAT rate.
 * @returns {AccountingLineInput} Line.
 */
function depositLine(percent: number, quote: { number: string | null; totalNet: number; currency: string; issueDate: Date }, amount: number, vatRate: number): AccountingLineInput {
  const day = formatDay(quote.issueDate).split('-').reverse().join('/');
  return {
    kind: 'ITEM',
    title: `Acompte de ${percent.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} % pour le devis ${quote.number ?? ''} de ${formatMoney(quote.totalNet, quote.currency)} HT du ${day}`,
    description: null,
    quantity: 1,
    unit: 'DEPOSIT',
    unitPrice: fromCents(amount),
    vatRate,
    discountType: null,
    discountValue: null,
  };
}

/** VAT rates an imported quote's rate is matched to (its own rate is only known from its totals). */
const VAT_RATES = [20, 10, 8.5, 5.5, 2.1, 0];

/**
 * Creates the draft of a deposit invoice from a quote, final in Ordo or imported: a percentage of the quote's
 * total excluding VAT, as one line « Acompte de N % pour le devis … de … HT du … ». A quote of Ordo with
 * several VAT rates gets one such line per rate (the VAT of a deposit follows that of the quote).
 * @param {object} input Deposit.
 * @param {string} [input.quoteId] Quote of Ordo. Optional.
 * @param {string} [input.importedQuoteId] Imported quote. Optional.
 * @param {number} input.percent Percentage of the quote (above 0, up to 100).
 * @param {string} input.issueDate Date of the deposit invoice.
 * @returns {Promise<AccountingDocument>} Draft.
 */
export async function createDepositInvoice(input: { quoteId?: string | null; importedQuoteId?: string | null; percent: number; issueDate: string }): Promise<AccountingDocument> {
  requirePro('facturation');
  const { percent, issueDate } = input;
  if (!(percent > 0 && percent <= 100)) throw clientError('BAD_USER_INPUT', 'Pourcentage d’acompte invalide (plus de 0 et jusqu’à 100 %).');

  if (input.quoteId) {
    const quote = await findDocument(input.quoteId);
    if (quote.type !== 'QUOTE' || quote.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Une facture d’acompte s’établit à partir d’un devis validé.');
    const totals = documentTotals(quote);
    const reference = { number: quote.number, totalNet: totals.totalNet, currency: quote.currency, issueDate: quote.issueDate };
    const bases = totals.vat.filter((item) => item.base > 0);
    const lines =
      bases.length <= 1
        ? [depositLine(percent, reference, Math.round((totals.totalNet * percent) / 100), bases[0]?.rate ?? 0)]
        : bases.map((item) => ({ ...depositLine(percent, reference, Math.round((item.base * percent) / 100), item.rate), description: `Part soumise à la TVA à ${item.rate.toLocaleString('fr-FR')} %` }));
    const defaults = await defaultFields('DEPOSIT_INVOICE', quote.clientId, issueDate);
    // A deposit keeps the terms agreed on its quote.
    const paymentTerms = quote.paymentTerms ?? defaults.paymentTerms;
    return createDocument(
      'DEPOSIT_INVOICE',
      {
        ...defaults,
        paymentTerms,
        paymentMethods: quote.paymentMethods ?? defaults.paymentMethods,
        lateInterest: quote.lateInterest ?? defaults.lateInterest,
        dueDate: dueDateForTerms(paymentTerms ?? null, issueDate) ?? defaults.dueDate,
        serviceId: quote.serviceId,
        contactId: quote.contactId,
        projectId: quote.projectId,
        title: quote.title ?? `Acompte — devis ${quote.number}`,
        referenceLabel: quote.referenceLabel,
        referenceValue: quote.referenceValue,
        vatApplicable: quote.vatApplicable,
        lines,
      },
      { sourceId: quote.id },
    );
  }

  const imported = input.importedQuoteId ? await prisma.importedDocument.findUnique({ where: { id: input.importedQuoteId } }) : null;
  if (!imported) throw clientError('BAD_USER_INPUT', 'Une facture d’acompte s’établit à partir d’un devis.');
  if (imported.type !== 'QUOTE') throw clientError('BAD_USER_INPUT', 'Une facture d’acompte s’établit à partir d’un devis.');
  if (!imported.clientId) throw clientError('BAD_USER_INPUT', 'Rattachez d’abord le devis importé à un client.');
  const totalNet = Math.round(Number(imported.totalNet) * 100);
  const totalVat = Math.round(Number(imported.totalVat) * 100);
  // The rate of the quote, from its totals, matched to the nearest usual rate.
  const rate = totalNet > 0 ? (totalVat / totalNet) * 100 : 0;
  const vatRate = VAT_RATES.reduce((best, item) => (Math.abs(item - rate) < Math.abs(best - rate) ? item : best), VAT_RATES[0]);
  const defaults = await defaultFields('DEPOSIT_INVOICE', imported.clientId, issueDate);
  return createDocument(
    'DEPOSIT_INVOICE',
    {
      ...defaults,
      projectId: imported.projectId,
      title: imported.title ?? `Acompte — devis ${imported.number}`,
      vatApplicable: totalVat > 0,
      lines: [depositLine(percent, { number: imported.number, totalNet, currency: imported.currency, issueDate: imported.issueDate }, Math.round((totalNet * percent) / 100), totalVat > 0 ? vatRate : 0)],
    },
    { importedSourceId: imported.id },
  );
}

/**
 * Copies a document as a new draft of the same type, dated today.
 * @param {string} id Document id.
 * @param {string} issueDate Date of the copy.
 * @returns {Promise<AccountingDocument>} Draft.
 */
export async function duplicateDocument(id: string, issueDate: string): Promise<AccountingDocument> {
  const source = await findDocument(id);
  // A deposit invoice stays tied to its quote.
  const deposit = source.type === 'DEPOSIT_INVOICE';
  return createDocument(
    source.type,
    { ...(await editableFields(source)), issueDate, dueDate: null },
    { sourceId: deposit ? source.sourceId : null, importedSourceId: deposit ? source.importedSourceId : null },
  );
}

/**
 * Editable fields of a stored document.
 * @param {DocumentWithLines} document Document.
 * @returns {Promise<AccountingDocumentInput>} Fields.
 */
export async function editableFields(document: DocumentWithLines): Promise<AccountingDocumentInput> {
  const day = (value: Date | null) => (value ? formatDay(value) : null);
  return {
    clientId: document.clientId,
    serviceId: document.serviceId,
    contactId: document.contactId,
    projectId: document.projectId,
    issueDate: formatDay(document.issueDate),
    dueDate: day(document.dueDate),
    serviceStart: day(document.serviceStart),
    serviceEnd: day(document.serviceEnd),
    title: document.title,
    introduction: document.introduction,
    referenceLabel: document.referenceLabel,
    referenceValue: document.referenceValue,
    conclusion: document.conclusion,
    paymentTerms: document.paymentTerms,
    paymentMethods: document.paymentMethods,
    depositType: document.depositType,
    depositValue: document.depositValue === null ? null : Number(document.depositValue),
    lateInterest: document.lateInterest,
    billingSchedule: document.billingSchedule,
    otherMentions: document.otherMentions,
    showBankDetails: document.showBankDetails,
    vatApplicable: document.vatApplicable,
    globalDiscountType: document.globalDiscountType,
    globalDiscountValue: document.globalDiscountValue === null ? null : Number(document.globalDiscountValue),
    lines: document.lines.map(lineInput),
  };
}

/**
 * Attaches files to a document (drafts and final documents alike: they are not part of it).
 * @param {string} id Document id.
 * @param {File[]} files Files.
 * @returns {Promise<void>}
 */
export async function addDocumentAttachments(id: string, files: File[]): Promise<void> {
  await findDocument(id);
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) throw clientError('BAD_USER_INPUT', `« ${file.name} » est trop lourd (10 Mo maximum).`);
    await prisma.attachment.create({ data: { ...attachmentData(file.name, Buffer.from(await file.arrayBuffer())), accountingDocumentId: id } });
  }
}

/**
 * Removes a file from a document.
 * @param {string} attachmentId File.
 * @returns {Promise<void>}
 */
export async function removeDocumentAttachment(attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { accountingDocumentId: true } });
  if (!attachment?.accountingDocumentId) throw notFound('Pièce jointe');
  await prisma.attachment.delete({ where: { id: attachmentId } });
}

/** Deposit invoice of a client with what is left to deduct from it. */
export interface DeductibleDeposit {
  id: string;
  number: string;
  issueDate: Date;
  /** Total including VAT, in cents. */
  totalGross: number;
  /** Amounts excluding VAT left to deduct, per VAT rate, in cents. */
  remaining: { rate: number; base: number }[];
}

/**
 * Final deposit invoices of a client not deducted in full yet: their amounts excluding VAT per rate, less their
 * credit notes and the deductions of the other documents (drafts included, the document being edited left out;
 * final credit notes giving back those of the invoices they cancel).
 * @param {string} clientId Client.
 * @param {string | null} documentId Document being edited (its own deductions do not count).
 * @returns {Promise<DeductibleDeposit[]>} Deposits, oldest first.
 */
export async function deductibleDeposits(clientId: string, documentId: string | null): Promise<DeductibleDeposit[]> {
  const deposits = await prisma.accountingDocument.findMany({
    where: { clientId, type: 'DEPOSIT_INVOICE', status: 'FINAL' },
    include: {
      lines: true,
      derived: { where: { status: 'FINAL', type: 'CREDIT_NOTE' }, include: { lines: true } },
      deductedBy: {
        where: documentId ? { documentId: { not: documentId } } : {},
        select: { quantity: true, unitPrice: true, vatRate: true, document: { select: { type: true, status: true } } },
      },
    },
    orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
  });
  return deposits.flatMap((deposit) => {
    const left = new Map<number, number>();
    for (const item of documentTotals(deposit).vat) left.set(item.rate, (left.get(item.rate) ?? 0) + item.base);
    for (const credit of deposit.derived) for (const item of documentTotals(credit).vat) left.set(item.rate, (left.get(item.rate) ?? 0) - item.base);
    for (const line of deposit.deductedBy) {
      // A final credit note cancelling an invoice gives its deduction back; a draft one does not count yet.
      const credit = line.document.type === 'CREDIT_NOTE';
      if (credit && line.document.status !== 'FINAL') continue;
      const rate = Number(line.vatRate);
      const amount = Math.round(Number(line.quantity) * toCents(Number(line.unitPrice)));
      left.set(rate, (left.get(rate) ?? 0) + (credit ? amount : -amount));
    }
    const remaining = [...left.entries()].filter(([, base]) => base > 0).map(([rate, base]) => ({ rate, base }));
    return remaining.length ? [{ id: deposit.id, number: deposit.number ?? '', issueDate: deposit.issueDate, totalGross: documentTotals(deposit).totalGross, remaining }] : [];
  });
}
