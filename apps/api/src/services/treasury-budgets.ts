import { addDays, budgetMonths, formatDay, occurrenceDates, parseDay, plannedContext, splitAmounts, treasuryBudgetSchema, type TreasuryBudgetInput } from '@ordo/shared';
import { prisma } from '../db';
import type { TreasuryBudget } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';

/** Key of a budget or of what it compares with: member, context (null: everyday), category. */
interface Key {
  memberId: string;
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
 * Validated budget data.
 * @param {TreasuryBudgetInput} input Budget.
 * @returns {Promise<object>} Data.
 */
async function budgetData(input: TreasuryBudgetInput) {
  const budget = parseInput(treasuryBudgetSchema, input);
  if (!(await prisma.treasuryCategory.findUnique({ where: { id: budget.categoryId }, select: { id: true } }))) throw notFound('Catégorie');
  if (budget.memberId && !(await prisma.contributor.findUnique({ where: { id: budget.memberId }, select: { id: true } }))) throw notFound('Membre');
  if (budget.contextId && !(await prisma.treasuryContext.findUnique({ where: { id: budget.contextId }, select: { id: true } }))) throw notFound('Contexte');
  return {
    month: parseDay(`${budget.month}-01`),
    memberId: budget.memberId,
    contextId: budget.contextId,
    categoryId: budget.categoryId,
    amount: new Prisma.Decimal(budget.amount),
    repeatEvery: budget.repeatEvery,
    repeatUntil: budget.repeatEvery && budget.repeatUntil ? parseDay(`${budget.repeatUntil}-01`) : null,
  };
}

/**
 * Creates a budget, or changes one (and all its repetitions).
 * @param {string | null} id Budget to change, or null to create one.
 * @param {TreasuryBudgetInput} input Budget.
 * @returns {Promise<TreasuryBudget>} Budget.
 */
export async function saveBudget(id: string | null, input: TreasuryBudgetInput): Promise<TreasuryBudget> {
  const data = await budgetData(input);
  if (!id) return prisma.treasuryBudget.create({ data });
  if (!(await prisma.treasuryBudget.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Budget');
  return prisma.treasuryBudget.update({ where: { id }, data });
}

/**
 * Deletes a budget and its repetitions.
 * @param {string} id Budget.
 * @returns {Promise<void>}
 */
export async function deleteBudget(id: string): Promise<void> {
  const { count } = await prisma.treasuryBudget.deleteMany({ where: { id } });
  if (!count) throw notFound('Budget');
}

/**
 * YYYY-MM of a date.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Month.
 */
const monthOf = (day: string) => day.slice(0, 7);

/**
 * Last day of a month.
 * @param {string} month YYYY-MM.
 * @returns {string} YYYY-MM-DD.
 */
function lastDay(month: string): string {
  const [year, value] = month.split('-').map(Number);
  return addDays(`${value === 12 ? year + 1 : year}-${String((value % 12) + 1).padStart(2, '0')}-01`, -1);
}

/**
 * Budgets of a range of months compared with the actual and forecast movements: each line of a split entry (a
 * line without member is the app user's), and what the lines leave or a whole entry without lines (the app
 * user's, in the context planned on its day), counts in the budget of its month, member and context for its
 * category or the closest parent category that has one; without one, it is out of budget.
 * @param {string} from First month (YYYY-MM).
 * @param {string} to Last month (YYYY-MM).
 * @param {string | null} meId Contributor of the app user.
 * @returns {Promise<BudgetReportRow[]>} Rows: budgets first, then what is out of budget.
 */
export async function budgetReport(from: string, to: string, meId: string | null): Promise<BudgetReportRow[]> {
  const me = meId ?? 'me';
  const [budgets, categories, periods] = await Promise.all([
    prisma.treasuryBudget.findMany({ where: { month: { lte: parseDay(`${to}-01`) } } }),
    prisma.treasuryCategory.findMany({ select: { id: true, parentId: true } }),
    prisma.treasuryContextPeriod.findMany(),
  ]);
  const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
  const planned = periods.map((period) => ({ contextId: period.contextId, startDate: formatDay(period.startDate), endDate: formatDay(period.endDate) }));
  const keyOf = (month: string, key: Key) => `${month}|${key.memberId}|${key.contextId ?? ''}|${key.categoryId ?? ''}`;

  const rows = new Map<string, BudgetReportRow>();
  for (const budget of budgets) {
    const months = budgetMonths(
      { month: monthOf(formatDay(budget.month)), repeatEvery: budget.repeatEvery, repeatUntil: budget.repeatUntil ? monthOf(formatDay(budget.repeatUntil)) : null },
      from,
      to,
    );
    for (const month of months) {
      const key = { memberId: budget.memberId ?? me, contextId: budget.contextId, categoryId: budget.categoryId };
      const row = rows.get(keyOf(month, key)) ?? { month, ...key, budget: 0, actual: 0, forecast: 0, budgeted: true };
      row.budget += Math.round(Number(budget.amount) * 100);
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
    if (!amount) return;
    const month = monthOf(day);
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
  const last = parseDay(lastDay(to));
  const entries = await prisma.treasuryEntry.findMany({
    where: {
      OR: [
        { status: 'ACTUAL', date: { gte: first, lte: last } },
        { status: 'FORECAST', date: { lte: last } },
      ],
    },
    select: { status: true, date: true, amount: true, categoryId: true, recurrence: true, lines: { orderBy: { position: 'asc' } } },
  });
  for (const entry of entries) {
    const start = formatDay(entry.date);
    const rule = entry.status === 'FORECAST' ? storedRecurrence(entry.recurrence) : null;
    const days = rule ? occurrenceDates(rule, start, `${from}-01`, lastDay(to)) : start >= `${from}-01` ? [start] : [];
    const total = Number(entry.amount);
    const lines = entry.lines.map((line) => ({ ...line, value: Number(line.value) }));
    const { amounts, remainder } = splitAmounts(total, lines);
    const kind = entry.status === 'ACTUAL' ? 'actual' : 'forecast';
    for (const day of days) {
      lines.forEach((line, index) => add(day, { memberId: line.memberId ?? me, contextId: line.contextId, categoryId: line.categoryId }, amounts[index], kind));
      // What the lines leave, or the whole entry: the app user's, in the context planned that day.
      add(day, { memberId: me, contextId: plannedContext(planned, day), categoryId: lines.length ? null : entry.categoryId }, remainder, kind);
    }
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month) || Number(b.budgeted) - Number(a.budgeted));
}
