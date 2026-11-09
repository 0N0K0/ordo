import { addDays, DOCUMENT_STATUS_CATEGORIES, formatDay, REMINDER_DELAY_DAYS, fromCents, parseDay, type TreasuryAccountInput, type TreasuryEntryInput } from '@ordo/shared';
import { prisma } from '../../db';
import * as reminders from '../../services/reminders';
import * as statuses from '../../services/document-statuses';
import * as tracking from '../../services/document-tracking';
import * as treasury from '../../services/treasury';
import * as settings from '../../services/treasury-settings';
import * as budgets from '../../services/treasury-budgets';
import * as statements from '../../services/treasury-import';
import * as loans from '../../services/treasury-loans';
import * as team from '../../services/treasury-team';
import { meContributorId } from '../../services/workspaces';
import { currentWorkspace } from '../../workspace-context';
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
const CategoryEnum = builder.enumType('DocumentStatusCategory', { values: DOCUMENT_STATUS_CATEGORIES });
const EntryStatusEnum = builder.enumType('TreasuryEntryStatus', { values: ['ACTUAL', 'FORECAST'] as const });
const DirectionEnum = builder.enumType('TreasuryDirection', { values: ['IN', 'OUT'] as const });

const LineModeEnum = builder.enumType('TreasuryLineMode', { values: ['AMOUNT', 'PERCENT'] as const });

builder.prismaObject('TreasuryEntryLine', {
  description: 'Part of a split entry: for a member, in a category and a context (none: everyday spending).',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label', { nullable: true }),
    mode: t.field({ type: LineModeEnum, resolve: (line) => line.mode }),
    value: t.float({ description: 'Signed amount, or signed percentage of the entry amount.', resolve: (line) => Number(line.value) }),
    memberId: t.exposeID('memberId', { nullable: true }),
    relationId: t.exposeID('relationId', { nullable: true, description: 'Relation it is for, instead of a member.' }),
    loan: t.exposeBoolean('loan', { description: 'Loan with the relation: money out lends (or repays), money in borrows (or is repaid).' }),
    date: t.expose('date', { type: 'Date', nullable: true, description: 'Own day of the line (deferred debit card); none: the day of the entry.' }),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    contextId: t.exposeID('contextId', { nullable: true }),
  }),
});

builder.prismaObject('TreasuryRelation', {
  description: 'Person out of the team or household (friend, family, partner…) lines and budgets can be for.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    note: t.exposeString('note', { nullable: true }),
    contributorId: t.exposeID('contributorId', { nullable: true, description: 'Contributor this person also is.' }),
    lineCount: t.relationCount('lines'),
    budgetCount: t.relationCount('budgets'),
  }),
});

const RelationInput = builder.inputType('TreasuryRelationInput', {
  fields: (t) => ({ name: t.string({ required: true }), note: t.string(), contributorId: t.id() }),
});

builder.prismaObject('TreasuryContext', {
  description: 'Context of spending (not in a tree); a line without context is everyday spending.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('TreasuryBudget', {
  description: 'Budget of a month (possibly repeated) for a member (none: the app user), a context (none: everyday) and a category.',
  fields: (t) => ({
    id: t.exposeID('id'),
    month: t.string({ description: 'First month, YYYY-MM.', resolve: (budget) => formatDay(budget.month).slice(0, 7) }),
    memberId: t.exposeID('memberId', { nullable: true }),
    relationId: t.exposeID('relationId', { nullable: true }),
    contextId: t.exposeID('contextId', { nullable: true }),
    categoryId: t.exposeID('categoryId'),
    amount: t.float({ resolve: (budget) => Number(budget.amount) }),
    repeatEvery: t.exposeInt('repeatEvery', { nullable: true, description: 'Every n months; none: that month only.' }),
    repeatUntil: t.string({ nullable: true, description: 'Last month, YYYY-MM; none: no end.', resolve: (budget) => (budget.repeatUntil ? formatDay(budget.repeatUntil).slice(0, 7) : null) }),
  }),
});

