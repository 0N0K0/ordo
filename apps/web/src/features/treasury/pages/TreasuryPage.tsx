import { useSearchParam } from '../../../lib/search-params';
import { formCallbacks } from '../../../lib/form';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { PAGES, SETTINGS_PARAM, documentPath } from '../../../app/pages';
import { PeriodNav } from '../../../components/page/PeriodNav';
import { StatTile } from '../../../components/page/StatTile';
import { openFormPanel } from '../../../components/panels/panels';
import { countOf, plural } from '../../../lib/text';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { BlockSkeleton, DetailSkeleton } from '../../../components/feedback/Skeletons';

import { useEntryCellSave, useEntryDuplicate } from '../lib/entry-values';

import { SettingsSection } from '../../../components/settings/SettingsSection';
import { Anchor, Badge, Button, Group, Popover, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { AreaChart } from '@mantine/charts';
import { DatePickerInput, MonthPicker, YearPicker } from '@mantine/dates';
import { addDays, CALENDAR_SCALE_OPTIONS, mapById, calendarEnd, type CalendarScale, calendarStart, shiftCalendar, sumOf } from '@ordo/shared';
import { ArrowsSplitIcon, BankIcon, CalendarPlusIcon, CheckIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useSetArchived, unarchived } from '../../../lib/archive';
import { useState } from 'react';
import { Link } from 'react-router';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { EditableDate, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { readOnlyCells, type DataColumn } from '../../../components/data-table/table/data-table';
import { localToday } from '../../../lib/dates';

import {
  treasuryKey,
  useForecastEntries,
  useTreasuryAccounts,
  useTreasuryMutations,
  useTreasuryProjection,
  type ForecastEntry,
  type ProjectionItem,
  type TreasuryAccount,
  type TreasuryEntry,
} from '../api';
import { periodName } from '../../../lib/periods';
import { EntriesPanel } from '../components/EntriesPanel';
import { DetailsToggle, PayerCell } from '../components/entry-cells';
import { entryFieldCells, entryFieldColumns } from '../lib/entry-columns';
import { useEntryEnv, type EntryEnv, type EntrySave } from '../lib/entry-env';
import { bulkCellLabels, bulkSaver, changeOf } from '../../../components/data-table/selection/bulk-edit';
import type { EntryValues } from '../lib/entry-values';
import { EntryLinesTable } from '../components/EntryLinesTable';
import { EntryUrl } from '../components/EntryUrl';
import { EntryForm } from '../components/EntryForm';
import { SettingsPanel } from '../components/SettingsPanel';
import { AccountItemForm } from '../components/TreasuryItemForms';
import { BudgetsPanel } from '../components/BudgetsPanel';
import { LoansPanel } from '../components/LoansPanel';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { PageSettings } from '../../../app/layout/PageSettings';
import * as fmt from '../../../lib/format';
import { archiveItemsAction, duplicateRowsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SignedAmount, SignedAmountCell } from '../../../components/money/SignedAmount';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { useDeleteEntries } from '../hooks/use-delete-entries';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';
import { signedText } from '../../../components/money/signed-text';

const FORECAST_KINDS: Record<string, { label: string; color: string }> = {
  FORECAST: { label: 'Prévision', color: 'grape' },
  ACTUAL: { label: 'À venir', color: 'gray' },
  INVOICE: { label: 'Facture', color: 'blue' },
  CREDIT_NOTE: { label: 'Avoir', color: 'orange' },
  IMPORTED: { label: 'Importé', color: 'cyan' },
  RECURRING_INVOICE: { label: 'Récurrente', color: 'teal' },
};

type ForecastRow = { item: ProjectionItem; index: number };

/** No account yet. */
const NO_ACCOUNTS: TreasuryAccount[] = [];

/**
 * Columns of the forecast: date, label, origin, overdue, amount, then the columns every table of entries shares (those
 * of an entry: none for an invoice due or a recurring invoice).
 * @param {(row: ForecastRow) => ForecastEntry | undefined} entryOf Entry of a row.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<ForecastRow>[]} Columns.
 */
function forecastColumns(entryOf: (row: ForecastRow) => ForecastEntry | undefined, env: EntryEnv): DataColumn<ForecastRow>[] {
  return [
    monthColumn('month', 'Mois', ({ item }) => item.date),
    {
      id: 'date',
      label: 'Date d’exécution',
      size: 140,
      required: true,
      bulk: true,
      sortValue: ({ item }) => item.date,
      text: ({ item }) => fmt.day(item.date),
      filter: { kind: 'date', value: ({ item }) => item.date },
    },
    { id: 'label', label: 'Libellé', size: 320, locked: true, required: true, bulk: true, sortValue: ({ item }) => item.label, text: ({ item }) => item.label },
    {
      id: 'origin',
      label: 'Origine',
      size: 130,
      required: true,
      sortValue: ({ item }) => (FORECAST_KINDS[item.kind] ?? FORECAST_KINDS.FORECAST).label,
      text: ({ item }) => (FORECAST_KINDS[item.kind] ?? FORECAST_KINDS.FORECAST).label,
      filter: {
        kind: 'choice',
        value: ({ item }) => (item.kind in FORECAST_KINDS ? item.kind : 'FORECAST'),
        options: Object.entries(FORECAST_KINDS).map(([value, kind]) => ({ value, label: kind.label })),
      },
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
    ...entryFieldColumns<ForecastRow>(entryOf, env, { payerName: ({ item }) => item.payerName ?? '', recurrence: true }),
    {
      id: 'amount',
      bulk: true,
      required: true,
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: ({ item }) => item.amount,
      formatTotal: fmt.money,
      text: ({ item }) => signedText(item.amount),
      filter: { kind: 'number', value: ({ item }) => item.amount },
    },
  ];
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
        « {item.label} », prévu le {fmt.day(item.dueDate)}, devient un mouvement réel.
      </Text>
      <SimpleGrid cols={2} spacing="sm">
        <DatePickerInput label="Date réelle" required value={date} onChange={setDate} />
        <AmountInput label={item.amount < 0 ? 'Montant sorti' : 'Montant entré'} min={0} value={amount} onChange={(value) => setAmount(typeof value === 'number' ? value : 0)} />
      </SimpleGrid>
      <FormActions
        onCancel={onDone}
        loading={realize.isPending}
        disabled={!date || amount <= 0}
        onSubmit={() =>
          date && item.entryId && realize.mutate({ id: item.entryId, occurrence: item.dueDate, date, amount: item.amount < 0 ? -amount : amount }, formCallbacks(null, 'Mouvement enregistré.', onDone))
        }
      />
    </Stack>
  );
}

/**
 * Key figure of the treasury: an amount (red below zero).
 * @param {{ label: string, value: number, hint?: string, color?: string }} props Component props.
 * @returns {JSX.Element} Tile.
 */
function AmountTile({ label, value, hint, color }: { label: string; value: number; hint?: string; color?: string }) {
  return <StatTile label={label} value={fmt.money(value)} hint={hint} valueColor={color ?? (value < 0 ? 'red' : undefined)} />;
}

type Dialog = { kind: 'entry'; entry?: TreasuryEntry | ForecastEntry; status?: 'ACTUAL' | 'FORECAST' } | { kind: 'realize'; item: ProjectionItem } | null;

/** Tabs of the treasury page. */
const TREASURY_TABS = ['forecast', 'entries', 'budgets', 'loans'] as const;

/** Former tabs of the page: the settings and the accounts, in the settings sidebar. */
const TREASURY_MOVED_TABS = { settings: { changes: { [SETTINGS_PARAM]: '1' }, only: true }, accounts: { changes: { [SETTINGS_PARAM]: '1' }, only: true } };

/**
 * Treasury: balance of the accounts, balance curve (actual, then forecast) over a month, a quarter or a
 * calendar year moved with arrows, expected movements (forecasts, invoices due, coming recurring invoices), actual movements of a
 * month or a year, the accounts, and the settings (categories, payment methods, counterparties).
 * @returns {JSX.Element} Page.
 */
export function TreasuryPage() {
  const today = localToday();
  const [settingsParam] = useSearchParam(SETTINGS_PARAM);
  // The old settings and accounts tabs: in the settings sidebar.
  const [tab, setTab] = usePageTab(TREASURY_TABS, TREASURY_TABS[0], TREASURY_MOVED_TABS);
  // Period of the chart: a month, quarter or calendar year, moved with arrows.
  const [scale, setScale] = useState<CalendarScale>('month');
  const [periodFirst, setPeriodFirst] = useState(() => calendarStart('month', today));
  const [picking, setPicking] = useState(false);
  const from = periodFirst;
  const periodLast = calendarEnd(scale, periodFirst);
  // The forecast (expected movements) always reaches a year ahead, whatever the period shown.
  const until = periodLast > addDays(today, 365) ? periodLast : addDays(today, 365);
  const { data: accounts, isPending: accountsPending } = useTreasuryAccounts();
  const { data: projection, isPending: projectionPending } = useTreasuryProjection({ today, from, until });
  const { data: forecasts } = useForecastEntries();
  const deleteEntries = useDeleteEntries();
  const setArchived = useSetArchived('TREASURY_ENTRY', [treasuryKey]);
  const saveEntry = useEntryCellSave();

  const env = useEntryEnv(accounts ?? NO_ACCOUNTS);
  const forecastById = mapById(forecasts ?? []);
  const forecastOf = ({ item }: ForecastRow) => (item.entryId ? forecastById.get(item.entryId) : undefined);
  // Rows whose splits are unfolded.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const forecastKey = ({ item, index }: ForecastRow) => `${item.kind}-${item.entryId ?? item.documentId ?? item.importedDocumentId ?? item.recurringInvoiceId}-${item.dueDate}-${index}`;
  const unfold = (key: string) =>
    setUnfolded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const columns = forecastColumns(forecastOf, env);
  // Archived forecasts and documents are hidden unless the view includes them (they still count in the balances and the
  // curve: real money).
  const forecastView = useDataView({
    tableKey: 'treasury-forecast',
    getKey: forecastKey,
    columns,
    rows: (projection?.items ?? []).map((item, index) => ({ item, index })),
    title: 'Prévisionnel',
    archived: (row) => row.item.archived || (forecastOf(row)?.archived ?? false),
  });
  /**
   * Saves the forecast entries of rows, each once (a repeating one shows on several rows); rows without entry (an
   * invoice due…) and changes that do not fit are left out.
   * @param {ForecastRow[]} rows Rows.
   * @param {(row: ForecastRow) => Partial<EntryValues>} changeFor Change of each.
   * @returns {void}
   */
  const saveForecasts = (rows: ForecastRow[], changeFor: (row: ForecastRow) => Partial<EntryValues>) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const entry = forecastOf(row);
      // An archived one is read only.
      if (!entry || entry.archived || seen.has(entry.id)) continue;
      seen.add(entry.id);
      const change = changeFor(row);
      if (Object.keys(change).length) saveEntry(entry, change);
    }
  };
  const forecastLabel = bulkCellLabels<ForecastRow>(forecastView, (row) => row.item.label);
  const forecastBulk = bulkSaver<ForecastRow, Partial<EntryValues>>(forecastView, (row, change) => saveForecasts([row], () => change), saveForecasts);
  /**
   * Save of a column of a row, as the entry cells call it.
   * @param {ForecastRow} row Row.
   * @returns {(column: string) => EntrySave} Save of a column.
   */
  const forecastSave =
    (row: ForecastRow) =>
    (column: string): EntrySave =>
    (_entry, change) =>
      forecastBulk(column)(row, (target) => {
        const entry = forecastOf(target);
        return entry ? changeOf(change, entry) : {};
      });
  /**
   * Opens the form of an entry (new or changed) or the realization of a forecast.
   * @param {NonNullable<Dialog>} dialog Form.
   * @returns {void}
   */
  const openDialog = (dialog: NonNullable<Dialog>) =>
    openFormPanel(
      dialog.kind === 'realize'
        ? 'Réaliser la prévision'
        : dialog.entry
          ? 'Modifier le mouvement'
          : dialog.status === 'FORECAST'
            ? 'Nouvelle prévision'
            : 'Nouveau mouvement',
      (close) => (dialog.kind === 'entry' ? <EntryForm entry={dialog.entry} status={dialog.status} onDone={close} /> : <RealizeForm item={dialog.item} onDone={close} />),
      // An entry has a table of lines (its split).
      dialog.kind === 'entry' ? 'lg' : 'md',
    );

  // « Dupliquer » of an entry or a forecast: saved at once, then its form opens (decision D20).
  const duplicateEntry = useEntryDuplicate((entry) => openDialog({ kind: 'entry', entry }));

  if (accountsPending) return <DetailSkeleton />;

  const header = (
    <PageHeader
      title={PAGES.treasury.label}
      actions={
        !accounts?.length ? (
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openFormPanel('Nouveau compte', (close) => <AccountItemForm onDone={() => close()} />)}>
            Nouveau compte
          </ActionButton>
        ) : (
          <ActionButton
            icon={<PlusIcon aria-hidden />}
            onClick={() => openDialog({ kind: 'entry', status: 'ACTUAL' })}
            menu={[{ label: 'Nouvelle prévision', icon: <CalendarPlusIcon aria-hidden />, onClick: () => openDialog({ kind: 'entry', status: 'FORECAST' }) }]}
          >
            Nouveau mouvement
          </ActionButton>
        )
      }
    />
  );

  if (!accounts?.length) {
    return (
      <Stack gap="md">
        {header}
        <EmptyState icon={<BankIcon aria-hidden />} message="Aucun compte. Créez votre compte bancaire avec le solde de votre relevé à une date : les mouvements et le prévisionnel partent de là." />
      </Stack>
    );
  }

  const items = projection?.items ?? [];
  const receivable = sumOf(
    items.filter((item) => item.amount > 0 && (item.kind === 'INVOICE' || item.kind === 'IMPORTED')),
    (item) => item.amount,
  );
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
  return (
    <Stack gap="md">
      {header}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
        <AmountTile label="Solde aujourd’hui" value={projection?.balance ?? 0} hint={countOf(unarchived(accounts).length, 'compte')} />
        <AmountTile label="À encaisser" value={receivable} hint="Factures validées non réglées" color="blue" />
        <AmountTile
          label="En retard"
          value={sumOf(late, (item) => item.amount)}
          hint={`${countOf(late.length, 'échéance')} ${plural(late.length, 'dépassée')}`}
          color={late.length ? LATE_COLOR : undefined}
        />
        <AmountTile
          label={`${end?.forecast === false ? 'Solde au' : 'Solde prévu au'} ${end ? fmt.day(end.date) : '—'}`}
          value={end?.balance ?? 0}
          hint={lowest ? `Point bas ${fmt.money(lowest.balance)} le ${fmt.day(lowest.date)}` : undefined}
        />
      </SimpleGrid>

      <SettingsSection
        title="Évolution du solde"
        actions={
          <Group gap="xs">
            <PeriodNav
              current={periodFirst === calendarStart(scale, today)}
              onToday={() => setPeriodFirst(calendarStart(scale, today))}
              onPrevious={() => setPeriodFirst(shiftCalendar(scale, periodFirst, -1))}
              onNext={() => setPeriodFirst(shiftCalendar(scale, periodFirst, 1))}
            >
              <Popover opened={picking} onChange={setPicking} position="bottom" shadow="md" withArrow>
                <Popover.Target>
                  {/* eslint-disable-next-line no-restricted-syntax -- a period picker showing its value (no icon), small and discreet like a field. */}
                  <Button size="xs" variant="subtle" color="gray" miw={150} onClick={() => setPicking((open) => !open)} aria-label={`Choisir la période (${periodName(scale, periodFirst)})`}>
                    {periodName(scale, periodFirst)}
                  </Button>
                </Popover.Target>
                <Popover.Dropdown>
                  {scale === 'year' ? (
                    <YearPicker
                      value={periodFirst}
                      onChange={(value) => {
                        if (value) setPeriodFirst(calendarStart('year', value));
                        setPicking(false);
                      }}
                    />
                  ) : (
                    // A quarter is chosen by one of its months.
                    <MonthPicker
                      value={periodFirst}
                      onChange={(value) => {
                        if (value) setPeriodFirst(calendarStart(scale, value));
                        setPicking(false);
                      }}
                    />
                  )}
                </Popover.Dropdown>
              </Popover>
            </PeriodNav>
            <SegmentedControl
              size="xs"
              aria-label="Durée de la période"
              data={CALENDAR_SCALE_OPTIONS}
              value={scale}
              // The new period contains the first day of the previous one.
              onChange={(value) => {
                setScale(value as CalendarScale);
                setPeriodFirst(calendarStart(value as CalendarScale, periodFirst));
              }}
            />
          </Group>
        }
      >
        {projectionPending ? (
          <BlockSkeleton height={11} />
        ) : (
          <AreaChart
            h={264}
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
            xAxisProps={{ tickFormatter: (value: string) => fmt.dayShort(value), minTickGap: 40 }}
            valueFormatter={(value) => fmt.money(value)}
            referenceLines={[{ y: 0, color: 'red.5' }]}
            yAxisProps={{ width: 90 }}
          />
        )}
      </SettingsSection>

      <PageTabs
        value={tab}
        onChange={(value) =>
          // The settings sidebar stays as it is.
          setTab(value, { [SETTINGS_PARAM]: settingsParam }, { only: true })
        }
        keepMounted={false}
      >
        <PageTabs.List>
          <PageTabs.Tab value="forecast">Prévisionnel</PageTabs.Tab>
          <PageTabs.Tab value="entries">Mouvements</PageTabs.Tab>
          <PageTabs.Tab value="budgets">Budgets</PageTabs.Tab>
          <PageTabs.Tab value="loans">Prêts</PageTabs.Tab>
        </PageTabs.List>

        <PageTabs.Panel value="forecast">
          <DataTable
            framed
            view={forecastView}
            selectionLabel={(count) => selectedLabel(count, ['prévision', 'prévisions'])}
            selectionActions={(rows, clear) => {
              // The forecasts entered (the invoices and recurring invoices to come are not deleted here).
              const entries = [
                ...new Map(
                  rows.flatMap((row) => {
                    const entry = forecastOf(row);
                    return entry ? [[entry.id, entry] as const] : [];
                  }),
                ).values(),
              ];
              return [
                {
                  ...archiveItemsAction(entries, setArchived, { noun: 'prévision', feminine: true, clear }),
                  disabled: entries.length === 0,
                },
                {
                  ...deleteEntries.forecasts(entries, clear, entries.length < rows.length ? ' (les factures à venir sélectionnées ne le sont pas)' : ''),
                  disabled: entries.length === 0,
                },
              ];
            }}
            bar={{ searchLabel: 'Rechercher (libellé, tiers)' }}
            empty={
              <EmptyState
                compact
                message={`Rien d’attendu d’ici le ${fmt.day(until)}. Ajoutez des prévisions (loyer, charges…) : les factures validées non réglées et les factures récurrentes y figurent d’elles-mêmes.`}
              />
            }
            verticalSpacing="xs"
            highlightOnHover
            getKey={forecastKey}
            isArchived={(row) => row.item.archived || (forecastOf(row)?.archived ?? false)}
            details={(row) => {
              const entry = forecastOf(row);
              return entry && !entry.archived && unfolded.has(forecastKey(row)) ? <EntryLinesTable entry={entry} env={env} save={saveEntry} /> : null;
            }}
            cells={(row) => {
              const { item } = row;
              const kind = FORECAST_KINDS[item.kind] ?? FORECAST_KINDS.FORECAST;
              const entry = forecastOf(row);
              if (entry?.archived) {
                // Read only: the texts of the columns.
                return {
                  ...readOnlyCells(columns, row),
                  label: (
                    <Group gap={4} wrap="nowrap">
                      <Text size="sm" truncate>
                        {item.label}
                      </Text>
                      <ArchivedBadge size="xs" feminine={entry.status === 'FORECAST'} />
                    </Group>
                  ),
                };
              }
              return {
                ...(entry ? entryFieldCells(entry, env, forecastSave(row), (column, field) => forecastLabel(column, row, field)) : {}),
                date: (
                  <>
                    {/* A repeating forecast moves by its rule (its form), each other entry by its cell. */}
                    {entry && entry.recurrence == null ? (
                      <EditableDate
                        value={item.date}
                        label={forecastLabel('date', row, 'Date')}
                        onSave={(date) => date && forecastSave(row)('date')(entry, (target) => (target.recurrence == null ? { date } : {}))}
                      />
                    ) : (
                      <Text size="sm">{fmt.day(item.date)}</Text>
                    )}
                    {item.overdue && (
                      <Badge size="xs" color={LATE_COLOR} variant="light">
                        Prévu le {fmt.day(item.dueDate)}
                      </Badge>
                    )}
                  </>
                ),
                label: (
                  <>
                    {item.documentId ? (
                      <Group gap={4} wrap="nowrap">
                        <Anchor component={Link} to={documentPath(item.documentId)} size="sm">
                          {item.label}
                        </Anchor>
                        {item.archived && <ArchivedBadge size="xs" />}
                      </Group>
                    ) : (
                      <Group gap={4} wrap="nowrap">
                        {entry ? (
                          <EditableText value={entry.label} label={forecastLabel('label', row, 'Libellé')} onSave={(label) => label && forecastSave(row)('label')(entry, { label })} />
                        ) : (
                          <Text size="sm">{item.label}</Text>
                        )}
                        {!entry && item.archived && <ArchivedBadge size="xs" />}
                        <EntryUrl url={entry?.url} label={item.label} />
                        {entry && (entry.lines.length > 0 || unfolded.has(forecastKey(row))) && (
                          <DetailsToggle opened={unfolded.has(forecastKey(row))} count={entry.lines.length} label={item.label} onToggle={() => unfold(forecastKey(row))} />
                        )}
                      </Group>
                    )}
                  </>
                ),
                payer: entry ? (
                  <PayerCell entry={entry} env={env} label={forecastLabel('payer', row, entry.amount < 0 ? 'Destinataire' : 'Émetteur')} save={forecastSave(row)('payer')} />
                ) : (
                  <Text size="sm">{item.payerName ?? ''}</Text>
                ),
                origin: (
                  <>
                    <Badge size="sm" variant="light" color={kind.color}>
                      {kind.label}
                    </Badge>
                  </>
                ),
                amount: entry ? (
                  <SignedAmountCell value={entry.amount} label={forecastLabel('amount', row, 'Montant')} onSave={(change) => forecastSave(row)('amount')(entry, change)} />
                ) : (
                  <SignedAmount value={item.amount} />
                ),
              };
            }}
            actions={(row) => {
              const { item } = row;
              const entry = item.entryId ? forecastById.get(item.entryId) : undefined;
              if (!entry || (item.kind !== 'ACTUAL' && item.kind !== 'FORECAST')) return null;
              // An actual entry is one dated after today; a forecast is realized.
              const forecast = item.kind === 'FORECAST';
              const archiveItem = archiveEntry({ archived: entry.archived, type: forecast ? 'Prévision' : 'Mouvement', label: entry.label, feminine: forecast }, setArchived, entry.id);
              return (
                <RowActions
                  name={item.label}
                  primary={
                    entry.archived
                      ? undefined
                      : forecast
                        ? { label: 'Réaliser', icon: <CheckIcon aria-hidden />, onClick: () => openDialog({ kind: 'realize', item }) }
                        : { label: 'Modifier le mouvement', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openDialog({ kind: 'entry', entry }) }
                  }
                  items={[
                    forecast && !entry.archived && { label: 'Modifier la prévision', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openDialog({ kind: 'entry', entry }) },
                    !entry.archived && rowMenuEntry(duplicateRowsAction([entry], duplicateEntry)),
                    // An entry not split yet: its split opens under it, where its lines are added.
                    !entry.archived &&
                      entry.lines.length === 0 &&
                      !unfolded.has(forecastKey(row)) && { label: 'Répartir', icon: <ArrowsSplitIcon aria-hidden />, onClick: () => unfold(forecastKey(row)) },
                    archiveItem,
                    rowMenuEntry(forecast ? deleteEntries.forecasts([entry]) : deleteEntries.movements([entry])),
                  ]}
                />
              );
            }}
          />
        </PageTabs.Panel>

        <PageTabs.Panel value="entries">
          <EntriesPanel accounts={accounts} onEdit={(entry) => openDialog({ kind: 'entry', entry })} onDuplicate={duplicateEntry} />
        </PageTabs.Panel>

        <PageTabs.Panel value="budgets">
          <BudgetsPanel />
        </PageTabs.Panel>

        <PageTabs.Panel value="loans">
          <LoansPanel />
        </PageTabs.Panel>
      </PageTabs>
      {/* Accounts, categories, payment methods, counterparties: in the settings sidebar. */}
      <PageSettings title="Paramètres de la trésorerie">
        <SettingsPanel />
      </PageSettings>
    </Stack>
  );
}
