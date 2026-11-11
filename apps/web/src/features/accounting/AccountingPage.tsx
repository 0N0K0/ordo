import { ActionIcon, Badge, Button, Group, Menu, Paper, Select, Skeleton, Stack, Table, Tabs, Text, Title, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { formatMoney, recurrenceSchema } from '@ordo/shared';
import {
  ArrowsClockwiseIcon,
  BellRingingIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  FileArrowUpIcon,
  FileZipIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Link, useSearchParams } from 'react-router';
import { describeRecurrence } from '../../components/recurrence/describe-recurrence';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { CatalogPanel } from './CatalogPanel';
import { OverdueInvoicesPanel } from './OverdueInvoicesPanel';
import { useOverdueInvoices } from './tracking-api';
import { useAccountingDocuments, useImportedDocuments, useRecurringInvoices, useRecurringMutations, type RecurringInvoice } from './documents-api';
import { openImportForm } from './imported-form';
import { DocumentsTable } from './DocumentsTable';
import { DOCUMENT_TYPE_LABELS, EMPTY_DOCUMENTS } from './labels';
import { openNewDocument } from './new-document';
import { DocumentsZipForm } from './DocumentsZipForm';
import { CompanySettings } from './CompanySettings';
import { openRecurringForm } from './recurring-form';
import { DocumentStatusSettings } from './DocumentStatusSettings';
import { PageTitle } from '../../components/PageTitle';
import { PageSettings } from '../../layouts/PageSettings';
import { SETTINGS_PARAM } from '../../layouts/page-settings';
import { useEffect } from 'react';

/** Tabs of the settings sidebar. */
type SettingsTab = 'zip' | 'statuses' | 'company';

const TABS = [
  { value: 'QUOTE', label: 'Devis' },
  { value: 'INVOICE', label: 'Factures' },
  { value: 'DEPOSIT_INVOICE', label: 'Acomptes' },
  { value: 'CREDIT_NOTE', label: 'Avoirs' },
] as const;

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Recurring invoices: schedule, next issue, model; edit or delete.
 * @returns {JSX.Element} List.
 */
function RecurringList() {
  const { data: recurring, isPending } = useRecurringInvoices();
  const { remove } = useRecurringMutations();
  if (isPending) return <Skeleton height={120} />;
  if (!recurring?.length) {
    return (
      <Text size="sm" c="dimmed">
        Aucune facture récurrente. Ouvrez une facture et choisissez « Rendre récurrente ».
      </Text>
    );
  }

  /**
   * Asks for confirmation before deleting a schedule.
   * @param {RecurringInvoice} item Schedule.
   * @returns {void}
   */
  const confirmDelete = (item: RecurringInvoice) => {
    const modalId = `delete-recurring-${item.id}`;
    modals.open({
      modalId,
      title: 'Supprimer la facture récurrente',
      children: (
        <Stack gap="md">
          <Text size="sm">« {item.name} » et son modèle seront supprimés définitivement ; les factures déjà émises sont conservées.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(item.id, { onSuccess: () => notifySuccess('Facture récurrente supprimée.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Paper withBorder radius="md">
      <Table verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nom</Table.Th>
            <Table.Th>Client</Table.Th>
            <Table.Th>Répétition</Table.Th>
            <Table.Th>Prochaine</Table.Th>
            <Table.Th ta="right">Montant</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {recurring.map((item) => {
            const rule = recurrenceSchema.safeParse(item.recurrence);
            return (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>
                      {item.name}
                    </Text>
                    {!item.active && (
                      <Badge size="xs" color="gray" variant="light">
                        En pause
                      </Badge>
                    )}
                    {item.autoFinalize && (
                      <Badge size="xs" color="green" variant="light">
                        Validée automatiquement
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {item.issuedCount} facture{item.issuedCount > 1 ? 's' : ''} émise{item.issuedCount > 1 ? 's' : ''}
                  </Text>
                </Table.Td>
                <Table.Td>{item.template.clientName}</Table.Td>
                <Table.Td>
                  <Text size="sm">{rule.success ? describeRecurrence(rule.data, String(item.startDate)) : '—'}</Text>
                </Table.Td>
                <Table.Td>{item.nextDate ? dateFormat.format(new Date(`${item.nextDate}T00:00:00Z`)) : 'Terminée'}</Table.Td>
                <Table.Td ta="right" ff="monospace">
                  {formatMoney(Math.round(item.template.totalGross * 100), item.template.currency)}
                </Table.Td>
                <Table.Td>
                  <Group gap={2} justify="flex-end" wrap="nowrap">
                    <Button size="compact-xs" variant="subtle" component={Link} to={`/accounting/${item.templateId}`}>
                      Modèle
                    </Button>
                    <Tooltip label="Planification">
                      <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${item.name}`} onClick={() => openRecurringForm({ recurring: item })}>
                        <PencilSimpleIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Supprimer">
                      <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${item.name}`} onClick={() => confirmDelete(item)}>
                        <TrashIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

/**
 * Accounting: quotes, invoices, deposit invoices and credit notes (imported ones listed with their type), the
 * documents to send (or deposit),
 * invoices to follow up, recurring invoices, catalogue; the tracking statuses of the documents in the settings sidebar.
 * @returns {JSX.Element} Page.
 */
export function AccountingPage() {
  const [params, setParams] = useSearchParams();
  // Imported documents are now listed with their type.
  const tab = params.get('tab') && params.get('tab') !== 'imported' ? params.get('tab')! : 'QUOTE';
  // The old tab of the tracking statuses: its settings, in the sidebar.
  useEffect(() => {
    if (params.get('tab') !== 'tracking') return;
    const next = new URLSearchParams(params);
    next.delete('tab');
    next.set(SETTINGS_PARAM, '1');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const { data: documents, isPending } = useAccountingDocuments();
  const imported = useImportedDocuments();
  const overdue = useOverdueInvoices(localToday());
  // Calendar year of the documents of every type (their date), kept in the address; none: the current one.
  const currentYear = localToday().slice(0, 4);
  const year = params.get('year') ?? currentYear;
  const [settingsTab, setSettingsTab] = useLocalStorage<SettingsTab>({ key: 'ordo.accounting.settingsTab', defaultValue: 'zip' });
  // A tab of the settings asked in the address (the former company settings): opened, then dropped from it.
  useEffect(() => {
    const asked = params.get('settingsTab');
    if (!asked) return;
    if (asked === 'zip' || asked === 'statuses' || asked === 'company') setSettingsTab(asked);
    const next = new URLSearchParams(params);
    next.delete('settingsTab');
    setParams(next, { replace: true });
  }, [params, setParams, setSettingsTab]);
  const yearOf = (date: unknown) => String(date).slice(0, 4);
  const years = [...new Set([...(documents ?? []).map((document) => yearOf(document.issueDate)), ...(imported.data ?? []).map((document) => yearOf(document.issueDate)), currentYear])]
    .sort()
    .reverse();
  const inYear = (date: unknown) => yearOf(date) === year;
  // Documents to send (or to deposit…): final ones, and imported ones, whose status is of the "to send" category,
  // of every type and year.
  const toSend = (documents ?? []).filter((document) => document.status === 'FINAL' && document.trackingStatus?.category === 'TO_SEND');
  const importedToSend = (imported.data ?? []).filter((document) => document.trackingStatus?.category === 'TO_SEND');
  const toSendCount = toSend.length + importedToSend.length;
  /**
   * Changes a parameter of the address, the others kept.
   * @param {string} key Parameter.
   * @param {string | null} value Value; none removes it.
   * @returns {void}
   */
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <Stack gap="lg">
      <PageTitle>Facturation</PageTitle>
      {/* The year of the documents on the left (on their tabs), the creation on the right. */}
      <Group justify="space-between" gap="sm">
        {TABS.some((item) => item.value === tab) ? (
          <Select
            w={170}
            aria-label="Année des documents"
            leftSection={<CalendarBlankIcon aria-hidden />}
            data={years}
            value={year}
            allowDeselect={false}
            onChange={(value) => value && setParam('year', value === currentYear ? null : value)}
          />
        ) : (
          <div />
        )}
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <Button leftSection={<PlusIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
              Nouveau
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {TABS.map((item) => (
              <Menu.Item key={item.value} onClick={() => openNewDocument(item.value)}>
                {DOCUMENT_TYPE_LABELS[item.value]}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<FileArrowUpIcon aria-hidden />} onClick={() => openImportForm()}>
              Importer un document existant
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <Tabs value={tab} onChange={(value) => setParam('tab', value && value !== 'QUOTE' ? value : null)} keepMounted={false}>
        <Group justify="space-between" align="flex-end" mb="md" wrap="nowrap" gap="md">
          <Tabs.List style={{ flex: 1 }}>
            {TABS.map((item) => (
              <Tabs.Tab key={item.value} value={item.value}>
                {item.label}
              </Tabs.Tab>
            ))}
            <Tabs.Tab
              value="toSend"
              leftSection={<PaperPlaneTiltIcon aria-hidden />}
              rightSection={
                toSendCount ? (
                  <Badge size="xs" circle color="blue">
                    {toSendCount}
                  </Badge>
                ) : undefined
              }
            >
              À envoyer
            </Tabs.Tab>
            <Tabs.Tab
              value="overdue"
              leftSection={<BellRingingIcon aria-hidden />}
              rightSection={
                overdue.data?.length ? (
                  <Badge size="xs" circle color="red">
                    {overdue.data.length}
                  </Badge>
                ) : undefined
              }
            >
              À relancer
            </Tabs.Tab>
            <Tabs.Tab value="recurring" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
              Récurrentes
            </Tabs.Tab>
            <Tabs.Tab value="catalog" leftSection={<PackageIcon aria-hidden />}>
              Catalogue
            </Tabs.Tab>
          </Tabs.List>
        </Group>
        {TABS.map((item) => (
          <Tabs.Panel key={item.value} value={item.value}>
            {isPending || imported.isPending ? (
              <Skeleton height={200} />
            ) : (
              <DocumentsTable
                documents={(documents ?? []).filter((document) => document.type === item.value && inYear(document.issueDate))}
                imported={(imported.data ?? []).filter((document) => document.type === item.value && inYear(document.issueDate))}
                empty={`${EMPTY_DOCUMENTS[item.value].replace(/\.$/, '')} en ${year}.`}
              />
            )}
          </Tabs.Panel>
        ))}
        <Tabs.Panel value="toSend">
          {isPending || imported.isPending ? <Skeleton height={200} /> : <DocumentsTable documents={toSend} imported={importedToSend} showType empty="Aucun document à envoyer ni à déposer." />}
        </Tabs.Panel>
        <Tabs.Panel value="overdue">
          <OverdueInvoicesPanel />
        </Tabs.Panel>
        <Tabs.Panel value="recurring">
          <RecurringList />
        </Tabs.Panel>
        <Tabs.Panel value="catalog">
          <CatalogPanel />
        </Tabs.Panel>
      </Tabs>
      {/* In the settings sidebar: the download of a period as a ZIP, the tracking statuses of the documents and the company. */}
      <PageSettings title="Paramètres de la facturation">
        <Tabs value={settingsTab} onChange={(value) => value && setSettingsTab(value as SettingsTab)}>
          <Tabs.List mb="md">
            <Tabs.Tab value="zip" leftSection={<FileZipIcon aria-hidden />}>
              Export ZIP
            </Tabs.Tab>
            <Tabs.Tab value="statuses">Suivi</Tabs.Tab>
            <Tabs.Tab value="company" leftSection={<BuildingsIcon aria-hidden />}>
              Ma société
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="statuses">
            <DocumentStatusSettings />
          </Tabs.Panel>
          <Tabs.Panel value="company">
            <CompanySettings />
          </Tabs.Panel>
          <Tabs.Panel value="zip">
            <Paper withBorder p="lg" radius="md" component="section">
              <Stack gap="md">
                <Title order={2} size="h4">
                  Télécharger les documents d’une période
                </Title>
                <DocumentsZipForm key={year} year={year} years={years} />
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </PageSettings>
    </Stack>
  );
}
