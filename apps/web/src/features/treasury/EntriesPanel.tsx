import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { SidePanel } from '../../components/panels/SidePanel';
import { Group, Paper, Stack, Switch, Table, Text } from '@mantine/core';
import { offsetLinkedMovements, type TableFilterGroup } from '@ordo/shared';
import { ArrowsLeftRightIcon, CopyIcon, FileCsvIcon, FilePdfIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { DataViewBar } from '../../components/data-table/DataViewBar';
import { EditableDate, EditableNumber, EditableText } from '../../components/data-table/EditableCells';
import { useEntryCellSave, type EntryValues } from './entry-values';
import { bulkSaver, type BulkChange } from '../../components/data-table/bulk-edit';
import { GroupHeaderRow, NoMatch } from '../../components/data-table/GroupHeaderRow';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { ROW_ACTIONS_WIDTH, RowActions } from '../../components/data-table/RowActions';
import { tableWidth, type DataColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import { AllRowsCheck, ROW_CHECK_WIDTH, RowCheck } from '../../components/data-table/RowCheck';
import { SelectionBar } from '../../components/data-table/SelectionBar';
import { deleteRowsAction } from '../../components/data-table/selection-actions';
import { selectedLabel } from '../../components/data-table/selection-label';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryEntries, useTreasuryMutations, type TreasuryAccount, type TreasuryEntry } from './api';
import { DetailsToggle, SettledCell } from './entry-cells';
import { useEntryEnv, type EntryEnv } from './entry-env';
import { entryFieldCells, entryFieldColumns } from './entry-columns';
import { EntryLinesTable } from './EntryLinesTable';
import { EntryUrl } from './EntryUrl';
import { StatementForm } from './StatementForm';
import { StatementImport } from './StatementImport';
import * as fmt from '../../lib/format';
import { useCommentCounts } from '../comments/api';
import { commentColumn } from '../comments/comment-column';
import { GroupFooter, TableFooter } from '../../components/data-table/TableFooter';

/**
 * Printed calendar date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Date.
 */
const printedDate = (date: string) => fmt.day(date);

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
 * Month of an entry, YYYY-MM.
 * @param {TreasuryEntry} entry Entry.
 * @returns {string} Month.
 */
const monthOf = (entry: TreasuryEntry) => String(entry.date).slice(0, 7);

/**
 * Columns of the entries: month (to group), execution date, label, amount, documents settled, then the columns every
 * table of entries shares.
 * @param {EntryEnv} env Names.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
function entryColumns(env: EntryEnv): DataColumn<TreasuryEntry>[] {
  return [
    {
      id: 'month',
      label: 'Mois',
      size: 150,
      hiddenByDefault: true,
      sortValue: monthOf,
      text: (entry) => fmt.capitalize(fmt.month(monthOf(entry))),
      filter: false,
      groupable: true,
    },
    {
      id: 'date',
      bulk: true,
      label: 'Date d’exécution',
      size: 130,
      sortValue: (entry) => String(entry.date),
      text: (entry) => printedDate(String(entry.date)),
      filter: { kind: 'date', value: (entry) => String(entry.date).slice(0, 10) },
    },
    { id: 'label', label: 'Libellé', size: 300, locked: true, bulk: true, sortValue: (entry) => entry.label, text: (entry) => entry.label },
    ...entryFieldColumns<TreasuryEntry>((entry) => entry, env, { payerName: (entry) => entry.payerName ?? '' }),
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
      label: 'Montant',
      size: 130,
      numeric: true,
      sortValue: (entry) => entry.amount,
      formatTotal: fmt.money,
      text: (entry) => `${entry.amount > 0 ? '+' : ''}${fmt.money(entry.amount)}`,
      filter: { kind: 'number', value: (entry) => entry.amount },
    },
  ];
}

/**
 * Filter of the entries executed within a period.
 * @param {string} period Period token.
 * @returns {TableFilterGroup} Filter.
 */
const executedWithin = (period: string): TableFilterGroup => ({
  type: 'group',
  id: 'root',
  combinator: 'and',
  children: [{ type: 'condition', id: 'date', field: 'date', operator: 'within', value: period }],
});

/** Views made the first time the entries are shown: this month (opened first), this year by month, all by month. */
const ENTRY_VIEWS: FirstTableView[] = [
  { name: 'Ce mois-ci', config: { filter: executedWithin('thisMonth') } },
  { name: 'Cette année', config: { filter: executedWithin('thisYear'), groupBy: 'month', sorting: [{ id: 'month', desc: true }] } },
  { name: 'Tous', config: { groupBy: 'month', sorting: [{ id: 'month', desc: true }] } },
];

/**
 * Actual movements in saved views (this month, this year by month, all by default), filtered, sorted, grouped and
 * exported as every table: execution and value dates, payer or payee, category, method, documents settled and linked
 * entries; money in and out of what is shown, linked ones offset.
 * @param {EntriesPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function EntriesPanel({ accounts, onEdit, onDuplicate }: EntriesPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  // Every entry: the views choose their period and account.
  const { data: entries, isPending } = useTreasuryEntries({ from: '1900-01-01', to: '2999-12-31', accountId: null });
  const { deleteEntry } = useTreasuryMutations();
  const saveEntry = useEntryCellSave();
  const env = useEntryEnv(accounts);
  const tableRef = useRef<HTMLTableElement>(null);
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
  const view = useDataView({ tableKey: 'treasury-entries', getKey: (entry) => entry.id, columns, rows: loaded, title: 'Mouvements', first: ENTRY_VIEWS });
  // Movements checked: every field edited at once, and the actions of the bar.
  const checks = view.rowSelection;
  const checked = checks ? view.rows.filter((entry) => checks.isChecked(entry.id)) : [];
  /**
   * Unchecks every movement.
   * @returns {void}
   */
  const clearChecks = () => checks?.check(checks.keys, false);
  const { shown } = view;
  // A change made on the bulk selection of a column saves each entry it fits (none: left as it is).
  const bulk = bulkSaver<TreasuryEntry, Partial<EntryValues>>(view, (entry, change) => Object.keys(change).length > 0 && saveEntry(entry, change));
  const actual = view.rows;
  const totals = periodTotals(actual);
  // Split entries whose lines are shown.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const split = actual.filter((entry) => entry.lines.length > 0);
  const allExpanded = split.length > 0 && split.every((entry) => expanded.has(entry.id));
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <Stack gap="sm">
      <DataViewBar
        view={view}
        searchLabel="Rechercher (libellé, tiers, documents)"
        displayOptions={
          split.length > 0 && (
            <Switch label="Répartitions dépliées" checked={allExpanded} onChange={(event) => setExpanded(event.currentTarget.checked ? new Set(split.map((entry) => entry.id)) : new Set())} />
          )
        }
        exports={
          <ActionButton priority="secondary" icon={<FilePdfIcon aria-hidden />} onClick={() => setExporting(true)}>
            Relevé de compte (PDF)
          </ActionButton>
        }
        tools={
          <>
            <ActionButton priority="secondary" icon={<FileCsvIcon aria-hidden />} onClick={() => setImporting(true)} disabled={!accounts.some((account) => !account.archived)}>
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
        }
      />
      {isPending || !view.config ? (
        <TableSkeleton rows={6} />
      ) : loaded.length === 0 ? (
        <EmptyState icon={<ArrowsLeftRightIcon aria-hidden />} message="Aucun mouvement pour le moment." />
      ) : actual.length === 0 ? (
        <NoMatch view={view} />
      ) : (
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          <Table
            ref={tableRef}
            verticalSpacing="xs"
            highlightOnHover
            className={tableClasses.table}
            style={{ width: tableWidth(shown, ROW_CHECK_WIDTH + ACTIONS_WIDTH), minWidth: '100%' }}
            data-checking={(checks && checks.keys.some((key) => checks.isChecked(key))) || undefined}
          >
            <DataTableHeader
              columns={columns}
              shown={shown}
              layout={view.layout}
              onLayoutChange={view.setLayout}
              sorting={view.sorting}
              onSortingChange={view.setSorting}
              tableRef={tableRef}
              leadingCount={1}
              leading={
                <Table.Th w={ROW_CHECK_WIDTH} px={4}>
                  {checks && <AllRowsCheck selection={checks} />}
                </Table.Th>
              }
              trailing={<Table.Th w={ACTIONS_WIDTH} />}
              columnExtras={view.columnExtras}
            />
            <Table.Tbody>
              {view.groups.flatMap((group) => {
                const groupTotals = periodTotals(group.rows);
                return [
                  ...(view.groupColumn
                    ? [
                        <GroupHeaderRow
                          key={`group:${group.key}`}
                          label={group.label}
                          count={group.rows.length}
                          summary={`+${fmt.money(groupTotals.incoming)} · −${fmt.money(groupTotals.outgoing)}`}
                          span={shown.length + 2}
                          collapsed={collapsedGroups.has(group.key)}
                          onToggle={() => toggleGroup(group.key)}
                        />,
                      ]
                    : []),
                  ...(collapsedGroups.has(group.key) ? [] : group.rows).map((entry) => {
                    const date = String(entry.date);
                    return (
                      <Fragment key={entry.id}>
                        <Table.Tr>
                          <Table.Td px={4}>{checks && <RowCheck selection={checks} rowKey={entry.id} label={entry.label ?? 'le mouvement'} />}</Table.Td>
                          {shown.map((column) => (
                            <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined} {...view.cellProps(column.id, entry.id)}>
                              {
                                {
                                  ...entryFieldCells(entry, env, (column) => (row, change) => bulk(column)(row as TreasuryEntry, change as BulkChange<TreasuryEntry, Partial<EntryValues>>)),
                                  date: <EditableDate value={date.slice(0, 10)} label={`Exécution de ${entry.label}`} onSave={(next) => next && bulk('date')(entry, { date: next })} />,
                                  label: (
                                    <Group gap={4} wrap="nowrap">
                                      <EditableText value={entry.label} label={`Libellé de ${entry.label}`} onSave={(label) => label && bulk('label')(entry, { label })} />
                                      <EntryUrl url={entry.url} label={entry.label} />
                                      {entry.lines.length > 0 && <DetailsToggle opened={expanded.has(entry.id)} count={entry.lines.length} label={entry.label} onToggle={() => toggle(entry.id)} />}
                                    </Group>
                                  ),
                                  settled: <SettledCell entry={entry} />,
                                  amount: (
                                    <Text span inherit c={entry.amount < 0 ? 'red' : 'green'}>
                                      <EditableNumber
                                        amount
                                        value={entry.amount}
                                        label={`Montant de ${entry.label}`}
                                        suffix="€"
                                        signed
                                        validate={(amount) => (amount === 0 ? 'Le montant ne peut pas être nul.' : null)}
                                        onSave={(amount) => amount !== null && bulk('amount')(entry, { direction: amount < 0 ? 'OUT' : 'IN', amount: Math.abs(amount) })}
                                      />
                                    </Text>
                                  ),
                                  comments: column.text?.(entry),
                                }[column.id]
                              }
                            </Table.Td>
                          ))}
                          <Table.Td>
                            <RowActions
                              name={entry.label}
                              primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => onEdit(entry) }}
                              items={[
                                { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => onDuplicate(entry) },
                                {
                                  label: 'Supprimer',
                                  icon: <TrashIcon aria-hidden />,
                                  danger: true,
                                  onClick: () =>
                                    confirmDestructive({
                                      title: 'Supprimer le mouvement',
                                      risks: [
                                        `« ${entry.label} » sera supprimé définitivement.`,
                                        entry.allocations.length ? 'Les documents qu’il règle redeviendront dus.' : '',
                                        entry.linkedEntries.length ? 'Ses liens avec d’autres mouvements seront retirés.' : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' '),
                                      onConfirm: () => deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Mouvement supprimé.'), onError: (error) => notifyError(error.message) }),
                                    }),
                                },
                              ]}
                            />
                          </Table.Td>
                        </Table.Tr>
                        {expanded.has(entry.id) && (
                          <Table.Tr className={tableClasses.details}>
                            <Table.Td colSpan={shown.length + 2} className={tableClasses.detailsCell}>
                              <EntryLinesTable entry={entry} env={env} save={saveEntry} />
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Fragment>
                    );
                  }),
                  ...(view.groupColumn && view.config?.footer && !collapsedGroups.has(group.key)
                    ? [<GroupFooter key={`footer:${group.key}`} shown={shown} rows={group.rows} totals={view.config.footer} label={group.label} before={1} after={1} />]
                    : []),
                ];
              })}
            </Table.Tbody>
            {view.config?.footer && (
              <TableFooter shown={view.shown} rows={actual} totals={view.config.footer} onChange={(totals) => view.change((current) => ({ ...current, footer: totals }))} before={1} after={1} />
            )}
          </Table>
        </Paper>
      )}
      {checked.length > 0 && (
        <SelectionBar
          label={selectedLabel(checked.length, ['mouvement', 'mouvements'], false)}
          onClear={clearChecks}
          actions={[
            deleteRowsAction(checked, {
              title: 'Supprimer les mouvements',
              risks: `${checked.length} mouvement(s) seront supprimés définitivement ; les documents qu’ils règlent redeviendront dus.`,
              remove: (entry) => deleteEntry.mutateAsync(entry.id),
              done: `${checked.length} mouvement(s) supprimé(s).`,
              clear: clearChecks,
            }),
          ]}
        />
      )}
      <SidePanel opened={importing} onClose={() => setImporting(false)} title="Importer un relevé bancaire" size="lg">
        {importing && <StatementImport accounts={accounts} onDone={() => setImporting(false)} />}
      </SidePanel>
      <SidePanel opened={exporting} onClose={() => setExporting(false)} title="Exporter le relevé des mouvements">
        {exporting && <StatementForm accounts={accounts} accountId={null} onDone={() => setExporting(false)} />}
      </SidePanel>
    </Stack>
  );
}
