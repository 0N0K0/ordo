import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { SidePanel } from '../../components/panels/SidePanel';
import { ActionIcon, Badge, Group, Paper, Stack, Switch, Table, Text, Tooltip } from '@mantine/core';
import { EVERYDAY_CONTEXT, formatMoney, offsetLinkedMovements, splitAmounts, type TableFilterGroup } from '@ordo/shared';
import {
  ArrowsLeftRightIcon,
  CaretDownIcon,
  CaretRightIcon,
  CopyIcon,
  FileCsvIcon,
  FilePdfIcon,
  HandCoinsIcon,
  LinkIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Fragment, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { DataViewBar } from '../../components/data-table/DataViewBar';
import { EditableDate, EditableNumber, EditableSelect, EditableText } from '../../components/data-table/EditableCells';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { useEntryCellSave } from './entry-values';
import { GroupHeaderRow, NoMatch } from '../../components/data-table/GroupHeaderRow';
import { useDataView, type FirstTableView } from '../../components/data-table/use-data-view';
import { ROW_ACTIONS_WIDTH, RowActions } from '../../components/data-table/RowActions';
import { tableWidth, type DataColumn, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryEntries, useTreasuryMutations, useTreasurySettings, type TreasuryAccount, type TreasuryEntry } from './api';
import { categoryOptions, categoryPaths } from './categories';
import { EntryUrl } from './EntryUrl';
import { StatementForm } from './StatementForm';
import { StatementImport } from './StatementImport';
import { handleFileClick } from '../files/open-file';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
 * Columns of the entries.
 * @param {Map<string, string>} paths Full names of the categories.
 * @param {TreasuryAccount[]} accounts Accounts.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
function entryColumns(paths: Map<string, string>, accounts: TreasuryAccount[]): DataColumn<TreasuryEntry>[] {
  const categoryOf = (entry: TreasuryEntry) => (entry.categoryId ? (paths.get(entry.categoryId) ?? '') : '');
  return [
    {
      id: 'month',
      label: 'Mois',
      size: 150,
      hiddenByDefault: true,
      sortValue: monthOf,
      text: (entry) => monthFormat.format(new Date(`${monthOf(entry)}-01T00:00:00Z`)).replace(/^./, (letter) => letter.toUpperCase()),
      filter: false,
      groupable: true,
    },
    {
      id: 'date',
      label: 'Exécution',
      size: 120,
      sortValue: (entry) => String(entry.date),
      text: (entry) => printedDate(String(entry.date)),
      filter: { kind: 'date', value: (entry) => String(entry.date).slice(0, 10) },
    },
    { id: 'label', label: 'Libellé', size: 300, locked: true, sortValue: (entry) => entry.label, text: (entry) => entry.label },
    { id: 'payer', label: 'Émetteur / destinataire', size: 200, sortValue: (entry) => entry.payerName ?? null, text: (entry) => entry.payerName ?? '', groupable: true },
    {
      id: 'account',
      label: 'Compte',
      size: 150,
      sortValue: (entry) => entry.accountName,
      text: (entry) => entry.accountName,
      filter: { kind: 'choice', value: (entry) => entry.accountId, options: accounts.map((account) => ({ value: account.id, label: account.name })) },
      groupable: true,
    },
    { id: 'category', label: 'Catégorie', size: 180, hiddenByDefault: true, sortValue: (entry) => categoryOf(entry) || null, text: categoryOf, groupable: true },
    { id: 'method', label: 'Moyen de paiement', size: 150, hiddenByDefault: true, sortValue: (entry) => entry.methodName ?? null, text: (entry) => entry.methodName ?? '', groupable: true },
    {
      id: 'direction',
      label: 'Sens',
      size: 100,
      hiddenByDefault: true,
      sortValue: (entry) => (entry.amount < 0 ? 1 : 0),
      text: (entry) => (entry.amount < 0 ? 'Sortie' : 'Entrée'),
      filter: {
        kind: 'choice',
        value: (entry) => (entry.amount < 0 ? 'OUT' : 'IN'),
        options: [
          { value: 'IN', label: 'Entrée' },
          { value: 'OUT', label: 'Sortie' },
        ],
      },
      groupable: true,
    },
    {
      id: 'documents',
      label: 'Documents, pièces et liens',
      size: 280,
      text: (entry) =>
        [...entry.allocations.map((allocation) => allocation.documentLabel), ...entry.documents.map((document) => document.title), ...entry.linkedEntries.map((linked) => linked.label)].join(', '),
    },
    { id: 'amount', label: 'Montant', size: 130, numeric: true, sortValue: (entry) => entry.amount, text: (entry) => `${entry.amount > 0 ? '+' : ''}${money(entry.amount)}` },
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
  const { data: settings } = useTreasurySettings();
  const { deleteEntry } = useTreasuryMutations();
  const saveEntry = useEntryCellSave();
  const paths = useMemo(() => categoryPaths(settings?.treasuryCategories ?? []), [settings]);
  const tableRef = useRef<HTMLTableElement>(null);
  const columns = useMemo(() => entryColumns(paths, accounts), [paths, accounts]);
  const loaded = useMemo(() => (entries ?? []).filter((entry) => entry.status === 'ACTUAL'), [entries]);
  const view = useDataView({ tableKey: 'treasury-entries', columns, rows: loaded, title: 'Mouvements', first: ENTRY_VIEWS });
  const { shown } = view;
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
  const nameOf = useMemo(
    () =>
      new Map([
        ...(settings?.treasuryMembers ?? []).map((member) => [`m:${member.id}`, member.isMe ? `${member.name} (moi)` : member.name] as const),
        ...(settings?.treasuryRelations ?? []).map((relation) => [`r:${relation.id}`, relation.name] as const),
        ...(settings?.treasuryContexts ?? []).map((context) => [`c:${context.id}`, context.name] as const),
      ]),
    [settings],
  );

  return (
    <Stack gap="sm">
      <DataViewBar
        view={view}
        searchLabel="Rechercher (libellé, tiers, documents)"
        displayOptions={
          split.length > 0 && (
            <Switch label="Répartitions développées" checked={allExpanded} onChange={(event) => setExpanded(event.currentTarget.checked ? new Set(split.map((entry) => entry.id)) : new Set())} />
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
                  Entrées {money(totals.incoming)} · Sorties {money(totals.outgoing)}
                </Text>
                {totals.offset > 0 && (
                  <Text size="xs" c="dimmed">
                    {money(totals.offset)} compensés par des mouvements liés
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
          <Table ref={tableRef} verticalSpacing="xs" highlightOnHover className={tableClasses.table} style={{ width: tableWidth(shown, ACTIONS_WIDTH), minWidth: '100%' }}>
            <DataTableHeader
              columns={columns}
              shown={shown}
              layout={view.layout}
              onLayoutChange={view.setLayout}
              sorting={view.sorting}
              onSortingChange={view.setSorting}
              tableRef={tableRef}
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
                          summary={`+${money(groupTotals.incoming)} · −${money(groupTotals.outgoing)}`}
                          span={shown.length + 1}
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
                          {shown.map((column) => (
                            <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined}>
                              {
                                {
                                  date: (
                                    <>
                                      <EditableDate value={date.slice(0, 10)} label={`Exécution de ${entry.label}`} onSave={(next) => next && saveEntry(entry, { date: next })} />
                                      {entry.valueDate && String(entry.valueDate) !== date && (
                                        <Text size="xs" c="dimmed">
                                          Valeur {printedDate(String(entry.valueDate))}
                                        </Text>
                                      )}
                                    </>
                                  ),
                                  label: (
                                    <Group gap={4} wrap="nowrap" align="flex-start">
                                      {entry.lines.length > 0 && (
                                        <ActionIcon
                                          variant="subtle"
                                          color="gray"
                                          size="sm"
                                          aria-label={expanded.has(entry.id) ? `Réduire la répartition de ${entry.label}` : `Développer la répartition de ${entry.label}`}
                                          aria-expanded={expanded.has(entry.id)}
                                          onClick={() => toggle(entry.id)}
                                        >
                                          {expanded.has(entry.id) ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
                                        </ActionIcon>
                                      )}
                                      <div>
                                        <Group gap={4} wrap="nowrap">
                                          <EditableText value={entry.label} label={`Libellé de ${entry.label}`} onSave={(label) => label && saveEntry(entry, { label })} />
                                          <EntryUrl url={entry.url} label={entry.label} />
                                        </Group>
                                        <Text size="xs" c="dimmed">
                                          {[
                                            entry.categoryId ? paths.get(entry.categoryId) : null,
                                            entry.methodName,
                                            entry.lines.length ? `réparti en ${entry.lines.length} ligne${entry.lines.length > 1 ? 's' : ''}` : null,
                                          ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </Text>
                                      </div>
                                    </Group>
                                  ),
                                  payer: <Text size="sm">{entry.payerName ?? ''}</Text>,
                                  account: (
                                    <EditableSelect
                                      value={entry.accountId}
                                      label={`Compte de ${entry.label}`}
                                      data={accounts.filter((account) => !account.archived || account.id === entry.accountId).map((account) => ({ value: account.id, label: account.name }))}
                                      onSave={(accountId) => accountId && saveEntry(entry, { accountId })}
                                    />
                                  ),
                                  category:
                                    entry.lines.length > 0 ? (
                                      <Text size="xs" c="dimmed">
                                        Sur les lignes
                                      </Text>
                                    ) : (
                                      <EditableSelect
                                        value={entry.categoryId ?? null}
                                        label={`Catégorie de ${entry.label}`}
                                        nullable
                                        {...treeSelectProps(categoryOptions(settings?.treasuryCategories ?? [], entry.amount < 0 ? 'OUT' : 'IN'))}
                                        onSave={(categoryId) => saveEntry(entry, { categoryId })}
                                      />
                                    ),
                                  method: (
                                    <EditableSelect
                                      value={entry.methodId ?? null}
                                      label={`Moyen de paiement de ${entry.label}`}
                                      nullable
                                      data={(settings?.treasuryPaymentMethods ?? [])
                                        .filter((method) => (entry.amount < 0 ? method.outgoing : method.incoming) || method.id === entry.methodId)
                                        .map((method) => ({ value: method.id, label: method.name }))}
                                      onSave={(methodId) => saveEntry(entry, { methodId })}
                                    />
                                  ),
                                  documents: (
                                    <Group gap={4}>
                                      {entry.allocations.map((allocation) =>
                                        allocation.documentId ? (
                                          <Badge
                                            key={allocation.id}
                                            size="sm"
                                            variant="light"
                                            leftSection={<ReceiptIcon aria-hidden />}
                                            component={Link}
                                            to={`/accounting/${allocation.documentId}`}
                                            style={{ cursor: 'pointer' }}
                                          >
                                            {allocation.documentLabel} · {money(allocation.amount)}
                                          </Badge>
                                        ) : (
                                          <Badge key={allocation.id} size="sm" variant="light" color="cyan" leftSection={<ReceiptIcon aria-hidden />}>
                                            {allocation.documentLabel} · {money(allocation.amount)}
                                          </Badge>
                                        ),
                                      )}
                                      {entry.documents.map((document) => (
                                        <Tooltip key={`${document.source}-${document.id}`} label={document.source === 'LIBRARY' ? `Bibliothèque · ${document.place}` : `Projet ${document.place}`}>
                                          <Badge
                                            size="sm"
                                            variant="light"
                                            color="gray"
                                            leftSection={<PaperclipIcon aria-hidden />}
                                            component="a"
                                            href={document.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            // A file of the app (PDF, image) opens in its viewer.
                                            onClick={(event: React.MouseEvent) => document.kind === 'FILE' && handleFileClick(event, { url: document.url, name: document.title })}
                                            style={{ cursor: 'pointer' }}
                                            tt="none"
                                          >
                                            {document.title.length > 24 ? `${document.title.slice(0, 23)}…` : document.title}
                                          </Badge>
                                        </Tooltip>
                                      ))}
                                      {entry.linkedEntries.map((linked) => (
                                        <Tooltip key={linked.id} label={`${printedDate(String(linked.date))} · ${linked.label}`}>
                                          <Badge size="sm" variant="outline" color={linked.amount < 0 ? 'red' : 'green'} leftSection={<LinkIcon aria-hidden />} tt="none">
                                            {linked.label.length > 24 ? `${linked.label.slice(0, 23)}…` : linked.label} · {money(linked.amount)}
                                          </Badge>
                                        </Tooltip>
                                      ))}
                                    </Group>
                                  ),
                                  amount: (
                                    <Text span inherit c={entry.amount < 0 ? 'red' : 'green'}>
                                      <EditableNumber
                                        value={entry.amount}
                                        label={`Montant de ${entry.label}`}
                                        suffix="€"
                                        signed
                                        validate={(amount) => (amount === 0 ? 'Le montant ne peut pas être nul.' : null)}
                                        onSave={(amount) => amount !== null && saveEntry(entry, { direction: amount < 0 ? 'OUT' : 'IN', amount: Math.abs(amount) })}
                                      />
                                    </Text>
                                  ),
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
                        {expanded.has(entry.id) && <SplitRows entry={entry} paths={paths} nameOf={nameOf} shown={shown} />}
                      </Fragment>
                    );
                  }),
                ];
              })}
            </Table.Tbody>
          </Table>
        </Paper>
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

/**
 * Lines of a split entry under it (and what they leave), muted: for whom, category, context, loan, own day,
 * project, documents and links.
 * @param {{ entry: TreasuryEntry, paths: Map<string, string>, nameOf: Map<string, string>, shown: ShownColumn<TreasuryEntry>[] }} props Entry, category paths, names of members ("m:"), relations ("r:") and contexts ("c:"), columns shown.
 * @returns {JSX.Element} Rows.
 */
function SplitRows({ entry, paths, nameOf, shown }: { entry: TreasuryEntry; paths: Map<string, string>; nameOf: Map<string, string>; shown: ShownColumn<TreasuryEntry>[] }) {
  const { amounts, remainder } = splitAmounts(entry.amount, entry.lines);
  const rows = [
    ...entry.lines.map((line, index) => ({
      key: line.id,
      label: line.label ?? 'Ligne',
      details: [
        line.relationId ? `pour ${nameOf.get(`r:${line.relationId}`) ?? 'une relation'}` : line.memberId ? `pour ${nameOf.get(`m:${line.memberId}`) ?? ''}` : '',
        line.categoryId ? paths.get(line.categoryId) : '',
        line.contextId ? nameOf.get(`c:${line.contextId}`) : EVERYDAY_CONTEXT,
        line.date ? `le ${printedDate(String(line.date))}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      loan: line.loan,
      attachments: (line.projectId ? 1 : 0) + line.documents.length + line.linkedLines.length + line.linkedEntries.length,
      amount: amounts[index] / 100,
    })),
    ...(remainder ? [{ key: 'rest', label: 'Non réparti', details: '', loan: false, attachments: 0, amount: remainder / 100 }] : []),
  ];
  return (
    <>
      {rows.map((row) => (
        <Table.Tr key={row.key} bg="var(--mantine-color-default-hover)">
          {shown.map((column) => (
            <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined} pl={column.id === 'label' ? 'xl' : undefined}>
              {column.id === 'label' ? (
                <>
                  <Group gap={6} wrap="nowrap">
                    <Text size="xs">↳ {row.label}</Text>
                    {row.loan && (
                      <Badge size="xs" variant="light" color="grape" leftSection={<HandCoinsIcon aria-hidden />}>
                        Prêt
                      </Badge>
                    )}
                  </Group>
                  {row.details && (
                    <Text size="xs" c="dimmed">
                      {row.details}
                    </Text>
                  )}
                </>
              ) : column.id === 'documents' ? (
                row.attachments > 0 && (
                  <Badge size="xs" variant="light" color="gray" leftSection={<PaperclipIcon aria-hidden />}>
                    {row.attachments}
                  </Badge>
                )
              ) : column.id === 'amount' ? (
                <Text span ff="monospace" fz="xs" c={row.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
                  {row.amount > 0 ? '+' : ''}
                  {money(row.amount)}
                </Text>
              ) : null}
            </Table.Td>
          ))}
          <Table.Td />
        </Table.Tr>
      ))}
    </>
  );
}
