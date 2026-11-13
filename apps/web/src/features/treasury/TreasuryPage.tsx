import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { useEntryCellSave } from './entry-values';
import { SidePanel } from '../../components/panels/SidePanel';
import { ActionIcon, Anchor, Badge, Button, Checkbox, Group, NumberInput, Paper, Popover, SegmentedControl, SimpleGrid, Skeleton, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { DatePickerInput, MonthPicker, YearPicker } from '@mantine/dates';
import { addDays, formatMoney, recurrenceSchema, treasuryAccountSchema } from '@ordo/shared';
import { BankIcon, CaretLeftIcon, CaretRightIcon, CheckIcon, CopyIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DataTable } from '../../components/data-table/DataTable';
import { EditableCheck, EditableDate, EditableNumber, EditableText } from '../../components/data-table/EditableCells';
import { useDataView } from '../../components/data-table/use-data-view';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
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
import { EntriesPanel } from './EntriesPanel';
import { EntryUrl } from './EntryUrl';
import { EntryForm } from './EntryForm';
import { SettingsPanel } from './SettingsPanel';
import { BudgetsPanel } from './BudgetsPanel';
import { LoansPanel } from './LoansPanel';
import { PageTabs } from '../../components/PageTabs';
import { PageTitle } from '../../components/PageTitle';
import { PageSettings } from '../../layouts/PageSettings';
import { SETTINGS_PARAM } from '../../layouts/page-settings';

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

type ForecastRow = { item: ProjectionItem; index: number };

/** Columns of the forecast. */
const FORECAST_COLUMNS: DataColumn<ForecastRow>[] = [
  { id: 'date', label: 'Date', size: 130, sortValue: ({ item }) => item.date, text: ({ item }) => printedDate(item.date), filter: { kind: 'date', value: ({ item }) => item.date } },
  { id: 'label', label: 'Libellé', size: 320, locked: true, sortValue: ({ item }) => item.label, text: ({ item }) => item.label },
  { id: 'payer', label: 'Émetteur / destinataire', size: 200, sortValue: ({ item }) => item.payerName ?? null, text: ({ item }) => item.payerName ?? '', groupable: true },
  {
    id: 'origin',
    label: 'Origine',
    size: 130,
    sortValue: ({ item }) => (KIND_LABELS[item.kind] ?? KIND_LABELS.FORECAST).label,
    text: ({ item }) => (KIND_LABELS[item.kind] ?? KIND_LABELS.FORECAST).label,
    filter: { kind: 'choice', value: ({ item }) => (item.kind in KIND_LABELS ? item.kind : 'FORECAST'), options: Object.entries(KIND_LABELS).map(([value, kind]) => ({ value, label: kind.label })) },
    groupable: true,
  },
  {
    id: 'overdue',
    label: 'En retard',
    size: 110,
    hiddenByDefault: true,
    sortValue: ({ item }) => (item.overdue ? 1 : 0),
    text: ({ item }) => (item.overdue ? 'En retard' : ''),
    filter: { kind: 'boolean', value: ({ item }) => Boolean(item.overdue) },
    groupable: true,
  },
  { id: 'amount', label: 'Montant', size: 130, numeric: true, sortValue: ({ item }) => item.amount, text: ({ item }) => `${item.amount > 0 ? '+' : ''}${money(item.amount)}` },
];

/** Columns of the accounts. */
const ACCOUNT_COLUMNS: DataColumn<TreasuryAccount>[] = [
  { id: 'name', label: 'Compte', size: 260, locked: true, sortValue: (account) => account.name, text: (account) => account.name },
  {
    id: 'openingBalance',
    label: 'Solde d’ouverture',
    size: 150,
    numeric: true,
    sortValue: (account) => account.openingBalance,
    text: (account) => money(account.openingBalance),
  },
  {
    id: 'openingDate',
    label: 'Ouvert le',
    size: 140,
    sortValue: (account) => String(account.openingDate),
    text: (account) => printedDate(String(account.openingDate)),
    filter: { kind: 'date', value: (account) => String(account.openingDate).slice(0, 10) },
  },
  { id: 'balance', label: 'Solde aujourd’hui', size: 160, numeric: true, sortValue: (account) => account.balance, text: (account) => money(account.balance) },
  {
    id: 'archived',
    label: 'Archivé',
    size: 100,
    hiddenByDefault: true,
    sortValue: (account) => (account.archived ? 1 : 0),
    text: (account) => (account.archived ? 'Archivé' : 'Ouvert'),
    filter: { kind: 'boolean', value: (account) => account.archived },
    groupable: true,
  },
];

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
  // The old settings tab: its settings, in the sidebar.
  const asked = params.get('tab') ?? 'forecast';
  const tab = asked === 'settings' ? 'forecast' : asked;
  useEffect(() => {
    if (asked === 'settings') setParams({ [SETTINGS_PARAM]: '1' }, { replace: true });
  }, [asked, setParams]);
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
  const { deleteEntry, deleteAccount, updateAccount } = useTreasuryMutations();
  const saveEntry = useEntryCellSave();

  /**
   * Saves a field of an account changed in its cell.
   * @param {TreasuryAccount} account Account.
   * @param {Partial<AccountValues>} change Change.
   * @returns {void}
   */
  const saveAccount = (account: TreasuryAccount, change: Partial<AccountValues>) =>
    updateAccount.mutate(
      { id: account.id, input: { name: account.name, openingBalance: account.openingBalance, openingDate: String(account.openingDate).slice(0, 10), archived: account.archived, ...change } },
      { onError: (error) => notifyError(error.message) },
    );
  const forecastView = useDataView({ tableKey: 'treasury-forecast', columns: FORECAST_COLUMNS, rows: (projection?.items ?? []).map((item, index) => ({ item, index })), title: 'Prévisionnel' });
  const accountsView = useDataView({ tableKey: 'treasury-accounts', columns: ACCOUNT_COLUMNS, rows: accounts ?? [], title: 'Comptes' });
  const close = () => setDialog(null);
  const onError = (error: Error) => notifyError(error.message);

  if (accountsPending) return <Skeleton height={400} />;

  const header = (
    <Group justify="space-between">
      <PageTitle>Trésorerie</PageTitle>
      {/* On the right, also when the title is hidden (from the tablet on). */}
      {!!accounts?.length && (
        <Group gap="xs" ml="auto">
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
    <SidePanel
      opened={dialog !== null}
      onClose={close}
      // An entry has a table of lines (its split).
      size={dialog?.kind === 'entry' ? 'lg' : 'md'}
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
    </SidePanel>
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
        <Figure
          label={`${end?.forecast === false ? 'Solde au' : 'Solde prévu au'} ${end ? printedDate(end.date) : '—'}`}
          value={end?.balance ?? 0}
          hint={lowest ? `Point bas ${money(lowest.balance)} le ${printedDate(lowest.date)}` : undefined}
        />
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

      <PageTabs
        value={tab}
        onChange={(value) =>
          // The settings sidebar stays as it is.
          setParams(
            (current) => {
              const next = new URLSearchParams(current.get(SETTINGS_PARAM) ? { [SETTINGS_PARAM]: '1' } : {});
              if (value && value !== 'forecast') next.set('tab', value);
              return next;
            },
            { replace: true },
          )
        }
        keepMounted={false}
      >
        <PageTabs.List>
          <PageTabs.Tab value="forecast">Prévisionnel</PageTabs.Tab>
          <PageTabs.Tab value="entries">Mouvements</PageTabs.Tab>
          <PageTabs.Tab value="budgets">Budgets</PageTabs.Tab>
          <PageTabs.Tab value="loans">Prêts</PageTabs.Tab>
          <PageTabs.Tab value="accounts">Comptes</PageTabs.Tab>
        </PageTabs.List>

        <PageTabs.Panel value="forecast">
          <DataTable
            framed
            view={forecastView}
            bar={{ searchLabel: 'Rechercher (libellé, tiers)' }}
            empty={
              <Text size="sm" c="dimmed">
                Rien d’attendu d’ici le {printedDate(until)}. Ajoutez des prévisions (loyer, charges…) : les factures validées non réglées et les factures récurrentes y figurent d’elles-mêmes.
              </Text>
            }
            verticalSpacing="xs"
            highlightOnHover
            getKey={({ item, index }) => `${item.kind}-${item.entryId ?? item.documentId ?? item.importedDocumentId ?? item.recurringInvoiceId}-${item.dueDate}-${index}`}
            cells={({ item }) => {
              const kind = KIND_LABELS[item.kind] ?? KIND_LABELS.FORECAST;
              const entry = item.entryId ? forecastById.get(item.entryId) : undefined;
              return {
                date: (
                  <>
                    {/* A repeating forecast moves by its rule (its form), each other entry by its cell. */}
                    {entry && entry.recurrence == null ? (
                      <EditableDate value={item.date} label={`Date de ${item.label}`} onSave={(date) => date && saveEntry(entry, { date })} />
                    ) : (
                      <Text size="sm">{printedDate(item.date)}</Text>
                    )}
                    {item.overdue && (
                      <Badge size="xs" color="red" variant="light">
                        Prévu le {printedDate(item.dueDate)}
                      </Badge>
                    )}
                  </>
                ),
                label: (
                  <>
                    {item.documentId ? (
                      <Anchor component={Link} to={`/accounting/${item.documentId}`} size="sm">
                        {item.label}
                      </Anchor>
                    ) : (
                      <Group gap={4} wrap="nowrap">
                        {entry ? <EditableText value={entry.label} label={`Libellé de ${item.label}`} onSave={(label) => label && saveEntry(entry, { label })} /> : <Text size="sm">{item.label}</Text>}
                        <EntryUrl url={entry?.url} label={item.label} />
                      </Group>
                    )}
                    {entry?.recurrence != null && (
                      <Text size="xs" c="dimmed">
                        {(() => {
                          const rule = recurrenceSchema.safeParse(entry.recurrence);
                          return rule.success ? describeRecurrence(rule.data, String(entry.date)) : '';
                        })()}
                      </Text>
                    )}
                  </>
                ),
                payer: <Text size="sm">{item.payerName ?? ''}</Text>,
                origin: (
                  <>
                    <Badge size="sm" variant="light" color={kind.color}>
                      {kind.label}
                    </Badge>
                  </>
                ),
                amount: (
                  <Text span inherit c={item.amount < 0 ? 'red' : 'green'}>
                    {entry ? (
                      <EditableNumber
                        value={entry.amount}
                        label={`Montant de ${item.label}`}
                        suffix="€"
                        signed
                        validate={(amount) => (amount === 0 ? 'Le montant ne peut pas être nul.' : null)}
                        onSave={(amount) => amount !== null && saveEntry(entry, { direction: amount < 0 ? 'OUT' : 'IN', amount: Math.abs(amount) })}
                      />
                    ) : (
                      <>
                        {item.amount > 0 ? '+' : ''}
                        {money(item.amount)}
                      </>
                    )}
                  </Text>
                ),
              };
            }}
            actions={({ item }) => {
              const entry = item.entryId ? forecastById.get(item.entryId) : undefined;
              if (!entry || (item.kind !== 'ACTUAL' && item.kind !== 'FORECAST')) return null;
              // An actual entry is one dated after today; a forecast is realized.
              const forecast = item.kind === 'FORECAST';
              return (
                <RowActions
                  name={item.label}
                  primary={
                    forecast
                      ? { label: 'Réaliser', icon: <CheckIcon aria-hidden />, onClick: () => setDialog({ kind: 'realize', item }) }
                      : { label: 'Modifier le mouvement', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setDialog({ kind: 'entry', entry }) }
                  }
                  items={[
                    forecast && { label: 'Modifier la prévision', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setDialog({ kind: 'entry', entry }) },
                    { label: forecast ? 'Dupliquer la prévision' : 'Dupliquer le mouvement', icon: <CopyIcon aria-hidden />, onClick: () => setDialog({ kind: 'entry', entry, copy: true }) },
                    {
                      label: forecast ? 'Supprimer la prévision' : 'Supprimer le mouvement',
                      icon: <TrashIcon aria-hidden />,
                      danger: true,
                      onClick: () =>
                        forecast
                          ? confirmDestructive({
                              title: 'Supprimer la prévision',
                              risks: `« ${item.label} » et toutes ses répétitions seront supprimées.`,
                              onConfirm: () => deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Prévision supprimée.'), onError }),
                            })
                          : confirmDestructive({
                              title: 'Supprimer le mouvement',
                              risks: entry.allocations.length ? `« ${item.label} » sera supprimé : les documents qu’il règle redeviendront dus.` : `« ${item.label} » sera supprimé définitivement.`,
                              onConfirm: () => deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Mouvement supprimé.'), onError }),
                            }),
                    },
                  ]}
                />
              );
            }}
          />
        </PageTabs.Panel>

        <PageTabs.Panel value="entries">
          <EntriesPanel accounts={accounts} onEdit={(entry) => setDialog({ kind: 'entry', entry })} onDuplicate={(entry) => setDialog({ kind: 'entry', entry, copy: true })} />
        </PageTabs.Panel>

        <PageTabs.Panel value="budgets">
          <BudgetsPanel />
        </PageTabs.Panel>

        <PageTabs.Panel value="loans">
          <LoansPanel />
        </PageTabs.Panel>

        <PageTabs.Panel value="accounts">
          <DataTable
            framed
            view={accountsView}
            bar={{
              searchLabel: 'Rechercher un compte',
              actions: (
                <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => setDialog({ kind: 'account' })}>
                  Compte
                </Button>
              ),
            }}
            verticalSpacing="xs"
            getKey={(account) => account.id}
            rowProps={(account) => ({ opacity: account.archived ? 0.6 : 1 })}
            cells={(account) => ({
              name: (
                <Group gap="xs" wrap="nowrap">
                  <EditableText value={account.name} label={`Nom du compte ${account.name}`} strong onSave={(name) => name && saveAccount(account, { name })} />
                  {account.archived && (
                    <Badge size="xs" color="gray" style={{ flex: 'none' }}>
                      Archivé
                    </Badge>
                  )}
                </Group>
              ),
              openingBalance: (
                <EditableNumber
                  value={account.openingBalance}
                  label={`Solde d’ouverture de ${account.name}`}
                  suffix="€"
                  signed
                  onSave={(openingBalance) => openingBalance !== null && saveAccount(account, { openingBalance })}
                />
              ),
              openingDate: (
                <EditableDate value={String(account.openingDate).slice(0, 10)} label={`Ouverture de ${account.name}`} onSave={(openingDate) => openingDate && saveAccount(account, { openingDate })} />
              ),
              balance: (
                <Text span inherit fw={600} c={account.balance < 0 ? 'red' : undefined}>
                  {money(account.balance)}
                </Text>
              ),
              archived: <EditableCheck value={account.archived} label={`${account.name} archivé`} onSave={(archived) => saveAccount(account, { archived })} />,
            })}
            actions={(account) => (
              <RowActions
                name={account.name}
                primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => setDialog({ kind: 'account', account }) }}
                items={[
                  {
                    label: 'Supprimer',
                    icon: <TrashIcon aria-hidden />,
                    danger: true,
                    disabled: account.entryCount > 0,
                    hint: account.entryCount ? 'A des mouvements : archivez-le' : undefined,
                    onClick: () =>
                      confirmDestructive({
                        title: 'Supprimer le compte',
                        risks: `« ${account.name} » sera supprimé définitivement.`,
                        onConfirm: () => deleteAccount.mutate(account.id, { onSuccess: () => notifySuccess('Compte supprimé.'), onError }),
                      }),
                  },
                ]}
              />
            )}
          />
        </PageTabs.Panel>
      </PageTabs>
      {/* Categories, payment methods, counterparties: in the settings sidebar. */}
      <PageSettings title="Paramètres de la trésorerie">
        <SettingsPanel />
      </PageSettings>
      {dialogs}
    </Stack>
  );
}
