import {
  budgetMonths,
  formatDay,
  joinedKey,
  lastDayOfMonth,
  monthOfDate,
  monthOfDay,
  occurrenceDates,
  parseDay,
  parseOptionalDay,
  contextPlanner,
  splitAmounts,
  type TreasuryBudgetInput,
  treasuryBudgetSchema,
  storedRecurrence,
} from '@ordo/shared';
import { prisma } from '../../db';
import { invoiceCategories } from '../accounting/company';
import { parisToday } from '../../today';
import type { TreasuryBudget } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { assertContextsActive } from './treasury-contexts';
import { contextEphemerides } from './treasury-team';
import { treasuryProjection } from './treasury';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertActive, findActive } from '../core/archive';
import { decimalCents, fromDecimal, toDecimal } from '../core/decimal';
import { BY_POSITION } from '../core/ordering';

/** Key of a budget or of what it compares with: member or relation, context (null: everyday), category. */
interface Key {
  /** Null for a relation. */
  memberId: string | null;
  relationId: string | null;
  contextId: string | null;
  categoryId: string | null;
}

/** A row of the comparison: a budget and what was spent (or received) in it, or what is out of budget. */
export interface BudgetReportRow extends Key {
  /** YYYY-MM. */
  month: string;
  /** Positive, in cents (0 out of budget). */
  budget: number;
  /** Signed sums of the actual and forecast movements, in cents. */
  actual: number;
  forecast: number;
  /** False: no budget covers it (out of budget). */
  budgeted: boolean;
}

/**
 * Validated budget data. An archived category, relation or context is refused unless it is the budget's already.
 * @param {TreasuryBudgetInput} input Budget.
 * @param {TreasuryBudget | null} previous Budget changed, or null for a new one.
 * @returns {Promise<object>} Data.
 */
async function budgetData(input: TreasuryBudgetInput, previous: TreasuryBudget | null) {
  const budget = parseInput(treasuryBudgetSchema, input);
  await assertActive(prisma.treasuryCategory, budget.categoryId, 'Catégorie', { keep: previous?.categoryId, field: 'categoryId' });
  await assertExists(prisma.contributor, budget.memberId, 'Membre');
  await assertActive(prisma.treasuryRelation, budget.relationId, 'Relation', { keep: previous?.relationId, field: 'relationId' });
  await assertContextsActive([budget.contextId], { keep: previous?.contextId, field: 'contextId' });
  return {
    month: parseDay(`${budget.month}-01`),
    memberId: budget.relationId ? null : budget.memberId,
    relationId: budget.relationId ?? null,
    contextId: budget.contextId,
    categoryId: budget.categoryId,
    amount: toDecimal(budget.amount),
    repeatEvery: budget.repeatEvery,
    repeatUntil: parseOptionalDay(budget.repeatEvery && budget.repeatUntil ? `${budget.repeatUntil}-01` : null),
  };
}

/**
 * Creates a budget, or changes one (and all its repetitions).
 * @param {string | null} id Budget to change, or null to create one.
 * @param {TreasuryBudgetInput} input Budget.
 * @returns {Promise<TreasuryBudget>} Budget.
 */
export async function saveBudget(id: string | null, input: TreasuryBudgetInput): Promise<TreasuryBudget> {
  if (!id) return prisma.treasuryBudget.create({ data: await budgetData(input, null) });
  const previous = await findActive(prisma.treasuryBudget, id, 'Budget');
  return prisma.treasuryBudget.update({ where: { id }, data: await budgetData(input, previous) });
}

/**
 * Deletes a budget and its repetitions.
 * @param {string} id Budget.
 * @returns {Promise<void>}
 */
export async function deleteBudget(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryBudget, id, 'Budget');
}

/**
 * YYYY-MM of a date.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Month.
 */

/**
 * Budgets of a range of months compared with the actual and forecast movements (loans left out): each line of a split entry (for
 * its relation, or its member; a line without either is the app user's), and what the lines leave or a whole entry without lines (the app
 * user's, in the context planned on its day), counts in the budget of its month, member and context for its
 * category or the closest parent category that has one; without one, it is out of budget. What is expected of
 * the invoices and credit notes counts as forecast in the categories set for them (invoicing settings). Archived
 * budgets are left out (their movements are out of budget); archived movements count (real money).
 * @param {string} from First month (YYYY-MM).
 * @param {string} to Last month (YYYY-MM).
 * @param {string | null} meId Contributor of the app user.
 * @returns {Promise<BudgetReportRow[]>} Rows: budgets first, then what is out of budget.
 */
