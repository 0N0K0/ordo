import { EVERYDAY_CONTEXT } from '@ordo/shared';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { itemChoices } from '../../../components/items/item-look';
import { signedText } from '../../../components/money/signed-text';
import { memberOrRelationKey, personKey, ME_KEY } from '../../../components/people/people-keys';
import { meName, personName } from '../../../components/people/people-options';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useTreasurySettings, type BudgetReportRow, type TreasuryBudget } from '../api';
import { categoryChoices, categoryPaths } from '../lib/categories';

/** Key of a budget (or of a row of the report): for whom, context, category. */
export type KeyRow = { memberId?: string | null; relationId?: string | null; contextId?: string | null; categoryId?: string | null };

/**
 * Repetition of a budget, told in words.
 * @param {number | null} every Months between two of its months; none: that month only.
 * @returns {string} Text.
 */
export const repeatLabel = (every: number | null) => (!every ? 'Ce mois seulement' : every === 12 ? 'Tous les ans' : every === 1 ? 'Tous les mois' : `Tous les ${every} mois`);

/**
 * Month in a table cell, capitalized as the « Mois » columns of the other tables.
 * @param {string} month YYYY-MM.
 * @returns {string} "Août 2026".
 */
export const monthCellText = (month: string) => fmt.capitalize(fmt.month(month));

/**
 * Columns of the tables of the budgets (the report of a month, what is out of budget, the budgets defined), with what
 * their cells also name (people, contexts, categories) and the comments of the budgets: in the budgets tab, and in the
 * settings of the treasury (no budget).
 * @param {readonly TreasuryBudget[]} budgets Budgets defined (their comments counted).
 * @returns {object} Columns of each table, and what their cells read.
 */
