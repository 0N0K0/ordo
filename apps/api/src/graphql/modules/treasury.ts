import { formatDay, fromCents, parseDay, type TreasuryAccountInput, type TreasuryEntryInput } from '@ordo/shared';
import { prisma } from '../../db';
import * as reminders from '../../services/reminders';
import * as statuses from '../../services/document-statuses';
import * as tracking from '../../services/document-tracking';
import * as treasury from '../../services/treasury';
import { builder } from '../builder';

/**
 * Today, on the server.
 * @returns {string} YYYY-MM-DD.
 */
const today = () => formatDay(new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())));

// Balances are computed once per request for all documents (lists show many of them).
const documentCache = new WeakMap<object, Promise<Map<string, tracking.DocumentBalance>>>();
const importedCache = new WeakMap<object, Promise<Map<string, tracking.DocumentBalance>>>();

/**
 * Balances of the final documents, shared by the fields of one request.
 * @param {object} ctx Request context.
 * @returns {Promise<Map<string, tracking.DocumentBalance>>} Balances.
 */
function balancesOf(ctx: object): Promise<Map<string, tracking.DocumentBalance>> {
  if (!documentCache.has(ctx)) documentCache.set(ctx, tracking.documentBalances());
  return documentCache.get(ctx) as Promise<Map<string, tracking.DocumentBalance>>;
}

/**
 * Balances of the imported documents, shared by the fields of one request.
 * @param {object} ctx Request context.
 * @returns {Promise<Map<string, tracking.DocumentBalance>>} Balances.
 */
function importedBalancesOf(ctx: object): Promise<Map<string, tracking.DocumentBalance>> {
  if (!importedCache.has(ctx)) importedCache.set(ctx, tracking.importedBalances());
  return importedCache.get(ctx) as Promise<Map<string, tracking.DocumentBalance>>;
}

const ScopeEnum = builder.enumType('DocumentStatusScope', { values: ['QUOTE', 'INVOICE'] as const });
const CategoryEnum = builder.enumType('DocumentStatusCategory', { values: ['TO_SEND', 'SENT', 'ACCEPTED', 'REFUSED', 'PAID'] as const });
const EntryStatusEnum = builder.enumType('TreasuryEntryStatus', { values: ['ACTUAL', 'FORECAST'] as const });

builder.prismaObject('DocumentStatus', {
  fields: (t) => ({
    id: t.exposeID('id'),
    scope: t.field({ type: ScopeEnum, resolve: (status) => status.scope }),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    category: t.field({ type: CategoryEnum, resolve: (status) => status.category }),
    position: t.exposeInt('position'),
    documentCount: t.relationCount('documents'),
  }),
});

builder.prismaObject('DocumentReminder', {
  fields: (t) => ({
    id: t.exposeID('id'),
    date: t.expose('date', { type: 'DateTime' }),
    note: t.exposeString('note', { nullable: true }),
  }),
});

builder.prismaObject('TreasuryAllocation', {
  fields: (t) => ({
    id: t.exposeID('id'),
    amount: t.float({ resolve: (allocation) => Number(allocation.amount) }),
    documentId: t.exposeID('documentId', { nullable: true }),
    importedDocumentId: t.exposeID('importedDocumentId', { nullable: true }),
    documentLabel: t.string({
      select: { document: { select: { type: true, number: true } }, importedDocument: { select: { number: true } } },
      resolve: (allocation) => allocation.document?.number ?? (allocation.importedDocument ? `${allocation.importedDocument.number} (importé)` : ''),
    }),
    entry: t.relation('entry'),
  }),
});

builder.prismaObject('TreasuryEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
    accountId: t.exposeID('accountId'),
    accountName: t.string({ select: { account: { select: { name: true } } }, resolve: (entry) => entry.account.name }),
    status: t.field({ type: EntryStatusEnum, resolve: (entry) => entry.status }),
    date: t.expose('date', { type: 'Date' }),
    label: t.exposeString('label'),
    amount: t.float({ resolve: (entry) => Number(entry.amount) }),
    category: t.exposeString('category', { nullable: true }),
    method: t.exposeString('method', { nullable: true }),
    projectId: t.exposeID('projectId', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    recurrence: t.field({ type: 'JSON', nullable: true, resolve: (entry) => entry.recurrence }),
    allocations: t.relation('allocations'),
  }),
});