const BudgetReportRowRef = builder.objectRef<budgets.BudgetReportRow>('TreasuryBudgetReportRow').implement({
  description: 'A budget of a month and the movements it covers, or what is out of budget.',
  fields: (t) => ({
    month: t.exposeString('month'),
    memberId: t.exposeID('memberId', { nullable: true, description: 'None for a relation.' }),
    relationId: t.exposeID('relationId', { nullable: true }),
    contextId: t.exposeID('contextId', { nullable: true }),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    budget: t.float({ description: 'Positive.', resolve: (row) => fromCents(row.budget) }),
    actual: t.float({ description: 'Signed sum of the actual movements.', resolve: (row) => fromCents(row.actual) }),
    forecast: t.float({ description: 'Signed sum of the forecast movements.', resolve: (row) => fromCents(row.forecast) }),
    budgeted: t.exposeBoolean('budgeted', { description: 'False: out of budget.' }),
  }),
});

const LoanItemRef = builder.objectRef<loans.LoanItem>('TreasuryLoanItem').implement({
  fields: (t) => ({
    lineId: t.exposeID('lineId'),
    entryId: t.exposeID('entryId'),
    date: t.exposeString('date'),
    label: t.exposeString('label'),
    amount: t.exposeFloat('amount', { description: 'Negative: money out (lent, or a debt repaid).' }),
  }),
});

const RelationLoansRef = builder.objectRef<loans.RelationLoans>('TreasuryRelationLoans').implement({
  description: 'Loans with a relation, both ways.',
  fields: (t) => ({
    relationId: t.exposeID('relationId'),
    balance: t.exposeFloat('balance', { description: 'What the relation owes (positive) or is owed (negative).' }),
    out: t.exposeFloat('out', { description: 'Money out to them: lent, or debts repaid.' }),
    in: t.exposeFloat('in', { description: 'Money in from them: borrowed, or loans repaid back.' }),
    items: t.field({ type: [LoanItemRef], resolve: (row) => row.items }),
  }),
});

const StatementRowInput = builder.inputType('TreasuryStatementRowInput', {
  fields: (t) => ({
    date: t.field({ type: 'Date', required: true }),
    label: t.string({ required: true }),
    amount: t.float({ required: true }),
    forecastId: t.id({ description: 'Forecast it realizes.' }),
    occurrence: t.field({ type: 'Date', description: 'Occurrence of a repeated forecast it realizes.' }),
  }),
});

const BudgetInput = builder.inputType('TreasuryBudgetInput', {
  fields: (t) => ({
    month: t.string({ required: true, description: 'YYYY-MM.' }),
    memberId: t.id(),
    relationId: t.id(),
    contextId: t.id(),
    categoryId: t.id({ required: true }),
    amount: t.float({ required: true }),
    repeatEvery: t.int(),
    repeatUntil: t.string({ description: 'YYYY-MM.' }),
  }),
});

builder.prismaObject('TreasuryContextPeriod', {
  description: 'Period a context is planned for: it is proposed to the lines of the entries dated in it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    contextId: t.exposeID('contextId'),
    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date' }),
    note: t.exposeString('note', { nullable: true }),
  }),
});

builder.prismaObject('TreasuryCategory', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    direction: t.field({ type: DirectionEnum, resolve: (category) => category.direction }),
    parentId: t.exposeID('parentId', { nullable: true }),
    entryCount: t.relationCount('entries'),
  }),
});

builder.prismaObject('TreasuryPaymentMethod', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    incoming: t.exposeBoolean('incoming'),
    outgoing: t.exposeBoolean('outgoing'),
    entryCount: t.relationCount('entries'),
  }),
});

builder.prismaObject('TreasuryCounterparty', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    note: t.exposeString('note', { nullable: true }),
    archived: t.exposeBoolean('archived'),
    entryCount: t.relationCount('entries'),
  }),
});

interface LinkedEntry {
  id: string;
  date: Date;
  label: string;
  amount: number;
  status: 'ACTUAL' | 'FORECAST';
}

const LinkedEntryRef = builder.objectRef<LinkedEntry>('TreasuryLinkedEntry').implement({
  description: 'Entry linked to another one (both ways).',
  fields: (t) => ({
    id: t.exposeID('id'),
    date: t.expose('date', { type: 'Date' }),
    label: t.exposeString('label'),
    amount: t.exposeFloat('amount'),
    status: t.field({ type: EntryStatusEnum, resolve: (entry) => entry.status }),
  }),
});

/** Supporting document of an entry: of the library, or of a project. */
interface EntryDocument {
  id: string;
  source: 'LIBRARY' | 'PROJECT';
  kind: string;
  title: string;
  url: string;
  projectId: string | null;
  /** Library folder, or project, it belongs to. */
  place: string;
}

