import { ActionButton } from '../../components/actions/ActionButton';
import { listSelectProps } from '../../components/settings/item-look';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { SidePanel } from '../../components/panels/SidePanel';
import { Badge, Group, Paper, Progress, SegmentedControl, Select, SimpleGrid, Stack, Text, Title, Tooltip, NumberInput } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { EVERYDAY_CONTEXT, treasuryBudgetSchema } from '@ordo/shared';
import { ChartPieSliceIcon, CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { DataTable } from '../../components/data-table/DataTable';
import { bulkSaver } from '../../components/data-table/bulk-edit';
import { EditableNumber, EditableSelect } from '../../components/data-table/EditableCells';
import { useDataView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess, onMutationError } from '../../lib/notify';
import { useTreasuryBudgetMutations, useTreasuryBudgets, useTreasurySettings, type BudgetReportRow, type TreasuryBudget, useTreasuryMutations } from './api';
import { categoryOptions, categoryPaths } from './categories';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import * as fmt from '../../lib/format';
import { AmountInput } from '../../components/AmountInput';
import { Comments } from '../comments/Comments';
import { useCommentCounts } from '../comments/api';
import { commentColumn } from '../comments/comment-column';
import { CreatableSelect } from '../../components/CreatableSelect';
import { deleteRowsAction } from '../../components/data-table/selection-actions';
import { selectedLabel } from '../../components/data-table/selection-label';
import { useDefaultColor } from '../workspace/use-default-color';
import { FormActions } from '../../components/dialogs/FormActions';

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
      valueFormat="MMMM YYYY"
      popoverProps={{ withinPortal: true }}
      onChange={(next) => {
        const month = next ? String(next).slice(0, 7) : null;
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
 * Direction of a budget (that of its category): money out or in.
 * @param {{ direction: string | undefined }} props Direction.
 * @returns {JSX.Element | null} Badge.
 */
function DirectionBadge({ direction }: { direction: string | undefined }) {
  if (!direction) return null;
  return (
    <Badge size="xs" variant="light" color={direction === 'IN' ? 'green' : 'red'}>
      {direction === 'IN' ? 'Entrée' : 'Sortie'}
    </Badge>
  );
}

/**
 * Budget form: money out or in, month, member (none: me), context (none: everyday), category of that direction,
 * amount, repetition.
 * @param {{ budget?: TreasuryBudget, defaults?: Partial<BudgetValues>, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function BudgetForm({ budget, defaults, onDone }: { budget?: TreasuryBudget; defaults?: Partial<BudgetValues>; onDone: () => void }) {
  const { createCategory } = useTreasuryMutations();
  const color = useDefaultColor();
  const { data: settings } = useTreasurySettings();
  const { save } = useTreasuryBudgetMutations();
  const members = settings?.treasuryMembers ?? [];
  const categories = settings?.treasuryCategories ?? [];
  const form = useAppForm<BudgetValues>({
    initialValues: {
      month: budget?.month ?? localToday().slice(0, 7),
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
  const me = members.find((member) => member.isMe);
  // Money out or in: the direction of the category, unless chosen first (none chosen: money out).
  const [chosenDirection, setDirection] = useState<'OUT' | 'IN' | null>(null);
  // Kept apart from the months: « every 12 months » chosen as such stays so while edited.
  const [repeatMode, setRepeatMode] = useState(() => {
    const every = budget ? budget.repeatEvery : 1;
    return !every ? 'ONCE' : every === 12 ? 'YEAR' : 'MONTHS';
  });
  const direction = chosenDirection ?? (categories.find((category) => category.id === values.categoryId)?.direction as 'OUT' | 'IN' | undefined) ?? 'OUT';

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
            { onSuccess: () => (notifySuccess(budget ? 'Budget modifié.' : 'Budget créé.'), onDone()), onError: (error) => showFormError(form, error) },
          ),
        )}
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <MonthPickerInput
              label={values.repeatEvery ? 'À partir de' : 'Mois'}
              required
              value={`${values.month}-01`}
              onChange={(value) => value && form.setFieldValue('month', String(value).slice(0, 7))}
              error={form.errors.month}
            />
            <AmountInput
              label={direction === 'OUT' ? 'Sorties prévues' : 'Entrées prévues'}
              required
              min={0}
              suffix=" €"
              prefix={direction === 'OUT' ? '− ' : '+ '}
              {...form.getInputProps('amount')}
            />
          </SimpleGrid>
          <SegmentedControl
            fullWidth
            aria-label="Sens du budget"
            data={[
              { value: 'OUT', label: 'Sorties (dépenses)' },
              { value: 'IN', label: 'Entrées (recettes)' },
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
            onCreate={(name) => createCategory.mutateAsync({ name, color, direction: direction ?? 'OUT', parentId: null })}
            {...treeSelectProps(categoryOptions(categories, direction))}
            nothingFoundMessage={direction === 'OUT' ? 'Aucune catégorie de sorties' : 'Aucune catégorie d’entrées'}
            description="Le budget couvre aussi ses sous-catégories qui n’ont pas le leur."
            {...form.getInputProps('categoryId')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <Select
              label="Bénéficiaire"
              placeholder={me ? `${me.name} (moi)` : 'Moi'}
              clearable
              searchable
              data={[
                { group: 'Membres', items: members.filter((member) => !member.isMe).map((member) => ({ value: `m:${member.id}`, label: member.name })) },
                { group: 'Relations', items: (settings?.treasuryRelations ?? []).map((relation) => ({ value: `r:${relation.id}`, label: relation.name })) },
              ].filter((group) => group.items.length)}
              value={values.relationId ? `r:${values.relationId}` : values.memberId ? `m:${values.memberId}` : null}
              onChange={(key) => form.setValues({ memberId: key?.startsWith('m:') ? key.slice(2) : null, relationId: key?.startsWith('r:') ? key.slice(2) : null })}
              error={form.errors.memberId}
            />
            <Select label="Contexte" placeholder={EVERYDAY_CONTEXT} clearable {...listSelectProps(settings?.treasuryContexts ?? [])} {...form.getInputProps('contextId')} />
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
            {values.repeatEvery && (
              <MonthPickerInput
                label="Jusqu’à"
                placeholder="Sans fin"
                clearable
                minDate={`${values.month}-01`}
                value={values.repeatUntil ? `${values.repeatUntil}-01` : null}
                onChange={(value) => form.setFieldValue('repeatUntil', value ? String(value).slice(0, 7) : null)}
                error={form.errors.repeatUntil}
              />
            )}
          </SimpleGrid>
          <FormActions onCancel={onDone} loading={save.isPending} />
        </Stack>
      </form>
      {budget && <Comments target="BUDGET" id={budget.id} />}
    </Stack>
  );
}

// A copy is a new budget with the values of another one.
type Dialog = { budget?: TreasuryBudget; defaults?: Partial<BudgetValues>; copy?: boolean } | null;

/**
 * Budgets: those of a month compared with its actual and forecast movements (what is spent, or received, and what
 * is left), what is out of budget (no budget for its member, context and category), and the budgets defined.
 * A movement without lines is mine, a budget without member is mine; a budget covers the sub-categories of its
 * category that have none of their own.
 * @returns {JSX.Element} Panel.
 */
export function BudgetsPanel() {
  const [month, setMonth] = useState(() => localToday().slice(0, 7));
  const { data, isPending } = useTreasuryBudgets(month, month);
  const { data: settings } = useTreasurySettings();
  const { remove, save } = useTreasuryBudgetMutations();

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
          month: budget.month,
          memberId: budget.memberId ?? null,
          relationId: budget.relationId ?? null,
          contextId: budget.contextId ?? null,
          categoryId: budget.categoryId,
          amount: budget.amount,
          repeatEvery: budget.repeatEvery ?? null,
          repeatUntil: budget.repeatUntil ?? null,
          ...change,
          // A budget of a single month ends with it.
          ...(change.repeatEvery === null ? { repeatUntil: null } : {}),
        },
      },
      { onError: onMutationError },
    );
  const [dialog, setDialog] = useState<Dialog>(null);
  const categories = settings?.treasuryCategories ?? [];
  const paths = categoryPaths(categories);
  const directionOf = new Map(categories.map((category) => [category.id, category.direction]));
  const memberName = new Map((settings?.treasuryMembers ?? []).map((member) => [member.id, member.isMe ? `${member.name} (moi)` : member.name]));
  const me = settings?.treasuryMembers.find((member) => member.isMe);
  const contextName = new Map((settings?.treasuryContexts ?? []).map((item) => [item.id, item.name]));
  const relationName = new Map((settings?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const rows = data?.treasuryBudgetReport ?? [];
  const budgeted = rows.filter((row) => row.budgeted);
  const outside = rows.filter((row) => !row.budgeted);
  const close = () => setDialog(null);

  /**
   * What a row used of its budget: money out for a category of money out, money in otherwise.
   * @param {BudgetReportRow} row Row.
   * @param {'actual' | 'forecast'} kind Actual or forecast.
   * @returns {number} Amount (positive: used).
   */
  const used = (row: BudgetReportRow, kind: 'actual' | 'forecast') => (row.categoryId && directionOf.get(row.categoryId) === 'IN' ? row[kind] : -row[kind]);
  // "Me" (no member nor relation), and the everyday context, in the filters.
  const ME_KEY = 'none';
  const whoKey = (row: { memberId?: string | null; relationId?: string | null }) => (row.relationId ? `r:${row.relationId}` : row.memberId && row.memberId !== me?.id ? `m:${row.memberId}` : null);
  const whoChoices = [
    { value: ME_KEY, label: `${me?.name ?? 'Moi'} (moi)` },
    ...(settings?.treasuryMembers ?? []).filter((member) => !member.isMe).map((member) => ({ value: `m:${member.id}`, label: member.name })),
    ...(settings?.treasuryRelations ?? []).map((relation) => ({ value: `r:${relation.id}`, label: relation.name })),
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
              Relation
            </Badge>
          </Group>
        ) : row.memberId ? (
          (memberName.get(row.memberId) ?? 'Ancien membre')
        ) : (
          `${me?.name ?? 'Moi'} (moi)`
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
      text: (row) => (row.relationId ? (relationName.get(row.relationId) ?? '') : row.memberId ? (memberName.get(row.memberId) ?? 'Ancien membre') : `${me?.name ?? 'Moi'} (moi)`),
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
      filter: { kind: 'choice', value: (row) => row.contextId ?? ME_KEY, options: [{ value: ME_KEY, label: EVERYDAY_CONTEXT }, ...[...contextName].map(([value, label]) => ({ value, label }))] },
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
      filter: { kind: 'choice', value: (row) => row.categoryId ?? null, options: [...categoryOptions(categories, 'OUT'), ...categoryOptions(categories, 'IN')] },
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
        text: (row) => `${row.budget ? Math.round(((used(row, 'actual') + used(row, 'forecast')) / row.budget) * 100) : 0} %`,
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
    columns: [
      {
        id: 'month',
        bulk: true,
        label: 'À partir de',
        size: 150,
        sortValue: (budget: TreasuryBudget) => budget.month,
        text: (budget: TreasuryBudget) => monthLabel(budget.month),
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
        text: (budget) => (budget.repeatEvery ? (budget.repeatUntil ? monthLabel(budget.repeatUntil) : 'Sans fin') : monthLabel(budget.month)),
        filter: { kind: 'date', value: (budget) => (budget.repeatEvery ? (budget.repeatUntil ? `${budget.repeatUntil}-01` : null) : `${budget.month}-01`) },
      },
      commentColumn<TreasuryBudget>(budgetComments, (budget) => budget.id),
    ],
  });

  const bulk = bulkSaver<TreasuryBudget, Partial<BudgetValues>>(definedView, (budget, change) => Object.keys(change).length > 0 && saveBudget(budget, change));

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <MonthPickerInput aria-label="Mois" value={`${month}-01`} onChange={(value) => value && setMonth(String(value).slice(0, 7))} w={200} />
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => setDialog({ defaults: { month } })} disabled={!categories.length}>
          Nouveau budget
        </ActionButton>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Title order={3} size="h5" mb="xs">
          Budgets de {monthLabel(month)}
        </Title>
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
                    <Tooltip label={`${Math.round(ratio)} % (réel ${Math.round(actualRatio)} %)${over ? (income ? ' · au-delà du budget' : ' · budget dépassé') : ''}`}>
                      <Progress.Root size="md" aria-label={`${income ? 'Reçu' : 'Utilisé'} à ${Math.round(ratio)} %`}>
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
      </Paper>

      {outside.length > 0 && (
        <Paper withBorder radius="md" p="md">
          <Group gap="xs" mb="xs">
            <WarningIcon aria-hidden color="var(--mantine-color-orange-6)" />
            <Title order={3} size="h5">
              Hors budget
            </Title>
          </Group>
          <Text size="xs" c="dimmed" mb="xs">
            Mouvements sans budget pour leur membre, contexte et catégorie ce mois-ci.
          </Text>
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
                name="ces mouvements"
                primary={
                  row.categoryId && {
                    label: 'Créer le budget',
                    icon: <PlusIcon aria-hidden />,
                    onClick: () =>
                      setDialog({
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
        </Paper>
      )}

      <Paper withBorder radius="md" p="md">
        <Title order={3} size="h5" mb="xs">
          Budgets définis
        </Title>
        {(data?.treasuryBudgets ?? []).length === 0 ? (
          <EmptyState compact message="Aucun budget." />
        ) : (
          <DataTable
            view={definedView}
            selectionLabel={(count) => selectedLabel(count, ['budget', 'budgets'], false)}
            selectionActions={(rows, clear) => [
              deleteRowsAction(rows, {
                title: 'Supprimer les budgets',
                risks: `${rows.length} budget(s) et leurs répétitions seront supprimés définitivement. Leurs mouvements seront hors budget s’il n’y en a pas d’autre.`,
                remove: (budget) => remove.mutateAsync(budget.id),
                done: `${rows.length} budget(s) supprimé(s).`,
                clear,
              }),
            ]}
            verticalSpacing={4}
            getKey={(budget) => budget.id}
            cells={(budget) => ({
              month: (
                <MonthCell
                  value={budget.month}
                  label="Premier mois du budget"
                  onSave={(month) => month && bulk('month')(budget, (row) => (row.repeatUntil && row.repeatUntil < month ? {} : { month }))}
                />
              ),
              repeat: (
                <EditableSelect
                  value={budget.repeatEvery ? String(budget.repeatEvery) : 'ONCE'}
                  label="Répétition du budget"
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
                  label="Dernier mois du budget"
                  nullable
                  minMonth={budget.month}
                  onSave={(repeatUntil) => bulk('until')(budget, (row) => (!row.repeatEvery || (repeatUntil && repeatUntil < row.month) ? {} : { repeatUntil }))}
                />
              ) : (
                <Text size="sm" c="dimmed">
                  {monthLabel(budget.month)}
                </Text>
              ),
              ...keyContent(budget),
              who: (
                <EditableSelect
                  value={whoKey(budget)}
                  label="Bénéficiaire du budget"
                  nullable
                  data={whoChoices.filter((choice) => choice.value !== ME_KEY)}
                  onSave={(key) => bulk('who')(budget, { memberId: key?.startsWith('m:') ? key.slice(2) : null, relationId: key?.startsWith('r:') ? key.slice(2) : null })}
                />
              ),
              context: (
                <EditableSelect
                  value={budget.contextId ?? null}
                  label="Contexte du budget"
                  nullable
                  data={[...contextName].map(([value, label]) => ({ value, label }))}
                  onSave={(contextId) => bulk('context')(budget, { contextId })}
                />
              ),
              category: (
                <EditableSelect
                  value={budget.categoryId}
                  label="Catégorie du budget"
                  {...treeSelectProps([...categoryOptions(categories, 'OUT'), ...categoryOptions(categories, 'IN')])}
                  onSave={(categoryId) => categoryId && bulk('category')(budget, { categoryId })}
                />
              ),
              // Money out budgeted below zero, money in above: the amount is typed positive.
              amount: (
                <Text span inherit c={directionOf.get(budget.categoryId) === 'IN' ? 'green' : 'red'}>
                  <EditableNumber
                    amount
                    value={budget.amount}
                    label="Montant du budget"
                    suffix="€"
                    validate={(amount) => (amount > 0 ? null : 'Montant positif attendu.')}
                    onSave={(amount) => amount !== null && bulk('amount')(budget, { amount })}
                  />
                </Text>
              ),
            })}
            actions={(budget) => (
              <RowActions
                name="le budget"
                primary={{ label: 'Modifier (et ses répétitions)', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setDialog({ budget }) }}
                items={[
                  {
                    label: 'Dupliquer',
                    icon: <CopyIcon aria-hidden />,
                    onClick: () =>
                      // A new budget with its values, to change (month, category…) before it is saved.
                      setDialog({
                        copy: true,
                        defaults: {
                          month: budget.month,
                          memberId: budget.memberId ?? null,
                          relationId: budget.relationId ?? null,
                          contextId: budget.contextId ?? null,
                          categoryId: budget.categoryId,
                          amount: budget.amount,
                          repeatEvery: budget.repeatEvery ?? null,
                          repeatUntil: budget.repeatUntil ?? null,
                        },
                      }),
                  },
                  {
                    label: 'Supprimer',
                    icon: <TrashIcon aria-hidden />,
                    danger: true,
                    onClick: () =>
                      confirmDestructive({
                        title: 'Supprimer le budget',
                        risks: `Ce budget${budget.repeatEvery ? ' et toutes ses répétitions' : ''} sera supprimé définitivement. Ses mouvements seront hors budget s’il n’y en a pas d’autre.`,
                        onConfirm: () => remove.mutate(budget.id, { onSuccess: () => notifySuccess('Budget supprimé.'), onError: onMutationError }),
                      }),
                  },
                ]}
              />
            )}
          />
        )}
      </Paper>

      <SidePanel opened={dialog !== null} onClose={close} title={dialog?.budget ? 'Modifier le budget' : dialog?.copy ? 'Dupliquer le budget' : 'Nouveau budget'}>
        {dialog && <BudgetForm budget={dialog.budget} defaults={dialog.defaults} onDone={close} />}
      </SidePanel>
    </Stack>
  );
}
