import { formatDay } from '@ordo/shared';
import { prisma } from '../../db';
import * as docs from '../../services/accounting-documents';
import * as imported from '../../services/imported-documents';
import * as recurring from '../../services/recurring-invoices';
import * as resources from '../../services/project-resources';
import { builder } from '../builder';
import { clientError } from '../errors';
import { AccountingDocumentTypeEnum } from './accounting';

const StatusEnum = builder.enumType('AccountingDocumentStatus', { values: ['DRAFT', 'FINAL', 'TEMPLATE'] as const });
export const LineKindEnum = builder.enumType('AccountingLineKind', { values: ['ITEM', 'DISBURSEMENT', 'TEXT', 'DEDUCTION'] as const });
export const UnitEnum = builder.enumType('AccountingUnit', { values: ['UNIT', 'HOUR', 'DAY', 'MONTH', 'FLAT', 'DEPOSIT'] as const });
const DiscountTypeEnum = builder.enumType('DiscountType', { values: ['PERCENT', 'AMOUNT'] as const });

builder.prismaObject('AccountingLine', {
  fields: (t) => ({
    id: t.exposeID('id'),
    position: t.exposeInt('position'),
    kind: t.field({ type: LineKindEnum, resolve: (line) => line.kind }),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    quantity: t.float({ resolve: (line) => Number(line.quantity) }),
    unit: t.field({ type: UnitEnum, resolve: (line) => line.unit }),
    unitPrice: t.float({ resolve: (line) => Number(line.unitPrice) }),
    vatRate: t.float({ resolve: (line) => Number(line.vatRate) }),
    discountType: t.field({ type: DiscountTypeEnum, nullable: true, resolve: (line) => line.discountType }),
    discountValue: t.float({ nullable: true, resolve: (line) => (line.discountValue === null ? null : Number(line.discountValue)) }),
    deductedDocumentId: t.exposeID('deductedDocumentId', { nullable: true, description: 'Deductions: deposit invoice whose amount the line takes off.' }),
  }),
});

const DocumentAttachment = builder
  .objectRef<{ id: string; name: string; size: number }>('AccountingAttachment')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      size: t.exposeInt('size'),
      url: t.string({ resolve: (attachment) => `/api/attachments/${attachment.id}/${encodeURIComponent(attachment.name)}` }),
    }),
  });

