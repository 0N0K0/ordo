import { ActionIcon, Badge, Button, Group, Modal, Paper, SegmentedControl, Select, Skeleton, Stack, Table, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { addDays, EVERYDAY_CONTEXT, formatMoney, offsetLinkedMovements, splitAmounts } from '@ordo/shared';
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
import { ColumnsMenu } from '../../components/data-table/ColumnsMenu';
import { shownColumns, sortRows, tableWidth, type DataColumn, type ShownColumn } from '../../components/data-table/data-table';
import { DataTableHeader } from '../../components/data-table/DataTableHeader';
import tableClasses from '../../components/data-table/DataTable.module.css';
import { useTableLayout } from '../../components/data-table/use-table-layout';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryEntries, useTreasuryMutations, useTreasurySettings, type TreasuryAccount, type TreasuryEntry } from './api';
import { categoryPaths } from './categories';
import { confirmDeletion } from './confirm-deletion';
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
const ACTIONS_WIDTH = 120;

/**
 * Columns of the entries.
 * @param {Map<string, string>} paths Full names of the categories.
 * @returns {DataColumn<TreasuryEntry>[]} Columns.
 */
function entryColumns(paths: Map<string, string>): DataColumn<TreasuryEntry>[] {
  return [
    { id: 'date', label: 'Exécution', size: 120, sortValue: (entry) => String(entry.date) },
    { id: 'label', label: 'Libellé', size: 300, locked: true, sortValue: (entry) => entry.label },
    { id: 'payer', label: 'Émetteur / destinataire', size: 200, sortValue: (entry) => entry.payerName ?? null },
    { id: 'account', label: 'Compte', size: 150, sortValue: (entry) => entry.accountName },
    { id: 'category', label: 'Catégorie', size: 180, hiddenByDefault: true, sortValue: (entry) => (entry.categoryId ? (paths.get(entry.categoryId) ?? null) : null) },
    { id: 'method', label: 'Moyen de paiement', size: 150, hiddenByDefault: true, sortValue: (entry) => entry.methodName ?? null },
    { id: 'documents', label: 'Documents, pièces et liens', size: 280 },
    { id: 'amount', label: 'Montant', size: 130, numeric: true, sortValue: (entry) => entry.amount },
  ];
}