builder.prismaObject('TreasuryAccount', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    openingBalance: t.float({ resolve: (account) => Number(account.openingBalance) }),
    openingDate: t.expose('openingDate', { type: 'Date' }),
    archived: t.exposeBoolean('archived'),
    entryCount: t.relationCount('entries'),
    balance: t.float({ description: 'Balance today.', resolve: async (account) => fromCents(await treasury.accountBalance(account, today())) }),
  }),
});

builder.prismaObjectFields('AccountingDocument', (t) => ({
  trackingStatus: t.relation('trackingStatus', { nullable: true }),
  sentAt: t.expose('sentAt', { type: 'DateTime', nullable: true }),
  acceptedAt: t.expose('acceptedAt', { type: 'Date', nullable: true }),
  signedFileUrl: t.string({
    nullable: true,
    select: { signedAttachment: { select: { id: true, name: true } } },
    resolve: (document) => (document.signedAttachment ? `/api/attachments/${document.signedAttachment.id}/${encodeURIComponent(document.signedAttachment.name)}` : null),
  }),
  signedFileName: t.string({ nullable: true, select: { signedAttachment: { select: { name: true } } }, resolve: (document) => document.signedAttachment?.name ?? null }),
  paid: t.float({
    nullable: true,
    description: 'Final invoices: paid by the client; credit notes: refunded.',
    resolve: async (document, _args, ctx) => {
      const balance = (await balancesOf(ctx)).get(document.id);
      return balance ? fromCents(balance.paid) : null;
    },
  }),
  credited: t.float({
    nullable: true,
    description: 'Final invoices: deducted by credit notes.',
    resolve: async (document, _args, ctx) => {
      const balance = (await balancesOf(ctx)).get(document.id);
      return balance ? fromCents(balance.credited) : null;
    },
  }),
  balance: t.float({
    nullable: true,
    description: 'Final invoices: still due by the client; credit notes: still owed to the client.',
    resolve: async (document, _args, ctx) => {
      const balance = (await balancesOf(ctx)).get(document.id);
      return balance ? fromCents(balance.balance) : null;
    },
  }),
  overdue: t.boolean({
    description: 'Final invoice still due after its due date, or quote waiting after its validity.',
    select: { trackingStatus: { select: { category: true } } },
    resolve: async (document, _args, ctx) => {
      if (document.status !== 'FINAL' || !document.dueDate || formatDay(document.dueDate) >= today()) return false;
      const category = document.trackingStatus?.category;
      if (document.type === 'QUOTE') return category === 'TO_SEND' || category === 'SENT';
      if (document.type === 'CREDIT_NOTE') return false;
      return ((await balancesOf(ctx)).get(document.id)?.balance ?? 0) > 0;
    },
  }),
  reminders: t.relation('reminders', { query: { orderBy: { date: 'desc' } } }),
  reminderCount: t.relationCount('reminders'),
  lastReminderAt: t.field({
    type: 'DateTime',
    nullable: true,
    select: { reminders: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 } },
    resolve: (document) => document.reminders[0]?.date ?? null,
  }),
  billingEmail: t.string({
    nullable: true,
    description: 'Address the document is mailed to: its contact, else its service, else its client.',
    select: { contactId: true, serviceId: true, clientId: true },
    resolve: async (document) => (await reminders.billingRecipient(document)).email,
  }),
  payments: t.relation('allocations', { query: { orderBy: { entry: { date: 'asc' } } } }),
}));

const ReminderResultRef = builder.objectRef<reminders.ReminderResult>('ReminderResult').implement({
  fields: (t) => ({
    documentId: t.exposeID('documentId'),
    number: t.exposeString('number'),
    error: t.exposeString('error', { nullable: true, description: 'Null when sent, else why it was not.' }),
  }),
});

builder.prismaObjectFields('ImportedDocument', (t) => ({
  settled: t.exposeBoolean('settled'),
  paid: t.float({
    nullable: true,
    resolve: async (document, _args, ctx) => {
      const balance = (await importedBalancesOf(ctx)).get(document.id);
      return balance ? fromCents(balance.paid) : null;
    },
  }),
  balance: t.float({
    nullable: true,
    description: 'Still due (by or to the client); 0 once settled.',
    resolve: async (document, _args, ctx) => {
      const balance = (await importedBalancesOf(ctx)).get(document.id);
      return balance ? fromCents(balance.balance) : null;
    },
  }),
  payments: t.relation('allocations'),
}));