builder.prismaObject('AccountingDocument', {
  fields: (t) => ({
    id: t.exposeID('id'),
    type: t.field({ type: AccountingDocumentTypeEnum, resolve: (document) => document.type }),
    status: t.field({ type: StatusEnum, resolve: (document) => document.status }),
    number: t.exposeString('number', { nullable: true }),
    issueDate: t.expose('issueDate', { type: 'Date' }),
    dueDate: t.expose('dueDate', { type: 'Date', nullable: true }),
    serviceStart: t.expose('serviceStart', { type: 'Date', nullable: true }),
    serviceEnd: t.expose('serviceEnd', { type: 'Date', nullable: true }),
    clientId: t.exposeID('clientId'),
    clientName: t.string({ select: { client: { select: { name: true } } }, resolve: (document) => document.client.name }),
    serviceId: t.exposeID('serviceId', { nullable: true }),
    contactId: t.exposeID('contactId', { nullable: true }),
    projectId: t.exposeID('projectId', { nullable: true }),
    sourceId: t.exposeID('sourceId', { nullable: true }),
    sourceNumber: t.string({ nullable: true, select: { source: { select: { number: true } } }, resolve: (document) => document.source?.number ?? null }),
    importedSourceId: t.exposeID('importedSourceId', { nullable: true, description: 'Imported quote a deposit invoice was made from.' }),
    importedSourceNumber: t.string({ nullable: true, select: { importedSource: { select: { number: true } } }, resolve: (document) => document.importedSource?.number ?? null }),
    derived: t.relation('derived', { query: { where: { status: { not: 'TEMPLATE' } }, orderBy: { issueDate: 'asc' } } }),
    seller: t.field({ type: 'JSON', nullable: true, resolve: (document) => document.seller }),
    buyer: t.field({ type: 'JSON', nullable: true, resolve: (document) => document.buyer }),
    title: t.exposeString('title', { nullable: true }),
    introduction: t.exposeString('introduction', { nullable: true }),
    referenceLabel: t.exposeString('referenceLabel', { nullable: true }),
    referenceValue: t.exposeString('referenceValue', { nullable: true }),
    conclusion: t.exposeString('conclusion', { nullable: true }),
    paymentTerms: t.exposeString('paymentTerms', { nullable: true }),
    paymentMethods: t.exposeString('paymentMethods', { nullable: true }),
    lateInterest: t.exposeString('lateInterest', { nullable: true }),
    depositType: t.field({ type: DiscountTypeEnum, nullable: true, resolve: (document) => document.depositType }),
    depositValue: t.float({ nullable: true, resolve: (document) => (document.depositValue === null ? null : Number(document.depositValue)) }),
    billingSchedule: t.exposeString('billingSchedule', { nullable: true }),
    timeEntries: t.relation('timeEntries', { description: 'Tracked time billed on the document.', query: { orderBy: { startedAt: 'asc' } } }),
    otherMentions: t.exposeString('otherMentions', { nullable: true }),
    showBankDetails: t.exposeBoolean('showBankDetails'),
    vatApplicable: t.exposeBoolean('vatApplicable'),
    vatExemptionText: t.exposeString('vatExemptionText', { nullable: true }),
    globalDiscountType: t.field({ type: DiscountTypeEnum, nullable: true, resolve: (document) => document.globalDiscountType }),
    globalDiscountValue: t.float({ nullable: true, resolve: (document) => (document.globalDiscountValue === null ? null : Number(document.globalDiscountValue)) }),
    currency: t.exposeString('currency'),
    totalNet: t.float({ resolve: (document) => Number(document.totalNet) }),
    totalVat: t.float({ resolve: (document) => Number(document.totalVat) }),
    totalGross: t.float({ resolve: (document) => Number(document.totalGross) }),
    invoicedNet: t.float({
      nullable: true,
      description: 'Quotes: amount excluding VAT already invoiced on it (final invoices minus credit notes).',
      resolve: async (document) => (document.type === 'QUOTE' && document.status === 'FINAL' ? (await docs.invoicedAmount(document.id)) / 100 : null),
    }),
    recurringId: t.exposeID('recurringId', { nullable: true }),
    lines: t.relation('lines', { query: { orderBy: { position: 'asc' } } }),
    attachments: t.field({
      type: [DocumentAttachment],
      select: { attachments: { select: { id: true, name: true, size: true }, orderBy: { createdAt: 'asc' } } },
      resolve: (document) => document.attachments,
    }),
    finalizedAt: t.expose('finalizedAt', { type: 'DateTime', nullable: true }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

builder.prismaObject('RecurringInvoice', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    templateId: t.exposeID('templateId'),
    template: t.relation('template'),
    recurrence: t.field({ type: 'JSON', resolve: (item) => item.recurrence }),
    startDate: t.expose('startDate', { type: 'Date' }),
    nextDate: t.expose('nextDate', { type: 'Date', nullable: true }),
    autoFinalize: t.exposeBoolean('autoFinalize'),
    active: t.exposeBoolean('active'),
    issuedCount: t.relationCount('generated'),
  }),
});

builder.prismaObject('ImportedDocument', {
  description: 'Quote or invoice issued before Ordo: main information and file.',
  fields: (t) => ({
    id: t.exposeID('id'),
    trackingStatus: t.relation('trackingStatus', { nullable: true, description: 'Tracking status, set by hand.' }),
    sentAt: t.expose('sentAt', { type: 'DateTime', nullable: true }),
    sentVia: t.exposeString('sentVia', { nullable: true, description: 'How it was sent: MAIL, CHORUS, POST, HAND or OTHER.' }),
    type: t.field({ type: AccountingDocumentTypeEnum, resolve: (document) => document.type }),
    number: t.exposeString('number'),
    issueDate: t.expose('issueDate', { type: 'Date' }),
    dueDate: t.expose('dueDate', { type: 'Date', nullable: true }),
    clientId: t.exposeID('clientId', { nullable: true }),
    clientName: t.string({
      select: { clientName: true, client: { select: { name: true } } },
      resolve: (document) => document.client?.name ?? document.clientName ?? '',
    }),
    projectId: t.exposeID('projectId', { nullable: true }),
    title: t.exposeString('title', { nullable: true }),
    totalNet: t.float({ resolve: (document) => Number(document.totalNet) }),
    totalVat: t.float({ resolve: (document) => Number(document.totalVat) }),
    totalGross: t.float({ resolve: (document) => Number(document.totalGross) }),
    currency: t.exposeString('currency'),
    note: t.exposeString('note', { nullable: true }),
    fileUrl: t.string({
      nullable: true,
      select: { attachment: { select: { id: true, name: true } } },
      resolve: (document) => (document.attachment ? `/api/attachments/${document.attachment.id}/${encodeURIComponent(document.attachment.name)}` : null),
    }),
    fileName: t.string({ nullable: true, select: { attachment: { select: { name: true } } }, resolve: (document) => document.attachment?.name ?? null }),
    fileMimeType: t.string({ nullable: true, select: { attachment: { select: { mimeType: true } } }, resolve: (document) => document.attachment?.mimeType ?? null }),
  }),
});

const ImportedDocumentInput = builder.inputType('ImportedDocumentInput', {
  fields: (t) => ({
    type: t.field({ type: AccountingDocumentTypeEnum, required: true }),
    number: t.string({ required: true }),
    issueDate: t.field({ type: 'Date', required: true }),
    dueDate: t.field({ type: 'Date' }),
    clientId: t.id(),
    clientName: t.string(),
    projectId: t.id(),
    title: t.string(),
    totalNet: t.float({ required: true }),
    totalVat: t.float({ required: true }),
    totalGross: t.float({ required: true }),
    currency: t.string({ required: true }),
    note: t.string(),
    settled: t.boolean({ required: true }),
  }),
});

/**
 * Imported document input with omitted optional fields as null.
 * @param {typeof ImportedDocumentInput.$inferInput} input GraphQL input.
 * @returns {imported.ImportedDocumentInput} Service input.
 */
const importedInput = (input: typeof ImportedDocumentInput.$inferInput): imported.ImportedDocumentInput => ({
  ...input,
  dueDate: input.dueDate ?? null,
  clientId: input.clientId ?? null,
  clientName: input.clientName ?? null,
  projectId: input.projectId ?? null,
  title: input.title ?? null,
  note: input.note ?? null,
});

const ResourceKindEnum = builder.enumType('ProjectResourceKind', { values: ['FILE', 'LINK'] as const });

builder.prismaObject('ProjectResource', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    kind: t.field({ type: ResourceKindEnum, resolve: (resource) => resource.kind }),
    title: t.exposeString('title'),
    note: t.exposeString('note', { nullable: true }),
    url: t.string({
      select: { attachment: { select: { id: true, name: true } } },
      resolve: (resource) =>
        resource.kind === 'LINK' ? (resource.url ?? '') : `/api/attachments/${resource.attachment?.id}/${encodeURIComponent(resource.attachment?.name ?? 'fichier')}`,
    }),
    size: t.int({ nullable: true, select: { attachment: { select: { size: true } } }, resolve: (resource) => resource.attachment?.size ?? null }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

const LineInput = builder.inputType('AccountingLineInput', {
  fields: (t) => ({
    kind: t.field({ type: LineKindEnum, required: true }),
    title: t.string({ required: true }),
    description: t.string(),
    quantity: t.float({ required: true }),
    unit: t.field({ type: UnitEnum, required: true }),
    unitPrice: t.float({ required: true }),
    vatRate: t.float({ required: true }),
    discountType: t.field({ type: DiscountTypeEnum }),
    discountValue: t.float(),
    deductedDocumentId: t.id({ description: 'Deductions: deposit invoice whose amount the line takes off.' }),
  }),
});

const DocumentInput = builder.inputType('AccountingDocumentInput', {
  fields: (t) => ({
    clientId: t.id({ required: true }),
    serviceId: t.id(),
    contactId: t.id(),
    projectId: t.id(),
    issueDate: t.field({ type: 'Date', required: true }),
    dueDate: t.field({ type: 'Date' }),
    serviceStart: t.field({ type: 'Date' }),
    serviceEnd: t.field({ type: 'Date' }),
    title: t.string(),
    introduction: t.string(),
    referenceLabel: t.string(),
    referenceValue: t.string(),
    conclusion: t.string(),
    paymentTerms: t.string(),
    paymentMethods: t.string(),
    lateInterest: t.string(),
    depositType: t.field({ type: DiscountTypeEnum }),
    depositValue: t.float(),
    billingSchedule: t.string(),
    otherMentions: t.string(),
    showBankDetails: t.boolean({ required: true }),
    vatApplicable: t.boolean({ required: true }),
    globalDiscountType: t.field({ type: DiscountTypeEnum }),
    globalDiscountValue: t.float(),
    lines: t.field({ type: [LineInput], required: true }),
    timeEntryIds: t.idList({ description: 'Tracked time billed on the document (replaces the previous ones); unchanged when omitted.' }),
  }),
});

const RecurringInput = builder.inputType('RecurringInvoiceInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    recurrence: t.field({ type: 'JSON', required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    autoFinalize: t.boolean({ required: true }),
    active: t.boolean({ required: true }),
  }),
});

/**
 * Document input with omitted optional fields as null.
 * @param {typeof DocumentInput.$inferInput} input GraphQL input.
 * @returns {import('@ordo/shared').AccountingDocumentInput} Service input.
 */
const documentInput = (input: typeof DocumentInput.$inferInput) => ({
  ...input,
  serviceId: input.serviceId ?? null,
  contactId: input.contactId ?? null,
  projectId: input.projectId ?? null,
  dueDate: input.dueDate ?? null,
  serviceStart: input.serviceStart ?? null,
  serviceEnd: input.serviceEnd ?? null,
  title: input.title ?? null,
  introduction: input.introduction ?? null,
  referenceLabel: input.referenceLabel ?? null,
  referenceValue: input.referenceValue ?? null,
  conclusion: input.conclusion ?? null,
  paymentTerms: input.paymentTerms ?? null,
  paymentMethods: input.paymentMethods ?? null,
  lateInterest: input.lateInterest ?? null,
  depositType: input.depositType ?? null,
  depositValue: input.depositValue ?? null,
  billingSchedule: input.billingSchedule ?? null,
  timeEntryIds: input.timeEntryIds ?? undefined,
  otherMentions: input.otherMentions ?? null,
  globalDiscountType: input.globalDiscountType ?? null,
  globalDiscountValue: input.globalDiscountValue ?? null,
  lines: input.lines.map((line) => ({
    ...line,
    description: line.description ?? null,
    discountType: line.discountType ?? null,
    discountValue: line.discountValue ?? null,
    deductedDocumentId: line.deductedDocumentId ?? null,
  })),
});

/**
 * Today, on the server.
 * @returns {string} YYYY-MM-DD.
 */
const today = () => formatDay(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));

