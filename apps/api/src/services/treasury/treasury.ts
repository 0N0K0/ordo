import { addDays, daysBetween, formatDay, occurrenceDates, parseDay, parseOptionalDay, splitAmounts, type TreasuryAccountInput, treasuryAccountSchema, type TreasuryEntryInput, treasuryEntrySchema } from '@ordo/shared';
import { prisma } from '../../db';
import { nextPositionIn } from '../core/ordering';
import { Prisma, type TreasuryAccount, type TreasuryEntry } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { storedRecurrence } from '../calendar/calendar-events';
import { documentBalances, importedBalances, syncPaymentStatus } from '../accounting/document-tracking';
import { assertAllExist, assertExists, deleteOrNotFound } from '../core/lookup';
import { assertNoneArchived, assertNotArchived } from '../core/archive';
import { connectIds } from '../core/relations';
import { decimalCents, fromDecimal, toDecimal } from '../core/decimal';

/**
 * Balance of an account at the end of a day: opening balance plus its actual entries since the opening date.
 * @param {TreasuryAccount} account Account.
 * @param {string} date Day (included).
 * @returns {Promise<number>} Balance, in cents.
 */
export async function accountBalance(account: TreasuryAccount, date: string): Promise<number> {
  if (date < formatDay(account.openingDate)) return 0;
  const { _sum } = await prisma.treasuryEntry.aggregate({
    where: { accountId: account.id, status: 'ACTUAL', date: { gte: account.openingDate, lte: parseDay(date) } },
    _sum: { amount: true },
  });
  return decimalCents(account.openingBalance) + decimalCents(_sum.amount);
}

/**
 * Creates an account at the end of the list.
 * @param {TreasuryAccountInput} input Account.
 * @returns {Promise<TreasuryAccount>} Account.
 */
export async function createAccount(input: TreasuryAccountInput): Promise<TreasuryAccount> {
  const data = parseInput(treasuryAccountSchema, input);
  const position = await nextPositionIn('treasuryAccount');
  return prisma.treasuryAccount.create({
    data: { name: data.name, openingBalance: toDecimal(data.openingBalance), openingDate: parseDay(data.openingDate), position },
  });
}

/**
 * Updates an account (name, opening balance and date); not an archived one (restore it first).
 * @param {string} id Account id.
 * @param {TreasuryAccountInput} input Account.
 * @returns {Promise<TreasuryAccount>} Account.
 */
export async function updateAccount(id: string, input: TreasuryAccountInput): Promise<TreasuryAccount> {
  const data = parseInput(treasuryAccountSchema, input);
  await assertExists(prisma.treasuryAccount, id, 'Compte');
  await assertNotArchived('TREASURY_ACCOUNT', id);
  return prisma.treasuryAccount.update({
    where: { id },
    data: { name: data.name, openingBalance: toDecimal(data.openingBalance), openingDate: parseDay(data.openingDate) },
  });
}

/**
 * Deletes an account without entries (an account with entries is archived instead).
 * @param {string} id Account id.
 * @returns {Promise<void>}
 */
export async function deleteAccount(id: string): Promise<void> {
  if (await prisma.treasuryEntry.count({ where: { accountId: id } })) throw clientError('BAD_USER_INPUT', 'Ce compte a des mouvements : archivez-le plutôt.');
  await deleteOrNotFound(prisma.treasuryAccount, id, 'Compte');
}

/**
 * Checks the lines of a split entry: their members, contexts and categories exist, and a category is of the
 * direction of its line (a positive line is money in, whatever the entry).
 * @param {number} amount Signed amount of the entry.
 * @param {ReturnType<typeof treasuryEntrySchema.parse>['lines']} lines Lines.
 * @returns {Promise<void>}
 */