/**
 * Actual movements of a month or a calendar year (by month), of all accounts or one: execution and value
 * dates, payer or payee, category, method, documents settled and linked entries; money in and out of the
 * period, linked ones offset.
 * @param {EntriesPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function EntriesPanel({ accounts, onEdit, onDuplicate }: EntriesPanelProps) {
  const today = localToday();
  const [scale, setScale] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState<string>(`${today.slice(0, 7)}-01`);
  const [year, setYear] = useState<string>(`${today.slice(0, 4)}-01-01`);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const from = scale === 'month' ? month : year;
  const to = scale === 'month' ? addDays(`${addDays(month, 31).slice(0, 7)}-01`, -1) : `${year.slice(0, 4)}-12-31`;
  const { data: entries, isPending } = useTreasuryEntries({ from, to, accountId });
  const { data: settings } = useTreasurySettings();
  const { deleteEntry } = useTreasuryMutations();
  const paths = useMemo(() => categoryPaths(settings?.treasuryCategories ?? []), [settings]);
  const { layout, setLayout, sorting, setSorting } = useTableLayout('treasury-entries');
  const tableRef = useRef<HTMLTableElement>(null);
  const columns = useMemo(() => entryColumns(paths), [paths]);
  const shown = shownColumns(columns, layout);
  const loaded = (entries ?? []).filter((entry) => entry.status === 'ACTUAL');
  // Sorted within each month (the months stay latest first).
  const months = [...new Set(loaded.map((entry) => String(entry.date).slice(0, 7)))];
  const actual = months.flatMap((key) =>
    sortRows(
      loaded.filter((entry) => String(entry.date).slice(0, 7) === key),
      sorting,
      columns,
    ),
  );
  const totals = periodTotals(actual);
  // Split entries whose lines are shown.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const split = actual.filter((entry) => entry.lines.length > 0);
  const allExpanded = split.length > 0 && split.every((entry) => expanded.has(entry.id));
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
      <Group gap="sm">
        <SegmentedControl
          aria-label="Période"
          data={[
            { value: 'month', label: 'Mois' },
            { value: 'year', label: 'Année' },
          ]}
          value={scale}
          onChange={(value) => setScale(value as 'month' | 'year')}
        />
        {scale === 'month' ? (
          <MonthPickerInput aria-label="Mois" valueFormat="MMMM YYYY" value={month} onChange={(value) => value && setMonth(value)} w={180} />
        ) : (
          <YearPickerInput aria-label="Année" valueFormat="YYYY" value={year} onChange={(value) => value && setYear(value)} w={120} />
        )}
        <Select
          aria-label="Compte"
          placeholder="Tous les comptes"
          clearable
          data={accounts.map((account) => ({ value: account.id, label: account.name }))}
          value={accountId}
          onChange={setAccountId}
          w={220}
        />
        <Button variant="default" leftSection={<FilePdfIcon aria-hidden />} onClick={() => setExporting(true)}>
          Exporter en PDF
        </Button>
        <Button variant="default" leftSection={<FileCsvIcon aria-hidden />} onClick={() => setImporting(true)} disabled={!accounts.some((account) => !account.archived)}>
          Importer un relevé
        </Button>
        {split.length > 0 && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={allExpanded ? <CaretDownIcon aria-hidden /> : <CaretRightIcon aria-hidden />}
            onClick={() => setExpanded(allExpanded ? new Set() : new Set(split.map((entry) => entry.id)))}
          >
            {allExpanded ? 'Réduire les répartitions' : 'Développer les répartitions'}
          </Button>
        )}
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
      </Group>
      {isPending ? (
        <Skeleton height={240} />
      ) : actual.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ArrowsLeftRightIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun mouvement {scale === 'month' ? 'ce mois-ci' : 'cette année'}.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder radius="md" style={{ overflowX: 'auto' }}>
          <Table ref={tableRef} verticalSpacing="xs" highlightOnHover className={tableClasses.table} style={{ width: tableWidth(shown, ACTIONS_WIDTH), minWidth: '100%' }}>
            <DataTableHeader
              columns={columns}
              shown={shown}
              layout={layout}
              onLayoutChange={setLayout}
              sorting={sorting}
              onSortingChange={setSorting}
              tableRef={tableRef}
              trailing={
                <Table.Th w={ACTIONS_WIDTH}>
                  <ColumnsMenu columns={columns} layout={layout} onLayoutChange={setLayout} />
                </Table.Th>
              }
            />
            <Table.Tbody>
              {actual.map((entry, index) => {
                const date = String(entry.date);
                // Over a year, the entries are grouped by month (latest first).
                const newMonth = scale === 'year' && (index === 0 || String(actual[index - 1].date).slice(0, 7) !== date.slice(0, 7));
                const monthEntries = newMonth ? actual.filter((other) => String(other.date).slice(0, 7) === date.slice(0, 7)) : [];
                const monthTotals = newMonth ? periodTotals(monthEntries) : null;
                return (
                  <Fragment key={entry.id}>
                    {monthTotals && (
                      <Table.Tr bg="var(--mantine-color-default-hover)">
                        <Table.Td colSpan={Math.max(1, shown.length - 1)}>
                          <Text size="sm" fw={600} tt="capitalize">
                            {monthFormat.format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`))}
                          </Text>
                        </Table.Td>
                        <Table.Td colSpan={2} ta="right">
                          <Text size="xs" c="dimmed" ff="monospace">
                            +{money(monthTotals.incoming)} · −{money(monthTotals.outgoing)}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    <Table.Tr>
                      {shown.map((column) => (
                        <Table.Td key={column.id} className={tableClasses.cell} data-numeric={column.numeric || undefined}>
                          {
                            {
                              date: (
                                <>
                                  <Text size="sm">{printedDate(date)}</Text>
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
                                      <Text size="sm">{entry.label}</Text>
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
                              account: entry.accountName,
                              category: entry.categoryId ? paths.get(entry.categoryId) : null,
                              method: entry.methodName,
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
                                <Text span size="sm" ff="monospace" c={entry.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
                                  {entry.amount > 0 ? '+' : ''}
                                  {money(entry.amount)}
                                </Text>
                              ),
                            }[column.id]
                          }
                        </Table.Td>
                      ))}
                      <Table.Td>
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Modifier">
                            <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${entry.label}`} onClick={() => onEdit(entry)}>
                              <PencilSimpleIcon aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Dupliquer">
                            <ActionIcon variant="subtle" color="gray" aria-label={`Dupliquer ${entry.label}`} onClick={() => onDuplicate(entry)}>
                              <CopyIcon aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Supprimer">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Supprimer ${entry.label}`}
                              onClick={() =>
                                confirmDeletion(
                                  'Supprimer le mouvement',
                                  [
                                    `« ${entry.label} » sera supprimé définitivement.`,
                                    entry.allocations.length ? 'Les documents qu’il règle redeviendront dus.' : '',
                                    entry.linkedEntries.length ? 'Ses liens avec d’autres mouvements seront retirés.' : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' '),
                                  () => deleteEntry.mutate(entry.id, { onSuccess: () => notifySuccess('Mouvement supprimé.'), onError: (error) => notifyError(error.message) }),
                                )
                              }
                            >
                              <TrashIcon aria-hidden />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    {expanded.has(entry.id) && <SplitRows entry={entry} paths={paths} nameOf={nameOf} shown={shown} />}
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <Modal opened={importing} onClose={() => setImporting(false)} title="Importer un relevé bancaire" size="xl">
        {importing && <StatementImport accounts={accounts} onDone={() => setImporting(false)} />}
      </Modal>
      <Modal opened={exporting} onClose={() => setExporting(false)} title="Exporter le relevé des mouvements">
        {exporting && <StatementForm accounts={accounts} accountId={accountId} onDone={() => setExporting(false)} />}
      </Modal>
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
