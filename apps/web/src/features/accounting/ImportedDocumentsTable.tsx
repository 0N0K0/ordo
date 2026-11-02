import { ActionIcon, Group, Paper, Stack, Table, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { formatMoney } from '@ordo/shared';
import { FilePdfIcon, FileArrowUpIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useImportedDocumentMutations, type ImportedDocument } from './documents-api';
import { openImportForm } from './imported-form';
import { DOCUMENT_TYPE_LABELS } from './labels';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });

/**
 * Imported quotes and invoices: number, type, date, client, totals and file.
 * @param {{ documents: ImportedDocument[], showClient?: boolean }} props Component props.
 * @returns {JSX.Element} Table.
 */
export function ImportedDocumentsTable({ documents, showClient = true }: { documents: ImportedDocument[]; showClient?: boolean }) {
  const { remove } = useImportedDocumentMutations();
  if (documents.length === 0) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <FileArrowUpIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            Aucun document importé.
          </Text>
        </Stack>
      </Paper>
    );
  }

  /**
   * Asks for confirmation before deleting an imported document.
   * @param {ImportedDocument} document Document.
   * @returns {void}
   */
  const confirmDelete = (document: ImportedDocument) => {
    const modalId = `delete-imported-${document.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le document importé',
      children: (
        <Stack gap="md">
          <Text size="sm">Le document importé {document.number} et son fichier seront supprimés définitivement d’Ordo. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(document.id, { onSuccess: () => notifySuccess('Document importé supprimé.'), onError: (error) => notifyError(error.message) });
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
            <Table.Th>Numéro</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Date</Table.Th>
            {showClient && <Table.Th>Client</Table.Th>}
            <Table.Th>Objet</Table.Th>
            <Table.Th ta="right">Total HT</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {documents.map((document) => (
            <Table.Tr key={document.id}>
              <Table.Td ff="monospace" fw={600}>
                {document.number}
              </Table.Td>
              <Table.Td>{DOCUMENT_TYPE_LABELS[document.type]}</Table.Td>
              <Table.Td>{dateFormat.format(new Date(`${document.issueDate}T00:00:00Z`))}</Table.Td>
              {showClient && <Table.Td>{document.clientName}</Table.Td>}
              <Table.Td>{document.title ?? '—'}</Table.Td>
              <Table.Td ta="right" ff="monospace">
                {formatMoney(Math.round(document.totalNet * 100), document.currency)}
              </Table.Td>
              <Table.Td ta="right" ff="monospace" fw={600}>
                {formatMoney(Math.round(document.totalGross * 100), document.currency)}
              </Table.Td>
              <Table.Td>
                <Group gap={2} justify="flex-end" wrap="nowrap">
                  {document.fileUrl && (
                    <Tooltip label={document.fileName ?? 'Document'}>
                      <ActionIcon component="a" href={document.fileUrl} target="_blank" rel="noopener" variant="subtle" color="gray" aria-label={`Ouvrir ${document.fileName ?? 'le document'}`}>
                        <FilePdfIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="Modifier">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${document.number}`} onClick={() => openImportForm(document)}>
                      <PencilSimpleIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Supprimer">
                    <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${document.number}`} onClick={() => confirmDelete(document)}>
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