async function assertLines(amount: number, lines: ReturnType<typeof treasuryEntrySchema.parse>['lines'], entryId: string | null): Promise<void> {
  const ids = (key: 'memberId' | 'relationId' | 'categoryId' | 'contextId' | 'projectId') => [...new Set(lines.map((line) => line[key]).filter((id): id is string => typeof id === 'string'))];
  const all = (key: 'libraryDocumentIds' | 'projectResourceIds' | 'linkedLineIds' | 'linkedEntryIds') => [...new Set(lines.flatMap((line) => line[key]))];
  await assertAllExist(prisma.contributor, ids('memberId'), 'Membre');
  await assertAllExist(prisma.treasuryContext, ids('contextId'), 'Contexte');
  await assertAllExist(prisma.treasuryRelation, ids('relationId'), 'Relation');
  await assertAllExist(prisma.project, ids('projectId'), 'Projet');
  await assertAllExist(prisma.libraryDocument, all('libraryDocumentIds'), 'Document');
  await assertAllExist(prisma.projectResource, all('projectResourceIds'), 'Document du projet');
  // Lines kept are lines of this entry.
  const kept = lines.map((line) => line.id).filter((id): id is string => Boolean(id));
  if (kept.length && (!entryId || (await prisma.treasuryEntryLine.count({ where: { id: { in: kept }, entryId } })) !== new Set(kept).size)) throw notFound('Ligne');
  // Linked lines are of other entries; linked whole entries have no lines.
  const linkedLines = await prisma.treasuryEntryLine.findMany({ where: { id: { in: all('linkedLineIds') } }, select: { entryId: true } });
  if (linkedLines.length !== all('linkedLineIds').length) throw notFound('Ligne liée');
  const otherEntry = 'Une ligne se lie à une ligne ou à un mouvement d’un autre mouvement.';
  if (entryId && (linkedLines.some((line) => line.entryId === entryId) || all('linkedEntryIds').includes(entryId))) throw clientError('BAD_USER_INPUT', otherEntry);
  const linkedEntries = await prisma.treasuryEntry.findMany({ where: { id: { in: all('linkedEntryIds') } }, select: { _count: { select: { lines: true } } } });
  if (linkedEntries.length !== all('linkedEntryIds').length) throw notFound('Mouvement lié');
  if (linkedEntries.some((linked) => linked._count.lines > 0)) throw clientError('BAD_USER_INPUT', 'Ce mouvement est décomposé : liez l’une de ses lignes.');
  const categories = new Map(
    (await prisma.treasuryCategory.findMany({ where: { id: { in: ids('categoryId') } }, select: { id: true, direction: true } })).map((category) => [category.id, category.direction]),
  );
  if (categories.size !== ids('categoryId').length) throw notFound('Catégorie');
  const { amounts } = splitAmounts(amount, lines);
  lines.forEach((line, index) => {
    if (!line.categoryId) return;
    if ((categories.get(line.categoryId) === 'IN') !== amounts[index] > 0) {
      const message = amounts[index] > 0 ? 'Choisissez une catégorie d’entrée pour une ligne positive.' : 'Choisissez une catégorie de sortie pour une ligne négative.';
      throw fieldError(`lines.${index}.categoryId`, message);
    }
  });
}

type ParsedLine = ReturnType<typeof treasuryEntrySchema.parse>['lines'][number];

/** Settings items, relations and documents an entry points to, as they were before a change. */
interface EntryRefs {
  accountId: string;
  categoryId: string | null;
  methodId: string | null;
  counterpartyId: string | null;
  lines: { categoryId: string | null; contextId: string | null; relationId: string | null }[];
  allocations: { documentId: string | null; importedDocumentId: string | null }[];
}

/**
 * Refuses an archived account, category, payment method, counterparty, context, relation or settled document newly given
 * to an entry; those it had already stay valid.
 * @param {ReturnType<typeof treasuryEntrySchema.parse>} entry Validated entry.
 * @param {EntryRefs | null} previous What it pointed to before the change, null for a new entry.
 * @returns {Promise<void>}
 */