const EntryDocumentRef = builder.objectRef<EntryDocument>('TreasuryEntryDocument').implement({
  description: 'Document of the app supporting an entry: of the library, or of a project.',
  fields: (t) => ({
    id: t.exposeID('id'),
    source: t.exposeString('source', { description: 'LIBRARY or PROJECT.' }),
    kind: t.exposeString('kind', { description: 'FILE or LINK.' }),
    title: t.exposeString('title'),
    url: t.exposeString('url'),
    projectId: t.exposeID('projectId', { nullable: true }),
    place: t.exposeString('place'),
  }),
});

const documentSelect = {
  select: { id: true, kind: true, title: true, url: true, attachment: { select: { id: true, name: true } } },
} as const;

/**
 * Address of a file or link document.
 * @param {{ kind: string, url: string | null, attachment: { id: string, name: string } | null }} document Document.
 * @returns {string} URL.
 */
const documentUrl = (document: { kind: string; url: string | null; attachment: { id: string; name: string } | null }) =>
  document.kind === 'LINK' ? (document.url ?? '') : `/api/attachments/${document.attachment?.id}/${encodeURIComponent(document.attachment?.name ?? 'fichier')}`;

const linkedSelect = { select: { id: true, date: true, label: true, amount: true, status: true } } as const;

/** Line of another entry linked to a line or a whole entry. */
interface LinkedLine {
  id: string;
  entryId: string;
  entryLabel: string;
  date: Date;
  label: string | null;
  /** Signed amount of the line. */
  amount: number;
  status: 'ACTUAL' | 'FORECAST';
}

const LinkedLineRef = builder.objectRef<LinkedLine>('TreasuryLinkedLine').implement({
  description: 'Line of another entry linked to a line or a whole entry.',
  fields: (t) => ({
    id: t.exposeID('id'),
    entryId: t.exposeID('entryId'),
    entryLabel: t.exposeString('entryLabel'),
    date: t.expose('date', { type: 'Date' }),
    label: t.exposeString('label', { nullable: true }),
    amount: t.exposeFloat('amount'),
    status: t.field({ type: EntryStatusEnum, resolve: (line) => line.status }),
  }),
});

const lineLinkSelect = {
  select: { id: true, label: true, mode: true, value: true, entry: { select: { id: true, label: true, date: true, amount: true, status: true } } },
} as const;

/**
 * Linked line as shown: its entry, and its signed amount (a percentage is of the entry amount).
 * @param {object} line Line with its entry.
 * @returns {LinkedLine} Linked line.
 */
function linkedLine(line: {
  id: string;
  label: string | null;
  mode: 'AMOUNT' | 'PERCENT';
  value: { toString(): string };
  entry: { id: string; label: string; date: Date; amount: { toString(): string }; status: 'ACTUAL' | 'FORECAST' };
}): LinkedLine {
  const value = Number(line.value);
  const amount = line.mode === 'PERCENT' ? Math.round(Number(line.entry.amount) * value) / 100 : value;
  return { id: line.id, entryId: line.entry.id, entryLabel: line.entry.label, date: line.entry.date, label: line.label, amount, status: line.entry.status };
}

/**
 * Supporting documents of an entry or a line: of the library, then of projects.
 * @param {object} owner Entry or line with its documents.
 * @returns {EntryDocument[]} Documents.
 */
