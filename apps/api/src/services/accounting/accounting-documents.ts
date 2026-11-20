import {
  type AccountingDocumentInput,
  accountingDocumentInputSchema,
  documentName,
  type AccountingDocumentType,
  type AccountingLineInput,
  addDays,
  byPosition,
  computeTotals,
  documentNumber,
  dueDateForTerms,
  formatDay,
  formatMoney,
  formatOptionalDay,
  formatPercent,
  fromCents,
  parseDay,
  parseOptionalDay,
  percentOf,
  printedDay,
  sumOf,
  toCents,
  INVOICE_TYPES,
  isInvoice,
  withoutBlankLines,
} from '@ordo/shared';
import { prisma } from '../../db';
import { currentWorkspaceId } from '../../workspace-context';
import { Prisma, type AccountingDocument, type AccountingLine, type CompanyProfile } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { deleteAttachment, storeAttachment } from '../core/attachments';
import { getCompanyProfile, usedCounter } from './company';
import { scopeOf, statusOf } from './document-statuses';
import { syncPaymentStatus } from './document-tracking';
import { requirePro } from '../workspaces/workspaces';
import { assertActive, assertNotArchived, refuseArchived } from '../core/archive';
import { findOrNotFound } from '../core/lookup';
import { decimalCents, fromDecimal, toDecimal } from '../core/decimal';
import { BY_POSITION } from '../core/ordering';
import { toJson } from '../core/json';
import { assertService } from './client-parties';

export type DocumentWithLines = AccountingDocument & { lines: AccountingLine[] };

/**
 * Line fields of a stored line (decimals as numbers).
 * @param {AccountingLine} line Stored line.
 * @returns {AccountingLineInput} Line.
 */
export function lineInput(line: AccountingLine): AccountingLineInput {
  return {
    kind: line.kind,
    label: line.label,
    description: line.description,
    quantity: fromDecimal(line.quantity),
    unit: line.unit,
    unitPrice: fromDecimal(line.unitPrice),
    vatRate: fromDecimal(line.vatRate),
    discountType: line.discountType,
    discountValue: fromDecimal(line.discountValue),
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
    lines: [...document.lines].sort(byPosition).map(lineInput),
    globalDiscountType: document.globalDiscountType,
    globalDiscountValue: fromDecimal(document.globalDiscountValue),
    vatApplicable: document.vatApplicable,
  });
}

/**
 * Loads a document with its lines or throws NOT_FOUND.
 * @param {string} id Document id.
 * @returns {Promise<DocumentWithLines>} Document.
 */