const DeductibleRateRef = builder.objectRef<{ rate: number; base: number }>('DeductibleRate').implement({
  fields: (t) => ({ rate: t.exposeFloat('rate'), amount: t.float({ description: 'Excluding VAT.', resolve: (item) => item.base / 100 }) }),
});

const DeductibleDepositRef = builder.objectRef<docs.DeductibleDeposit>('DeductibleDeposit').implement({
  description: 'Final deposit invoice of a client with what is left to deduct from it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    number: t.exposeString('number'),
    issueDate: t.string({ resolve: (deposit) => formatDay(deposit.issueDate) }),
    totalGross: t.float({ description: 'Total including VAT.', resolve: (deposit) => deposit.totalGross / 100 }),
    remaining: t.field({
      type: [DeductibleRateRef],
      description: 'Amounts excluding VAT left to deduct, per VAT rate.',
      resolve: (deposit) => deposit.remaining,
    }),
  }),
});

builder.queryFields((t) => ({
  deductibleDeposits: t.field({
    type: [DeductibleDepositRef],
    description: 'Final deposit invoices of a client not deducted in full yet (the deductions of `documentId` left out).',
    args: { clientId: t.arg.id({ required: true }), documentId: t.arg.id() },
    resolve: (_root, { clientId, documentId }) => docs.deductibleDeposits(clientId, documentId ?? null),
  }),
  latestDocumentDate: t.string({
    nullable: true,
    description: 'Date (YYYY-MM-DD) of the latest document of a type, final or imported, `documentId` left out: none can be dated before.',
    args: { type: t.arg({ type: AccountingDocumentTypeEnum, required: true }), documentId: t.arg.id() },
    resolve: (_root, { type, documentId }) => docs.latestIssueDate(type, documentId ?? null),
  }),
}));

