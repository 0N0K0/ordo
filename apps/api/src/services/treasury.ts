import {
  addDays,
  daysBetween,
  formatDay,
  occurrenceDates,
  parseDay,
  toCents,
  treasuryAccountSchema,
  treasuryEntrySchema,
  type TreasuryAccountInput,
  type TreasuryEntryInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type TreasuryAccount, type TreasuryEntry } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';
import { documentBalances, importedBalances, syncPaymentStatus } from './document-tracking';

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
  return toCents(Number(account.openingBalance)) + toCents(Number(_sum.amount ?? 0));
}

/**
 * Creates an account at the end of the list.
 * @param {TreasuryAccountInput} input Account.
 * @returns {Promise<TreasuryAccount>} Account.
 */
export async function createAccount(input: TreasuryAccountInput): Promise<TreasuryAccount> {
  const data = parseInput(treasuryAccountSchema, input);
  const { _max } = await prisma.treasuryAccount.aggregate({ _max: { position: true } });
  return prisma.treasuryAccount.create({
    data: { name: data.name, openingBalance: new Prisma.Decimal(data.openingBalance), openingDate: parseDay(data.openingDate), position: (_max.position ?? -1) + 1 },
  });
}

/**
 * Updates an account (name, opening balance and date) or archives it.
 * @param {string} id Account id.
 * @param {TreasuryAccountInput & { archived: boolean }} input Account.
 * @returns {Promise<TreasuryAccount>} Account.
 */