export function findDocument(id: string): Promise<DocumentWithLines> {
  return orNotFound(prisma.accountingDocument.findUnique({ where: { id }, include: { lines: { orderBy: BY_POSITION } } }), 'Document');
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

/** Client and project a document already has (or copies from its source): kept even if archived. */
type KeptParties = { clientId: string | null; projectId: string | null } | null;

/**
 * Checks the client of a document and the service, contact and project chosen with it (an archived client or project
 * is refused, unless the document already has it).
 * @param {object} refs References.
 * @param {string} refs.clientId Client.
 * @param {string | null} refs.serviceId Service.
 * @param {string | null} refs.contactId Contact.
 * @param {string | null} refs.projectId Project.
 * @param {KeptParties} [kept] Client and project already there. Optional. Default = none.
 * @returns {Promise<void>}
 */
async function assertParties(
  { clientId, serviceId, contactId, projectId }: { clientId: string; serviceId: string | null; contactId: string | null; projectId: string | null },
  kept: KeptParties = null,
) {
  await assertActive(prisma.client, clientId, 'Client', { keep: kept?.clientId, field: 'clientId' });
  await assertService(serviceId, clientId);
  if (contactId && (await prisma.clientContact.findUnique({ where: { id: contactId } }))?.clientId !== clientId) {
    throw fieldError('contactId', 'Ce contact n’appartient pas au client.');
  }
  await assertActive(prisma.project, projectId, 'Projet', { keep: kept?.projectId, field: 'projectId' });
}

type Client = Prisma.TransactionClient | typeof prisma;

/** A document of each type, to tell it in messages. */
const TYPE_NAMES: Record<AccountingDocumentType, string> = {
  QUOTE: 'le dernier devis',
  INVOICE: 'la dernière facture',
  DEPOSIT_INVOICE: 'la dernière facture d’acompte',
  CREDIT_NOTE: 'le dernier avoir',
};

/**
 * Date of the latest document of a type: final in Ordo (another one than a document), or imported.
 * @param {AccountingDocumentType} type Type.
 * @param {string | null} exceptId Document left out (the one being dated).
 * @param {Client} [client] Prisma client or transaction. Optional.
 * @returns {Promise<string | null>} YYYY-MM-DD, none without documents.
 */
export async function latestIssueDate(type: AccountingDocumentType, exceptId: string | null, client: Client = prisma): Promise<string | null> {
  const [own, imported] = await Promise.all([
    client.accountingDocument.aggregate({ where: { type, status: 'FINAL', ...(exceptId ? { id: { not: exceptId } } : {}) }, _max: { issueDate: true } }),
    client.importedDocument.aggregate({ where: { type }, _max: { issueDate: true } }),
  ]);
  const dates = [own._max.issueDate, imported._max.issueDate].filter((date): date is Date => date !== null).map(formatDay);
  return dates.length ? dates.sort().at(-1)! : null;
}

/**
 * Checks that a document is not dated before the latest one of its type: documents follow each other in time as
 * their numbers do.
 * @param {AccountingDocumentType} type Type.
 * @param {string} issueDate Date of the document.
 * @param {string | null} id Document (null when created).
 * @param {Client} [client] Prisma client or transaction. Optional.
 * @returns {Promise<void>}
 */
async function assertChronology(type: AccountingDocumentType, issueDate: string, id: string | null, client: Client = prisma): Promise<void> {
  const latest = await latestIssueDate(type, id, client);
  if (latest && issueDate < latest) {
    const message = `La date ne peut pas précéder celle de ${TYPE_NAMES[type]} (${printedDay(latest)}).`;
    throw fieldError('issueDate', message);
  }
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
  if (billed) throw clientError('BAD_USER_INPUT', `Une partie de ce temps est déjà facturée (« ${documentName(billed.document?.number)} »).`);
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
    quantity: toDecimal(line.quantity),
    unitPrice: toDecimal(line.unitPrice),
    vatRate: toDecimal(line.vatRate),
    discountValue: toDecimal(line.discountValue),
  }));
}

/**
 * Fields of a document checked, its blank lines dropped (`withoutBlankLines`: a line left as added is not saved).
 * @param {AccountingDocumentInput} input Fields.
 * @returns {ReturnType<typeof accountingDocumentInputSchema.parse>} Fields.
 */
function parseDocumentInput(input: AccountingDocumentInput) {
  const fields = parseInput(accountingDocumentInputSchema, input);
  return { ...fields, lines: withoutBlankLines(fields.lines) };
}

/**
 * Scalar data of validated document fields, with their totals.
 * @param {ReturnType<typeof accountingDocumentInputSchema.parse>} input Fields.
 * @returns {object} Prisma data.
 */