const ProjectionItem = builder.objectRef<treasury.ProjectionItem>('TreasuryProjectionItem').implement({
  fields: (t) => ({
    date: t.exposeString('date', { description: 'Expected date, YYYY-MM-DD (overdue items: today).' }),
    dueDate: t.exposeString('dueDate'),
    label: t.exposeString('label'),
    amount: t.float({ resolve: (item) => fromCents(item.amount) }),
    kind: t.exposeString('kind'),
    overdue: t.exposeBoolean('overdue'),
    entryId: t.exposeID('entryId', { nullable: true }),
    documentId: t.exposeID('documentId', { nullable: true }),
    importedDocumentId: t.exposeID('importedDocumentId', { nullable: true }),
    recurringInvoiceId: t.exposeID('recurringInvoiceId', { nullable: true }),
    accountId: t.exposeID('accountId', { nullable: true }),
  }),
});

const ProjectionPoint = builder.objectRef<treasury.Projection['series'][number]>('TreasuryBalancePoint').implement({
  fields: (t) => ({
    date: t.exposeString('date'),
    balance: t.float({ resolve: (point) => fromCents(point.balance) }),
    forecast: t.exposeBoolean('forecast'),
  }),
});

const Projection = builder.objectRef<treasury.Projection>('TreasuryProjection').implement({
  fields: (t) => ({
    balance: t.float({ resolve: (projection) => fromCents(projection.balance) }),
    series: t.field({ type: [ProjectionPoint], resolve: (projection) => projection.series }),
    items: t.field({ type: [ProjectionItem], resolve: (projection) => projection.items }),
  }),
});

const AccountInput = builder.inputType('TreasuryAccountInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    openingBalance: t.float({ required: true }),
    openingDate: t.field({ type: 'Date', required: true }),
    archived: t.boolean({ required: true }),
  }),
});

const AllocationInput = builder.inputType('TreasuryAllocationInput', {
  fields: (t) => ({
    documentId: t.id(),
    importedDocumentId: t.id(),
    amount: t.float({ required: true }),
  }),
});

const EntryInput = builder.inputType('TreasuryEntryInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    status: t.field({ type: EntryStatusEnum, required: true }),
    date: t.field({ type: 'Date', required: true }),
    label: t.string({ required: true }),
    amount: t.float({ required: true }),
    category: t.string(),
    method: t.string(),
    projectId: t.id(),
    note: t.string(),
    recurrence: t.field({ type: 'JSON' }),
    allocations: t.field({ type: [AllocationInput], required: true }),
  }),
});

/**
 * Entry input with omitted optional fields as null.
 * @param {typeof EntryInput.$inferInput} input GraphQL input.
 * @returns {TreasuryEntryInput} Service input.
 */
const entryInput = (input: typeof EntryInput.$inferInput): TreasuryEntryInput => ({
  ...input,
  category: input.category ?? null,
  method: input.method ?? null,
  projectId: input.projectId ?? null,
  note: input.note ?? null,
  recurrence: (input.recurrence ?? null) as TreasuryEntryInput['recurrence'],
  allocations: input.allocations.map((allocation) => ({
    documentId: allocation.documentId ?? null,
    importedDocumentId: allocation.importedDocumentId ?? null,
    amount: allocation.amount,
  })),
});

const PaymentInput = builder.inputType('DocumentPaymentInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    date: t.field({ type: 'Date', required: true }),
    amount: t.float({ required: true }),
    method: t.string(),
  }),
});

