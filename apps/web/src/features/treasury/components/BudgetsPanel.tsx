import { useCategoryCreators } from '../hooks/use-settings-items';
import { useActiveWorkspace } from '../../workspaces/api';
import { openFormPanel } from '../../../components/panels/panels';
import { memberOrRelation, memberOrRelationKey, memberRelationOptions, personKey } from '../../../components/people/people-keys';
import { ActionButton } from '../../../components/actions/ActionButton';
import { itemChoices, listSelectProps } from '../../../components/items/item-look';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';

import { Badge, Group, Progress, SegmentedControl, Select, SimpleGrid, Stack, Text, Tooltip, NumberInput } from '@mantine/core';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { MonthPickerInput } from '@mantine/dates';
import { EVERYDAY_CONTEXT, treasuryBudgetSchema } from '@ordo/shared';
import { ChartPieSliceIcon, CopyIcon, PencilSimpleIcon, PlusIcon, WarningIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, unarchived, useSetArchived } from '../../../lib/archive';
import { useState, type ReactNode } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableNumber, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { localToday, monthOfDay } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { ON_ERROR } from '../../../lib/notify';
import { treasuryKey, useTreasuryBudgetMutations, useTreasuryBudgets, useTreasurySettings, type BudgetReportRow, type TreasuryBudget } from '../api';
import { categoryChoices, categoryOptions, categoryPaths } from '../lib/categories';
import { treeSelectProps } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { DirectionBadge } from './DirectionBadge';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { Comments } from '../../comments/components/Comments';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { archiveItemsAction, deleteItemsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { FormActions } from '../../../components/dialogs/FormActions';
import { meName, personName, relationNoun } from '../../../components/people/people-options';
import { dateRangeProps, followBounds, formRange } from '../../../components/inputs/date-range';
import { DIRECTION_PLURALS } from '../lib/direction';

/** Repetitions of a budget: that month only, every X months, or every year (12 months). */
const REPEAT_MODES = [
  { value: 'ONCE', label: 'Ce mois seulement' },
  { value: 'MONTHS', label: 'Tous les X mois' },
  { value: 'YEAR', label: 'Tous les ans' },
];

/**
 * Repetition of a budget, told in words.
 * @param {number | null} every Months between two of its months; none: that month only.
 * @returns {string} Text.
 */
const repeatLabel = (every: number | null) => (!every ? 'Ce mois seulement' : every === 12 ? 'Tous les ans' : every === 1 ? 'Tous les mois' : `Tous les ${every} mois`);

/**
 * Month in words.
 * @param {string} month YYYY-MM.
 * @returns {string} "août 2026".
 */
const monthLabel = (month: string) => fmt.month(month);

/**
 * Month in a table cell, capitalized as the « Mois » columns of the other tables.
 * @param {string} month YYYY-MM.
 * @returns {string} "Août 2026".
 */
const monthCellText = (month: string) => fmt.capitalize(fmt.month(month));

/**
 * Month of a budget, picked in place (or cleared, when it may be empty).
 * @param {{ value: string | null, label: string, nullable?: boolean, minMonth?: string, onSave: (month: string | null) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
function MonthCell({ value, label, nullable = false, minMonth, onSave }: { value: string | null; label: string; nullable?: boolean; minMonth?: string; onSave: (month: string | null) => void }) {
  return (
    <MonthPickerInput
      variant="unstyled"
      size="xs"
      aria-label={label}
      placeholder={nullable ? 'Sans fin' : '—'}
      clearable={nullable}
      minDate={minMonth ? `${minMonth}-01` : undefined}
      value={value ? `${value}-01` : null}
      // « Novembre 2026 », as the month of the other cells.
      styles={{ input: { textTransform: 'capitalize' } }}
      popoverProps={{ withinPortal: true }}
      onChange={(next) => {
        const month = next ? monthOfDay(next) : null;
        if ((month || nullable) && month !== value) onSave(month);
      }}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/** Repetitions offered in a cell (months between two of its months; ONCE: that month only). */
const REPEAT_CHOICES = [
  { value: 'ONCE', label: 'Ce mois seulement' },
  { value: '1', label: 'Tous les mois' },
  { value: '2', label: 'Tous les 2 mois' },
  { value: '3', label: 'Tous les 3 mois' },
  { value: '6', label: 'Tous les 6 mois' },
  { value: '12', label: 'Tous les ans' },
];

interface BudgetValues extends Record<string, unknown> {
  month: string;
  memberId: string | null;
  relationId: string | null;
  contextId: string | null;
  categoryId: string;
  amount: number;
  repeatEvery: number | null;
  repeatUntil: string | null;
}

/**
 * Values of a budget saved, for its form or a change of one field.
 * @param {TreasuryBudget} budget Budget.
 * @returns {BudgetValues} Values.
 */
const budgetValues = (budget: TreasuryBudget): BudgetValues => ({
  month: budget.month,
  memberId: budget.memberId ?? null,
  relationId: budget.relationId ?? null,
  contextId: budget.contextId ?? null,
  categoryId: budget.categoryId,
  amount: budget.amount,
  repeatEvery: budget.repeatEvery ?? null,
  repeatUntil: budget.repeatUntil ?? null,
});

/**
 * Budget form: money out or in, month, member (none: me), context (none: everyday), category of that direction,
 * amount, repetition.
 * @param {{ budget?: TreasuryBudget, defaults?: Partial<BudgetValues>, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function BudgetForm({ budget, defaults, onDone }: { budget?: TreasuryBudget; defaults?: Partial<BudgetValues>; onDone: () => void }) {
  const { data: settings } = useTreasurySettings();
  const { save } = useTreasuryBudgetMutations();
  const { perso } = useActiveWorkspace();
  const members = settings?.treasuryMembers ?? [];
  const categories = settings?.treasuryCategories ?? [];
  const form = useAppForm<BudgetValues>({
    initialValues: {
      month: budget?.month ?? monthOfDay(localToday()),
      memberId: budget?.memberId ?? null,
      relationId: budget?.relationId ?? null,
      contextId: budget?.contextId ?? null,
      categoryId: budget?.categoryId ?? '',
      amount: budget?.amount ?? 0,
      // A new budget comes back every month; one of a single month stays so.
      repeatEvery: budget ? budget.repeatEvery : 1,
      repeatUntil: budget?.repeatUntil ?? null,
      ...defaults,
    },
    schema: treasuryBudgetSchema,
  });
  const values = form.values;
  const months = dateRangeProps(formRange(form, 'month', 'repeatUntil'), { month: true });
  const me = members.find((member) => member.isMe);
  // Money out or in: the direction of the category, unless chosen first (none chosen: money out).
  const [chosenDirection, setDirection] = useState<'OUT' | 'IN' | null>(null);
  // Kept apart from the months: « every 12 months » chosen as such stays so while edited.
  const [repeatMode, setRepeatMode] = useState(() => {
    const every = budget ? budget.repeatEvery : 1;
    return !every ? 'ONCE' : every === 12 ? 'YEAR' : 'MONTHS';
  });
  const direction = chosenDirection ?? (categories.find((category) => category.id === values.categoryId)?.direction as 'OUT' | 'IN' | undefined) ?? 'OUT';
  const createCategory = useCategoryCreators(categories);

  return (
    <Stack gap="lg">
      <form
        noValidate
        onSubmit={form.onSubmit((input) =>
          save.mutate(
            // "Moi" is no member at all.
            {
              id: budget?.id ?? null,
              input: { ...input, memberId: input.memberId === me?.id ? null : input.memberId, relationId: input.relationId ?? null, repeatUntil: input.repeatEvery ? input.repeatUntil : null },
            },
            formCallbacks(form, budget ? 'Budget modifié.' : 'Budget créé.', onDone),
          ),
        )}
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <MonthPickerInput label={values.repeatEvery ? 'À partir de' : 'Mois'} required {...months.start} />
            <AmountInput label={direction === 'OUT' ? 'Sorties prévues' : 'Entrées prévues'} required min={0} prefix={direction === 'OUT' ? '− ' : '+ '} {...form.getInputProps('amount')} />
          </SimpleGrid>
          <SegmentedControl
            fullWidth
            aria-label="Sens du budget"
            data={[
              { value: 'OUT', label: DIRECTION_PLURALS.OUT },
              { value: 'IN', label: DIRECTION_PLURALS.IN },
            ]}
            value={direction}
            onChange={(value) => {
              setDirection(value as 'OUT' | 'IN');
              // A category of the other direction no longer fits.
              if (categories.find((category) => category.id === values.categoryId)?.direction !== value) form.setFieldValue('categoryId', '');
            }}
          />
          <CreatableSelect
            label="Catégorie"
            required
            searchable
            onCreate={createCategory[direction]}
            {...treeSelectProps(categoryOptions(categories, direction, undefined, budget?.categoryId))}
            nothingFoundMessage={direction === 'OUT' ? 'Aucune catégorie de sorties' : 'Aucune catégorie d’entrées'}
            description="Le budget couvre aussi ses sous-catégories qui n’ont pas le leur."
            {...form.getInputProps('categoryId')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Bénéficiaire"
              placeholder={meName(me)}
              clearable
              searchable
              data={memberRelationOptions(members, unarchived(settings?.treasuryRelations ?? [], budget?.relationId), { perso, withMe: false })}
              value={memberOrRelationKey(values)}
              onChange={(key) => form.setValues(memberOrRelation(key))}
              error={form.errors.memberId}
            />
            <Select
              label="Contexte"
              placeholder={EVERYDAY_CONTEXT}
              clearable
              {...listSelectProps(settings?.treasuryContexts ?? [], undefined, budget?.contextId)}
              {...form.getInputProps('contextId')}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Répétition"
              allowDeselect={false}
              data={REPEAT_MODES}
              value={repeatMode}
              onChange={(mode) => {
                setRepeatMode(mode ?? 'ONCE');
                form.setFieldValue('repeatEvery', mode === 'YEAR' ? 12 : mode === 'MONTHS' ? (values.repeatEvery && values.repeatEvery !== 12 ? values.repeatEvery : 1) : null);
              }}
            />
            {repeatMode === 'MONTHS' && (
              <NumberInput
                label="Tous les"
                suffix=" mois"
                min={1}
                max={24}
                allowDecimal={false}
                value={values.repeatEvery ?? 1}
                onChange={(value) => form.setFieldValue('repeatEvery', Math.min(24, Math.max(1, Number(value) || 1)))}
                error={form.errors.repeatEvery}
              />
            )}
            {values.repeatEvery && <MonthPickerInput label="Jusqu’à" placeholder="Sans fin" clearable {...months.end} />}
          </SimpleGrid>
          <FormActions onCancel={onDone} loading={save.isPending} />
        </Stack>
      </form>
      {budget && <Comments target="BUDGET" id={budget.id} readOnly={budget.archived} />}
    </Stack>
  );
}

// A copy is a new budget with the values of another one.
type Dialog = { budget?: TreasuryBudget; defaults?: Partial<BudgetValues>; copy?: boolean };

/**
 * Budgets: those of a month compared with its actual and forecast movements (what is spent, or received, and what
 * is left), what is out of budget (no budget for its member, context and category), and the budgets defined.
 * A movement without lines is mine, a budget without member is mine; a budget covers the sub-categories of its
 * category that have none of their own. Archived budgets are hidden unless the view includes them, read only, and do not
 * count (their movements are out of budget).
 * @returns {JSX.Element} Panel.
 */
export function BudgetsPanel() {
  const { perso } = useActiveWorkspace();
  const [month, setMonth] = useState(() => monthOfDay(localToday()));
  const { data, isPending } = useTreasuryBudgets(month, month);
  const { data: settings } = useTreasurySettings();
  const { remove, save } = useTreasuryBudgetMutations();
  /**
   * « Supprimer » of budgets, on a row as on a selection.
   * @param {TreasuryBudget[]} rows Budgets.
   * @param {() => void} [clear] Clears the selection once done. Optional.
   * @returns {SelectionAction} Action.
   */
  const deleteBudgets = (rows: TreasuryBudget[], clear?: () => void) =>
    deleteItemsAction(rows, {
      noun: 'budget',
      the: 'le budget',
      risks: (subject, one, budgets) => {
        const repeated = budgets.some((budget) => budget.repeatEvery);
        return `${subject}${repeated ? ` et ${one ? 'toutes ses' : 'leurs'} répétitions` : ''} ${one && !repeated ? 'sera supprimé' : 'seront supprimés'} définitivement. ${one ? 'Ses' : 'Leurs'} mouvements seront hors budget s’il n’y en a pas d’autre.`;
      },
      remove: (budget) => remove.mutateAsync(budget.id),
      clear,
    });
  const setArchived = useSetArchived('TREASURY_BUDGET', [treasuryKey]);

  /**
   * Saves fields of a budget changed in their cells (its repetitions follow, as from its form).
   * @param {TreasuryBudget} budget Budget.
   * @param {Partial<BudgetValues>} change Change.
   * @returns {void}
   */
  const saveBudget = (budget: TreasuryBudget, change: Partial<BudgetValues>) =>
    save.mutate(
      {
        id: budget.id,
        input: {
          ...budgetValues(budget),
          ...change,
          // A budget of a single month ends with it.
          ...(change.repeatEvery === null ? { repeatUntil: null } : {}),
        },
      },
      ON_ERROR,
    );
  const categories = settings?.treasuryCategories ?? [];
  const paths = categoryPaths(categories);
  const directionOf = new Map(categories.map((category) => [category.id, category.direction]));
  const memberName = new Map((settings?.treasuryMembers ?? []).map((member) => [member.id, personName(member)]));
  const me = settings?.treasuryMembers.find((member) => member.isMe);
  const contextName = new Map((settings?.treasuryContexts ?? []).map((item) => [item.id, item.label]));
  const relationName = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const rows = data?.treasuryBudgetReport ?? [];
  const budgeted = rows.filter((row) => row.budgeted);
  const outside = rows.filter((row) => !row.budgeted);
  /**
   * Opens the form of a new, changed or copied budget.
   * @param {Dialog} dialog Budget changed, or the values of a new one.
   * @returns {void}
   */
  const openBudget = (dialog: Dialog) =>
    openFormPanel(dialog.budget ? 'Modifier le budget' : dialog.copy ? 'Dupliquer le budget' : 'Nouveau budget', (close) => (
      <BudgetForm budget={dialog.budget} defaults={dialog.defaults} onDone={close} />
    ));

  /**
   * What a row used of its budget: money out for a category of money out, money in otherwise.
   * @param {BudgetReportRow} row Row.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {number} Amount (positive: used).
   */
  const used = (row: BudgetReportRow, kind: 'actual' | 'forecast') => (row.categoryId && directionOf.get(row.categoryId) === 'IN' ? row[kind] : -row[kind]);
  // "Me" (no member nor relation), and the everyday context, in the filters.
  const ME_KEY = 'none';
  const whoKey = (row: { memberId?: string | null; relationId?: string | null }) => memberOrRelationKey({ relationId: row.relationId, memberId: row.memberId !== me?.id ? row.memberId : null });
  const whoChoices = [
    { value: ME_KEY, label: meName(me) },
    ...(settings?.treasuryMembers ?? []).filter((member) => !member.isMe).map((member) => ({ value: personKey('member', member.id), label: member.name })),
    ...(settings?.treasuryRelations ?? []).map((relation) => ({ value: personKey('relation', relation.id), label: relation.name, archived: relation.archived })),
  ];
  // Archived relations, offered only where they are the value already.
  const archivedWho = new Set((settings?.treasuryRelations ?? []).filter((relation) => relation.archived).map((relation) => personKey('relation', relation.id)));
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
  const outsideText = (row: BudgetReportRow, kind: 'actual' | 'forecast') =>
    row.categoryId && directionOf.has(row.categoryId) ? fmt.money(used(row, kind)) : `${row[kind] > 0 ? '+' : ''}${fmt.money(row[kind])}`;
  type KeyRow = { memberId?: string | null; relationId?: string | null; contextId?: string | null; categoryId?: string | null };
  /**
   * Cells of the key of a budget (or of a report row): for whom, context, category.
   * @param {KeyRow} row Budget or row.
   * @returns {Record<string, ReactNode>} Cells, by column.
   */
  const keyContent = (row: KeyRow): Record<string, ReactNode> => ({
    who: (
      <>
        {row.relationId ? (
          <Group gap={6} wrap="nowrap">
            {relationName.get(row.relationId) ?? ''}
            <Badge size="xs" variant="light" color="grape">
              {relationNoun(perso)}
            </Badge>
          </Group>
        ) : row.memberId ? (
          (memberName.get(row.memberId) ?? 'Ancien membre')
        ) : (
          meName(me)
        )}
      </>
    ),
    context: row.contextId ? (contextName.get(row.contextId) ?? '') : EVERYDAY_CONTEXT,
    category: (
      <>
        {row.categoryId ? (
          // The direction of a budget is that of its category.
          <Group gap={6} wrap="nowrap">
            {paths.get(row.categoryId) ?? ''}
            <DirectionBadge direction={directionOf.get(row.categoryId)} />
          </Group>
        ) : (
          <Text c="dimmed">Sans catégorie</Text>
        )}
      </>
    ),
  });
  /**
   * Columns of the key of a budget, sorted by their names.
   * @returns {DataColumn<R>[]} Columns.
   */
  const keyColumns = <R extends KeyRow>(): DataColumn<R>[] => [
    {
      id: 'who',
      bulk: true,
      label: 'Bénéficiaire',
      size: 180,
      sortValue: (row) => (row.relationId ? (relationName.get(row.relationId) ?? '') : row.memberId ? (memberName.get(row.memberId) ?? '') : ''),
      text: (row) => (row.relationId ? (relationName.get(row.relationId) ?? '') : row.memberId ? (memberName.get(row.memberId) ?? 'Ancien membre') : meName(me)),
      filter: { kind: 'choice', value: (row) => whoKey(row) ?? ME_KEY, options: whoChoices },
      groupable: true,
    },
    {
      id: 'context',
      bulk: true,
      label: 'Contexte',
      size: 160,
      sortValue: (row) => (row.contextId ? (contextName.get(row.contextId) ?? '') : ''),
      text: (row) => (row.contextId ? (contextName.get(row.contextId) ?? '') : EVERYDAY_CONTEXT),
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
  const reportView = useDataView({
    tableKey: 'treasury-budget-report',
    title: `Budgets de ${monthLabel(month)}`,
    rows: budgeted,
    columns: [
      ...keyColumns<BudgetReportRow>(),
      {
        id: 'budget',
        label: 'Montant du budget',
        size: 140,
        numeric: true,
        sortValue: (row) => row.budget,
        text: (row) => fmt.money(row.budget),
        filter: { kind: 'number', value: (row) => row.budget },
      },
      {
        id: 'actual',
        label: 'Montant réel',
        size: 130,
        numeric: true,
        sortValue: (row) => used(row, 'actual'),
        text: (row) => fmt.money(used(row, 'actual')),
        filter: { kind: 'number', value: (row) => used(row, 'actual') },
      },
      {
        id: 'forecast',
        label: 'Montant prévu',
        size: 130,
        numeric: true,
        sortValue: (row) => used(row, 'forecast'),
        text: (row) => fmt.money(used(row, 'forecast')),
        filter: { kind: 'number', value: (row) => used(row, 'forecast') },
      },
      {
        id: 'left',
        label: 'Montant restant',
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
    ],
  });
  const outsideView = useDataView({
    tableKey: 'treasury-budget-outside',
    title: `Hors budget de ${monthLabel(month)}`,
    rows: outside,
    columns: [
      ...keyColumns<BudgetReportRow>(),
      {
        id: 'actual',
        label: 'Montant réel',
        size: 130,
        numeric: true,
        sortValue: (row) => outsideUsed(row, 'actual'),
        text: (row) => outsideText(row, 'actual'),
        filter: { kind: 'number', value: (row) => outsideUsed(row, 'actual') },
      },
      {
        id: 'forecast',
        label: 'Montant prévu',
        size: 130,
        numeric: true,
        sortValue: (row) => outsideUsed(row, 'forecast'),
        text: (row) => outsideText(row, 'forecast'),
        filter: { kind: 'number', value: (row) => outsideUsed(row, 'forecast') },
      },
    ],
  });
  const budgetComments = useCommentCounts(
    'BUDGET',
    (data?.treasuryBudgets ?? []).map((budget) => budget.id),
  );
  const definedView = useDataView({
    tableKey: 'treasury-budgets',
    getKey: (budget: TreasuryBudget) => budget.id,
    title: 'Budgets',
    rows: data?.treasuryBudgets ?? [],
    archived: (budget) => budget.archived,
    columns: [
      {
        id: 'month',
        bulk: true,
        label: 'À partir de',
        size: 150,
        sortValue: (budget: TreasuryBudget) => budget.month,
        text: (budget: TreasuryBudget) => monthCellText(budget.month),
        filter: { kind: 'date', value: (budget: TreasuryBudget) => `${budget.month}-01` },
      },
      {
        id: 'amount',
        bulk: true,
        label: 'Montant',
        size: 130,
        numeric: true,
        sortValue: (budget) => (directionOf.get(budget.categoryId) === 'IN' ? budget.amount : -budget.amount),
        text: (budget) => `${directionOf.get(budget.categoryId) === 'IN' ? '+' : '−'}${fmt.money(budget.amount)}`,
        filter: { kind: 'number', value: (budget) => (directionOf.get(budget.categoryId) === 'IN' ? budget.amount : -budget.amount) },
      },
      ...keyColumns<TreasuryBudget>(),
      { id: 'repeat', bulk: true, label: 'Répétition', size: 170, sortValue: (budget) => budget.repeatEvery ?? 0, text: (budget) => repeatLabel(budget.repeatEvery ?? null), groupable: true },
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
    ],
  });

  // Archived budgets are read only.
  const cellLabelOf = bulkCellLabels(definedView, (budget: TreasuryBudget) => (budget.categoryId ? (paths.get(budget.categoryId) ?? 'Budget') : 'Sans catégorie'));
  const bulk = bulkSaver<TreasuryBudget, Partial<BudgetValues>>(definedView, (budget, change) => !budget.archived && Object.keys(change).length > 0 && saveBudget(budget, change));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <MonthPickerInput aria-label="Mois" value={`${month}-01`} onChange={(value) => value && setMonth(monthOfDay(value))} w={200} />
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openBudget({ defaults: { month } })} disabled={!categories.length}>
          Nouveau budget
        </ActionButton>
      </Group>

      <SettingsSection title={`Budgets de ${monthLabel(month)}`}>
        {isPending && !data ? (
          <TableSkeleton rows={3} />
        ) : budgeted.length === 0 ? (
          <EmptyState compact icon={<ChartPieSliceIcon aria-hidden />} message={categories.length ? 'Aucun budget ce mois-ci.' : 'Créez d’abord des catégories (Paramètres).'} />
        ) : (
          <DataTable
            view={reportView}
            verticalSpacing={6}
            getKey={(row) => `${row.memberId}|${row.relationId}|${row.contextId}|${row.categoryId}`}
            cells={(row) => {
              const actual = used(row, 'actual');
              const forecast = used(row, 'forecast');
              const left = row.budget - actual - forecast;
              const ratio = row.budget ? ((actual + forecast) / row.budget) * 100 : 0;
              const actualRatio = row.budget ? (actual / row.budget) * 100 : 0;
              // Money in beyond its budget is good news; money out beyond it is not.
              const income = row.categoryId !== null && directionOf.get(row.categoryId) === 'IN';
              const over = left < 0;
              const barColor = income ? (ratio >= 100 ? 'green' : 'blue') : ratio > 100 ? 'red' : ratio > 80 ? 'orange' : 'blue';
              return {
                ...keyContent(row),
                budget: fmt.money(row.budget),
                actual: fmt.money(actual),
                forecast: (
                  <Text span inherit c="dimmed">
                    {forecast ? fmt.money(forecast) : '—'}
                  </Text>
                ),
                left: (
                  <Text span inherit c={over ? (income ? 'green' : 'red') : undefined} fw={over ? 600 : undefined}>
                    {/* Income beyond its budget: what came in on top. */}
                    {over && income ? `+${fmt.money(-left)}` : fmt.money(left)}
                  </Text>
                ),
                progress: (
                  <>
                    <Tooltip label={`${fmt.percent(ratio, 0)} (réel ${fmt.percent(actualRatio, 0)})${over ? (income ? ' · au-delà du budget' : ' · budget dépassé') : ''}`}>
                      <Progress.Root size="md" aria-label={`${income ? 'Reçu' : 'Utilisé'} à ${fmt.percent(ratio, 0)}`}>
                        <Progress.Section value={Math.min(100, actualRatio)} color={barColor} />
                        <Progress.Section value={Math.max(0, Math.min(100, ratio) - Math.min(100, actualRatio))} color={`${barColor}.3`} />
                      </Progress.Root>
                    </Tooltip>
                  </>
                ),
              };
            }}
          />
        )}
      </SettingsSection>

      {outside.length > 0 && (
        <SettingsSection
          title={
            <>
              <WarningIcon aria-hidden color="var(--mantine-color-orange-6)" style={{ verticalAlign: 'middle', marginRight: 'var(--mantine-spacing-xs)' }} />
              Hors budget
            </>
          }
          description="Mouvements sans budget pour leur membre, contexte et catégorie ce mois-ci."
        >
          <DataTable
            view={outsideView}
            verticalSpacing={6}
            getKey={(row) => `${row.memberId}|${row.relationId}|${row.contextId}|${row.categoryId}`}
            cells={(row) => ({
              ...keyContent(row),
              actual: outsideText(row, 'actual'),
              forecast: (
                <Text span inherit c="dimmed">
                  {row.forecast ? outsideText(row, 'forecast') : '—'}
                </Text>
              ),
            })}
            actions={(row) => (
              <RowActions
                about="ces mouvements"
                primary={
                  row.categoryId && {
                    label: 'Créer le budget',
                    icon: <PlusIcon aria-hidden />,
                    onClick: () =>
                      openBudget({
                        defaults: {
                          month,
                          memberId: row.memberId === me?.id ? null : (row.memberId ?? null),
                          relationId: row.relationId ?? null,
                          contextId: row.contextId ?? null,
                          categoryId: row.categoryId ?? '',
                          amount: Math.abs(row.actual + row.forecast),
                        },
                      }),
                  }
                }
                items={[]}
              />
            )}
          />
        </SettingsSection>
      )}

      <SettingsSection title="Budgets définis">
        {(data?.treasuryBudgets ?? []).length === 0 ? (
          <EmptyState compact message="Aucun budget." />
        ) : (
          <DataTable
            view={definedView}
            selectionLabel={(count) => selectedLabel(count, ['budget', 'budgets'], false)}
            isArchived={(budget) => budget.archived}
            selectionActions={(rows, clear) => [archiveItemsAction(rows, setArchived, { noun: 'budget', clear }), deleteBudgets(rows, clear)]}
            verticalSpacing={4}
            getKey={(budget) => budget.id}
            cells={(budget) =>
              budget.archived
                ? {
                    // Read only.
                    ...keyContent(budget),
                    month: (
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{monthCellText(budget.month)}</Text>
                        <ArchivedBadge size="xs" />
                      </Group>
                    ),
                    amount: `${directionOf.get(budget.categoryId) === 'IN' ? '+' : '−'}${fmt.money(budget.amount)}`,
                    repeat: repeatLabel(budget.repeatEvery ?? null),
                    until: budget.repeatEvery ? (budget.repeatUntil ? monthCellText(budget.repeatUntil) : 'Sans fin') : monthCellText(budget.month),
                  }
                : {
                    month: (
                      <MonthCell
                        value={budget.month}
                        label={cellLabelOf('month', budget, 'Premier mois')}
                        // A first month set after the last one moves the last one to it (decision Q).
                        onSave={(month) => month && bulk('month')(budget, (row) => ({ month, repeatUntil: followBounds([row.month, row.repeatUntil ?? null], 'start', month)[1] }))}
                      />
                    ),
                    repeat: (
                      <EditableSelect
                        value={budget.repeatEvery ? String(budget.repeatEvery) : 'ONCE'}
                        label={cellLabelOf('repeat', budget, 'Répétition')}
                        data={[
                          ...REPEAT_CHOICES,
                          ...(budget.repeatEvery && !REPEAT_CHOICES.some((choice) => choice.value === String(budget.repeatEvery))
                            ? [{ value: String(budget.repeatEvery), label: repeatLabel(budget.repeatEvery) }]
                            : []),
                        ]}
                        onSave={(every) => every && bulk('repeat')(budget, { repeatEvery: every === 'ONCE' ? null : Number(every) })}
                      />
                    ),
                    until: budget.repeatEvery ? (
                      <MonthCell
                        value={budget.repeatUntil ?? null}
                        label={cellLabelOf('until', budget, 'Dernier mois')}
                        nullable
                        minMonth={budget.month}
                        onSave={(repeatUntil) =>
                          bulk('until')(budget, (row) => (row.repeatEvery ? { repeatUntil, month: followBounds([row.month, row.repeatUntil ?? null], 'end', repeatUntil)[0] ?? row.month } : {}))
                        }
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        {monthCellText(budget.month)}
                      </Text>
                    ),
                    ...keyContent(budget),
                    who: (
                      <EditableSelect
                        value={whoKey(budget)}
                        label={cellLabelOf('who', budget, 'Bénéficiaire')}
                        nullable
                        data={whoChoices.filter((choice) => choice.value !== ME_KEY && (!archivedWho.has(choice.value) || choice.value === whoKey(budget)))}
                        onSave={(key) => bulk('who')(budget, memberOrRelation(key))}
                      />
                    ),
                    context: (
                      <EditableSelect
                        value={budget.contextId ?? null}
                        label={cellLabelOf('context', budget, 'Contexte')}
                        nullable
                        data={unarchived(settings?.treasuryContexts ?? [], budget.contextId).map((item) => ({ value: item.id, label: item.label }))}
                        onSave={(contextId) => bulk('context')(budget, { contextId })}
                      />
                    ),
                    category: (
                      <EditableSelect
                        value={budget.categoryId}
                        label={cellLabelOf('category', budget, 'Catégorie')}
                        {...treeSelectProps([...categoryOptions(categories, 'OUT', undefined, budget.categoryId), ...categoryOptions(categories, 'IN', undefined, budget.categoryId)])}
                        onSave={(categoryId) => categoryId && bulk('category')(budget, { categoryId })}
                      />
                    ),
                    // Money out budgeted below zero, money in above: the amount is typed positive.
                    amount: (
                      <Text span inherit c={directionOf.get(budget.categoryId) === 'IN' ? 'green' : 'red'}>
                        <EditableNumber
                          amount
                          value={budget.amount}
                          label={cellLabelOf('amount', budget, 'Montant')}
                          validate={(amount) => (amount > 0 ? null : 'Montant positif attendu.')}
                          onSave={(amount) => amount !== null && bulk('amount')(budget, { amount })}
                        />
                      </Text>
                    ),
                  }
            }
            actions={(budget) => {
              const archiveItem = archiveEntry({ archived: budget.archived, type: 'Budget', label: paths.get(budget.categoryId) ?? '' }, setArchived, budget.id);
              return (
                <RowActions
                  about="le budget"
                  primary={budget.archived ? undefined : { label: 'Modifier (et ses répétitions)', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openBudget({ budget }) }}
                  items={[
                    !budget.archived && {
                      label: 'Dupliquer',
                      icon: <CopyIcon aria-hidden />,
                      onClick: () =>
                        // A new budget with its values, to change (month, category…) before it is saved.
                        openBudget({
                          copy: true,
                          defaults: budgetValues(budget),
                        }),
                    },
                    archiveItem,
                    rowMenuEntry(deleteBudgets([budget])),
                  ]}
                />
              );
            }}
          />
        )}
      </SettingsSection>
    </Stack>
  );
}