async function assertNoNewArchived(entry: ReturnType<typeof treasuryEntrySchema.parse>, previous: EntryRefs | null): Promise<void> {
  /**
   * Ids given that the entry did not have.
   * @param {(string | null | undefined)[]} ids Ids given.
   * @param {(string | null | undefined)[]} before Ids it had.
   * @returns {string[]} New ids.
   */
  const added = (ids: (string | null | undefined)[], before: (string | null | undefined)[]) => ids.filter((id): id is string => Boolean(id) && !before.includes(id));
  const lines = previous?.lines ?? [];
  const allocations = previous?.allocations ?? [];
  await assertNoneArchived('TREASURY_ACCOUNT', added([entry.accountId], [previous?.accountId]));
  await assertNoneArchived('TREASURY_CATEGORY', added([entry.categoryId, ...entry.lines.map((line) => line.categoryId)], [previous?.categoryId, ...lines.map((line) => line.categoryId)]));
  await assertNoneArchived('TREASURY_PAYMENT_METHOD', added([entry.methodId], [previous?.methodId]));
  await assertNoneArchived('TREASURY_COUNTERPARTY', added([entry.counterpartyId], [previous?.counterpartyId]));
  await assertNoneArchived('TREASURY_CONTEXT', added(entry.lines.map((line) => line.contextId), lines.map((line) => line.contextId)));
  await assertNoneArchived('TREASURY_RELATION', added(entry.lines.map((line) => line.relationId), lines.map((line) => line.relationId)));
  // Settling an archived document changes it: refused (an allocation it had stays).
  await assertNoneArchived('ACCOUNTING_DOCUMENT', added(entry.allocations.map((allocation) => allocation.documentId), allocations.map((allocation) => allocation.documentId)));
  await assertNoneArchived('IMPORTED_DOCUMENT', added(entry.allocations.map((allocation) => allocation.importedDocumentId), allocations.map((allocation) => allocation.importedDocumentId)));
}

/** What `assertNoNewArchived` reads of a stored entry. */
const ENTRY_REFS = {
  accountId: true,
  categoryId: true,
  methodId: true,
  counterpartyId: true,
  lines: { select: { categoryId: true, contextId: true, relationId: true } },
  allocations: { select: { documentId: true, importedDocumentId: true } },
} as const;

/**
 * Fields of a line row (relations apart).
 * @param {ParsedLine} line Validated line.
 * @param {number} position Position in the entry.
 * @returns {object} Fields.
 */
function lineFields(line: ParsedLine, position: number) {
  return {
    position,
    label: line.label,
    mode: line.mode,
    value: toDecimal(line.value),
    memberId: line.memberId,
    relationId: line.relationId ?? null,
    loan: line.loan,
    date: parseOptionalDay(line.date),
    categoryId: line.categoryId,
    contextId: line.contextId,
    projectId: line.projectId ?? null,
  };
}

/**
 * Relations of a line: documents and links, connected on creation or replacing the previous ones. A link is kept
 * once, from the line saved.
 * @param {ParsedLine} line Validated line.
 * @param {'connect' | 'set'} mode Creation or update.
 * @returns {object} Relation data.
 */
function lineRelations(line: ParsedLine, mode: 'connect' | 'set') {
  return {
    libraryDocuments: { [mode]: connectIds(line.libraryDocumentIds) },
    projectResources: { [mode]: connectIds(line.projectResourceIds) },
    links: { [mode]: connectIds(line.linkedLineIds) },
    linkedEntries: { [mode]: connectIds(line.linkedEntryIds) },
    ...(mode === 'set' ? { linkedBy: { set: [] } } : {}),
  } as Pick<Prisma.TreasuryEntryLineCreateWithoutEntryInput, 'libraryDocuments' | 'projectResources' | 'links' | 'linkedEntries'>;
}

/**
 * Line rows of a new split entry, in their order.
 * @param {ParsedLine[]} lines Validated lines.
 * @returns {Prisma.TreasuryEntryLineUncheckedCreateWithoutEntryInput[]} Rows.
 */
function linesData(lines: readonly ParsedLine[]): Prisma.TreasuryEntryLineUncheckedCreateWithoutEntryInput[] {
  return lines.map((line, position) => ({ ...lineFields(line, position), ...lineRelations(line, 'connect') }));
}

/**
 * Saves the lines of an entry in place: lines kept are updated (their links from other entries stay), the others
 * are deleted, new ones created.
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {string} entryId Entry.
 * @param {ParsedLine[]} lines Validated lines.
 * @returns {Promise<void>}
 */
