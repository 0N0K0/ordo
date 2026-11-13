import { Badge, Button, Group, Menu, Paper, Select, Skeleton, Stack, Tabs, Text, Title } from '@mantine/core';
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
  FileTextIcon,
  FileZipIcon,
  PackageIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { DataTable } from '../../components/data-table/DataTable';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { useSearchParams } from 'react-router';
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
import { PageTabs } from '../../components/PageTabs';
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

/** Columns of the recurring invoices. */
const RECURRING_COLUMNS: DataColumn<RecurringInvoice>[] = [
  { id: 'name', label: 'Nom', size: 280, locked: true, sortValue: (item) => item.name },
  { id: 'client', label: 'Client', size: 200, sortValue: (item) => item.template.clientName ?? null },
  { id: 'repetition', label: 'Répétition', size: 240 },
  { id: 'next', label: 'Prochaine', size: 130, sortValue: (item) => (item.nextDate ? String(item.nextDate) : null) },
  { id: 'issued', label: 'Émises', size: 90, numeric: true, hiddenByDefault: true, sortValue: (item) => item.issuedCount },
  { id: 'amount', label: 'Montant', size: 130, numeric: true, sortValue: (item) => item.template.totalGross },
];

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
    <DataTable
      framed
      tableKey="recurring-invoices"
      verticalSpacing="xs"
      columns={RECURRING_COLUMNS}
      rows={recurring}
      getKey={(item) => item.id}
      cells={(item) => {
        const rule = recurrenceSchema.safeParse(item.recurrence);
        return {
          name: (
            <>
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
            </>
          ),
          client: item.template.clientName,
          repetition: <Text size="sm">{rule.success ? describeRecurrence(rule.data, String(item.startDate)) : '—'}</Text>,
          next: item.nextDate ? dateFormat.format(new Date(`${item.nextDate}T00:00:00Z`)) : 'Terminée',
          issued: item.issuedCount,
          amount: formatMoney(Math.round(item.template.totalGross * 100), item.template.currency),
        };
      }}
      actions={(item) => (
        <RowActions
          name={item.name}
          primary={{ label: 'Modifier la planification', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRecurringForm({ recurring: item }) }}
          items={[
            { label: 'Ouvrir le modèle', icon: <FileTextIcon aria-hidden />, to: `/accounting/${item.templateId}` },
            { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(item) },
          ]}
        />
      )}
    />
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
      <PageTabs value={tab} onChange={(value) => setParam('tab', value && value !== 'QUOTE' ? value : null)} keepMounted={false}>
        <PageTabs.List>
          {TABS.map((item) => (
            <PageTabs.Tab key={item.value} value={item.value}>
              {item.label}
            </PageTabs.Tab>
          ))}
          <PageTabs.Tab
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
          </PageTabs.Tab>
          <PageTabs.Tab
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
          </PageTabs.Tab>
          <PageTabs.Tab value="recurring" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Récurrentes
          </PageTabs.Tab>
          <PageTabs.Tab value="catalog" leftSection={<PackageIcon aria-hidden />}>
            Catalogue
          </PageTabs.Tab>
        </PageTabs.List>
        {TABS.map((item) => (
          <PageTabs.Panel key={item.value} value={item.value}>
            {isPending || imported.isPending ? (
              <Skeleton height={200} />
            ) : (
              <DocumentsTable
                documents={(documents ?? []).filter((document) => document.type === item.value && inYear(document.issueDate))}
                imported={(imported.data ?? []).filter((document) => document.type === item.value && inYear(document.issueDate))}
                empty={`${EMPTY_DOCUMENTS[item.value].replace(/\.$/, '')} en ${year}.`}
              />
            )}
          </PageTabs.Panel>
        ))}
        <PageTabs.Panel value="toSend">
          {isPending || imported.isPending ? <Skeleton height={200} /> : <DocumentsTable documents={toSend} imported={importedToSend} showType empty="Aucun document à envoyer ni à déposer." />}
        </PageTabs.Panel>
        <PageTabs.Panel value="overdue">
          <OverdueInvoicesPanel />
        </PageTabs.Panel>
        <PageTabs.Panel value="recurring">
          <RecurringList />
        </PageTabs.Panel>
        <PageTabs.Panel value="catalog">
          <CatalogPanel />
        </PageTabs.Panel>
      </PageTabs>
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
