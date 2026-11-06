import { Button, Group, Menu, Skeleton, Stack, Text, Title } from '@mantine/core';
import { CaretDownIcon, FileArrowUpIcon, PlusIcon } from '@phosphor-icons/react';
import { useAccountingDocuments, useImportedDocuments } from './documents-api';
import { DocumentsTable } from './DocumentsTable';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openNewDocument } from './new-document';

/**
 * Billing tab of a project or documents section of a client: its quotes, invoices, deposit invoices and
 * credit notes, imported ones among them.
 * @param {{ clientId?: string | null, projectId?: string }} props Client (for new documents) and project, or client alone.
 * @returns {JSX.Element} Panel.
 */
export function ProjectBillingPanel({ clientId, projectId }: { clientId?: string | null; projectId?: string }) {
  const filter = projectId ? { projectId } : { clientId: clientId ?? undefined };
  const documents = useAccountingDocuments(filter);
  const imported = useImportedDocuments(filter);
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2} size="h4">
          Documents comptables
        </Title>
        <Menu position="bottom-end" shadow="md">
          <Menu.Target>
            <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />} disabled={!clientId}>
              Nouveau
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] as const).map((type) => (
              <Menu.Item key={type} onClick={() => openNewDocument(type, { clientId, projectId })}>
                {DOCUMENT_TYPE_LABELS[type]}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<FileArrowUpIcon aria-hidden />} onClick={() => openImportForm()}>
              Importer un document existant
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {!clientId && projectId && (
        <Text size="xs" c="dimmed">
          Rattachez le projet à un client pour lui établir des documents.
        </Text>
      )}
      {documents.isPending || imported.isPending ? (
        <Skeleton height={120} />
      ) : (
        <DocumentsTable documents={documents.data ?? []} imported={imported.data ?? []} showType showClient={!projectId && !clientId} empty="Aucun document comptable." />
      )}
    </Stack>
  );
}