export async function budgetReport(from: string, to: string, meId: string | null, today: string = parisToday()): Promise<BudgetReportRow[]> {
  const me = meId ?? 'me';
  const [budgets, categories, ephemerides] = await Promise.all([
    prisma.treasuryBudget.findMany({ where: { archivedAt: null, month: { lte: parseDay(`${to}-01`) } } }),
    prisma.treasuryCategory.findMany({ select: { id: true, parentId: true } }),
    contextEphemerides(),
  ]);
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  // The context of a day: that of its éphémérides; none when several contexts cover it.
  const planned = contextPlanner(ephemerides);
  const keyOf = (month: string, key: Key) => joinedKey(month, key.memberId, key.relationId, key.contextId, key.categoryId);
  /**
   * Who a budget or a line is for: its relation, or its member (the app user when none).
   * @param {{ memberId: string | null, relationId: string | null }} row Budget or line.
   * @returns {{ memberId: string | null, relationId: string | null }} Member or relation.
   */
  const whom = (row: { memberId: string | null; relationId: string | null }) => (row.relationId ? { memberId: null, relationId: row.relationId } : { memberId: row.memberId ?? me, relationId: null });

  const rows = new Map<string, BudgetReportRow>();
  for (const budget of budgets) {
    const months = budgetMonths({ month: monthOfDate(budget.month), repeatEvery: budget.repeatEvery, repeatUntil: budget.repeatUntil ? monthOfDate(budget.repeatUntil) : null }, from, to);
    for (const month of months) {
      const key = { ...whom(budget), contextId: budget.contextId, categoryId: budget.categoryId };
      const row = rows.get(keyOf(month, key)) ?? { month, ...key, budget: 0, actual: 0, forecast: 0, budgeted: true };
      row.budget += decimalCents(budget.amount);
      rows.set(keyOf(month, key), row);
    }
  }

  /**
   * Adds a part of a movement to the budget covering it, or out of budget.
   * @param {string} day Day of the movement.
   * @param {Key} key Member, context and category of the part.
   * @param {number} amount Signed amount, in cents.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {void}
   */
  const add = (day: string, key: Key, amount: number, kind: 'actual' | 'forecast') => {
    const month = monthOfDay(day);
    // A line of its own day may fall out of the range (an entry of the range for purchases of the month before).
    if (!amount || month < from || month > to) return;
    const seen = new Set<string>();
    for (let category = key.categoryId; category && !seen.has(category); category = parentOf.get(category) ?? null) {
      seen.add(category);
      const row = rows.get(keyOf(month, { ...key, categoryId: category }));
      if (row?.budgeted) {
        row[kind] += amount;
        return;
      }
    }
    const row = rows.get(keyOf(month, key)) ?? { month, ...key, budget: 0, actual: 0, forecast: 0, budgeted: false };
    row[kind] += amount;
    rows.set(keyOf(month, key), row);
  };

  const first = parseDay(`${from}-01`);
  const last = parseDay(lastDayOfMonth(to));
  const entries = await prisma.treasuryEntry.findMany({
    where: {
      OR: [
        { status: 'ACTUAL', date: { gte: first, lte: last } },
        // Actual entries out of the range with lines of their own day in it (deferred debit card).
        { status: 'ACTUAL', lines: { some: { date: { gte: first, lte: last } } } },
        { status: 'FORECAST', date: { lte: last } },
      ],
    },
    select: { status: true, date: true, amount: true, categoryId: true, recurrence: true, lines: { orderBy: BY_POSITION } },
  });
  for (const entry of entries) {
    const start = formatDay(entry.date);
    const rule = entry.status === 'FORECAST' ? storedRecurrence(entry.recurrence) : null;
    // Out of the range, an actual entry only counts by its lines of their own day (the check of `add`).
    const days = rule ? occurrenceDates(rule, start, `${from}-01`, lastDayOfMonth(to)) : entry.status === 'ACTUAL' || start >= `${from}-01` ? [start] : [];
    const total = fromDecimal(entry.amount);
    const lines = entry.lines.map((line) => ({ ...line, value: fromDecimal(line.value) }));
    const { amounts, remainder } = splitAmounts(total, lines);
    const kind = entry.status === 'ACTUAL' ? 'actual' : 'forecast';
    for (const day of days) {
      // A line of its own day (a purchase paid by a deferred debit card) counts that day.
      // A loan is no spending: out of the budgets.
      lines.forEach(
        (line, index) =>
          !line.loan && add(line.date && kind === 'actual' ? formatDay(line.date) : day, { ...whom(line), contextId: line.contextId, categoryId: line.categoryId }, amounts[index], kind),
      );
      // What the lines leave, or the whole entry: the app user's, in the context planned that day.
      add(day, { memberId: me, relationId: null, contextId: planned(day), categoryId: lines.length ? null : entry.categoryId }, remainder, kind);
    }
  }
  // What is expected of the invoices (due on final and imported ones, coming recurring ones) and credit notes, in
  // the categories set for them: forecast of the app user, in the context planned that day (overdue: today).
  const company = await invoiceCategories();
  if (today <= lastDayOfMonth(to)) {
    const { items } = await treasuryProjection(today, today, lastDayOfMonth(to));
    for (const item of items) {
      if (item.kind === 'FORECAST' || item.kind === 'ACTUAL') continue;
      const categoryId = item.amount < 0 ? company.creditNoteCategoryId : company.invoiceCategoryId;
      add(item.date, { memberId: me, relationId: null, contextId: planned(item.date), categoryId }, item.amount, 'forecast');
    }
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month) || Number(b.budgeted) - Number(a.budgeted));
}