export function useBudgetColumns(budgets: readonly TreasuryBudget[]) {
  const { data: settings } = useTreasurySettings();
  const categories = settings?.treasuryCategories ?? [];
  const paths = categoryPaths(categories);
  const directionOf = new Map(categories.map((category) => [category.id, category.direction]));
  const memberName = new Map((settings?.treasuryMembers ?? []).map((member) => [member.id, personName(member)]));
  const me = settings?.treasuryMembers.find((member) => member.isMe);
  const contextName = new Map((settings?.treasuryContexts ?? []).map((item) => [item.id, item.label]));
  const relationName = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  /**
   * What a row used of its budget: money out for a category of money out, money in otherwise.
   * @param {BudgetReportRow} row Row.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {number} Amount (positive: used).
   */
  const used = (row: BudgetReportRow, kind: 'actual' | 'forecast') => (row.categoryId && directionOf.get(row.categoryId) === 'IN' ? row[kind] : -row[kind]);
  // "Me" (no member nor relation), and the everyday context, in the filters: ME_KEY.
  const whoKey = (row: { memberId?: string | null; relationId?: string | null }) => memberOrRelationKey({ relationId: row.relationId, memberId: row.memberId !== me?.id ? row.memberId : null });
  const whoChoices = [
    { value: ME_KEY, label: meName(me) },
    ...(settings?.treasuryMembers ?? []).filter((member) => !member.isMe).map((member) => ({ value: personKey('member', member.id), label: member.name })),
    ...(settings?.treasuryRelations ?? []).map((relation) => ({ value: personKey('relation', relation.id), label: relation.name, archived: relation.archived })),
  ];
  /**
   * What is out of budget, counted as the budgets count it: spent (money out) or received (money in) by the direction of
   * its category; without category, signed.
   * @param {BudgetReportRow} row Row.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {number} Amount.
   */
  const outsideUsed = (row: BudgetReportRow, kind: 'actual' | 'forecast') => (row.categoryId && directionOf.has(row.categoryId) ? used(row, kind) : row[kind]);
  /**
   * Amount out of budget, written: signed without category (+ received, − spent).
   * @param {BudgetReportRow} row Row.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {string} Text.
   */
  const outsideText = (row: BudgetReportRow, kind: 'actual' | 'forecast') => (row.categoryId && directionOf.has(row.categoryId) ? fmt.money(used(row, kind)) : signedText(row[kind]));
  /**
   * Who a budget is for, as shown and sorted: a relation, a member, else « Moi ».
   * @param {KeyRow} row Row.
   * @returns {string} Name.
   */
  const whoText = (row: KeyRow) => (row.relationId ? (relationName.get(row.relationId) ?? '') : row.memberId ? (memberName.get(row.memberId) ?? 'Ancien membre') : meName(me));
  /**
   * Context of a budget, as shown and sorted: its own, else the everyday one.
   * @param {KeyRow} row Row.
   * @returns {string} Name.
   */
  const contextText = (row: KeyRow) => (row.contextId ? (contextName.get(row.contextId) ?? '') : EVERYDAY_CONTEXT);
  /**
   * Columns of the key of a budget, sorted by their names.
   * @returns {DataColumn<R>[]} Columns.
   */
  const keyColumns = <R extends KeyRow>(): DataColumn<R>[] => [
    {
      id: 'who',
      bulk: true,
      // « Moi » without member nor relation, the everyday context without context: never empty.
      required: true,
      label: 'Bénéficiaire',
      size: 180,
      sortValue: whoText,
      text: whoText,
      filter: { kind: 'choice', value: (row) => whoKey(row) ?? ME_KEY, options: whoChoices },
      groupable: true,
    },
    {
      id: 'context',
      bulk: true,
      required: true,
      label: 'Contexte',
      size: 160,
      sortValue: contextText,
      text: contextText,
      filter: { kind: 'choice', value: (row) => row.contextId ?? ME_KEY, options: [{ value: ME_KEY, label: EVERYDAY_CONTEXT }, ...itemChoices(settings?.treasuryContexts ?? [])] },
      groupable: true,
    },
    {
      id: 'category',
      bulk: true,
      label: 'Catégorie',
      size: 220,
      locked: true,
      sortValue: (row) => (row.categoryId ? (paths.get(row.categoryId) ?? '') : null),
      text: (row) => (row.categoryId ? (paths.get(row.categoryId) ?? '') : 'Sans catégorie'),
      filter: { kind: 'choice', value: (row) => row.categoryId ?? null, options: categoryChoices(categories) },
      groupable: true,
    },
  ];
  const reportColumns: DataColumn<BudgetReportRow>[] = [
    ...keyColumns<BudgetReportRow>(),
    {
      id: 'budget',
      label: 'Montant du budget',
      required: true,
      size: 140,
      numeric: true,
      sortValue: (row) => row.budget,
      text: (row) => fmt.money(row.budget),
      filter: { kind: 'number', value: (row) => row.budget },
    },
    {
      id: 'actual',
      label: 'Montant réel',
      required: true,
      size: 130,
      numeric: true,
      sortValue: (row) => used(row, 'actual'),
      text: (row) => fmt.money(used(row, 'actual')),
      filter: { kind: 'number', value: (row) => used(row, 'actual') },
    },
    {
      id: 'forecast',
      label: 'Montant prévu',
      required: true,
      size: 130,
      numeric: true,
      sortValue: (row) => used(row, 'forecast'),
      text: (row) => fmt.money(used(row, 'forecast')),
      filter: { kind: 'number', value: (row) => used(row, 'forecast') },
    },
    {
      id: 'left',
      label: 'Montant restant',
      required: true,
      size: 140,
      numeric: true,
      sortValue: (row) => row.budget - used(row, 'actual') - used(row, 'forecast'),
      text: (row) => fmt.money(row.budget - used(row, 'actual') - used(row, 'forecast')),
      filter: { kind: 'number', value: (row) => row.budget - used(row, 'actual') - used(row, 'forecast') },
    },
    {
      id: 'progress',
      label: 'Avancement',
      size: 160,
      sortValue: (row) => (row.budget ? (used(row, 'actual') + used(row, 'forecast')) / row.budget : 0),
      text: (row) => fmt.percent(row.budget ? ((used(row, 'actual') + used(row, 'forecast')) / row.budget) * 100 : 0, 0),
      filter: false,
    },
  ];
  const outsideColumns: DataColumn<BudgetReportRow>[] = [
    ...keyColumns<BudgetReportRow>(),
    {
      id: 'actual',
      label: 'Montant réel',
      required: true,
      size: 130,
      numeric: true,
      sortValue: (row) => outsideUsed(row, 'actual'),
      text: (row) => outsideText(row, 'actual'),
      filter: { kind: 'number', value: (row) => outsideUsed(row, 'actual') },
    },
    {
      id: 'forecast',
      label: 'Montant prévu',
      required: true,
      size: 130,
      numeric: true,
      sortValue: (row) => outsideUsed(row, 'forecast'),
      text: (row) => outsideText(row, 'forecast'),
      filter: { kind: 'number', value: (row) => outsideUsed(row, 'forecast') },
    },
  ];
  const budgetComments = useCommentCounts(
    'BUDGET',
    budgets.map((budget) => budget.id),
  );
  const definedColumns: DataColumn<TreasuryBudget>[] = [
    {
      id: 'month',
      bulk: true,
      required: true,
      label: 'À partir de',
      size: 150,
      sortValue: (budget: TreasuryBudget) => budget.month,
      text: (budget: TreasuryBudget) => monthCellText(budget.month),
      filter: { kind: 'date', value: (budget: TreasuryBudget) => `${budget.month}-01` },
    },
    {
      id: 'amount',
      bulk: true,
      required: true,
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: (budget) => (directionOf.get(budget.categoryId) === 'IN' ? budget.amount : -budget.amount),
      text: (budget) => `${directionOf.get(budget.categoryId) === 'IN' ? '+' : '−'}${fmt.money(budget.amount)}`,
      filter: { kind: 'number', value: (budget) => (directionOf.get(budget.categoryId) === 'IN' ? budget.amount : -budget.amount) },
    },
    ...keyColumns<TreasuryBudget>(),
    {
      id: 'repeat',
      bulk: true,
      required: true,
      label: 'Répétition',
      size: 170,
      sortValue: (budget) => budget.repeatEvery ?? 0,
      text: (budget) => repeatLabel(budget.repeatEvery ?? null),
      groupable: true,
    },
    {
      id: 'until',
      bulk: true,
      label: 'Jusqu’à',
      size: 150,
      sortValue: (budget) => (budget.repeatEvery ? (budget.repeatUntil ?? '9999-12') : budget.month),
      text: (budget) => (budget.repeatEvery ? (budget.repeatUntil ? monthCellText(budget.repeatUntil) : 'Sans fin') : monthCellText(budget.month)),
      filter: { kind: 'date', value: (budget) => (budget.repeatEvery ? (budget.repeatUntil ? `${budget.repeatUntil}-01` : null) : `${budget.month}-01`) },
    },
    commentColumn<TreasuryBudget>(budgetComments, (budget) => budget.id),
  ];
  return { reportColumns, outsideColumns, definedColumns, paths, directionOf, memberName, me, contextName, relationName, used, whoKey, whoChoices, outsideText };
}
