import { Badge, Button, Group, Modal, NumberInput, Paper, Progress, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { EVERYDAY_CONTEXT, formatMoney, treasuryBudgetSchema } from '@ordo/shared';
import { ChartPieSliceIcon, CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { DataTable } from '../../components/data-table/DataTable';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryBudgetMutations, useTreasuryBudgets, useTreasurySettings, type BudgetReportRow, type TreasuryBudget } from './api';
import { categoryOptions, categoryPaths } from './categories';
import { confirmDeletion } from './confirm-deletion';
import { treeSelectProps } from '../../components/tree-select/tree-select';

const REPEATS = [
  { value: '', label: 'Ce mois seulement' },
  { value: '1', label: 'Tous les mois' },
  { value: '2', label: 'Tous les 2 mois' },
  { value: '3', label: 'Tous les 3 mois' },
  { value: '6', label: 'Tous les 6 mois' },
  { value: '12', label: 'Tous les ans' },
];

const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Month in words.
 * @param {string} month YYYY-MM.
 * @returns {string} "août 2026".
 */
const monthLabel = (month: string) => monthFormat.format(new Date(`${month}-01T00:00:00Z`));

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
      repeatEvery: budget?.repeatEvery ?? 1,
      repeatUntil: budget?.repeatUntil ?? null,
      ...defaults,
    },
    schema: treasuryBudgetSchema,
  });
  const values = form.values;
  const me = members.find((member) => member.isMe);
  // Money out or in: the direction of the category, unless chosen first (none chosen: money out).
  const [chosenDirection, setDirection] = useState<'OUT' | 'IN' | null>(null);
  const direction = chosenDirection ?? (categories.find((category) => category.id === values.categoryId)?.direction as 'OUT' | 'IN' | undefined) ?? 'OUT';

  return (
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
            label={values.repeatEvery ? 'Premier mois' : 'Mois'}
            required
            valueFormat="MMMM YYYY"
            value={`${values.month}-01`}
            onChange={(value) => value && form.setFieldValue('month', String(value).slice(0, 7))}
            error={form.errors.month}
          />
          <NumberInput
            label={direction === 'OUT' ? 'Sorties prévues' : 'Entrées prévues'}
            required
            min={0}
            decimalScale={2}
            decimalSeparator=","
            thousandSeparator=" "
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
        <Select
          label="Catégorie"
          required
          searchable
          {...treeSelectProps(categoryOptions(categories, direction))}
          nothingFoundMessage={direction === 'OUT' ? 'Aucune catégorie de sorties' : 'Aucune catégorie d’entrées'}
          description="Le budget couvre aussi ses sous-catégories qui n’ont pas le leur."
          {...form.getInputProps('categoryId')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Pour"
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
          <Select
            label="Contexte"
            placeholder={EVERYDAY_CONTEXT}
            clearable
            data={(settings?.treasuryContexts ?? []).map((item) => ({ value: item.id, label: item.name }))}
            {...form.getInputProps('contextId')}
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Répétition"
            allowDeselect={false}
            data={REPEATS}
            value={values.repeatEvery ? String(values.repeatEvery) : ''}
            onChange={(value) => form.setFieldValue('repeatEvery', value ? Number(value) : null)}
          />
          {values.repeatEvery && (
            <MonthPickerInput
              label="Jusqu’à"
              placeholder="Sans fin"
              clearable
              valueFormat="MMMM YYYY"
              minDate={`${values.month}-01`}
              value={values.repeatUntil ? `${values.repeatUntil}-01` : null}
              onChange={(value) => form.setFieldValue('repeatUntil', value ? String(value).slice(0, 7) : null)}
              error={form.errors.repeatUntil}
            />
          )}
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={save.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
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
  const { remove } = useTreasuryBudgetMutations();
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
  /**
   * Totals of the budgeted rows of a direction: budgets, actual and forecast movements used, what is left.
   * @param {'IN' | 'OUT'} direction Money in or out.
   * @returns {{ count: number, budget: number, actual: number, forecast: number, left: number }} Totals, in cents.
   */
  const totalOf = (direction: 'IN' | 'OUT') => {
    const total = { count: 0, budget: 0, actual: 0, forecast: 0, left: 0 };
    for (const row of budgeted) {
      if ((row.categoryId ? directionOf.get(row.categoryId) : 'OUT') !== direction) continue;
      const actual = used(row, 'actual');
      const forecast = used(row, 'forecast');
      total.count += 1;
      total.budget += row.budget;
      total.actual += actual;
      total.forecast += forecast;
      total.left += row.budget - actual - forecast;
    }
    return total;
  };
  const outTotal = totalOf('OUT');
  const inTotal = totalOf('IN');
  /**
   * Total rows: money out and money in like their rows; the balance in money in minus money out, its "left" the gap
   * with the planned balance (above zero: better than planned).
   */
  const totals: { label: string; kind: 'OUT' | 'IN' | 'BALANCE'; budget: number; actual: number; forecast: number; left: number }[] = [
    ...(outTotal.count ? [{ label: 'Total sorties', kind: 'OUT' as const, ...outTotal }] : []),
    ...(inTotal.count ? [{ label: 'Total entrées', kind: 'IN' as const, ...inTotal }] : []),
    ...(outTotal.count && inTotal.count
      ? [
          {
            label: 'Solde (entrées − sorties)',
            kind: 'BALANCE' as const,
            budget: inTotal.budget - outTotal.budget,
            actual: inTotal.actual - outTotal.actual,
            forecast: inTotal.forecast - outTotal.forecast,
            // Money in beyond its budget and money out below its budget both make the balance better.
            left: outTotal.left - inTotal.left,
          },
        ]
      : []),
  ];
  /**
   * A total as printed, with its color: signed for the balance; "left" like the rows (money out over budget in red,
   * money in beyond its budget as a green surplus).
   * @param {(typeof totals)[number]} total Total row.
   * @param {'budget' | 'actual' | 'forecast' | 'left'} key Column.
   * @returns {{ text: string, color?: string }} Cell.
   */
  const totalCell = (total: (typeof totals)[number], key: 'budget' | 'actual' | 'forecast' | 'left'): { text: string; color?: string } => {
    const value = total[key];
    if (total.kind === 'BALANCE') return { text: `${value > 0 ? '+' : ''}${money(value)}`, color: value < 0 ? 'red' : value > 0 ? 'green' : undefined };
    if (key === 'left' && value < 0) return total.kind === 'IN' ? { text: `+${money(-value)}`, color: 'green' } : { text: money(value), color: 'red' };
    return { text: money(value), color: key === 'forecast' ? 'dimmed' : undefined };
  };
  const money = (amount: number) => formatMoney(Math.round(amount * 100));
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
    { id: 'who', label: 'Pour', size: 180, sortValue: (row) => (row.relationId ? (relationName.get(row.relationId) ?? '') : row.memberId ? (memberName.get(row.memberId) ?? '') : '') },
    { id: 'context', label: 'Contexte', size: 160, sortValue: (row) => (row.contextId ? (contextName.get(row.contextId) ?? '') : '') },
    { id: 'category', label: 'Catégorie', size: 220, locked: true, sortValue: (row) => (row.categoryId ? (paths.get(row.categoryId) ?? '') : null) },
  ];

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <MonthPickerInput aria-label="Mois" valueFormat="MMMM YYYY" value={`${month}-01`} onChange={(value) => value && setMonth(String(value).slice(0, 7))} w={200} />
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ defaults: { month } })} disabled={!categories.length}>
          Budget
        </Button>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Title order={3} size="h5" mb="xs">
          Budgets de {monthLabel(month)}
        </Title>
        {isPending && !data ? (
          <Skeleton height={120} />
        ) : budgeted.length === 0 ? (
          <Group gap="xs" py="md" justify="center">
            <ChartPieSliceIcon aria-hidden />
            <Text size="sm" c="dimmed">
              {categories.length ? 'Aucun budget ce mois-ci.' : 'Créez d’abord des catégories (Paramètres).'}
            </Text>
          </Group>
        ) : (
          <DataTable
            tableKey="treasury-budget-report"
            verticalSpacing={6}
            columns={[
              ...keyColumns<BudgetReportRow>(),
              { id: 'budget', label: 'Budget', size: 120, numeric: true, sortValue: (row) => row.budget },
              { id: 'actual', label: 'Réel', size: 120, numeric: true, sortValue: (row) => used(row, 'actual') },
              { id: 'forecast', label: 'Prévu', size: 120, numeric: true, sortValue: (row) => used(row, 'forecast') },
              { id: 'left', label: 'Reste', size: 120, numeric: true, sortValue: (row) => row.budget - used(row, 'actual') - used(row, 'forecast') },
              { id: 'progress', label: 'Avancement', size: 160 },
            ]}
            rows={budgeted}
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
                budget: money(row.budget),
                actual: money(actual),
                forecast: (
                  <Text span inherit c="dimmed">
                    {forecast ? money(forecast) : '—'}
                  </Text>
                ),
                left: (
                  <Text span inherit c={over ? (income ? 'green' : 'red') : undefined} fw={over ? 600 : undefined}>
                    {/* Income beyond its budget: what came in on top. */}
                    {over && income ? `+${money(-left)}` : money(left)}
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
            footer={(shown) => (
              // Totals per direction, and the balance of money in minus money out.
              <Table.Tfoot>
                {totals.map((total) => (
                  <Table.Tr
                    key={total.label}
                    // Totals stand out from the budgets: tinted in gray, the balance in the primary color.
                    bg={total.kind === 'BALANCE' ? 'var(--mantine-primary-color-light)' : 'var(--mantine-color-gray-light)'}
                    style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
                  >
                    {shown.map((column, index) => {
                      const key = (['budget', 'actual', 'forecast', 'left'] as const).find((item) => item === column.id);
                      const cell = key ? totalCell(total, key) : null;
                      return (
                        <Table.Th key={column.id} ta={key ? 'right' : undefined} c={cell?.color} style={{ whiteSpace: 'nowrap' }}>
                          {cell ? cell.text : index === 0 ? total.label : null}
                        </Table.Th>
                      );
                    })}
                    <Table.Th />
                  </Table.Tr>
                ))}
              </Table.Tfoot>
            )}
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
            tableKey="treasury-budget-outside"
            verticalSpacing={6}
            columns={[
              ...keyColumns<BudgetReportRow>(),
              { id: 'actual', label: 'Réel', size: 120, numeric: true, sortValue: (row) => row.actual },
              { id: 'forecast', label: 'Prévu', size: 120, numeric: true, sortValue: (row) => row.forecast },
            ]}
            rows={outside}
            getKey={(row) => `${row.memberId}|${row.relationId}|${row.contextId}|${row.categoryId}`}
            cells={(row) => ({
              ...keyContent(row),
              actual: money(row.actual),
              forecast: (
                <Text span inherit c="dimmed">
                  {row.forecast ? money(row.forecast) : '—'}
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
          <Text size="sm" c="dimmed">
            Aucun budget.
          </Text>
        ) : (
          <DataTable
            tableKey="treasury-budgets"
            verticalSpacing={4}
            columns={[
              { id: 'period', label: 'Période', size: 220, sortValue: (budget: TreasuryBudget) => budget.month },
              ...keyColumns<TreasuryBudget>(),
              { id: 'amount', label: 'Montant', size: 130, numeric: true, sortValue: (budget) => (directionOf.get(budget.categoryId) === 'IN' ? budget.amount : -budget.amount) },
            ]}
            rows={data?.treasuryBudgets ?? []}
            getKey={(budget) => budget.id}
            cells={(budget) => ({
              period: (
                <>
                  <Text size="sm">
                    {budget.repeatEvery ? `Dès ${monthLabel(budget.month)}` : monthLabel(budget.month)}
                    {budget.repeatUntil ? ` jusqu’à ${monthLabel(budget.repeatUntil)}` : ''}
                  </Text>
                  {budget.repeatEvery && (
                    <Badge size="xs" variant="light">
                      {REPEATS.find((item) => item.value === String(budget.repeatEvery))?.label ?? `Tous les ${budget.repeatEvery} mois`}
                    </Badge>
                  )}
                </>
              ),
              ...keyContent(budget),
              // Money out budgeted below zero, money in above.
              amount: (
                <Text span inherit c={directionOf.get(budget.categoryId) === 'IN' ? 'green' : 'red'} style={{ whiteSpace: 'nowrap' }}>
                  {directionOf.get(budget.categoryId) === 'IN' ? '+' : '−'}
                  {money(budget.amount)}
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
                      confirmDeletion(
                        'Supprimer le budget',
                        `Ce budget${budget.repeatEvery ? ' et toutes ses répétitions' : ''} sera supprimé définitivement. Ses mouvements seront hors budget s’il n’y en a pas d’autre.`,
                        () => remove.mutate(budget.id, { onSuccess: () => notifySuccess('Budget supprimé.'), onError: (error) => notifyError(error.message) }),
                      ),
                  },
                ]}
              />
            )}
          />
        )}
      </Paper>

      <Modal opened={dialog !== null} onClose={close} title={dialog?.budget ? 'Modifier le budget' : dialog?.copy ? 'Dupliquer le budget' : 'Nouveau budget'}>
        {dialog && <BudgetForm budget={dialog.budget} defaults={dialog.defaults} onDone={close} />}
      </Modal>
    </Stack>
  );
}
