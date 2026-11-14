import { ActionButton } from '../../components/actions/ActionButton';
import { TableSkeleton } from '../../components/feedback/Skeletons';
import { Group, Stack, Text, Title } from '@mantine/core';
import { FileArrowUpIcon, PlusIcon, FileTextIcon } from '@phosphor-icons/react';
import { useAccountingDocuments, useImportedDocuments } from './documents-api';
import { DocumentsTable } from './DocumentsTable';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';
import { openNewDocument } from './new-document';

/**
 * Billing tab of a project or documents section of a client: its quotes, invoices, deposit invoices and
 * credit notes, imported ones among them. For a client with projects given: its documents and those of these
 * projects (also those not addressed to it).
 * @param {{ clientId?: string | null, projectId?: string, projectIds?: Set<string> }} props Client (for new documents) and project, or client alone (and its projects).
 * @returns {JSX.Element} Panel.
 */
export function ProjectBillingPanel({ clientId, projectId, projectIds }: { clientId?: string | null; projectId?: string; projectIds?: Set<string> }) {
  // A client and its projects: every document, sorted out here (the same cache as the accounting page).
  const ofProjects = !projectId && Boolean(projectIds);
  const filter = projectId ? { projectId } : ofProjects ? {} : { clientId: clientId ?? undefined };
  const documents = useAccountingDocuments(filter);
  const imported = useImportedDocuments(filter);
  /**
   * Document of the client or of one of its projects.
   * @param {{ clientId?: string | null, projectId?: string | null }} document Document.
   * @returns {boolean} Kept.
   */
  const kept = (document: { clientId?: string | null; projectId?: string | null }) =>
    !ofProjects || document.clientId === clientId || (document.projectId != null && projectIds!.has(document.projectId));
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2} size="h4">
          Documents comptables
        </Title>
        <ActionButton
          icon={<PlusIcon aria-hidden />}
          disabled={!clientId}
          menu={[
            ...(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] as const).map((type) => ({
              label: DOCUMENT_TYPE_LABELS[type],
              icon: <FileTextIcon aria-hidden />,
              onClick: () => openNewDocument(type, { clientId, projectId }),
            })),
            'divider' as const,
            { label: 'Importer un document existant', icon: <FileArrowUpIcon aria-hidden />, onClick: () => openImportForm() },
          ]}
        >
          Nouveau document
        </ActionButton>
      </Group>
      {!clientId && projectId && (
        <Text size="xs" c="dimmed">
          Rattachez le projet à un client pour lui établir des documents.
        </Text>
      )}
      {documents.isPending || imported.isPending ? (
        <TableSkeleton rows={3} />
      ) : (
        <DocumentsTable
          tableKey="project-documents"
          projectId={projectId ?? null}
          title="Documents comptables"
          documents={(documents.data ?? []).filter(kept)}
          imported={(imported.data ?? []).filter(kept)}
          showType
          showClient={!projectId && !clientId}
          empty="Aucun document comptable."
        />
      )}
    </Stack>
  );
}
