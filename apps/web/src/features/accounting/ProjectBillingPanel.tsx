import { Button, Group, Menu, Skeleton, Stack, Text, Title } from '@mantine/core';
import { CaretDownIcon, PlusIcon } from '@phosphor-icons/react';
import { useAccountingDocuments, useImportedDocuments } from './documents-api';
import { DocumentsTable } from './DocumentsTable';
import { ImportedDocumentsTable } from './ImportedDocumentsTable';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openNewDocument } from './new-document';

/**
 * Billing tab of a project or documents section of a client: its quotes, invoices, deposit invoices and
 * credit notes, and the imported ones.
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
          </Menu.Dropdown>
        </Menu>
      </Group>
      {!clientId && projectId && (
        <Text size="xs" c="dimmed">
          Rattachez le projet à un client pour lui établir des documents.
        </Text>
      )}
      {documents.isPending ? (
        <Skeleton height={120} />
      ) : (
        <DocumentsTable documents={documents.data ?? []} showType showClient={!projectId && !clientId} empty="Aucun document comptable." />
      )}
      {(imported.data?.length ?? 0) > 0 && (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Documents importés
          </Text>
          <ImportedDocumentsTable documents={imported.data ?? []} showClient={false} />
        </Stack>
      )}
    </Stack>
  );
}
