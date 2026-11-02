import {
  accountingDocumentInputSchema,
  addDays,
  computeTotals,
  documentNumber,
  fromCents,
  formatDay,
  parseDay,
  type AccountingDocumentInput,
  type AccountingDocumentType,
  type AccountingLineInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type AccountingDocument, type AccountingLine, type CompanyProfile } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { attachmentData } from './attachments';
import { getCompanyProfile, usedCounter } from './company';

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
 * Prisma data of the lines of a document.
 * @param {AccountingLineInput[]} lines Lines.
 * @returns {Prisma.AccountingLineCreateWithoutDocumentInput[]} Lines data.
 */
function linesData(lines: AccountingLineInput[]): Prisma.AccountingLineCreateWithoutDocumentInput[] {
  return lines.map((line, position) => ({
    ...line,
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
  const { lines, issueDate, dueDate, serviceStart, serviceEnd, globalDiscountValue, ...rest } = input;
  const totals = computeTotals({ lines, globalDiscountType: input.globalDiscountType, globalDiscountValue, vatApplicable: input.vatApplicable });
  const day = (value: string | null) => (value ? parseDay(value) : null);
  return {
    ...rest,
    issueDate: parseDay(issueDate),
    dueDate: day(dueDate),
    serviceStart: day(serviceStart),
    serviceEnd: day(serviceEnd),
    globalDiscountValue: globalDiscountValue === null ? null : new Prisma.Decimal(globalDiscountValue),
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
  return {
    clientId,
    serviceId: null,
    contactId: null,
    projectId: null,
    issueDate,
    dueDate: type === 'CREDIT_NOTE' ? null : addDays(issueDate, isQuote ? company.quoteValidityDays : company.paymentDays),
    serviceStart: null,
    serviceEnd: null,
    title: null,
    introduction: null,
    referenceLabel: company.referenceLabel,
    referenceValue: null,
    conclusion: null,
    paymentTerms: isQuote ? null : company.paymentTerms,
    paymentMethods: company.paymentMethods,
    lateInterest: isQuote ? null : company.lateInterest,
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
  extra: { sourceId?: string | null; recurringId?: string | null; status?: 'DRAFT' | 'TEMPLATE' } = {},
): Promise<AccountingDocument> {
  const fields = parseInput(accountingDocumentInputSchema, input);
  await assertParties(fields);
  const company = await getCompanyProfile();
  return prisma.accountingDocument.create({
    data: {
      ...documentData(fields),
      type,
      status: extra.status ?? 'DRAFT',
      sourceId: extra.sourceId ?? null,
      recurringId: extra.recurringId ?? null,
      vatExemptionText: company.vatExemptionText,
      lines: { create: linesData(fields.lines) },
    },
  });
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
  return prisma.$transaction(async (tx) => {
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

  return prisma.$transaction(async (tx) => {
    // The sequence row is locked until the end of the transaction: two validations never get the same number.
    await tx.$executeRaw`INSERT INTO "DocumentSequence" ("type", "year", "nextNumber") VALUES (${document.type}::"AccountingDocumentType", ${year}, 1) ON CONFLICT DO NOTHING`;
    const [sequence] = await tx.$queryRaw<{ nextNumber: number }[]>`
      SELECT "nextNumber" FROM "DocumentSequence" WHERE "type" = ${document.type}::"AccountingDocumentType" AND "year" = ${year} FOR UPDATE`;
    const counter = Math.max(sequence.nextNumber, (await usedCounter(document.type, year)) + 1);
    if (counter > 99_999) throw clientError('BAD_USER_INPUT', 'Numérotation épuisée pour cette année.');
    await tx.documentSequence.update({ where: { type_year: { type: document.type, year } }, data: { nextNumber: counter + 1 } });
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
      },
    });
  });
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
    return { number: invoice.number ?? '', rates };
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
 * on it), a deposit invoice from a quote (a percentage of each VAT base), or a credit note from an invoice.
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
  const source = await findDocument(sourceId);
  if (source.status !== 'FINAL') throw clientError('BAD_USER_INPUT', 'Validez d’abord le document d’origine.');
  const allowed =
    (source.type === 'QUOTE' && (type === 'INVOICE' || type === 'DEPOSIT_INVOICE')) ||
    ((source.type === 'INVOICE' || source.type === 'DEPOSIT_INVOICE') && type === 'CREDIT_NOTE');
  if (!allowed) throw clientError('BAD_USER_INPUT', 'Ce document ne peut pas être créé à partir de celui-ci.');

  const defaults = await defaultFields(type, source.clientId, options.issueDate);
  const sourceLines = source.lines.map(lineInput);
  let lines: AccountingLineInput[];
  let title = source.title;

  if (type === 'DEPOSIT_INVOICE') {
    const percent = options.depositPercent ?? 30;
    if (!(percent > 0 && percent <= 100)) throw clientError('BAD_USER_INPUT', 'Pourcentage d’acompte invalide (1 à 100 %).');
    lines = documentTotals(source)
      .vat.filter((item) => item.base > 0)
      .map((item) => ({
        kind: 'ITEM',
        title: `Acompte de ${percent.toLocaleString('fr-FR')} % sur le devis ${source.number}`,
        description: null,
        quantity: 1,
        unit: 'DEPOSIT',
        unitPrice: fromCents(Math.round((item.base * percent) / 100)),
        vatRate: item.rate,
        discountType: null,
        discountValue: null,
      }));
    title = title ?? `Acompte — devis ${source.number}`;
  } else if (type === 'INVOICE') {
    const deductions: AccountingLineInput[] = (await invoicedOnQuote(source.id)).flatMap(({ number, rates }) =>
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
        })),
    );
    lines = [...sourceLines.filter((line) => line.kind !== 'DEDUCTION'), ...deductions];
  } else {
    lines = sourceLines;
    title = `Avoir sur la facture ${source.number}`;
  }

  return createDocument(
    type,
    {
      ...defaults,
      serviceId: source.serviceId,
      contactId: source.contactId,
      projectId: source.projectId,
      serviceStart: source.serviceStart ? formatDay(source.serviceStart) : null,
      serviceEnd: source.serviceEnd ? formatDay(source.serviceEnd) : null,
      title,
      referenceLabel: source.referenceLabel,
      referenceValue: source.referenceValue,
      vatApplicable: source.vatApplicable,
      globalDiscountType: type === 'DEPOSIT_INVOICE' ? null : source.globalDiscountType,
      globalDiscountValue: type === 'DEPOSIT_INVOICE' || source.globalDiscountValue === null ? null : Number(source.globalDiscountValue),
      lines,
    },
    { sourceId: source.id },
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
  return createDocument(source.type, { ...(await editableFields(source)), issueDate, dueDate: null }, { sourceId: null });
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
    lateInterest: document.lateInterest,
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