function supportingDocuments(owner: {
  libraryDocuments: (Parameters<typeof documentUrl>[0] & { id: string; kind: string; title: string; folder: { name: string } | null })[];
  projectResources: (Parameters<typeof documentUrl>[0] & { id: string; kind: string; title: string; project: { id: string; title: string } })[];
}): EntryDocument[] {
  return [
    ...owner.libraryDocuments.map((document) => ({
      id: document.id,
      source: 'LIBRARY' as const,
      kind: document.kind,
      title: document.title,
      url: documentUrl(document),
      projectId: null,
      place: document.folder?.name ?? 'Documents',
    })),
    ...owner.projectResources.map((resource) => ({
      id: resource.id,
      source: 'PROJECT' as const,
      kind: resource.kind,
      title: resource.title,
      url: documentUrl(resource),
      projectId: resource.project.id,
      place: resource.project.title,
    })),
  ];
}

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
    date: t.expose('date', { type: 'Date', description: 'Execution date.' }),
    valueDate: t.expose('valueDate', { type: 'Date' }),
    label: t.exposeString('label'),
    amount: t.float({ resolve: (entry) => Number(entry.amount) }),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    methodId: t.exposeID('methodId', { nullable: true }),
    methodName: t.string({ nullable: true, select: { method: { select: { name: true } } }, resolve: (entry) => entry.method?.name ?? null }),
    clientId: t.exposeID('clientId', { nullable: true }),
    counterpartyId: t.exposeID('counterpartyId', { nullable: true }),
    payerName: t.string({
      nullable: true,
      description: 'Payer or payee: the client or the counterparty.',
      select: { client: { select: { name: true } }, counterparty: { select: { name: true } } },
      resolve: (entry) => entry.client?.name ?? entry.counterparty?.name ?? null,
    }),
    linkedEntries: t.field({
      type: [LinkedEntryRef],
      select: { links: linkedSelect, linkedBy: linkedSelect },
      resolve: (entry) =>
        [...entry.links, ...entry.linkedBy]
          .map((linked) => ({ ...linked, amount: Number(linked.amount) }))
          .sort((a, b) => a.date.getTime() - b.date.getTime()),
    }),
    projectId: t.exposeID('projectId', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    recurrence: t.field({ type: 'JSON', nullable: true, resolve: (entry) => entry.recurrence }),
    allocations: t.relation('allocations'),
    lines: t.relation('lines', { description: 'Split of the amount; what the lines leave is "not split".', query: { orderBy: { position: 'asc' } } }),
    documents: t.field({
      type: [EntryDocumentRef],
      description: 'Supporting documents: of the library, then of projects.',
      select: {
        libraryDocuments: { select: { ...documentSelect.select, folder: { select: { name: true } } } },
        projectResources: { select: { ...documentSelect.select, project: { select: { id: true, title: true } } } },
      },
      resolve: (entry) => supportingDocuments(entry),
    }),
    linkedByLines: t.field({
      type: [LinkedLineRef],
      description: 'Lines of other entries linked to this whole entry.',
      select: { linkedByLines: lineLinkSelect },
      resolve: (entry) => entry.linkedByLines.map(linkedLine),
    }),
  }),
});

builder.prismaObjectFields('TreasuryEntryLine', (t) => ({
  projectId: t.exposeID('projectId', { nullable: true }),
  documents: t.field({
    type: [EntryDocumentRef],
    description: 'Supporting documents: of the library, then of projects.',
    select: {
      libraryDocuments: { select: { ...documentSelect.select, folder: { select: { name: true } } } },
      projectResources: { select: { ...documentSelect.select, project: { select: { id: true, title: true } } } },
    },
    resolve: (line) => supportingDocuments(line),
  }),
  linkedLines: t.field({
    type: [LinkedLineRef],
    description: 'Lines of other entries linked to this one (both ways).',
    select: { links: lineLinkSelect, linkedBy: lineLinkSelect },
    resolve: (line) => [...line.links, ...line.linkedBy].map(linkedLine).sort((a, b) => a.date.getTime() - b.date.getTime()),
  }),
  linkedEntries: t.field({
    type: [LinkedEntryRef],
    description: 'Whole entries (without lines) linked to this line.',
    select: { linkedEntries: linkedSelect },
    resolve: (line) => line.linkedEntries.map((linked) => ({ ...linked, amount: Number(linked.amount) })),
  }),
}));

builder.prismaObject('TreasuryAccount', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    openingBalance: t.float({ resolve: (account) => Number(account.openingBalance) }),
    openingDate: t.expose('openingDate', { type: 'Date' }),
    archived: t.exposeBoolean('archived'),
    csvMapping: t.field({ type: 'JSON', nullable: true, description: 'Columns of its bank statements (CSV), as last mapped.', resolve: (account) => account.csvMapping }),
    entryCount: t.relationCount('entries'),
    balance: t.float({ description: 'Balance today.', resolve: async (account) => fromCents(await treasury.accountBalance(account, today())) }),
  }),
});