export async function updateAccount(id: string, input: TreasuryAccountInput & { archived: boolean }): Promise<TreasuryAccount> {
  const data = parseInput(treasuryAccountSchema, input);
  if (!(await prisma.treasuryAccount.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Compte');
  return prisma.treasuryAccount.update({
    where: { id },
    data: { name: data.name, openingBalance: new Prisma.Decimal(data.openingBalance), openingDate: parseDay(data.openingDate), archived: input.archived },
  });
}

/**
 * Deletes an account without entries (an account with entries is archived instead).
 * @param {string} id Account id.
 * @returns {Promise<void>}
 */
export async function deleteAccount(id: string): Promise<void> {
  if (await prisma.treasuryEntry.count({ where: { accountId: id } })) throw clientError('BAD_USER_INPUT', 'Ce compte a des mouvements : archivez-le plutôt.');
  const { count } = await prisma.treasuryAccount.deleteMany({ where: { id } });
  if (!count) throw notFound('Compte');
}

/**
 * Validates an entry and the account, project and documents it points to. Money in settles invoices,
 * money out refunds credit notes.
 * @param {TreasuryEntryInput} input Entry.
 * @returns {Promise<ReturnType<typeof treasuryEntrySchema.parse>>} Entry.
 */
async function parseEntry(input: TreasuryEntryInput) {
  const entry = parseInput(treasuryEntrySchema, input);
  if (!(await prisma.treasuryAccount.findUnique({ where: { id: entry.accountId }, select: { id: true } }))) throw notFound('Compte');
  if (entry.projectId && !(await prisma.project.findUnique({ where: { id: entry.projectId }, select: { id: true } }))) throw notFound('Projet');
  if (entry.clientId && !(await prisma.client.findUnique({ where: { id: entry.clientId }, select: { id: true } }))) throw notFound('Client');
  if (entry.counterpartyId && !(await prisma.treasuryCounterparty.findUnique({ where: { id: entry.counterpartyId }, select: { id: true } }))) throw notFound('Tiers');
  const incoming = entry.amount > 0;
  if (entry.categoryId) {
    const category = await prisma.treasuryCategory.findUnique({ where: { id: entry.categoryId }, select: { direction: true } });
    if (!category) throw notFound('Catégorie');
    if ((category.direction === 'IN') !== incoming) {
      const message = incoming ? 'Choisissez une catégorie d’entrée.' : 'Choisissez une catégorie de sortie.';
      throw clientError('BAD_USER_INPUT', message, { fields: { categoryId: message } });
    }
  }
  if (entry.methodId) {
    const method = await prisma.treasuryPaymentMethod.findUnique({ where: { id: entry.methodId }, select: { incoming: true, outgoing: true } });
    if (!method) throw notFound('Moyen de paiement');
    if (!(incoming ? method.incoming : method.outgoing)) {
      const message = incoming ? 'Ce moyen de paiement ne sert pas aux entrées.' : 'Ce moyen de paiement ne sert pas aux sorties.';
      throw clientError('BAD_USER_INPUT', message, { fields: { methodId: message } });
    }
  }
  const libraryIds = [...new Set(entry.libraryDocumentIds)];
  if (libraryIds.length && (await prisma.libraryDocument.count({ where: { id: { in: libraryIds } } })) !== libraryIds.length) throw notFound('Document');
  const resourceIds = [...new Set(entry.projectResourceIds)];
  if (resourceIds.length && (await prisma.projectResource.count({ where: { id: { in: resourceIds } } })) !== resourceIds.length) throw notFound('Document du projet');
  const linked = [...new Set(entry.linkedEntryIds)];
  if (linked.length && (await prisma.treasuryEntry.count({ where: { id: { in: linked } } })) !== linked.length) throw notFound('Mouvement lié');
  const wrongWay = 'Une entrée règle des factures, une sortie rembourse des avoirs.';
  for (const allocation of entry.allocations) {
    const document = allocation.documentId
      ? await prisma.accountingDocument.findUnique({ where: { id: allocation.documentId }, select: { type: true, status: true } })
      : await prisma.importedDocument.findUnique({ where: { id: allocation.importedDocumentId ?? '' }, select: { type: true } });
    if (!document || document.type === 'QUOTE' || ('status' in document && document.status !== 'FINAL')) throw notFound('Document');
    if ((document.type === 'CREDIT_NOTE') === incoming) throw clientError('BAD_USER_INPUT', wrongWay, { fields: { allocations: wrongWay } });
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
    amount: new Prisma.Decimal(entry.amount),
    categoryId: entry.categoryId,
    methodId: entry.methodId,
    clientId: entry.clientId,
    counterpartyId: entry.counterpartyId,
    projectId: entry.projectId,
    note: entry.note,
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
    libraryDocuments: { [mode]: [...new Set(entry.libraryDocumentIds)].map((id) => ({ id })) },
    projectResources: { [mode]: [...new Set(entry.projectResourceIds)].map((id) => ({ id })) },
  } as { libraryDocuments: { connect: { id: string }[] }; projectResources: { connect: { id: string }[] } };
}

/**
 * Allocation rows of an entry.
 * @param {Awaited<ReturnType<typeof parseEntry>>} entry Entry.
 * @returns {Prisma.TreasuryAllocationCreateWithoutEntryInput[]} Rows.
 */
function allocationsData(entry: Awaited<ReturnType<typeof parseEntry>>): Prisma.TreasuryAllocationCreateWithoutEntryInput[] {
  return entry.allocations.map((allocation) => ({
    amount: new Prisma.Decimal(allocation.amount),
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
    data: { ...entryData(entry), ...documentsData(entry, 'connect'), allocations: { create: allocationsData(entry) }, links: { connect: [...new Set(entry.linkedEntryIds)].map((linkedId) => ({ id: linkedId })) } },
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
  const previous = await prisma.treasuryEntry.findUnique({ where: { id }, include: { allocations: { select: { documentId: true } } } });
  if (!previous) throw notFound('Mouvement');
  const entry = await parseEntry(input);
  if (entry.linkedEntryIds.includes(id)) throw clientError('BAD_USER_INPUT', 'Un mouvement ne peut pas être lié à lui-même.', { fields: { linkedEntryIds: 'Retirez ce mouvement de ses liens.' } });
  const updated = await prisma.treasuryEntry.update({
    where: { id },
    data: {
      ...entryData(entry),
      ...documentsData(entry, 'set'),
      allocations: { deleteMany: {}, create: allocationsData(entry) },
      // A link is kept once, from this side.
      links: { set: [...new Set(entry.linkedEntryIds)].map((linkedId) => ({ id: linkedId })) },
      linkedBy: { set: [] },
    },
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
  const previous = await prisma.treasuryEntry.findUnique({ where: { id }, include: { allocations: { select: { documentId: true } } } });
  if (!previous) throw notFound('Mouvement');
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
  const forecast = await prisma.treasuryEntry.findUnique({ where: { id } });
  if (!forecast || forecast.status !== 'FORECAST') throw notFound('Prévision');
  const rule = storedRecurrence(forecast.recurrence);
  const entry = await parseEntry({
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
    recurrence: null,
    allocations: [],
    linkedEntryIds: [],
    libraryDocumentIds: [],
    projectResourceIds: [],
  });
  return prisma.$transaction(async (tx) => {
    if (rule) {
      await tx.treasuryEntry.update({ where: { id }, data: { recurrence: { ...rule, exceptions: [...new Set([...rule.exceptions, occurrence])] } } });
    } else await tx.treasuryEntry.delete({ where: { id } });
    return tx.treasuryEntry.create({ data: entryData(entry) });
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
  const accounts = await prisma.treasuryAccount.findMany({ where: { archived: false } });
  const accountIds = accounts.map((account) => account.id);
  const expected = (date: string) => (date < today ? today : date);
  const items: ProjectionItem[] = [];
  const base = { entryId: null, documentId: null, importedDocumentId: null, recurringInvoiceId: null, accountId: null };

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
        amount: toCents(Number(entry.amount)),
        kind: entry.status,
        overdue: date < today,
        entryId: entry.id,
        accountId: entry.accountId,
      });
    }
  }

  // What is due on final documents.
  const balances = await documentBalances();
  const due = await prisma.accountingDocument.findMany({
    where: { id: { in: [...balances.entries()].filter(([, item]) => item.balance > 0).map(([id]) => id) } },
    select: { id: true, type: true, number: true, issueDate: true, dueDate: true, client: { select: { name: true } } },
  });
  for (const document of due) {
    const date = formatDay(document.dueDate ?? document.issueDate);
    const credit = document.type === 'CREDIT_NOTE';
    items.push({
      ...base,
      date: expected(date),
      dueDate: date,
      label: `${credit ? 'Avoir' : 'Facture'} ${document.number} — ${document.client.name}`,
      payerName: document.client.name,
      amount: (credit ? -1 : 1) * (balances.get(document.id)?.balance ?? 0),
      kind: credit ? 'CREDIT_NOTE' : 'INVOICE',
      overdue: date < today,
      documentId: document.id,
    });
  }
  const importedDue = await importedBalances();
  const imported = await prisma.importedDocument.findMany({
    where: { id: { in: [...importedDue.entries()].filter(([, item]) => item.balance > 0).map(([id]) => id) } },
    select: { id: true, type: true, number: true, issueDate: true, dueDate: true, clientName: true, client: { select: { name: true } } },
  });
  for (const document of imported) {
    const date = formatDay(document.dueDate ?? document.issueDate);
    const credit = document.type === 'CREDIT_NOTE';
    items.push({
      ...base,
      date: expected(date),
      dueDate: date,
      label: `${credit ? 'Avoir' : 'Facture'} ${document.number} (importé) — ${document.client?.name ?? document.clientName ?? ''}`,
      payerName: document.client?.name ?? document.clientName ?? null,
      amount: (credit ? -1 : 1) * (importedDue.get(document.id)?.balance ?? 0),
      kind: 'IMPORTED',
      overdue: date < today,
      importedDocumentId: document.id,
    });
  }

  // Coming recurring invoices, paid after the same delay as their model.
  const recurring = await prisma.recurringInvoice.findMany({ where: { active: true, nextDate: { not: null } }, include: { template: { include: { client: { select: { name: true } } } } } });
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
        amount: toCents(Number(schedule.template.totalGross)),
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
    pastByDay.set(day, (pastByDay.get(day) ?? 0) + toCents(Number(entry.amount)));
  }
  // An account opened during the period adds its opening balance that day.
  for (const account of accounts) {
    const day = formatDay(account.openingDate);
    if (day >= start && day <= today) pastByDay.set(day, (pastByDay.get(day) ?? 0) + toCents(Number(account.openingBalance)));
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