async function saveLines(tx: Prisma.TransactionClient, entryId: string, lines: readonly ParsedLine[]): Promise<void> {
  const kept = lines.map((line) => line.id).filter((id): id is string => Boolean(id));
  await tx.treasuryEntryLine.deleteMany({ where: { entryId, id: { notIn: kept } } });
  for (const [position, line] of lines.entries()) {
    if (line.id) await tx.treasuryEntryLine.update({ where: { id: line.id }, data: { ...lineFields(line, position), ...lineRelations(line, 'set') } });
    else await tx.treasuryEntryLine.create({ data: { entryId, ...lineFields(line, position), ...lineRelations(line, 'connect') } });
  }
}

/**
 * Validates an entry and the account, project and documents it points to. Money in settles invoices,
 * money out refunds credit notes. Archived items newly given are refused (see `assertNoNewArchived`).
 * @param {TreasuryEntryInput} input Entry.
 * @param {string | null} [id] Entry changed. Optional. Default = a new entry.
 * @param {EntryRefs | null} [previous] What the entry (or the forecast it realizes) pointed to. Optional. Default = nothing.
 * @returns {Promise<ReturnType<typeof treasuryEntrySchema.parse>>} Entry.
 */
async function parseEntry(input: TreasuryEntryInput, id: string | null = null, previous: EntryRefs | null = null) {
  const entry = parseInput(treasuryEntrySchema, input);
  await assertNoNewArchived(entry, previous);
  await assertExists(prisma.treasuryAccount, entry.accountId, 'Compte');
  await assertExists(prisma.project, entry.projectId, 'Projet');
  await assertExists(prisma.client, entry.clientId, 'Client');
  await assertExists(prisma.treasuryCounterparty, entry.counterpartyId, 'Tiers');
  const incoming = entry.amount > 0;
  if (entry.categoryId) {
    const category = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id: entry.categoryId }, select: { direction: true } }), 'Catégorie');
    if ((category.direction === 'IN') !== incoming) {
      const message = incoming ? 'Choisissez une catégorie d’entrée.' : 'Choisissez une catégorie de sortie.';
      throw fieldError('categoryId', message);
    }
  }
  if (entry.methodId) {
    const method = await orNotFound(prisma.treasuryPaymentMethod.findUnique({ where: { id: entry.methodId }, select: { incoming: true, outgoing: true } }), 'Moyen de paiement');
    if (!(incoming ? method.incoming : method.outgoing)) {
      const message = incoming ? 'Ce moyen de paiement ne sert pas aux entrées.' : 'Ce moyen de paiement ne sert pas aux sorties.';
      throw fieldError('methodId', message);
    }
  }
  const libraryIds = [...new Set(entry.libraryDocumentIds)];
  await assertAllExist(prisma.libraryDocument, libraryIds, 'Document');
  const resourceIds = [...new Set(entry.projectResourceIds)];
  await assertAllExist(prisma.projectResource, resourceIds, 'Document du projet');
  const linked = [...new Set(entry.linkedEntryIds)];
  const linkedEntries = await prisma.treasuryEntry.findMany({ where: { id: { in: linked } }, select: { _count: { select: { lines: true } } } });
  if (linkedEntries.length !== linked.length) throw notFound('Mouvement lié');
  // A split entry is linked through its lines.
  if (linkedEntries.some((item) => item._count.lines > 0)) {
    const message = 'Un mouvement décomposé se lie par ses lignes.';
    throw fieldError('linkedEntryIds', message);
  }
  await assertLines(entry.amount, entry.lines, id);
  const wrongWay = 'Une entrée règle des factures, une sortie rembourse des avoirs.';
  for (const allocation of entry.allocations) {
    const document = allocation.documentId
      ? await prisma.accountingDocument.findUnique({ where: { id: allocation.documentId }, select: { type: true, status: true } })
      : await prisma.importedDocument.findUnique({ where: { id: allocation.importedDocumentId ?? '' }, select: { type: true } });
    if (!document || document.type === 'QUOTE' || ('status' in document && document.status !== 'FINAL')) throw notFound('Document');
    if ((document.type === 'CREDIT_NOTE') === incoming) throw fieldError('allocations', wrongWay);
  }
  return entry;
}