builder.prismaObjectFields('AccountingDocument', (t) => ({
  trackingStatus: t.relation('trackingStatus', { nullable: true }),
  sentAt: t.expose('sentAt', { type: 'DateTime', nullable: true }),
  sentVia: t.exposeString('sentVia', { nullable: true, description: 'How it was sent: MAIL, CHORUS, POST, HAND or OTHER.' }),
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
    payerName: t.exposeString('payerName', { nullable: true }),
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

const LineInput = builder.inputType('TreasuryEntryLineInput', {
  fields: (t) => ({
    id: t.id({ description: 'Line kept (its links from other entries stay); none for a new line.' }),
    label: t.string(),
    relationId: t.id({ description: 'Relation it is for, instead of a member.' }),
    loan: t.boolean(),
    date: t.field({ type: 'Date' }),
    mode: t.field({ type: LineModeEnum, required: true }),
    value: t.float({ required: true }),
    memberId: t.id(),
    categoryId: t.id(),
    contextId: t.id(),
    projectId: t.id(),
    libraryDocumentIds: t.idList(),
    projectResourceIds: t.idList(),
    linkedLineIds: t.idList({ description: 'Lines of other entries.' }),
    linkedEntryIds: t.idList({ description: 'Other entries, without lines.' }),
  }),
});

const ContextInput = builder.inputType('TreasuryContextInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

const ContextPeriodInput = builder.inputType('TreasuryContextPeriodInput', {
  fields: (t) => ({
    contextId: t.id({ required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    endDate: t.field({ type: 'Date', required: true }),
    note: t.string(),
  }),
});

const EntryInput = builder.inputType('TreasuryEntryInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    status: t.field({ type: EntryStatusEnum, required: true }),
    date: t.field({ type: 'Date', required: true }),
    valueDate: t.field({ type: 'Date', description: 'The execution date when omitted.' }),
    label: t.string({ required: true }),
    amount: t.float({ required: true }),
    categoryId: t.id(),
    methodId: t.id(),
    clientId: t.id(),
    counterpartyId: t.id(),
    projectId: t.id(),
    note: t.string(),
    recurrence: t.field({ type: 'JSON' }),
    allocations: t.field({ type: [AllocationInput], required: true }),
    linkedEntryIds: t.idList(),
    libraryDocumentIds: t.idList(),
    projectResourceIds: t.idList(),
    lines: t.field({ type: [LineInput], description: 'Split of the amount (none when omitted).' }),
  }),
});

const CategoryInput = builder.inputType('TreasuryCategoryInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    direction: t.field({ type: DirectionEnum, required: true }),
    parentId: t.id(),
  }),
});

const PaymentMethodInput = builder.inputType('TreasuryPaymentMethodInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    incoming: t.boolean({ required: true }),
    outgoing: t.boolean({ required: true }),
  }),
});

const CounterpartyInput = builder.inputType('TreasuryCounterpartyInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    note: t.string(),
    archived: t.boolean({ required: true }),
  }),
});

/**
 * Entry input with omitted optional fields as null.
 * @param {typeof EntryInput.$inferInput} input GraphQL input.
 * @returns {TreasuryEntryInput} Service input.
 */
const entryInput = (input: typeof EntryInput.$inferInput): TreasuryEntryInput => ({
  ...input,
  valueDate: input.valueDate ?? null,
  categoryId: input.categoryId ?? null,
  methodId: input.methodId ?? null,
  clientId: input.clientId ?? null,
  counterpartyId: input.counterpartyId ?? null,
  projectId: input.projectId ?? null,
  linkedEntryIds: input.linkedEntryIds ?? [],
  libraryDocumentIds: input.libraryDocumentIds ?? [],
  projectResourceIds: input.projectResourceIds ?? [],
  note: input.note ?? null,
  recurrence: (input.recurrence ?? null) as TreasuryEntryInput['recurrence'],
  allocations: input.allocations.map((allocation) => ({
    documentId: allocation.documentId ?? null,
    importedDocumentId: allocation.importedDocumentId ?? null,
    amount: allocation.amount,
  })),
  lines: (input.lines ?? []).map((line) => ({
    id: line.id ?? null,
    relationId: line.relationId ?? null,
    loan: line.loan ?? false,
    date: line.date ?? null,
    projectId: line.projectId ?? null,
    libraryDocumentIds: line.libraryDocumentIds ?? [],
    projectResourceIds: line.projectResourceIds ?? [],
    linkedLineIds: line.linkedLineIds ?? [],
    linkedEntryIds: line.linkedEntryIds ?? [],
    label: line.label ?? null,
    mode: line.mode,
    value: line.value,
    memberId: line.memberId ?? null,
    categoryId: line.categoryId ?? null,
    contextId: line.contextId ?? null,
  })),
});

const PaymentInput = builder.inputType('DocumentPaymentInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    date: t.field({ type: 'Date', required: true }),
    amount: t.float({ required: true }),
    methodId: t.id(),
  }),
});

