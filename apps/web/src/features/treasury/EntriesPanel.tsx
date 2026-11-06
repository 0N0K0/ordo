import { ActionIcon, Badge, Button, Group, Modal, Paper, SegmentedControl, Select, Skeleton, Stack, Table, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { addDays, formatMoney, offsetLinkedMovements } from '@ordo/shared';
import { ArrowsLeftRightIcon, FilePdfIcon, LinkIcon, PaperclipIcon, PencilSimpleIcon, ReceiptIcon, TrashIcon } from '@phosphor-icons/react';
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTreasuryEntries, useTreasuryMutations, useTreasurySettings, type TreasuryAccount, type TreasuryEntry } from './api';
import { categoryPaths } from './categories';
import { confirmDeletion } from './confirm-deletion';
import { StatementForm } from './StatementForm';

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
}

/**
 * Actual movements of a month or a calendar year (by month), of all accounts or one: execution and value
 * dates, payer or payee, category, method, documents settled and linked entries; money in and out of the
 * period, linked ones offset.
 * @param {EntriesPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function EntriesPanel({ accounts, onEdit }: EntriesPanelProps) {
  const today = localToday();
  const [scale, setScale] = useState<'month' | 'year'>('month');
  const [month, setMonth] = useState<string>(`${today.slice(0, 7)}-01`);
  const [year, setYear] = useState<string>(`${today.slice(0, 4)}-01-01`);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const from = scale === 'month' ? month : year;
  const to = scale === 'month' ? addDays(`${addDays(month, 31).slice(0, 7)}-01`, -1) : `${year.slice(0, 4)}-12-31`;
  const { data: entries, isPending } = useTreasuryEntries({ from, to, accountId });
  const { data: settings } = useTreasurySettings();
  const { deleteEntry } = useTreasuryMutations();
  const paths = useMemo(() => categoryPaths(settings?.treasuryCategories ?? []), [settings]);
  const actual = (entries ?? []).filter((entry) => entry.status === 'ACTUAL');
  const totals = periodTotals(actual);

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
          <Table verticalSpacing="xs" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Exécution</Table.Th>
                <Table.Th>Libellé</Table.Th>
                <Table.Th>Émetteur / destinataire</Table.Th>
                <Table.Th>Compte</Table.Th>
                <Table.Th>Documents, pièces et liens</Table.Th>
                <Table.Th ta="right">Montant</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
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
                        <Table.Td colSpan={5}>
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
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="sm">{printedDate(date)}</Text>
                        {entry.valueDate && String(entry.valueDate) !== date && (
                          <Text size="xs" c="dimmed">
                            Valeur {printedDate(String(entry.valueDate))}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{entry.label}</Text>
                        <Text size="xs" c="dimmed">
                          {[entry.categoryId ? paths.get(entry.categoryId) : null, entry.methodName].filter(Boolean).join(' · ')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{entry.payerName ?? ''}</Text>
                      </Table.Td>
                      <Table.Td>{entry.accountName}</Table.Td>
                      <Table.Td>
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
                      </Table.Td>
                      <Table.Td ta="right" ff="monospace" c={entry.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
                        {entry.amount > 0 ? '+' : ''}
                        {money(entry.amount)}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={2} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Modifier">
                            <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${entry.label}`} onClick={() => onEdit(entry)}>
                              <PencilSimpleIcon aria-hidden />
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
                  </Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <Modal opened={exporting} onClose={() => setExporting(false)} title="Exporter le relevé des mouvements">
        {exporting && <StatementForm accounts={accounts} accountId={accountId} onDone={() => setExporting(false)} />}
      </Modal>
    </Stack>
  );
}