builder.queryFields((t) => ({
  accountingDocuments: t.prismaField({
    type: ['AccountingDocument'],
    description: 'Documents (recurring models excluded), latest first, optionally of a client or a project.',
    args: { clientId: t.arg.id(), projectId: t.arg.id() },
    resolve: (query, _root, { clientId, projectId }) =>
      prisma.accountingDocument.findMany({
        ...query,
        where: { status: { not: 'TEMPLATE' }, ...(clientId && { clientId }), ...(projectId && { projectId }) },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      }),
  }),
  accountingDocument: t.prismaField({
    type: 'AccountingDocument',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) => prisma.accountingDocument.findUnique({ ...query, where: { id } }),
  }),
  newDocumentDefaults: t.field({
    type: 'JSON',
    description: 'Fields of a new document of a client (company terms and mentions, dates).',
    args: { type: t.arg({ type: AccountingDocumentTypeEnum, required: true }), clientId: t.arg.id({ required: true }), issueDate: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { type, clientId, issueDate }) => docs.defaultFields(type, clientId, issueDate),
  }),
  recurringInvoices: t.prismaField({
    type: ['RecurringInvoice'],
    resolve: (query) => prisma.recurringInvoice.findMany({ ...query, orderBy: { createdAt: 'asc' } }),
  }),
  importedDocument: t.prismaField({
    type: 'ImportedDocument',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) => prisma.importedDocument.findUnique({ ...query, where: { id } }),
  }),
  importedDocuments: t.prismaField({
    type: ['ImportedDocument'],
    description: 'Imported quotes and invoices, latest first, optionally of a client or a project.',
    args: { clientId: t.arg.id(), projectId: t.arg.id() },
    resolve: (query, _root, { clientId, projectId }) =>
      prisma.importedDocument.findMany({
        ...query,
        where: { ...(clientId && { clientId }), ...(projectId && { projectId }) },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }],
      }),
  }),
  projectResources: t.prismaField({
    type: ['ProjectResource'],
    args: { projectId: t.arg.id({ required: true }) },
    resolve: (query, _root, { projectId }) => prisma.projectResource.findMany({ ...query, where: { projectId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  createAccountingDocument: t.id({
    args: { type: t.arg({ type: AccountingDocumentTypeEnum, required: true }), input: t.arg({ type: DocumentInput, required: true }) },
    resolve: async (_root, { type, input }) => {
      if (type === 'DEPOSIT_INVOICE') throw clientError('BAD_USER_INPUT', 'Une facture d’acompte s’établit à partir d’un devis.');
      return (await docs.createDocument(type, documentInput(input))).id;
    },
  }),
  createDepositInvoice: t.id({
    description: 'Deposit invoice from a quote of Ordo or an imported quote: a percentage of its total excluding VAT.',
    args: {
      quoteId: t.arg.id(),
      importedQuoteId: t.arg.id(),
      percent: t.arg.float({ required: true }),
      issueDate: t.arg({ type: 'Date', required: true }),
    },
    resolve: async (_root, { quoteId, importedQuoteId, percent, issueDate }) => (await docs.createDepositInvoice({ quoteId, importedQuoteId, percent, issueDate })).id,
  }),
  updateAccountingDocument: t.id({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: DocumentInput, required: true }) },
    resolve: async (_root, { id, input }) => (await docs.updateDocument(id, documentInput(input))).id,
  }),
  deleteAccountingDocument: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await docs.deleteDocument(id);
      return true;
    },
  }),
  finalizeAccountingDocument: t.string({
    description: 'Makes a draft final; returns its number.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => (await docs.finalizeDocument(id)).number ?? '',
  }),
  createDocumentFrom: t.id({
    description: 'Invoice or deposit invoice from a quote, credit note from an invoice.',
    args: {
      sourceId: t.arg.id({ required: true }),
      type: t.arg({ type: AccountingDocumentTypeEnum, required: true }),
      depositPercent: t.arg.float(),
      issueDate: t.arg({ type: 'Date', required: true }),
    },
    resolve: async (_root, { sourceId, type, depositPercent, issueDate }) => (await docs.createFromDocument(sourceId, type, { depositPercent, issueDate })).id,
  }),
  duplicateAccountingDocument: t.id({
    args: { id: t.arg.id({ required: true }), issueDate: t.arg({ type: 'Date', required: true }) },
    resolve: async (_root, { id, issueDate }) => (await docs.duplicateDocument(id, issueDate)).id,
  }),
  addAccountingAttachments: t.boolean({
    args: { id: t.arg.id({ required: true }), files: t.arg({ type: ['File'], required: true }) },
    resolve: async (_root, { id, files }) => {
      await docs.addDocumentAttachments(id, files);
      return true;
    },
  }),
  removeAccountingAttachment: t.boolean({
    args: { attachmentId: t.arg.id({ required: true }) },
    resolve: async (_root, { attachmentId }) => {
      await docs.removeDocumentAttachment(attachmentId);
      return true;
    },
  }),
  createRecurringInvoice: t.id({
    args: { documentId: t.arg.id({ required: true }), input: t.arg({ type: RecurringInput, required: true }) },
    resolve: async (_root, { documentId, input }) => {
      const created = await recurring.createRecurringInvoice(documentId, input as recurring.RecurringSettings);
      // An invoice due today is issued at once rather than at the next hourly run.
      await recurring.issueDueInvoices(today());
      return created.id;
    },
  }),
  updateRecurringInvoice: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: RecurringInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await recurring.updateRecurringInvoice(id, input as recurring.RecurringSettings, today());
      await recurring.issueDueInvoices(today());
      return true;
    },
  }),
  deleteRecurringInvoice: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await recurring.deleteRecurringInvoice(id);
      return true;
    },
  }),
  issueDueRecurringInvoices: t.int({
    description: 'Issues the recurring invoices due today (also done every hour).',
    args: { today: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, args) => recurring.issueDueInvoices(args.today),
  }),
  importDocument: t.id({
    args: { input: t.arg({ type: ImportedDocumentInput, required: true }), file: t.arg({ type: 'File' }) },
    resolve: async (_root, { input, file }) => (await imported.importDocument(importedInput(input), file ?? null)).id,
  }),
  updateImportedDocument: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ImportedDocumentInput, required: true }), file: t.arg({ type: 'File' }) },
    resolve: async (_root, { id, input, file }) => {
      await imported.updateImportedDocument(id, importedInput(input), file ?? null);
      return true;
    },
  }),
  markImportedDocumentSent: t.boolean({
    description: 'Notes that an imported document was sent, on a day (none: now) and how, with a "sent" status.',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date' }), via: t.arg.string(), statusId: t.arg.id({ required: true }) },
    resolve: async (_root, { id, date, via, statusId }) => {
      await imported.markImportedSent(id, { date: date ?? null, via: via ?? null, statusId });
      return true;
    },
  }),
  setImportedDocumentTrackingStatus: t.boolean({
    description: 'Sets the tracking status of an imported document by hand (none: clears it).',
    args: { id: t.arg.id({ required: true }), statusId: t.arg.id() },
    resolve: async (_root, { id, statusId }) => {
      await imported.setImportedTrackingStatus(id, statusId ?? null);
      return true;
    },
  }),
  deleteImportedDocument: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await imported.deleteImportedDocument(id);
      return true;
    },
  }),
  addProjectLink: t.boolean({
    args: { projectId: t.arg.id({ required: true }), title: t.arg.string({ required: true }), url: t.arg.string({ required: true }), note: t.arg.string() },
    resolve: async (_root, { projectId, title, url, note }) => {
      await resources.addProjectLink(projectId, { title, url, note: note ?? null });
      return true;
    },
  }),
  addProjectFiles: t.boolean({
    args: { projectId: t.arg.id({ required: true }), files: t.arg({ type: ['File'], required: true }) },
    resolve: async (_root, { projectId, files }) => {
      await resources.addProjectFiles(projectId, files);
      return true;
    },
  }),
  updateProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }), title: t.arg.string({ required: true }), url: t.arg.string(), note: t.arg.string() },
    resolve: async (_root, { id, title, url, note }) => {
      await resources.updateProjectResource(id, { title, url, note });
      return true;
    },
  }),
  deleteProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await resources.deleteProjectResource(id);
      return true;
    },
  }),
  moveProjectResource: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await resources.moveProjectResource(id, index);
      return true;
    },
  }),
}));