function documentData(input: ReturnType<typeof accountingDocumentInputSchema.parse>) {
  const { lines, issueDate, dueDate, serviceStart, serviceEnd, globalDiscountValue, depositValue, timeEntryIds: _timeEntryIds, ...rest } = input;
  const totals = computeTotals({ lines, globalDiscountType: input.globalDiscountType, globalDiscountValue, vatApplicable: input.vatApplicable });
  return {
    ...rest,
    issueDate: parseDay(issueDate),
    dueDate: parseOptionalDay(dueDate),
    serviceStart: parseOptionalDay(serviceStart),
    serviceEnd: parseOptionalDay(serviceEnd),
    globalDiscountValue: toDecimal(globalDiscountValue),
    depositType: depositValue ? input.depositType : null,
    depositValue: depositValue && input.depositType ? toDecimal(depositValue) : null,
    totalNet: toDecimal(fromCents(totals.totalNet)),
    totalVat: toDecimal(fromCents(totals.totalVat)),
    totalGross: toDecimal(fromCents(totals.totalGross)),
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
    dueDate: isCreditNote ? null : isQuote ? addDays(issueDate, company.quoteValidityDays) : (dueDateForTerms(company.paymentTerms, issueDate) ?? addDays(issueDate, company.paymentDays)),
    serviceStart: null,
    serviceEnd: null,
    label: null,
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
 * @param {object} [extra] Source document, recurring origin or status, and whether the client and project are copied from a source (then kept even if archived). Optional.
 * @returns {Promise<AccountingDocument>} Draft.
 */
export async function createDocument(
  type: AccountingDocumentType,
  input: AccountingDocumentInput,
  extra: { sourceId?: string | null; importedSourceId?: string | null; recurringId?: string | null; status?: 'DRAFT' | 'TEMPLATE'; inherited?: boolean } = {},
): Promise<AccountingDocument> {
  requirePro('facturation');
  const fields = parseDocumentInput(input);
  await assertParties(fields, extra.inherited ? fields : null);
  await assertDeductions(fields.lines, fields.clientId);
  // A model of recurring invoices is dated when its invoices are made.
  if (extra.status !== 'TEMPLATE') await assertChronology(type, fields.issueDate, null);
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
  refuseArchived(document);
  // The model of a recurring invoice is read only with it.
  if (document.status === 'TEMPLATE') await assertNotArchived('RECURRING_INVOICE', (await prisma.recurringInvoice.findFirst({ where: { templateId: id }, select: { id: true } }))?.id);
  const fields = parseDocumentInput(input);
  await assertParties(fields, document);
  await assertDeductions(fields.lines, fields.clientId);
  if (document.status === 'DRAFT') await assertChronology(document.type, fields.issueDate, id);
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

export type Seller = Omit<CompanyProfile, 'id' | 'updatedAt' | 'invoiceCategoryId' | 'creditNoteCategoryId'>;
export type Buyer = Awaited<ReturnType<typeof buyerSnapshot>>;

/**
 * Seller as printed: the company profile at the time the document becomes final.
 * @returns {Promise<Seller>} Seller.
 */
export async function sellerSnapshot(): Promise<Seller> {
  const company = await getCompanyProfile();
  // Treasury settings are no part of the documents.
  const { id: _id, updatedAt: _updatedAt, invoiceCategoryId: _invoice, creditNoteCategoryId: _creditNote, ...fields } = company;
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
    service: service ? { label: service.label, email: service.email, phones: service.phones } : null,
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
  refuseArchived(document);
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
    // Checked again under the lock: another document of the type may have been validated meanwhile.
    await assertChronology(document.type, formatDay(document.issueDate), id, tx);
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
        seller: toJson(seller),
        buyer: toJson(buyer),
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
  return (await invoicedOnQuotes([quoteId])).get(quoteId) ?? [];
}

/**
 * What was invoiced on several quotes (see `invoicedOnQuote`), in one query.
 * @param {string[]} quoteIds Quotes.
 * @returns {Promise<Map<string, { id: string, type: AccountingDocumentType, number: string, rates: Map<number, number> }[]>>} Invoices of each quote that has some.
 */
async function invoicedOnQuotes(quoteIds: string[]) {
  const invoices = await prisma.accountingDocument.findMany({
    where: { sourceId: { in: quoteIds }, status: 'FINAL', type: { in: [...INVOICE_TYPES] } },
    include: { lines: true, derived: { where: { status: 'FINAL', type: 'CREDIT_NOTE' }, include: { lines: true } } },
    orderBy: { issueDate: 'asc' },
  });
  const byQuote = new Map<string, { id: string; type: AccountingDocumentType; number: string; rates: Map<number, number> }[]>();
  for (const invoice of invoices) {
    if (!invoice.sourceId) continue;
    const rates = new Map<number, number>();
    for (const item of documentTotals(invoice).vat) rates.set(item.rate, item.base);
    for (const credit of invoice.derived) {
      for (const item of documentTotals(credit).vat) rates.set(item.rate, (rates.get(item.rate) ?? 0) - item.base);
    }
    const items = byQuote.get(invoice.sourceId) ?? [];
    items.push({ id: invoice.id, type: invoice.type, number: invoice.number ?? '', rates });
    byQuote.set(invoice.sourceId, items);
  }
  return byQuote;
}

/**
 * Amount excluding VAT already invoiced on each of several quotes, in cents, in one query.
 * @param {string[]} quoteIds Quotes.
 * @returns {Promise<number[]>} Amounts, in the order of the quotes.
 */
export async function invoicedAmounts(quoteIds: string[]): Promise<number[]> {
  const invoiced = await invoicedOnQuotes(quoteIds);
  return quoteIds.map((id) => sumOf(invoiced.get(id) ?? [], (item) => sumOf([...item.rates.values()], (base) => base)));
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
export async function createFromDocument(sourceId: string, type: AccountingDocumentType, options: { depositPercent?: number | null; issueDate: string }): Promise<AccountingDocument> {
  requirePro('facturation');
  const source = await findDocument(sourceId);
  if (source.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Validez d’abord le document d’origine.');
  refuseArchived(source);
  const allowed = (source.type === 'QUOTE' && isInvoice(type)) || (isInvoice(source.type) && type === 'CREDIT_NOTE');
  if (!allowed) throw clientError('BAD_USER_INPUT', 'Ce document ne peut pas être créé à partir de celui-ci.');
  if (type === 'DEPOSIT_INVOICE') return createDepositInvoice({ quoteId: source.id, percent: options.depositPercent ?? 30, issueDate: options.issueDate });

  const defaults = await defaultFields(type, source.clientId, options.issueDate);
  const sourceLines = source.lines.map(lineInput);
  let lines: AccountingLineInput[];
  let label = source.label;

  if (type === 'INVOICE') {
    const deductions: AccountingLineInput[] = (await invoicedOnQuote(source.id)).flatMap(({ id, type: invoicedType, number, rates }) =>
      [...rates.entries()]
        .filter(([, base]) => base !== 0)
        .map(([rate, base]) => ({
          kind: 'DEDUCTION' as const,
          label: `Déjà facturé : ${number}`,
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
    label = `Avoir sur la facture ${source.number}`;
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
      serviceStart: formatOptionalDay(source.serviceStart),
      serviceEnd: formatOptionalDay(source.serviceEnd),
      label,
      referenceLabel: source.referenceLabel,
      referenceValue: source.referenceValue,
      vatApplicable: source.vatApplicable,
      globalDiscountType: source.globalDiscountType,
      globalDiscountValue: fromDecimal(source.globalDiscountValue),
      lines,
    },
    { sourceId: source.id, inherited: true },
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
  const day = printedDay(quote.issueDate);
  return {
    kind: 'ITEM',
    label: `Acompte de ${formatPercent(percent)} pour le devis ${quote.number ?? ''} de ${formatMoney(quote.totalNet, quote.currency)} HT du ${day}`,
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
    refuseArchived(quote);
    const totals = documentTotals(quote);
    const reference = { number: quote.number, totalNet: totals.totalNet, currency: quote.currency, issueDate: quote.issueDate };
    const bases = totals.vat.filter((item) => item.base > 0);
    const lines =
      bases.length <= 1
        ? [depositLine(percent, reference, percentOf(totals.totalNet, percent), bases[0]?.rate ?? 0)]
        : bases.map((item) => ({ ...depositLine(percent, reference, percentOf(item.base, percent), item.rate), description: `Part soumise à la TVA à ${formatPercent(item.rate, 3)}` }));
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
        label: quote.label ?? `Acompte — devis ${quote.number}`,
        referenceLabel: quote.referenceLabel,
        referenceValue: quote.referenceValue,
        vatApplicable: quote.vatApplicable,
        lines,
      },
      { sourceId: quote.id, inherited: true },
    );
  }

  const imported = input.importedQuoteId ? await findOrNotFound(prisma.importedDocument, input.importedQuoteId, 'Document importé') : null;
  if (imported?.type !== 'QUOTE') throw clientError('BAD_USER_INPUT', 'Une facture d’acompte s’établit à partir d’un devis.');
  if (!imported.clientId) throw clientError('BAD_USER_INPUT', 'Rattachez d’abord le devis importé à un client.');
  refuseArchived(imported);
  const totalNet = decimalCents(imported.totalNet);
  const totalVat = decimalCents(imported.totalVat);
  // The rate of the quote, from its totals, matched to the nearest usual rate.
  const rate = totalNet > 0 ? (totalVat / totalNet) * 100 : 0;
  const vatRate = VAT_RATES.reduce((best, item) => (Math.abs(item - rate) < Math.abs(best - rate) ? item : best), VAT_RATES[0]);
  const defaults = await defaultFields('DEPOSIT_INVOICE', imported.clientId, issueDate);
  return createDocument(
    'DEPOSIT_INVOICE',
    {
      ...defaults,
      projectId: imported.projectId,
      label: imported.label ?? `Acompte — devis ${imported.number}`,
      vatApplicable: totalVat > 0,
      lines: [depositLine(percent, { number: imported.number, totalNet, currency: imported.currency, issueDate: imported.issueDate }, percentOf(totalNet, percent), totalVat > 0 ? vatRate : 0)],
    },
    { importedSourceId: imported.id, inherited: true },
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
  refuseArchived(source);
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
  return {
    clientId: document.clientId,
    serviceId: document.serviceId,
    contactId: document.contactId,
    projectId: document.projectId,
    issueDate: formatDay(document.issueDate),
    dueDate: formatOptionalDay(document.dueDate),
    serviceStart: formatOptionalDay(document.serviceStart),
    serviceEnd: formatOptionalDay(document.serviceEnd),
    label: document.label,
    introduction: document.introduction,
    referenceLabel: document.referenceLabel,
    referenceValue: document.referenceValue,
    conclusion: document.conclusion,
    paymentTerms: document.paymentTerms,
    paymentMethods: document.paymentMethods,
    depositType: document.depositType,
    depositValue: fromDecimal(document.depositValue),
    lateInterest: document.lateInterest,
    billingSchedule: document.billingSchedule,
    otherMentions: document.otherMentions,
    showBankDetails: document.showBankDetails,
    vatApplicable: document.vatApplicable,
    globalDiscountType: document.globalDiscountType,
    globalDiscountValue: fromDecimal(document.globalDiscountValue),
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
  refuseArchived(await findDocument(id));
  for (const file of files) {
    await storeAttachment(file, { accountingDocumentId: id });
  }
}

/**
 * Moves a document to a project, or out of any: drafts and final documents alike (the project is not printed on it).
 * @param {string} id Document id.
 * @param {string | null} projectId Project, null for none.
 * @returns {Promise<void>}
 */
export async function setDocumentProject(id: string, projectId: string | null): Promise<void> {
  const document = await findDocument(id);
  refuseArchived(document);
  await assertActive(prisma.project, projectId, 'Projet', { keep: document.projectId });
  await prisma.accountingDocument.update({ where: { id }, data: { projectId } });
}

/**
 * Removes a file from a document.
 * @param {string} attachmentId File.
 * @returns {Promise<void>}
 */
export async function removeDocumentAttachment(attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId }, select: { accountingDocumentId: true } });
  if (!attachment?.accountingDocumentId) throw notFound('Pièce jointe');
  await assertNotArchived('ACCOUNTING_DOCUMENT', attachment.accountingDocumentId);
  await deleteAttachment(attachmentId);
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
      const rate = fromDecimal(line.vatRate);
      const amount = toCents(fromDecimal(line.quantity) * fromDecimal(line.unitPrice));
      left.set(rate, (left.get(rate) ?? 0) + (credit ? amount : -amount));
    }
    const remaining = [...left.entries()].filter(([, base]) => base > 0).map(([rate, base]) => ({ rate, base }));
    return remaining.length ? [{ id: deposit.id, number: deposit.number ?? '', issueDate: deposit.issueDate, totalGross: documentTotals(deposit).totalGross, remaining }] : [];
  });
}
