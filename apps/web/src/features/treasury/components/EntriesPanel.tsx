import { toggledIn } from '../../../lib/sets';
import { openFormPanel } from '../../../components/panels/panels';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { Group, Stack, Switch, Text } from '@mantine/core';
import { offsetLinkedMovements } from '@ordo/shared';
import { ArrowsLeftRightIcon, CopyIcon, FileCsvIcon, FilePdfIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { EditableDate, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useEntryCellSave, type EntryValues } from '../lib/entry-values';
import { bulkCellLabels, type BulkChange, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { useDataView, type FirstTableView, withinFilter } from '../../../components/data-table/views/use-data-view';
import { ROW_ACTIONS_WIDTH, RowActions } from '../../../components/data-table/cells/RowActions';
import { readOnlyCells, type DataColumn } from '../../../components/data-table/table/data-table';
import { archiveItemsAction, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useSetArchived, unarchived } from '../../../lib/archive';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';

import { treasuryKey, useTreasuryEntries, type TreasuryAccount, type TreasuryEntry } from '../api';
import { DetailsToggle, SettledCell } from './entry-cells';
import { useEntryEnv, type EntryEnv } from '../lib/entry-env';
import { entryFieldCells, entryFieldColumns } from '../lib/entry-columns';
import { EntryLinesTable } from './EntryLinesTable';
import { EntryUrl } from './EntryUrl';
import { StatementForm } from './StatementForm';
import { StatementImport } from './StatementImport';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { SignedAmountCell } from '../../../components/money/SignedAmount';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { useDeleteEntries } from '../hooks/use-delete-entries';
import { signedText } from '../../../components/money/signed-text';

/**
 * Money in and out of actual entries, linked money in and out of the period offsetting each other.
 * @param {TreasuryEntry[]} entries Actual entries of the period.
 * @returns {{ incoming: number, outgoing: number, offset: number }} Totals, and the amount offset by links.
 */
function periodTotals(entries: TreasuryEntry[]) {
  const remaining = offsetLinkedMovements(entries.map((entry) => ({ id: entry.id, amount: entry.amount, linkedIds: entry.linkedEntries.map((linked) => linked.id), period: 'all' })));
  let incoming = 0;
  let outgoing = 0;
  let offset = 0;
  for (const entry of entries) {
    const amount = remaining.get(entry.id) ?? entry.amount;
    if (amount > 0) incoming += amount;
    else outgoing -= amount;
    if (entry.amount > 0) offset += entry.amount - amount;
  }
  return { incoming, outgoing, offset };
}

interface EntriesPanelProps {
  accounts: TreasuryAccount[];
  onEdit: (entry: TreasuryEntry) => void;
  /** Copies an entry into a new one. */
  onDuplicate: (entry: TreasuryEntry) => void;
}

/** Width of the actions column. */
const ACTIONS_WIDTH = ROW_ACTIONS_WIDTH;

/**
 * Columns of the entries: month (to group), execution date, label, amount, documents settled, then the columns every
 * table of entries shares.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
function entryColumns(env: EntryEnv): DataColumn<TreasuryEntry>[] {
  return [
    monthColumn('month', 'Mois', (entry) => entry.date),
    {
      id: 'date',
      bulk: true,
      required: true,
      label: 'Date d’exécution',
      size: 130,
      sortValue: (entry) => entry.date,
      text: (entry) => fmt.day(entry.date),
      filter: { kind: 'date', value: (entry) => entry.date },
    },
    { id: 'label', label: 'Libellé', size: 300, locked: true, required: true, bulk: true, sortValue: (entry) => entry.label, text: (entry) => entry.label },
    ...entryFieldColumns<TreasuryEntry>((entry) => entry, env, { payerName: (entry) => entry.payerName ?? '', allEntries: true }),
    {
      id: 'settled',
      label: 'Documents réglés',
      size: 200,
      hiddenByDefault: true,
      text: (entry) => entry.allocations.map((allocation) => allocation.documentLabel).join(', '),
      filter: { kind: 'boolean', value: (entry) => entry.allocations.length > 0 },
    },
    {
      id: 'amount',
      bulk: true,
      required: true,
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: (entry) => entry.amount,
      formatTotal: fmt.money,
      text: (entry) => signedText(entry.amount),
      filter: { kind: 'number', value: (entry) => entry.amount },
    },
  ];
}

/** Views made the first time the entries are shown: this month (opened first), this year by month, all by month. */
const ENTRY_VIEWS: FirstTableView[] = [
  { label: 'Ce mois-ci', config: { filter: withinFilter('date', 'thisMonth') } },
  { label: 'Cette année', config: { filter: withinFilter('date', 'thisYear'), groupBy: 'month', sorting: [{ id: 'month', desc: true }] } },
  { label: 'Tous', config: { groupBy: 'month', sorting: [{ id: 'month', desc: true }] } },
];

/**
 * Actual movements in saved views (this month, this year by month, all by default), filtered, sorted, grouped and
 * exported as every table: execution and value dates, payer or payee, category, method, documents settled and linked
 * entries; money in and out of what is shown, linked ones offset. Archived entries are hidden unless the view includes
 * them, and read only; they still count in the balances, the projection and the statements (real money).
 * @param {EntriesPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function EntriesPanel({ accounts, onEdit, onDuplicate }: EntriesPanelProps) {
  // Every entry: the views choose their period and account.
  const { data: entries, isPending } = useTreasuryEntries({ from: '1900-01-01', to: '2999-12-31', accountId: null });
  const deleteEntries = useDeleteEntries();
  const setArchived = useSetArchived('TREASURY_ENTRY', [treasuryKey]);
  const saveEntry = useEntryCellSave();
  const env = useEntryEnv(accounts);
  const entryComments = useCommentCounts(
    'TREASURY_ENTRY',
    (entries ?? []).map((entry) => entry.id),
  );
  const columns = useMemo(
    () => [
      ...entryColumns(env),
      commentColumn<TreasuryEntry>(
        entryComments,
        (entry) => entry.id,
        (entry) => entry.note,
      ),
    ],
    [env, entryComments],
  );
  const loaded = useMemo(() => (entries ?? []).filter((entry) => entry.status === 'ACTUAL'), [entries]);
  const view = useDataView({ tableKey: 'treasury-entries', getKey: (entry) => entry.id, columns, rows: loaded, title: 'Mouvements', first: ENTRY_VIEWS, archived: (entry) => entry.archived });
  // A change made on the bulk selection of a column saves each entry it fits (none: left as it is; archived ones are read only).
  const cellLabelOf = bulkCellLabels(view, (entry) => entry.label);
  const bulk = bulkSaver<TreasuryEntry, Partial<EntryValues>>(view, (entry, change) => !entry.archived && Object.keys(change).length > 0 && saveEntry(entry, change));
  const actual = view.rows;
  const totals = periodTotals(actual);
  // Split entries whose lines are shown.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const split = actual.filter((entry) => entry.lines.length > 0);
  const allExpanded = split.length > 0 && split.every((entry) => expanded.has(entry.id));
  const toggle = (id: string) => setExpanded((current) => toggledIn(current, id));
  return (
    <Stack gap="sm">
      <DataTable
        view={view}
        getKey={(entry) => entry.id}
        loading={isPending}
        actionsWidth={ACTIONS_WIDTH}
        framed
        verticalSpacing="xs"
        empty={<EmptyState icon={<ArrowsLeftRightIcon aria-hidden />} message="Aucun mouvement pour le moment." />}
        bar={{
          searchLabel: 'Rechercher (libellé, tiers, documents)',
          displayOptions: split.length > 0 && (
            <Switch label="Répartitions dépliées" checked={allExpanded} onChange={(event) => setExpanded(event.currentTarget.checked ? new Set(split.map((entry) => entry.id)) : new Set())} />
          ),
          exports: (
            <ActionButton
              priority="secondary"
              icon={<FilePdfIcon aria-hidden />}
              onClick={() => openFormPanel('Exporter le relevé des mouvements', (close) => <StatementForm accounts={accounts} accountId={null} onDone={close} />)}
            >
              Relevé de compte (PDF)
            </ActionButton>
          ),
          tools: (
            <>
              <ActionButton
                priority="secondary"
                icon={<FileCsvIcon aria-hidden />}
                onClick={() => openFormPanel('Importer un relevé bancaire', (close) => <StatementImport accounts={accounts} onDone={close} />, 'lg')}
                disabled={unarchived(accounts).length === 0}
              >
                Importer un relevé
              </ActionButton>
              {actual.length > 0 && (
                <Stack gap={0} ml="auto" align="flex-end">
                  <Text size="sm" c="dimmed">
                    Entrées {fmt.money(totals.incoming)} · Sorties {fmt.money(totals.outgoing)}
                  </Text>
                  {totals.offset > 0 && (
                    <Text size="xs" c="dimmed">
                      {fmt.money(totals.offset)} compensés par des mouvements liés
                    </Text>
                  )}
                </Stack>
              )}
            </>
          ),
        }}
        groupSummary={(rows) => {
          const groupTotals = periodTotals(rows);
          return `+${fmt.money(groupTotals.incoming)} · −${fmt.money(groupTotals.outgoing)}`;
        }}
        isArchived={(entry) => entry.archived}
        cells={(entry) =>
          entry.archived
            ? {
                // Read only: the texts of the columns.
                ...readOnlyCells(columns, entry),
                label: (
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm" truncate>
                      {entry.label}
                    </Text>
                    <ArchivedBadge size="xs" />
                  </Group>
                ),
                settled: <SettledCell entry={entry} />,
              }
            : {
                ...entryFieldCells(
                  entry,
                  env,
                  (column) => (row, change) => bulk(column)(row as TreasuryEntry, change as BulkChange<TreasuryEntry, Partial<EntryValues>>),
                  (column, field) => cellLabelOf(column, entry, field),
                ),
                date: <EditableDate value={entry.date} label={cellLabelOf('date', entry, 'Exécution')} onSave={(next) => next && bulk('date')(entry, { date: next })} />,
                label: (
                  <Group gap={4} wrap="nowrap">
                    <EditableText value={entry.label} label={cellLabelOf('label', entry, 'Libellé')} onSave={(label) => label && bulk('label')(entry, { label })} />
                    <EntryUrl url={entry.url} label={entry.label} />
                    {entry.lines.length > 0 && <DetailsToggle opened={expanded.has(entry.id)} count={entry.lines.length} label={entry.label} onToggle={() => toggle(entry.id)} />}
                  </Group>
                ),
                settled: <SettledCell entry={entry} />,
                amount: <SignedAmountCell value={entry.amount} label={cellLabelOf('amount', entry, 'Montant')} onSave={(change) => bulk('amount')(entry, change)} />,
              }
        }
        details={(entry) => !entry.archived && expanded.has(entry.id) && <EntryLinesTable entry={entry} env={env} save={saveEntry} />}
        actions={(entry) => (
          <RowActions
            name={entry.label}
            primary={!entry.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => onEdit(entry) }}
            items={[
              !entry.archived && { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => onDuplicate(entry) },
              archiveEntry({ archived: entry.archived, type: 'Mouvement', label: entry.label }, setArchived, entry.id),
              rowMenuEntry(deleteEntries.movements([entry])),
            ]}
          />
        )}
        selectionLabel={(count) => selectedLabel(count, ['mouvement', 'mouvements'], false)}
        selectionActions={(rows, clear) => [archiveItemsAction(rows, setArchived, { noun: 'mouvement', clear }), deleteEntries.movements(rows, clear)]}
      />
    </Stack>
  );
}
