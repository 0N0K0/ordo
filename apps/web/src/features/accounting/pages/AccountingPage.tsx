import { SETTINGS_TAB_PARAM, useSettingsTab } from '../../../components/tabs/use-settings-tab';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { PAGES, SETTINGS_PARAM, documentPath } from '../../../app/pages';
import { CountBadge } from '../../../components/feedback/CountBadge';
import { useSetParams } from '../../../lib/search-params';
import { countOf, plural } from '../../../lib/text';
import { PageHeader } from '../../../components/page/PageHeader';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';

import { Badge, Group, Stack, Text } from '@mantine/core';
import { ArrowsClockwiseIcon, BellRingingIcon, BuildingsIcon, ColumnsIcon, FileTextIcon, FileZipIcon, PackageIcon, PaperPlaneTiltIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { DataTable } from '../../../components/data-table/table/DataTable';
import { bulkCellLabels, bulkSaver } from '../../../components/data-table/selection/bulk-edit';
import { EditableSelect, EditableText } from '../../../components/data-table/cells/EditableCells';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useSearchParams } from 'react-router';
import { localToday, yearOfDay } from '../../../lib/dates';
import { ON_ERROR } from '../../../lib/notify';
import { CatalogPanel } from '../components/CatalogPanel';
import { OverdueInvoicesPanel } from '../components/OverdueInvoicesPanel';
import { useOverdueInvoices } from '../api/tracking';
import { useAccountingDocuments, useImportedDocuments, useRecurringInvoices, useRecurringMutations, type RecurringInvoice, type RecurringSettings } from '../api/documents';
import { DocumentsTable } from '../components/DocumentsTable';
import { DOCUMENT_TABS, documentsTableKey, EMPTY_DOCUMENTS } from '../lib/labels';
import { RECURRING_COLUMNS, repetitionText } from '../lib/accounting-columns';
import { AccountingColumnDefaults } from '../components/AccountingColumnDefaults';
import { newDocumentMenu } from '../lib/new-document';
import { DocumentsZipForm } from '../components/DocumentsZipForm';
import { CompanySettings } from '../components/CompanySettings';
import { openRecurringForm } from '../lib/recurring-form';
import { DocumentStatusSettings } from '../components/DocumentStatusSettings';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { PageSettings } from '../../../app/layout/PageSettings';
import { SettingsTabPanel, SettingsTabs } from '../../../components/tabs/SettingsTabs';
import { useEffect } from 'react';
import { archiveItemsAction, deleteItemsAction, rowLabel, rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { archiveEntry, useSetArchived, unarchived } from '../../../lib/archive';
import { accountingQueryKey } from '../api';
import { selectedLabel } from '../../../components/data-table/selection/selection-label';
import * as fmt from '../../../lib/format';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';

/** Tabs of the settings sidebar. */
const SETTINGS_TABS = ['zip', 'statuses', 'company', 'columns'] as const;

/** Tabs of the page: the documents by type, then the others. */
const PAGE_TABS = [...DOCUMENT_TABS.map((item) => item.value), 'toSend', 'overdue', 'recurring', 'catalog'] as const;

/** Former tabs of the page: the tracking statuses, in the settings sidebar. */
const ACCOUNTING_MOVED_TABS = { tracking: { changes: { [SETTINGS_PARAM]: '1' } } };

/**
 * Recurring invoices: schedule, next issue, model; edit, archive (no invoice issued any more, read only) or delete.
 * @returns {JSX.Element} List.
 */
function RecurringList() {
  const { data: recurring, isPending } = useRecurringInvoices();
  const { remove, update } = useRecurringMutations();
  const setArchived = useSetArchived('RECURRING_INVOICE', [accountingQueryKey]);

  /**
   * Saves fields of a recurring invoice changed in their cells.
   * @param {RecurringInvoice} item Recurring invoice.
   * @param {Partial<RecurringSettings>} change Change.
   * @returns {void}
   */
  const saveRecurring = (item: RecurringInvoice, change: Partial<RecurringSettings>) =>
    update.mutate({ id: item.id, input: { label: item.label, recurrence: item.recurrence, startDate: item.startDate, autoFinalize: item.autoFinalize, active: item.active, ...change } }, ON_ERROR);
  const view = useDataView({
    tableKey: 'recurring-invoices',
    getKey: (item) => item.id,
    columns: RECURRING_COLUMNS,
    rows: recurring ?? [],
    title: 'Factures récurrentes',
    archived: (item) => item.archived,
  });
  // An archived one is read only: left out of the changes of several rows.
  const cellLabelOf = bulkCellLabels(view, (item: RecurringInvoice) => item.label);
  const bulk = bulkSaver(view, (item: RecurringInvoice, change: Partial<RecurringSettings>) => !item.archived && saveRecurring(item, change));
  if (isPending) return <TableSkeleton rows={3} />;

  /**
   * « Supprimer » of recurring invoices, on a row as on a selection.
   * @param {RecurringInvoice[]} rows Recurring invoices.
   * @param {() => void} [clear] Clears the selection once done. Optional.
   * @returns {SelectionAction} Action.
   */
  const deleteRecurring = (rows: RecurringInvoice[], clear?: () => void) =>
    deleteItemsAction(rows, {
      noun: 'facture récurrente',
      many: 'factures récurrentes',
      feminine: true,
      the: 'la facture récurrente',
      label: rowLabel,
      risks: (subject, one) => `${subject} et ${one ? 'son modèle' : 'leurs modèles'} seront supprimés définitivement ; les factures déjà émises sont conservées.`,
      remove: (item) => remove.mutateAsync(item.id),
      clear,
    });

  return (
    <DataTable
      framed
      view={view}
      selectionLabel={(count) => selectedLabel(count, ['facture récurrente', 'factures récurrentes'])}
      isArchived={(item) => item.archived}
      selectionActions={(rows, clear) => [archiveItemsAction(rows, setArchived, { noun: 'facture récurrente', many: 'factures récurrentes', feminine: true, clear }), deleteRecurring(rows, clear)]}
      verticalSpacing="xs"
      empty={<EmptyState compact message="Aucune facture récurrente. Ouvrez une facture et choisissez « Rendre récurrente »." />}
      getKey={(item) => item.id}
      cells={(item) => {
        return {
          label: (
            <>
              <Group gap={6} wrap="nowrap">
                <EditableText value={item.label} label={cellLabelOf('label', item, 'Libellé')} strong readOnly={item.archived} onSave={(label) => label && bulk('label')(item, { label })} />
                {item.archived && <ArchivedBadge feminine size="xs" />}
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
                {countOf(item.issuedCount, 'facture')} {plural(item.issuedCount, 'émise')}
              </Text>
            </>
          ),
          client: item.template.clientName,
          repetition: <Text size="sm">{repetitionText(item) || '—'}</Text>,
          next: item.nextDate ? fmt.day(item.nextDate) : 'Terminée',
          state: (
            <EditableSelect
              value={item.active ? 'active' : 'paused'}
              label={cellLabelOf('state', item, 'État')}
              readOnly={item.archived}
              data={[
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'En pause' },
              ]}
              onSave={(state) => state && bulk('state')(item, { active: state === 'active' })}
            />
          ),
          issued: item.issuedCount,
          amount: fmt.money(item.template.totalGross, item.template.currency),
        };
      }}
      actions={(item) => (
        <RowActions
          name={item.label}
          primary={!item.archived && { label: 'Modifier la planification', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRecurringForm({ recurring: item }) }}
          items={[
            { label: 'Ouvrir le modèle', icon: <FileTextIcon aria-hidden />, to: documentPath(item.templateId) },
            archiveEntry({ archived: item.archived, type: 'Facture récurrente', label: item.label, feminine: true }, setArchived, item.id),
            rowMenuEntry(deleteRecurring([item])),
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
  const [params] = useSearchParams();
  const setParams = useSetParams();
  // Imported documents are now listed with their type (the former tab shows the quotes).
  // The old tab of the tracking statuses: its settings, in the sidebar.
  const [tab, setTab] = usePageTab(PAGE_TABS, 'QUOTE', ACCOUNTING_MOVED_TABS);
  const { data: documents, isPending } = useAccountingDocuments();
  const imported = useImportedDocuments();
  const overdue = useOverdueInvoices(localToday());
  const [settingsTab, setSettingsTab] = useSettingsTab(SETTINGS_TABS);
  // The former parameter of the tab of the settings (links, bookmarks): the one of every page.
  useEffect(() => {
    const asked = params.get('settingsTab');
    if (asked) setParams({ settingsTab: null, [SETTINGS_TAB_PARAM]: asked });
  }, [params, setParams]);
  // Documents to send (or to deposit…): final ones, and imported ones, whose status is of the "to send" category,
  // of every type and year.
  // Years of the documents, offered by the download of a period.
  const yearOf = (date: string) => String(yearOfDay(date));
  const years = [...new Set([...(documents ?? []).map((document) => yearOf(document.issueDate)), ...(imported.data ?? []).map((document) => yearOf(document.issueDate)), yearOf(localToday())])]
    .sort()
    .reverse();
  // Archived ones are not to do any more.
  const toSend = unarchived(documents ?? []).filter((document) => document.status === 'FINAL' && document.trackingStatus?.category === 'TO_SEND');
  const importedToSend = unarchived(imported.data ?? []).filter((document) => document.trackingStatus?.category === 'TO_SEND');
  const toSendCount = toSend.length + importedToSend.length;

  return (
    <Stack gap="lg">
      <PageHeader
        title={PAGES.accounting.label}
        actions={
          <ActionButton icon={<PlusIcon aria-hidden />} menu={newDocumentMenu()}>
            Nouveau document
          </ActionButton>
        }
      />
      <PageTabs value={tab} onChange={(value) => setTab(value)} keepMounted={false}>
        <PageTabs.List>
          {DOCUMENT_TABS.map((item) => (
            <PageTabs.Tab key={item.value} value={item.value}>
              {item.label}
            </PageTabs.Tab>
          ))}
          <PageTabs.Tab value="toSend" leftSection={<PaperPlaneTiltIcon aria-hidden />} rightSection={toSendCount ? <CountBadge count={toSendCount} color="blue" /> : undefined}>
            À envoyer
          </PageTabs.Tab>
          <PageTabs.Tab value="overdue" leftSection={<BellRingingIcon aria-hidden />} rightSection={overdue.data?.length ? <CountBadge count={overdue.data.length} color={LATE_COLOR} /> : undefined}>
            À relancer
          </PageTabs.Tab>
          <PageTabs.Tab value="recurring" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Récurrentes
          </PageTabs.Tab>
          <PageTabs.Tab value="catalog" leftSection={<PackageIcon aria-hidden />}>
            Catalogue
          </PageTabs.Tab>
        </PageTabs.List>
        {DOCUMENT_TABS.map((item) => (
          <PageTabs.Panel key={item.value} value={item.value}>
            {isPending || imported.isPending ? (
              <TableSkeleton rows={5} />
            ) : (
              <DocumentsTable
                tableKey={documentsTableKey(item.value)}
                title={item.label}
                documents={(documents ?? []).filter((document) => document.type === item.value)}
                imported={(imported.data ?? []).filter((document) => document.type === item.value)}
                empty={EMPTY_DOCUMENTS[item.value]}
              />
            )}
          </PageTabs.Panel>
        ))}
        <PageTabs.Panel value="toSend">
          {isPending || imported.isPending ? (
            <TableSkeleton rows={5} />
          ) : (
            <DocumentsTable
              tableKey="documents-to-send"
              title="Documents à envoyer"
              first={[{ label: 'À envoyer' }]}
              documents={toSend}
              imported={importedToSend}
              showType
              empty="Aucun document à envoyer ni à déposer."
            />
          )}
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
      {/* In the settings sidebar: the download of a period as a ZIP, the tracking statuses of the documents, the company, then the columns of new views of its tables. */}
      <PageSettings title="Paramètres de la facturation">
        <SettingsTabs
          value={settingsTab}
          onChange={setSettingsTab}
          tabs={[
            { value: 'zip', label: 'Export ZIP', icon: <FileZipIcon aria-hidden /> },
            { value: 'statuses', label: 'Suivi' },
            { value: 'company', label: 'Ma société', icon: <BuildingsIcon aria-hidden /> },
            { value: 'columns', label: 'Colonnes', icon: <ColumnsIcon aria-hidden /> },
          ]}
        >
          <SettingsTabPanel value="statuses">
            <DocumentStatusSettings />
          </SettingsTabPanel>
          <SettingsTabPanel value="company">
            <CompanySettings />
          </SettingsTabPanel>
          <SettingsTabPanel value="columns">
            <AccountingColumnDefaults />
          </SettingsTabPanel>
          <SettingsTabPanel value="zip">
            <SettingsSection title="Télécharger les documents d’une période">
              <DocumentsZipForm years={years} />
            </SettingsSection>
          </SettingsTabPanel>
        </SettingsTabs>
      </PageSettings>
    </Stack>
  );
}
