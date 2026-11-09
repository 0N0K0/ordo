import { ActionIcon, Badge, Button, Group, Modal, NumberInput, Paper, Progress, Select, SimpleGrid, Skeleton, Stack, Table, Text, Title, Tooltip } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { EVERYDAY_CONTEXT, formatMoney, treasuryBudgetSchema } from '@ordo/shared';
import { ChartPieSliceIcon, CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryBudgetMutations, useTreasuryBudgets, useTreasurySettings, type BudgetReportRow, type TreasuryBudget } from './api';
import { categoryOptions, categoryPaths } from './categories';
import { confirmDeletion } from './confirm-deletion';

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
 * Budget form: month, member (none: me), context (none: everyday), category, amount, repetition.
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
          <NumberInput label="Montant" required min={0} decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" {...form.getInputProps('amount')} />
        </SimpleGrid>
        <Select
          label="Catégorie"
          required
          searchable
          data={[
            { group: 'Sorties', items: categoryOptions(categories, 'OUT') },
            { group: 'Entrées', items: categoryOptions(categories, 'IN') },
          ]}
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
  const money = (amount: number) => formatMoney(Math.round(amount * 100));
  const keyCells = (row: { memberId?: string | null; relationId?: string | null; contextId?: string | null; categoryId?: string | null }) => (
    <>
      <Table.Td>
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
      </Table.Td>
      <Table.Td>{row.contextId ? (contextName.get(row.contextId) ?? '') : EVERYDAY_CONTEXT}</Table.Td>
      <Table.Td>{row.categoryId ? (paths.get(row.categoryId) ?? '') : <Text c="dimmed">Sans catégorie</Text>}</Table.Td>
    </>
  );

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
          <Table.ScrollContainer minWidth={820}>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pour</Table.Th>
                  <Table.Th>Contexte</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th ta="right">Budget</Table.Th>
                  <Table.Th ta="right">Réel</Table.Th>
                  <Table.Th ta="right">Prévu</Table.Th>
                  <Table.Th ta="right">Reste</Table.Th>
                  <Table.Th w={140} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {budgeted.map((row) => {
                  const actual = used(row, 'actual');
                  const forecast = used(row, 'forecast');
                  const left = row.budget - actual - forecast;
                  const ratio = row.budget ? ((actual + forecast) / row.budget) * 100 : 0;
                  return (
                    <Table.Tr key={`${row.memberId}|${row.relationId}|${row.contextId}|${row.categoryId}`}>
                      {keyCells(row)}
                      <Table.Td ta="right">{money(row.budget)}</Table.Td>
                      <Table.Td ta="right">{money(actual)}</Table.Td>
                      <Table.Td ta="right" c="dimmed">
                        {forecast ? money(forecast) : '—'}
                      </Table.Td>
                      <Table.Td ta="right" c={left < 0 ? 'red' : undefined} fw={left < 0 ? 600 : undefined}>
                        {money(left)}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={`${Math.round(ratio)} % (réel ${Math.round(row.budget ? (actual / row.budget) * 100 : 0)} %)`}>
                          <Progress.Root size="md" aria-label={`Utilisé à ${Math.round(ratio)} %`}>
                            <Progress.Section value={Math.min(100, row.budget ? (actual / row.budget) * 100 : 0)} color={ratio > 100 ? 'red' : ratio > 80 ? 'orange' : 'blue'} />
                            <Progress.Section value={Math.max(0, Math.min(100, ratio) - Math.min(100, row.budget ? (actual / row.budget) * 100 : 0))} color={ratio > 100 ? 'red.3' : 'blue.2'} />
                          </Progress.Root>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
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
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pour</Table.Th>
                  <Table.Th>Contexte</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th ta="right">Réel</Table.Th>
                  <Table.Th ta="right">Prévu</Table.Th>
                  <Table.Th w={1} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {outside.map((row) => (
                  <Table.Tr key={`${row.memberId}|${row.relationId}|${row.contextId}|${row.categoryId}`}>
                    {keyCells(row)}
                    <Table.Td ta="right">{money(row.actual)}</Table.Td>
                    <Table.Td ta="right" c="dimmed">
                      {row.forecast ? money(row.forecast) : '—'}
                    </Table.Td>
                    <Table.Td>
                      {row.categoryId && (
                        <Tooltip label="Créer le budget">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Créer le budget"
                            onClick={() =>
                              setDialog({
                                defaults: {
                                  month,
                                  memberId: row.memberId === me?.id ? null : (row.memberId ?? null),
                                  relationId: row.relationId ?? null,
                                  contextId: row.contextId ?? null,
                                  categoryId: row.categoryId ?? '',
                                  amount: Math.abs(row.actual + row.forecast),
                                },
                              })
                            }
                          >
                            <PlusIcon aria-hidden />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
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
          <Table.ScrollContainer minWidth={820}>
            <Table verticalSpacing={4}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Période</Table.Th>
                  <Table.Th>Pour</Table.Th>
                  <Table.Th>Contexte</Table.Th>
                  <Table.Th>Catégorie</Table.Th>
                  <Table.Th ta="right">Montant</Table.Th>
                  <Table.Th w={1} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(data?.treasuryBudgets ?? []).map((budget) => (
                  <Table.Tr key={budget.id}>
                    <Table.Td>
                      <Text size="sm">
                        {budget.repeatEvery ? `Dès ${monthLabel(budget.month)}` : monthLabel(budget.month)}
                        {budget.repeatUntil ? ` jusqu’à ${monthLabel(budget.repeatUntil)}` : ''}
                      </Text>
                      {budget.repeatEvery && (
                        <Badge size="xs" variant="light">
                          {REPEATS.find((item) => item.value === String(budget.repeatEvery))?.label ?? `Tous les ${budget.repeatEvery} mois`}
                        </Badge>
                      )}
                    </Table.Td>
                    {keyCells(budget)}
                    <Table.Td ta="right">{money(budget.amount)}</Table.Td>
                    <Table.Td>
                      <Group gap={2} wrap="nowrap">
                        <Tooltip label="Modifier (et ses répétitions)">
                          <ActionIcon variant="subtle" color="gray" aria-label="Modifier le budget" onClick={() => setDialog({ budget })}>
                            <PencilSimpleIcon aria-hidden />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Dupliquer">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Dupliquer le budget"
                            onClick={() =>
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
                              })
                            }
                          >
                            <CopyIcon aria-hidden />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Supprimer le budget"
                            onClick={() =>
                              confirmDeletion(
                                'Supprimer le budget',
                                `Ce budget${budget.repeatEvery ? ' et toutes ses répétitions' : ''} sera supprimé définitivement. Ses mouvements seront hors budget s’il n’y en a pas d’autre.`,
                                () => remove.mutate(budget.id, { onSuccess: () => notifySuccess('Budget supprimé.'), onError: (error) => notifyError(error.message) }),
                              )
                            }
                          >
                            <TrashIcon aria-hidden />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={dialog !== null} onClose={close} title={dialog?.budget ? 'Modifier le budget' : dialog?.copy ? 'Dupliquer le budget' : 'Nouveau budget'}>
        {dialog && <BudgetForm budget={dialog.budget} defaults={dialog.defaults} onDone={close} />}
      </Modal>
    </Stack>
  );
}