builder.queryFields((t) => ({
  overdueInvoices: t.prismaField({
    type: ['AccountingDocument'],
    description: 'Final invoices still due after their due date, oldest due first.',
    args: { today: t.arg({ type: 'Date', required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const balances = await balancesOf(ctx);
      const late = await prisma.accountingDocument.findMany({
        where: { status: 'FINAL', type: { in: ['INVOICE', 'DEPOSIT_INVOICE'] }, dueDate: { lt: parseDay(args.today) } },
        select: { id: true },
      });
      const ids = late.filter((document) => (balances.get(document.id)?.balance ?? 0) > 0).map((document) => document.id);
      return prisma.accountingDocument.findMany({ ...query, where: { id: { in: ids } }, orderBy: [{ dueDate: 'asc' }, { number: 'asc' }] });
    },
  }),
  documentStatuses: t.prismaField({
    type: ['DocumentStatus'],
    resolve: (query) => prisma.documentStatus.findMany({ ...query, orderBy: [{ scope: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  treasuryAccounts: t.prismaField({
    type: ['TreasuryAccount'],
    resolve: (query) => prisma.treasuryAccount.findMany({ ...query, orderBy: [{ archived: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  treasuryEntries: t.prismaField({
    type: ['TreasuryEntry'],
    description: 'Entries between two dates (included), latest first.',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }), accountId: t.arg.id() },
    resolve: (query, _root, { from, to, accountId }) =>
      prisma.treasuryEntry.findMany({
        ...query,
        where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, ...(accountId ? { accountId } : {}) },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
  }),
  forecastEntries: t.prismaField({
    type: ['TreasuryEntry'],
    resolve: (query) => prisma.treasuryEntry.findMany({ ...query, where: { status: 'FORECAST' }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
  }),
  treasuryProjection: t.field({
    type: Projection,
    args: { today: t.arg({ type: 'Date', required: true }), from: t.arg({ type: 'Date', required: true }), until: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, args) => treasury.treasuryProjection(args.today, args.from, args.until),
  }),
}));

builder.mutationFields((t) => ({
  createDocumentStatus: t.id({
    args: { scope: t.arg({ type: ScopeEnum, required: true }), name: t.arg.string({ required: true }), color: t.arg.string({ required: true }), category: t.arg({ type: CategoryEnum, required: true }) },
    resolve: async (_root, args) => (await statuses.createDocumentStatus(args)).id,
  }),
  updateDocumentStatus: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string(), color: t.arg.string(), category: t.arg({ type: CategoryEnum }) },
    resolve: async (_root, { id, ...input }) => {
      await statuses.updateDocumentStatus(id, input);
      return true;
    },
  }),
  deleteDocumentStatus: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await statuses.deleteDocumentStatus(id);
      return true;
    },
  }),
  moveDocumentStatus: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await statuses.moveDocumentStatus(id, index);
      return true;
    },
  }),
  setDocumentTrackingStatus: t.boolean({
    args: { id: t.arg.id({ required: true }), statusId: t.arg.id({ required: true }) },
    resolve: async (_root, { id, statusId }) => {
      await tracking.setTrackingStatus(id, statusId);
      return true;
    },
  }),
  markDocumentSent: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await tracking.markSent(id);
      return true;
    },
  }),
  acceptQuote: t.boolean({
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date', required: true }), file: t.arg({ type: 'File' }) },
    resolve: async (_root, { id, date, file }) => {
      await tracking.acceptQuote(id, date, file ?? null);
      return true;
    },
  }),
  removeSignedQuote: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await tracking.removeSignedQuote(id);
      return true;
    },
  }),
  sendDocumentReminders: t.field({
    type: [ReminderResultRef],
    description: 'Mails the reminder of several unpaid invoices (one mail each, with the PDF), noted as reminders.',
    args: { accountId: t.arg.id({ required: true }), documentIds: t.arg.idList({ required: true }) },
    resolve: (_root, args) => reminders.sendReminders(args),
  }),
  addDocumentReminder: t.boolean({
    args: { id: t.arg.id({ required: true }), note: t.arg.string() },
    resolve: async (_root, { id, note }) => {
      await tracking.addReminder(id, note ?? null);
      return true;
    },
  }),
  deleteDocumentReminder: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await tracking.deleteReminder(id);
      return true;
    },
  }),
  recordDocumentPayment: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PaymentInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await tracking.recordPayment(id, { ...input, method: input.method ?? null });
      return true;
    },
  }),
  createTreasuryAccount: t.id({
    args: { input: t.arg({ type: AccountInput, required: true }) },
    resolve: async (_root, { input }) => (await treasury.createAccount(input as TreasuryAccountInput)).id,
  }),
  updateTreasuryAccount: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: AccountInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await treasury.updateAccount(id, input);
      return true;
    },
  }),
  deleteTreasuryAccount: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await treasury.deleteAccount(id);
      return true;
    },
  }),
  createTreasuryEntry: t.id({
    args: { input: t.arg({ type: EntryInput, required: true }) },
    resolve: async (_root, { input }) => (await treasury.createEntry(entryInput(input))).id,
  }),
  updateTreasuryEntry: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: EntryInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await treasury.updateEntry(id, entryInput(input));
      return true;
    },
  }),
  deleteTreasuryEntry: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await treasury.deleteEntry(id);
      return true;
    },
  }),
  realizeTreasuryForecast: t.id({
    description: 'Records a forecast (one date of a repeated one) as an actual entry.',
    args: {
      id: t.arg.id({ required: true }),
      occurrence: t.arg({ type: 'Date', required: true }),
      date: t.arg({ type: 'Date', required: true }),
      amount: t.arg.float({ required: true }),
    },
    resolve: async (_root, { id, occurrence, date, amount }) => (await treasury.realizeForecast(id, occurrence, { date, amount })).id,
  }),
}));
