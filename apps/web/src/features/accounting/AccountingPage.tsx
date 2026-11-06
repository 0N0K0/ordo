import { ActionIcon, Badge, Button, Group, Menu, Paper, Skeleton, Stack, Table, Tabs, Text, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney, recurrenceSchema } from '@ordo/shared';
import { ArrowsClockwiseIcon, BellRingingIcon, CaretDownIcon, FileArrowUpIcon, FileZipIcon, PackageIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
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
import { openDocumentsZip, openNewDocument } from './new-document';
import { openRecurringForm } from './recurring-form';

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
 * Accounting: quotes, invoices, deposit invoices and credit notes (imported ones listed with their type),
 * invoices to follow up, recurring invoices and catalogue.
 * @returns {JSX.Element} Page.
 */
export function AccountingPage() {
  const [params, setParams] = useSearchParams();
  // Imported documents are now listed with their type.
  const tab = params.get('tab') && params.get('tab') !== 'imported' ? params.get('tab')! : 'QUOTE';
  const { data: documents, isPending } = useAccountingDocuments();
  const imported = useImportedDocuments();
  const overdue = useOverdueInvoices(localToday());

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={1} size="h2">
          Facturation
        </Title>
        <Group gap="sm">
          <Button variant="default" leftSection={<FileZipIcon aria-hidden />} onClick={openDocumentsZip}>
            Télécharger (ZIP)
          </Button>
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
      </Group>
      <Tabs value={tab} onChange={(value) => setParams(value && value !== 'QUOTE' ? { tab: value } : {}, { replace: true })} keepMounted={false}>
        <Tabs.List mb="md">
          {TABS.map((item) => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
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
        {TABS.map((item) => (
          <Tabs.Panel key={item.value} value={item.value}>
            {isPending || imported.isPending ? (
              <Skeleton height={200} />
            ) : (
              <DocumentsTable
                documents={(documents ?? []).filter((document) => document.type === item.value)}
                imported={(imported.data ?? []).filter((document) => document.type === item.value)}
                empty={EMPTY_DOCUMENTS[item.value]}
              />
            )}
          </Tabs.Panel>
        ))}
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
    </Stack>
  );
}