const InvoiceCategoriesRef = builder.objectRef<{ invoiceCategoryId: string | null; creditNoteCategoryId: string | null }>('InvoiceTreasuryCategories').implement({
  fields: (t) => ({
    invoiceCategoryId: t.exposeID('invoiceCategoryId', { nullable: true, description: 'Money in: payments of invoices.' }),
    creditNoteCategoryId: t.exposeID('creditNoteCategoryId', { nullable: true, description: 'Money out: refunds of credit notes.' }),
  }),
});

builder.queryFields((t) => ({
  treasuryMembers: t.prismaField({
    type: ['Contributor'],
    description: 'Members of the team or household: the app user first.',
    resolve: async (query) => {
      const order = (await team.listMembers()).map((member) => member.id);
      const members = await prisma.contributor.findMany({ ...query, where: { id: { in: order } } });
      return members.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    },
  }),
  treasuryBudgets: t.prismaField({
    type: ['TreasuryBudget'],
    resolve: (query) => prisma.treasuryBudget.findMany({ ...query, orderBy: [{ month: 'asc' }, { createdAt: 'asc' }] }),
  }),
  treasuryBudgetReport: t.field({
    type: [BudgetReportRowRef],
    description: 'Budgets of a range of months compared with the actual and forecast movements, and what is out of budget.',
    args: { from: t.arg.string({ required: true }), to: t.arg.string({ required: true }) },
    resolve: async (_root, { from, to }, ctx) => budgets.budgetReport(from, to, ctx.session ? await meContributorId(ctx.session.userId) : null),
  }),
  treasuryRelations: t.prismaField({
    type: ['TreasuryRelation'],
    description: 'People out of the team or household, by name.',
    resolve: (query) => prisma.treasuryRelation.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  treasuryLoans: t.field({
    type: [RelationLoansRef],
    description: 'Loans with the relations, both ways (actual lines marked as loans).',
    resolve: () => loans.relationLoans(),
  }),
  treasuryContexts: t.prismaField({
    type: ['TreasuryContext'],
    resolve: (query) => prisma.treasuryContext.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  treasuryContextPeriods: t.prismaField({
    type: ['TreasuryContextPeriod'],
    resolve: (query) => prisma.treasuryContextPeriod.findMany({ ...query, orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }] }),
  }),
  overdueInvoices: t.prismaField({
    type: ['AccountingDocument'],
    description: `Final invoices still due, sent ${REMINDER_DELAY_DAYS} days ago or more (the sending counts, not the due date), sent first first.`,
    args: { today: t.arg({ type: 'Date', required: true }) },
    resolve: async (query, _root, args, ctx) => {
      const balances = await balancesOf(ctx);
      // Sent on the 1st: reminded from the 16th.
      const sentBefore = parseDay(addDays(args.today, -(REMINDER_DELAY_DAYS - 1)));
      const late = await prisma.accountingDocument.findMany({
        where: { status: 'FINAL', type: { in: ['INVOICE', 'DEPOSIT_INVOICE'] }, sentAt: { lt: sentBefore } },
        select: { id: true },
      });
      const ids = late.filter((document) => (balances.get(document.id)?.balance ?? 0) > 0).map((document) => document.id);
      return prisma.accountingDocument.findMany({ ...query, where: { id: { in: ids } }, orderBy: [{ sentAt: 'asc' }, { number: 'asc' }] });
    },
  }),
  invoiceTreasuryCategories: t.field({
    type: InvoiceCategoriesRef,
    description: 'Treasury categories of the payments of invoices and of the refunds of credit notes: the budgets they count in.',
    resolve: async () => {
      const company = await prisma.companyProfile.findFirst({ select: { invoiceCategoryId: true, creditNoteCategoryId: true } });
      return { invoiceCategoryId: company?.invoiceCategoryId ?? null, creditNoteCategoryId: company?.creditNoteCategoryId ?? null };
    },
  }),
  documentStatuses: t.prismaField({
    type: ['DocumentStatus'],
    resolve: async (query) => {
      // A category added since (credit note to make…) gets its default status.
      if (currentWorkspace().kind === 'PRO') await statuses.ensureDocumentStatuses();
      return prisma.documentStatus.findMany({ ...query, orderBy: [{ scope: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }] });
    },
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
  treasuryCategories: t.prismaField({
    type: ['TreasuryCategory'],
    resolve: (query) => prisma.treasuryCategory.findMany({ ...query, orderBy: [{ direction: 'asc' }, { name: 'asc' }] }),
  }),
  treasuryPaymentMethods: t.prismaField({
    type: ['TreasuryPaymentMethod'],
    resolve: (query) => prisma.treasuryPaymentMethod.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  treasuryCounterparties: t.prismaField({
    type: ['TreasuryCounterparty'],
    resolve: (query) => prisma.treasuryCounterparty.findMany({ ...query, orderBy: [{ archived: 'asc' }, { name: 'asc' }] }),
  }),
  treasuryDocumentOptions: t.field({
    type: [EntryDocumentRef],
    description: 'Documents of the app that can support an entry: the library, then the documents of the projects.',
    resolve: async () => {
      const [documents, resources] = await Promise.all([
        prisma.libraryDocument.findMany({ select: { ...documentSelect.select, folder: { select: { name: true } } }, orderBy: { title: 'asc' } }),
        prisma.projectResource.findMany({
          select: { ...documentSelect.select, project: { select: { id: true, title: true } } },
          orderBy: [{ project: { title: 'asc' } }, { position: 'asc' }],
        }),
      ]);
      return [
        ...documents.map((document) => ({
          id: document.id,
          source: 'LIBRARY' as const,
          kind: document.kind,
          title: document.title,
          url: documentUrl(document),
          projectId: null,
          place: document.folder?.name ?? 'Documents',
        })),
        ...resources.map((resource) => ({
          id: resource.id,
          source: 'PROJECT' as const,
          kind: resource.kind,
          title: resource.title,
          url: documentUrl(resource),
          projectId: resource.project.id,
          place: resource.project.title,
        })),
      ];
    },
  }),
  treasuryEntrySearch: t.prismaField({
    type: ['TreasuryEntry'],
    description: 'Entries whose label contains a text (to link entries), latest first.',
    args: { text: t.arg.string({ required: true }), limit: t.arg.int() },
    resolve: (query, _root, { text, limit }) =>
      prisma.treasuryEntry.findMany({
        ...query,
        where: { label: { contains: text.trim(), mode: 'insensitive' } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(limit ?? 20, 50),
      }),
  }),
  forecastEntries: t.prismaField({
    type: ['TreasuryEntry'],
    description: 'Forecasts (repeated ones once) and actual entries dated after today: the entries of the forecast.',
    resolve: (query) =>
      prisma.treasuryEntry.findMany({
        ...query,
        where: { OR: [{ status: 'FORECAST' }, { status: 'ACTUAL', date: { gt: parseDay(today()) } }] },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
  }),
  treasuryProjection: t.field({
    type: Projection,
    args: { today: t.arg({ type: 'Date', required: true }), from: t.arg({ type: 'Date', required: true }), until: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, args) => treasury.treasuryProjection(args.today, args.from, args.until),
  }),
}));

builder.mutationFields((t) => ({
  addTreasuryMember: t.id({
    description: 'Adds a member: an existing contributor, or a new contributor of this name.',
    args: { contributorId: t.arg.id(), name: t.arg.string() },
    resolve: async (_root, args) => (await team.addMember(args)).id,
  }),
  removeTreasuryMember: t.boolean({
    description: 'Removes a member from the team or household (they stay a contributor).',
    args: { contributorId: t.arg.id({ required: true }) },
    resolve: async (_root, { contributorId }) => {
      await team.removeMember(contributorId);
      return true;
    },
  }),
  saveTreasuryBudget: t.id({
    description: 'Creates a budget (without id), or changes one and its repetitions.',
    args: { id: t.arg.id(), input: t.arg({ type: BudgetInput, required: true }) },
    resolve: async (_root, { id, input }) =>
      (
        await budgets.saveBudget(id ?? null, {
          ...input,
          memberId: input.memberId ?? null,
          relationId: input.relationId ?? null,
          contextId: input.contextId ?? null,
          repeatEvery: input.repeatEvery ?? null,
          repeatUntil: input.repeatUntil ?? null,
        })
      ).id,
  }),
  deleteTreasuryBudget: t.boolean({
    description: 'Deletes a budget and its repetitions.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await budgets.deleteBudget(id);
      return true;
    },
  }),
  saveTreasuryRelation: t.id({
    description: 'Creates a relation (without id) or changes one.',
    args: { id: t.arg.id(), input: t.arg({ type: RelationInput, required: true }) },
    resolve: async (_root, { id, input }) => (await team.saveRelation(id ?? null, { name: input.name, note: input.note ?? null, contributorId: input.contributorId ?? null })).id,
  }),
  deleteTreasuryRelation: t.boolean({
    description: 'Deletes a relation: its budgets go with it, its lines become the app user\'s.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await team.deleteRelation(id);
      return true;
    },
  }),
  importTreasuryStatement: t.field({
    type: 'JSON',
    description: 'Creates the operations of a bank statement in an account (or realizes their forecasts); keeps the column mapping.',
    args: { accountId: t.arg.id({ required: true }), mapping: t.arg({ type: 'JSON' }), rows: t.arg({ type: [StatementRowInput], required: true }) },
    resolve: (_root, { accountId, mapping, rows }) =>
      statements.importStatement({
        accountId,
        mapping: (mapping ?? null) as never,
        rows: rows.map((row) => ({ ...row, forecastId: row.forecastId ?? null, occurrence: row.occurrence ?? null })),
      }),
  }),
  saveTreasuryContext: t.id({
    description: 'Creates a context (without id) or changes one.',
    args: { id: t.arg.id(), input: t.arg({ type: ContextInput, required: true }) },
    resolve: async (_root, { id, input }) => (await team.saveContext(id ?? null, input)).id,
  }),
  deleteTreasuryContext: t.boolean({
    description: 'Deletes a context and its periods; its lines become everyday spending.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await team.deleteContext(id);
      return true;
    },
  }),
  saveTreasuryContextPeriod: t.id({
    description: 'Plans a context between two days (without id), or changes a period. Lines already saved keep their context.',
    args: { id: t.arg.id(), input: t.arg({ type: ContextPeriodInput, required: true }) },
    resolve: async (_root, { id, input }) => (await team.saveContextPeriod(id ?? null, { ...input, note: input.note ?? null })).id,
  }),
  deleteTreasuryContextPeriod: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await team.deleteContextPeriod(id);
      return true;
    },
  }),
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
    description: 'Notes that a document was sent, now or on a past day (date), how (MAIL, CHORUS, POST, HAND, OTHER), and with which "sent" status.',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date' }), via: t.arg.string(), statusId: t.arg.id() },
    resolve: async (_root, { id, date, via, statusId }) => {
      await tracking.markSent(id, { date: date ?? null, via: via ?? null, statusId: statusId ?? null });
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
      await tracking.recordPayment(id, { ...input, methodId: input.methodId ?? null });
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
  setInvoiceTreasuryCategories: t.boolean({
    description: 'Treasury categories of the payments of invoices (money in) and of the refunds of credit notes (money out); null: none.',
    args: { invoiceCategoryId: t.arg.id(), creditNoteCategoryId: t.arg.id() },
    resolve: async (_root, { invoiceCategoryId, creditNoteCategoryId }) => {
      await settings.setInvoiceCategories({ invoiceCategoryId: invoiceCategoryId ?? null, creditNoteCategoryId: creditNoteCategoryId ?? null });
      return true;
    },
  }),
  createTreasuryCategory: t.id({
    args: { input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { input }) => (await settings.createCategory(input as never)).id,
  }),
  updateTreasuryCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await settings.updateCategory(id, input as never);
      return true;
    },
  }),
  deleteTreasuryCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await settings.deleteCategory(id);
      return true;
    },
  }),
  createTreasuryPaymentMethod: t.id({
    args: { input: t.arg({ type: PaymentMethodInput, required: true }) },
    resolve: async (_root, { input }) => (await settings.createPaymentMethod(input as never)).id,
  }),
  updateTreasuryPaymentMethod: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: PaymentMethodInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await settings.updatePaymentMethod(id, input as never);
      return true;
    },
  }),
  deleteTreasuryPaymentMethod: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await settings.deletePaymentMethod(id);
      return true;
    },
  }),
  createTreasuryCounterparty: t.id({
    args: { input: t.arg({ type: CounterpartyInput, required: true }) },
    resolve: async (_root, { input }) => (await settings.createCounterparty(input as never)).id,
  }),
  updateTreasuryCounterparty: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CounterpartyInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await settings.updateCounterparty(id, input as never);
      return true;
    },
  }),
  deleteTreasuryCounterparty: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await settings.deleteCounterparty(id);
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
