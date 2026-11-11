import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  Paper,
  Popover,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { DatePickerInput, MonthPicker, YearPicker } from '@mantine/dates';
import { addDays, formatMoney, recurrenceSchema, treasuryAccountSchema } from '@ordo/shared';
import { BankIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, CopyIcon, GearIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import {
  useForecastEntries,
  useTreasuryAccounts,
  useTreasuryMutations,
  useTreasuryProjection,
  type AccountValues,
  type ForecastEntry,
  type ProjectionItem,
  type TreasuryAccount,
  type TreasuryEntry,
} from './api';
import { CHART_SCALES, periodEnd, periodLabel, periodStart, shiftPeriod, type ChartScale } from './chart-period';
import { confirmDeletion } from './confirm-deletion';
import { EntriesPanel } from './EntriesPanel';
import { EntryForm } from './EntryForm';
import { SettingsPanel } from './SettingsPanel';
import { BudgetsPanel } from './BudgetsPanel';
import { LoansPanel } from './LoansPanel';
import { PageTitle } from '../../components/PageTitle';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date.
 */
const printedDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Amount in euros, from currency units.
 * @param {number} amount Amount.
 * @returns {string} Amount.
 */
const money = (amount: number) => formatMoney(Math.round(amount * 100));

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  FORECAST: { label: 'Prévision', color: 'grape' },
  ACTUAL: { label: 'À venir', color: 'gray' },
  INVOICE: { label: 'Facture', color: 'blue' },
  CREDIT_NOTE: { label: 'Avoir', color: 'orange' },
  IMPORTED: { label: 'Importé', color: 'cyan' },
  RECURRING_INVOICE: { label: 'Récurrente', color: 'teal' },
};

/**
 * Account: name, opening balance and date, archived.
 * @param {{ account?: TreasuryAccount, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function AccountForm({ account, onDone }: { account?: TreasuryAccount; onDone: () => void }) {
  const { createAccount, updateAccount } = useTreasuryMutations();
  const form = useAppForm<AccountValues & Record<string, unknown>>({
    initialValues: {
      name: account?.name ?? '',
      openingBalance: account?.openingBalance ?? 0,
      openingDate: account ? String(account.openingDate) : localToday(),
      archived: account?.archived ?? false,
    },
    schema: treasuryAccountSchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(account ? 'Compte modifié.' : 'Compte créé.');
            onDone();
          },
          onError: (error: Error) => showFormError(form, error),
        };
        if (account) updateAccount.mutate({ id: account.id, input }, callbacks);
        else createAccount.mutate(input, callbacks);
      })}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required placeholder="Compte courant, livret…" data-autofocus {...form.getInputProps('name')} />
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput label="Solde d’ouverture" decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" {...form.getInputProps('openingBalance')} />
          <DatePickerInput label="Au" required valueFormat="D MMM YYYY" {...form.getInputProps('openingDate')} />
        </SimpleGrid>
        <Text size="xs" c="dimmed">
          Le solde du relevé à cette date : seuls les mouvements suivants sont comptés.
        </Text>
        {account && <Checkbox label="Archivé (n’est plus compté dans le solde)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createAccount.isPending || updateAccount.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Realization of an expected movement: actual date and amount.
 * @param {{ item: ProjectionItem, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function RealizeForm({ item, onDone }: { item: ProjectionItem; onDone: () => void }) {
  const { realize } = useTreasuryMutations();
  const [date, setDate] = useState<string | null>(item.date);
  const [amount, setAmount] = useState<number>(Math.abs(item.amount));
  return (
    <Stack gap="sm">
      <Text size="sm">
        « {item.label} », prévu le {printedDate(item.dueDate)}, devient un mouvement réel.
      </Text>
      <SimpleGrid cols={2} spacing="sm">
        <DatePickerInput label="Date réelle" required valueFormat="D MMM YYYY" value={date} onChange={setDate} />
        <NumberInput
          label={item.amount < 0 ? 'Montant sorti' : 'Montant entré'}
          min={0}
          decimalScale={2}
          decimalSeparator=","
          thousandSeparator=" "
          suffix=" €"
          value={amount}
          onChange={(value) => setAmount(typeof value === 'number' ? value : 0)}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={realize.isPending}
          disabled={!date || amount <= 0}
          onClick={() =>
            date &&
            item.entryId &&
            realize.mutate(
              { id: item.entryId, occurrence: item.dueDate, date, amount: item.amount < 0 ? -amount : amount },
              {
                onSuccess: () => {
                  notifySuccess('Mouvement enregistré.');
                  onDone();
                },
                onError: (error) => notifyError(error.message),
              },
            )
          }
        >
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Key figure of the treasury.
 * @param {{ label: string, value: number, hint?: string, color?: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
function Figure({ label, value, hint, color }: { label: string; value: number; hint?: string; color?: string }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700} ff="monospace" c={color ?? (value < 0 ? 'red' : undefined)}>
        {money(value)}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

type Dialog =
  | { kind: 'account'; account?: TreasuryAccount }
  | { kind: 'entry'; entry?: TreasuryEntry | ForecastEntry; status?: 'ACTUAL' | 'FORECAST'; copy?: boolean }
  | { kind: 'realize'; item: ProjectionItem }
  | null;

/**
 * Treasury: balance of the accounts, balance curve (actual, then forecast) over a month, a quarter or a
 * calendar year moved with arrows, expected movements (forecasts, invoices due, coming recurring invoices), actual movements of a
 * month or a year, the accounts, and the settings (categories, payment methods, counterparties).
 * @returns {JSX.Element} Page.
 */