/**
 * Prisma data of a validated entry.
 * @param {Awaited<ReturnType<typeof parseEntry>>} entry Entry.
 * @returns {object} Data (allocations apart).
 */
function entryData(entry: Awaited<ReturnType<typeof parseEntry>>) {
  return {
    accountId: entry.accountId,
    status: entry.status,
    date: parseDay(entry.date),
    // Without a value date, the execution date.
    valueDate: parseDay(entry.valueDate ?? entry.date),
    label: entry.label,
    amount: toDecimal(entry.amount),
    categoryId: entry.categoryId,
    methodId: entry.methodId,
    clientId: entry.clientId,
    counterpartyId: entry.counterpartyId,
    projectId: entry.projectId,
    note: entry.note,
    url: entry.url ?? null,
    recurrence: entry.recurrence ? (entry.recurrence as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

/**
 * Supporting documents of a validated entry: connected on creation, replacing the previous ones on update.
 * @param {Awaited<ReturnType<typeof parseEntry>>} entry Entry.
 * @param {'connect' | 'set'} mode Creation or update.
 * @returns {object} Relation data.
 */
function documentsData(entry: Awaited<ReturnType<typeof parseEntry>>, mode: 'connect' | 'set') {
  return {
    libraryDocuments: { [mode]: connectIds(entry.libraryDocumentIds) },
    projectResources: { [mode]: connectIds(entry.projectResourceIds) },
  } as { libraryDocuments: { connect: { id: string }[] }; projectResources: { connect: { id: string }[] } };
}

/**
 * Allocation rows of an entry.
 * @param {Awaited<ReturnType<typeof parseEntry>>} entry Entry.
 * @returns {Prisma.TreasuryAllocationCreateWithoutEntryInput[]} Rows.
 */
function allocationsData(entry: Awaited<ReturnType<typeof parseEntry>>): Prisma.TreasuryAllocationCreateWithoutEntryInput[] {
  return entry.allocations.map((allocation) => ({
    amount: toDecimal(allocation.amount),
    ...(allocation.documentId ? { document: { connect: { id: allocation.documentId } } } : {}),
    ...(allocation.importedDocumentId ? { importedDocument: { connect: { id: allocation.importedDocumentId } } } : {}),
  }));
}

/**
 * Creates an entry with the documents it settles.
 * @param {TreasuryEntryInput} input Entry.
 * @returns {Promise<TreasuryEntry>} Entry.
 */
export async function createEntry(input: TreasuryEntryInput): Promise<TreasuryEntry> {
  const entry = await parseEntry(input);
  const created = await prisma.treasuryEntry.create({
    data: {
      ...entryData(entry),
      ...documentsData(entry, 'connect'),
      allocations: { create: allocationsData(entry) },
      lines: { create: linesData(entry.lines) },
      links: { connect: connectIds(entry.linkedEntryIds) },
    },
  });
  await syncPaymentStatus(entry.allocations.map((allocation) => allocation.documentId));
  return created;
}

/**
 * Replaces an entry and the documents it settles.
 * @param {string} id Entry id.
 * @param {TreasuryEntryInput} input Entry.
 * @returns {Promise<TreasuryEntry>} Entry.
 */
export async function updateEntry(id: string, input: TreasuryEntryInput): Promise<TreasuryEntry> {
  const previous = await orNotFound(prisma.treasuryEntry.findUnique({ where: { id }, select: ENTRY_REFS }), 'Mouvement');
  await assertNotArchived('TREASURY_ENTRY', id);
  const entry = await parseEntry(input, id, previous);
  if (entry.linkedEntryIds.includes(id)) throw fieldError('linkedEntryIds', 'Un mouvement ne peut pas être lié à lui-même.', 'Retirez ce mouvement de ses liens.');
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.treasuryEntry.update({
      where: { id },
      data: {
        ...entryData(entry),
        ...documentsData(entry, 'set'),
        allocations: { deleteMany: {}, create: allocationsData(entry) },
        // A link is kept once, from this side.
        links: { set: connectIds(entry.linkedEntryIds) },
        linkedBy: { set: [] },
        // Split, it is linked through its lines only.
        ...(entry.lines.length ? { linkedByLines: { set: [] } } : {}),
      },
    });
    await saveLines(tx, id, entry.lines);
    return saved;
  });
  await syncPaymentStatus([...previous.allocations.map((allocation) => allocation.documentId), ...entry.allocations.map((allocation) => allocation.documentId)]);
  return updated;
}

/**
 * Deletes an entry; the documents it settled are due again.
 * @param {string} id Entry id.
 * @returns {Promise<void>}
 */
export async function deleteEntry(id: string): Promise<void> {
  const previous = await orNotFound(prisma.treasuryEntry.findUnique({ where: { id }, include: { allocations: { select: { documentId: true } } } }), 'Mouvement');
  await prisma.treasuryEntry.delete({ where: { id } });
  await syncPaymentStatus(previous.allocations.map((allocation) => allocation.documentId));
}

/**
 * Turns a forecast (or one date of a repeated forecast) into an actual entry: the forecast is removed, or the
 * date becomes an exception of its repetition.
 * @param {string} id Forecast entry id.
 * @param {string} occurrence Expected date realized (repeated forecasts).
 * @param {object} actual Actual date and amount.
 * @param {string} actual.date Date.
 * @param {number} actual.amount Signed amount.
 * @returns {Promise<TreasuryEntry>} Actual entry.
 */
export async function realizeForecast(id: string, occurrence: string, actual: { date: string; amount: number }): Promise<TreasuryEntry> {
  const forecast = await prisma.treasuryEntry.findUnique({ where: { id }, include: { lines: { orderBy: { position: 'asc' }, include: { libraryDocuments: { select: { id: true } }, projectResources: { select: { id: true } } } } } });
  if (!forecast || forecast.status !== 'FORECAST') throw notFound('Prévision');
  await assertNotArchived('TREASURY_ENTRY', id);
  const rule = storedRecurrence(forecast.recurrence);
  const entry = await parseEntry(
    {
    accountId: forecast.accountId,
    status: 'ACTUAL',
    date: actual.date,
    valueDate: null,
    label: forecast.label,
    amount: actual.amount,
    categoryId: forecast.categoryId,
    methodId: forecast.methodId,
    clientId: forecast.clientId,
    counterpartyId: forecast.counterpartyId,
    projectId: forecast.projectId,
    note: forecast.note,
    url: forecast.url,
    recurrence: null,
    allocations: [],
    linkedEntryIds: [],
    libraryDocumentIds: [],
    projectResourceIds: [],
    // The split follows (percentages apply to the actual amount), with the projects and documents of its lines.
    lines: forecast.lines.map((line) => ({
      label: line.label,
      mode: line.mode,
      value: fromDecimal(line.value),
      memberId: line.memberId,
      categoryId: line.categoryId,
      contextId: line.contextId,
      relationId: line.relationId,
      loan: line.loan,
      projectId: line.projectId,
      libraryDocumentIds: line.libraryDocuments.map((document) => document.id),
      projectResourceIds: line.projectResources.map((document) => document.id),
      // The links of the forecast stay with it.
    })),
    },
    null,
    // Its own items stay valid, archived or not.
    { ...forecast, allocations: [] },
  );
  return prisma.$transaction(async (tx) => {
    if (rule) {
      await tx.treasuryEntry.update({ where: { id }, data: { recurrence: { ...rule, exceptions: [...new Set([...rule.exceptions, occurrence])] } } });
    } else await tx.treasuryEntry.delete({ where: { id } });
    return tx.treasuryEntry.create({ data: { ...entryData(entry), lines: { create: linesData(entry.lines) } } });
  });
}

/** Expected movement of the forecast. */
export interface ProjectionItem {
  /** Expected date (overdue items are expected today). */
  date: string;
  /** Date it was due. */
  dueDate: string;
  label: string;
  /** Payer or payee: client or counterparty of the entry, client of the document. */
  payerName: string | null;
  /** Signed, in cents. */
  amount: number;
  kind: 'FORECAST' | 'ACTUAL' | 'INVOICE' | 'CREDIT_NOTE' | 'IMPORTED' | 'RECURRING_INVOICE';
  overdue: boolean;
  entryId: string | null;
  documentId: string | null;
  importedDocumentId: string | null;
  recurringInvoiceId: string | null;
  accountId: string | null;
  /** Its entry or document is archived: it still counts (real money), its row is hidden unless asked. */
  archived: boolean;
}

export interface Projection {
  /** Balance of all open accounts today, in cents. */
  balance: number;
  /** Day by day balance: actual until today, forecast after. */
  series: { date: string; balance: number; forecast: boolean }[];
  items: ProjectionItem[];
}

/**
 * Treasury forecast: actual balance over the past days, then today's balance plus the expected movements
 * (forecast entries and their repetitions, what is due on final invoices and credit notes, imported ones
 * not settled, and the coming recurring invoices), overdue ones expected today.
 * @param {string} today Today.
 * @param {string} from First day of the series (past).
 * @param {string} until Last day of the forecast.
 * @returns {Promise<Projection>} Forecast.
 */
export async function treasuryProjection(today: string, from: string, until: string): Promise<Projection> {
  const accounts = await prisma.treasuryAccount.findMany({ where: { archivedAt: null } });
  const accountIds = accounts.map((account) => account.id);
  const expected = (date: string) => (date < today ? today : date);
  const items: ProjectionItem[] = [];
  const base = { entryId: null, documentId: null, importedDocumentId: null, recurringInvoiceId: null, accountId: null, archived: false };

  // Actual entries dated after today, and forecasts.
  const upcoming = await prisma.treasuryEntry.findMany({
    where: { accountId: { in: accountIds }, OR: [{ status: 'FORECAST' }, { status: 'ACTUAL', date: { gt: parseDay(today), lte: parseDay(until) } }] },
    include: { client: { select: { name: true } }, counterparty: { select: { name: true } } },
  });
  for (const entry of upcoming) {
    const start = formatDay(entry.date);
    const rule = storedRecurrence(entry.recurrence);
    const dates = entry.status === 'FORECAST' && rule ? occurrenceDates(rule, start, today, until) : start <= until ? [start] : [];
    for (const date of dates) {
      items.push({
        ...base,
        date: expected(date),
        dueDate: date,
        label: entry.label,
        payerName: entry.client?.name ?? entry.counterparty?.name ?? null,
        amount: decimalCents(entry.amount),
        kind: entry.status,
        overdue: date < today,
        entryId: entry.id,
        accountId: entry.accountId,
        archived: entry.archivedAt !== null,
      });
    }
  }

  /**
   * Item of a document still due: on its due date (else its issue date), late after today, an invoice or a credit note.
   * @param {{ id: string, type: string, number: string | null, issueDate: Date, dueDate: Date | null, archivedAt: Date | null }} document Document.
   * @param {number} balance What remains due.
   * @param {string} clientName Its client.
   * @param {boolean} importedOne Imported (not made in Ordo).
   * @returns {object} Item, its kind and document link aside.
   */
  const dueItem = (
    document: { id: string; type: string; number: string | null; issueDate: Date; dueDate: Date | null; archivedAt: Date | null },
    balance: number,
    clientName: string,
    importedOne: boolean,
  ) => {
    const date = formatDay(document.dueDate ?? document.issueDate);
    const credit = document.type === 'CREDIT_NOTE';
    return {
      ...base,
      date: expected(date),
      dueDate: date,
      label: `${credit ? 'Avoir' : 'Facture'} ${document.number}${importedOne ? ' (importé)' : ''} — ${clientName}`,
      amount: (credit ? -1 : 1) * balance,
      overdue: date < today,
      archived: document.archivedAt !== null,
      credit,
    };
  };

  // What is due on final documents.
  const balances = await documentBalances();
  const due = await prisma.accountingDocument.findMany({
    where: { id: { in: [...balances.entries()].filter(([, item]) => item.balance > 0).map(([id]) => id) } },
    select: { id: true, type: true, number: true, issueDate: true, dueDate: true, archivedAt: true, client: { select: { name: true } } },
  });
  for (const document of due) {
    const { credit, ...item } = dueItem(document, balances.get(document.id)?.balance ?? 0, document.client.name, false);
    items.push({ ...item, payerName: document.client.name, kind: credit ? 'CREDIT_NOTE' : 'INVOICE', documentId: document.id });
  }
  const importedDue = await importedBalances();
  const imported = await prisma.importedDocument.findMany({
    where: { id: { in: [...importedDue.entries()].filter(([, item]) => item.balance > 0).map(([id]) => id) } },
    select: { id: true, type: true, number: true, issueDate: true, dueDate: true, archivedAt: true, clientName: true, client: { select: { name: true } } },
  });
  for (const document of imported) {
    const payerName = document.client?.name ?? document.clientName ?? null;
    const { credit: _credit, ...item } = dueItem(document, importedDue.get(document.id)?.balance ?? 0, payerName ?? '', true);
    items.push({ ...item, payerName, kind: 'IMPORTED', importedDocumentId: document.id });
  }

  // Coming recurring invoices, paid after the same delay as their model.
  const recurring = await prisma.recurringInvoice.findMany({ where: { active: true, archivedAt: null, nextDate: { not: null } }, include: { template: { include: { client: { select: { name: true } } } } } });
  for (const schedule of recurring) {
    const rule = storedRecurrence(schedule.recurrence);
    if (!rule || !schedule.nextDate) continue;
    const delay = schedule.template.dueDate ? daysBetween(formatDay(schedule.template.issueDate), formatDay(schedule.template.dueDate)) : 0;
    for (const date of occurrenceDates(rule, formatDay(schedule.startDate), formatDay(schedule.nextDate), until)) {
      const paidOn = addDays(date, delay);
      if (paidOn > until) continue;
      items.push({
        ...base,
        date: expected(paidOn),
        dueDate: paidOn,
        label: `${schedule.name} — ${schedule.template.client.name}`,
        payerName: schedule.template.client.name,
        amount: decimalCents(schedule.template.totalGross),
        kind: 'RECURRING_INVOICE',
        overdue: false,
        recurringInvoiceId: schedule.id,
      });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);

  // Past: actual balance day by day.
  const balance = (await Promise.all(accounts.map((account) => accountBalance(account, today)))).reduce((sum, value) => sum + value, 0);
  const start = from < today ? from : today;
  const opening = (await Promise.all(accounts.map((account) => accountBalance(account, addDays(start, -1))))).reduce((sum, value) => sum + value, 0);
  const past = await prisma.treasuryEntry.findMany({
    where: { accountId: { in: accountIds }, status: 'ACTUAL', date: { gte: parseDay(start), lte: parseDay(today) } },
    select: { date: true, amount: true, accountId: true },
  });
  const openingDates = new Map(accounts.map((account) => [account.id, formatDay(account.openingDate)]));
  const pastByDay = new Map<string, number>();
  for (const entry of past) {
    const day = formatDay(entry.date);
    // Before its opening date, an account is not counted.
    if (day < (openingDates.get(entry.accountId) ?? '')) continue;
    pastByDay.set(day, (pastByDay.get(day) ?? 0) + decimalCents(entry.amount));
  }
  // An account opened during the period adds its opening balance that day.
  for (const account of accounts) {
    const day = formatDay(account.openingDate);
    if (day >= start && day <= today) pastByDay.set(day, (pastByDay.get(day) ?? 0) + decimalCents(account.openingBalance));
  }
  const series: Projection['series'] = [];
  let running = opening;
  // A period over before today has no forecast.
  const lastPast = until < today ? until : today;
  for (let day = start; day <= lastPast; day = addDays(day, 1)) {
    running += pastByDay.get(day) ?? 0;
    series.push({ date: day, balance: running, forecast: false });
  }
  const futureByDay = new Map<string, number>();
  for (const item of items) futureByDay.set(item.date, (futureByDay.get(item.date) ?? 0) + item.amount);
  if (until < today) return { balance, series, items };
  running = balance;
  // Overdue items (expected today) start the forecast.
  running += futureByDay.get(today) ?? 0;
  series.push({ date: today, balance: running, forecast: true });
  for (let day = addDays(today, 1); day <= until; day = addDays(day, 1)) {
    running += futureByDay.get(day) ?? 0;
    series.push({ date: day, balance: running, forecast: true });
  }
  return { balance, series, items };
}