export function TreasuryPage() {
  const today = localToday();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'forecast';
  // Period of the chart: a month, quarter or calendar year, moved with arrows.
  const [scale, setScale] = useState<ChartScale>('month');
  const [periodFirst, setPeriodFirst] = useState(() => periodStart('month', today));
  const [picking, setPicking] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const from = periodFirst;
  const periodLast = periodEnd(scale, periodFirst);
  // The forecast (expected movements) always reaches a year ahead, whatever the period shown.
  const until = periodLast > addDays(today, 365) ? periodLast : addDays(today, 365);
  const { data: accounts, isPending: accountsPending } = useTreasuryAccounts();
  const { data: projection, isPending: projectionPending } = useTreasuryProjection({ today, from, until });
  const { data: forecasts } = useForecastEntries();
  const { deleteEntry, deleteAccount } = useTreasuryMutations();
  const close = () => setDialog(null);
  const onError = (error: Error) => notifyError(error.message);

  if (accountsPending) return <Skeleton height={400} />;

  const header = (
    <Group justify="space-between">
      <PageTitle>Trésorerie</PageTitle>
      {!!accounts?.length && (
        <Group gap="xs">
          <Button variant="light" color="grape" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'entry', status: 'FORECAST' })}>
            Prévision
          </Button>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'entry', status: 'ACTUAL' })}>
            Mouvement
          </Button>
        </Group>
      )}
    </Group>
  );

  const dialogs = (
    <Modal
      opened={dialog !== null}
      onClose={close}
      // An entry has a table of lines (its split).
      size={dialog?.kind === 'entry' ? '72rem' : 'md'}
      title={
        dialog?.kind === 'account'
          ? dialog.account
            ? 'Modifier le compte'
            : 'Nouveau compte'
          : dialog?.kind === 'realize'
            ? 'Réaliser la prévision'
            : dialog?.kind === 'entry' && dialog.entry && dialog.copy
              ? dialog.entry.status === 'FORECAST'
                ? 'Dupliquer la prévision'
                : 'Dupliquer le mouvement'
              : dialog?.kind === 'entry' && dialog.entry
              ? 'Modifier le mouvement'
              : dialog?.kind === 'entry' && dialog.status === 'FORECAST'
                ? 'Nouvelle prévision'
                : 'Nouveau mouvement'
      }
    >
      {dialog?.kind === 'account' && <AccountForm account={dialog.account} onDone={close} />}
      {dialog?.kind === 'entry' && <EntryForm entry={dialog.entry} status={dialog.status} copy={dialog.copy} onDone={close} />}
      {dialog?.kind === 'realize' && <RealizeForm item={dialog.item} onDone={close} />}
    </Modal>
  );

  if (!accounts?.length) {
    return (
      <Stack gap="md">
        {header}
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <BankIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed" ta="center">
              Aucun compte. Créez votre compte bancaire avec le solde de votre relevé à une date : les mouvements et le prévisionnel partent de là.
            </Text>
            <Button leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'account' })}>
              Créer un compte
            </Button>
          </Stack>
        </Paper>
        {dialogs}
      </Stack>
    );
  }

  const items = projection?.items ?? [];
  const receivable = items.filter((item) => item.amount > 0 && (item.kind === 'INVOICE' || item.kind === 'IMPORTED')).reduce((sum, item) => sum + item.amount, 0);
  const late = items.filter((item) => item.overdue && item.amount > 0 && item.kind !== 'FORECAST');
  const forecastSeries = (projection?.series ?? []).filter((point) => point.forecast && point.date >= from && point.date <= periodLast);
  const lowest = forecastSeries.reduce<(typeof forecastSeries)[number] | null>((low, point) => (!low || point.balance < low.balance ? point : low), null);
  // Balance at the end of the period (actual for a past year).
  const shown = (projection?.series ?? []).filter((point) => point.date >= from && point.date <= periodLast);
  const end = shown.at(-1);
  // One row per day: actual and forecast curves meet today.
  const chart = new Map<string, { date: string; Réel?: number; Prévu?: number }>();
  for (const point of (projection?.series ?? []).filter((item) => item.date >= from && item.date <= periodLast)) {
    const row = chart.get(point.date) ?? { date: point.date };
    if (point.forecast) row.Prévu = point.balance;
    else row.Réel = point.balance;
    chart.set(point.date, row);
  }
  const forecastById = new Map((forecasts ?? []).map((entry) => [entry.id, entry]));

  return (
    <Stack gap="md">
      {header}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <Figure label="Solde aujourd’hui" value={projection?.balance ?? 0} hint={`${accounts.filter((account) => !account.archived).length} compte(s)`} />
        <Figure label="À encaisser" value={receivable} hint="Factures validées non réglées" color="blue" />
        <Figure label="En retard" value={late.reduce((sum, item) => sum + item.amount, 0)} hint={`${late.length} échéance(s) dépassée(s)`} color={late.length ? 'red' : undefined} />
        <Figure label={`${end?.forecast === false ? 'Solde au' : 'Solde prévu au'} ${end ? printedDate(end.date) : '—'}`} value={end?.balance ?? 0} hint={lowest ? `Point bas ${money(lowest.balance)} le ${printedDate(lowest.date)}` : undefined} />
      </SimpleGrid>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Évolution du solde</Text>
          <Group gap="xs">
            <Button size="xs" variant="default" disabled={periodFirst === periodStart(scale, today)} onClick={() => setPeriodFirst(periodStart(scale, today))}>
              Aujourd’hui
            </Button>
            <Group gap={2} wrap="nowrap">
              <Tooltip label="Période précédente">
                <ActionIcon variant="subtle" color="gray" aria-label="Période précédente" onClick={() => setPeriodFirst(shiftPeriod(scale, periodFirst, -1))}>
                  <CaretLeftIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
              <Popover opened={picking} onChange={setPicking} position="bottom" shadow="md" withArrow>
                <Popover.Target>
                  <Button size="xs" variant="subtle" color="gray" miw={150} onClick={() => setPicking((open) => !open)} aria-label={`Choisir la période (${periodLabel(scale, periodFirst)})`}>
                    {periodLabel(scale, periodFirst)}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  {scale === 'year' ? (
                    <YearPicker
                      value={periodFirst}
                      onChange={(value) => {
                        if (value) setPeriodFirst(periodStart('year', value));
                        setPicking(false);
                      }}
                    />
                  ) : (
                    // A quarter is chosen by one of its months.
                    <MonthPicker
                      value={periodFirst}
                      onChange={(value) => {
                        if (value) setPeriodFirst(periodStart(scale, value));
                        setPicking(false);
                      }}
                    />
                  )}
                </Popover.Dropdown>
              </Popover>
              <Tooltip label="Période suivante">
                <ActionIcon variant="subtle" color="gray" aria-label="Période suivante" onClick={() => setPeriodFirst(shiftPeriod(scale, periodFirst, 1))}>
                  <CaretRightIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            </Group>
            <SegmentedControl
              size="xs"
              aria-label="Durée de la période"
              data={CHART_SCALES}
              value={scale}
              // The new period contains the first day of the previous one.
              onChange={(value) => {
                setScale(value as ChartScale);
                setPeriodFirst(periodStart(value as ChartScale, periodFirst));
              }}
            />
          </Group>
        </Group>
        {projectionPending ? (
          <Skeleton height={260} />
        ) : (
          <AreaChart
            h={260}
            data={[...chart.values()]}
            dataKey="date"
            curveType="stepAfter"
            withGradient
            connectNulls={false}
            withDots={false}
            series={[
              { name: 'Réel', color: 'blue.6' },
              { name: 'Prévu', color: 'grape.5', strokeDasharray: '5 5' },
            ]}
            xAxisProps={{ tickFormatter: (value: string) => shortDate.format(new Date(`${value}T00:00:00Z`)), minTickGap: 40 }}
            valueFormatter={(value) => money(value)}
            referenceLines={[{ y: 0, color: 'red.5' }]}
            yAxisProps={{ width: 90 }}
          />
        )}
      </Paper>

      <Tabs value={tab} onChange={(value) => setParams(value && value !== 'forecast' ? { tab: value } : {}, { replace: true })} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="forecast">Prévisionnel</Tabs.Tab>
          <Tabs.Tab value="entries">Mouvements</Tabs.Tab>
          <Tabs.Tab value="budgets">Budgets</Tabs.Tab>
          <Tabs.Tab value="loans">Prêts</Tabs.Tab>
          <Tabs.Tab value="accounts">Comptes</Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<GearIcon aria-hidden />}>
            Paramètres
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="forecast" pt="md">
          {items.length === 0 ? (
            <Text size="sm" c="dimmed">
              Rien d’attendu d’ici le {printedDate(until)}. Ajoutez des prévisions (loyer, charges…) : les factures validées non réglées et les factures récurrentes y figurent d’elles-mêmes.
            </Text>
          ) : (
            <Paper withBorder radius="md">
              <Table verticalSpacing="xs" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Libellé</Table.Th>
                    <Table.Th>Émetteur / destinataire</Table.Th>
                    <Table.Th>Origine</Table.Th>
                    <Table.Th ta="right">Montant</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {items.map((item, index) => {
                    const kind = KIND_LABELS[item.kind] ?? KIND_LABELS.FORECAST;
                    const entry = item.entryId ? forecastById.get(item.entryId) : undefined;
                    return (
                      <Table.Tr key={`${item.kind}-${item.entryId ?? item.documentId ?? item.importedDocumentId ?? item.recurringInvoiceId}-${item.dueDate}-${index}`}>
                        <Table.Td>
                          <Text size="sm">{printedDate(item.date)}</Text>
                          {item.overdue && (
                            <Badge size="xs" color="red" variant="light">
                              Prévu le {printedDate(item.dueDate)}
                            </Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {item.documentId ? (
                            <Anchor component={Link} to={`/accounting/${item.documentId}`} size="sm">
                              {item.label}
                            </Anchor>
                          ) : (
                            <Text size="sm">{item.label}</Text>
                          )}
                          {entry?.recurrence != null && (
                            <Text size="xs" c="dimmed">
                              {(() => {
                                const rule = recurrenceSchema.safeParse(entry.recurrence);
                                return rule.success ? describeRecurrence(rule.data, String(entry.date)) : '';
                              })()}
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.payerName ?? ''}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={kind.color}>
                            {kind.label}
                          </Badge>
                        </Table.Td>
                        <Table.Td ta="right" ff="monospace" c={item.amount < 0 ? 'red' : 'green'}>
                          {item.amount > 0 ? '+' : ''}
                          {money(item.amount)}
                        </Table.Td>
                        <Table.Td>
                          {item.kind === 'ACTUAL' && entry && (
                            // Actual entry dated after today.
                            <Group gap={2} justify="flex-end" wrap="nowrap">
                              <Tooltip label="Modifier le mouvement">
                                <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${item.label}`} onClick={() => setDialog({ kind: 'entry', entry })}>
                                  <PencilSimpleIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Dupliquer le mouvement">
                                <ActionIcon variant="subtle" color="gray" aria-label={`Dupliquer ${item.label}`} onClick={() => setDialog({ kind: 'entry', entry, copy: true })}>
                                  <CopyIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Supprimer le mouvement">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Supprimer ${item.label}`}
                                  onClick={() =>
                                    confirmDeletion(
                                      'Supprimer le mouvement',
                                      entry.allocations.length ? `« ${item.label} » sera supprimé : les documents qu’il règle redeviendront dus.` : `« ${item.label} » sera supprimé définitivement.`,
                                      () => deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Mouvement supprimé.'), onError }),
                                    )
                                  }
                                >
                                  <TrashIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          )}
                          {item.kind === 'FORECAST' && entry && (
                            <Group gap={2} justify="flex-end" wrap="nowrap">
                              <Tooltip label="Réaliser">
                                <ActionIcon variant="subtle" color="green" aria-label={`Réaliser ${item.label}`} onClick={() => setDialog({ kind: 'realize', item })}>
                                  <CheckIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Modifier la prévision">
                                <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${item.label}`} onClick={() => setDialog({ kind: 'entry', entry })}>
                                  <PencilSimpleIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Dupliquer la prévision">
                                <ActionIcon variant="subtle" color="gray" aria-label={`Dupliquer ${item.label}`} onClick={() => setDialog({ kind: 'entry', entry, copy: true })}>
                                  <CopyIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Supprimer la prévision">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Supprimer ${item.label}`}
                                  onClick={() =>
                                    confirmDeletion('Supprimer la prévision', `« ${item.label} » et toutes ses répétitions seront supprimées.`, () =>
                                      deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Prévision supprimée.'), onError }),
                                    )
                                  }
                                >
                                  <TrashIcon aria-hidden />
                                </ActionIcon>
                              </Tooltip>
                            </Group>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="entries" pt="md">
          <EntriesPanel accounts={accounts} onEdit={(entry) => setDialog({ kind: 'entry', entry })} onDuplicate={(entry) => setDialog({ kind: 'entry', entry, copy: true })} />
        </Tabs.Panel>

        <Tabs.Panel value="budgets" pt="md">
          <BudgetsPanel />
        </Tabs.Panel>

        <Tabs.Panel value="loans" pt="md">
          <LoansPanel />
        </Tabs.Panel>

        <Tabs.Panel value="accounts" pt="md">
          <Stack gap="sm">
            <Group justify="flex-end">
              <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'account' })}>
                Compte
              </Button>
            </Group>
            <Paper withBorder radius="md">
              <Table verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Compte</Table.Th>
                    <Table.Th>Ouverture</Table.Th>
                    <Table.Th ta="right">Solde aujourd’hui</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {accounts.map((account) => (
                    <Table.Tr key={account.id} opacity={account.archived ? 0.6 : 1}>
                      <Table.Td>
                        <Group gap="xs">
                          <Text size="sm" fw={600}>
                            {account.name}
                          </Text>
                          {account.archived && (
                            <Badge size="xs" color="gray">
                              Archivé
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {money(account.openingBalance)} au {printedDate(String(account.openingDate))}
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" fw={600} c={account.balance < 0 ? 'red' : undefined}>
                        {money(account.balance)}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Modifier">
                            <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${account.name}`} onClick={() => setDialog({ kind: 'account', account })}>
                              <PencilSimpleIcon aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={account.entryCount ? 'A des mouvements : archivez-le' : 'Supprimer'}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Supprimer ${account.name}`}
                              disabled={account.entryCount > 0}
                              onClick={() =>
                                confirmDeletion('Supprimer le compte', `« ${account.name} » sera supprimé définitivement.`, () =>
                                  deleteAccount.mutate(account.id, { onSuccess: () => notifySuccess('Compte supprimé.'), onError }),
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
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="settings" pt="md">
          <SettingsPanel />
        </Tabs.Panel>
      </Tabs>
      {dialogs}
    </Stack>
  );
}
