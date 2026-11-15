import { ActionIcon, Badge, FileButton, Group, Tooltip } from '@mantine/core';
import { PaperclipIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { EditableSelect } from '../../components/data-table/EditableCells';
import { treeSelectProps, type TreeOption } from '../../components/tree-select/tree-select';
import { notifyError, notifySuccess } from '../../lib/notify';
import { openFile } from '../files/open-file';
import { useDocumentMutations, useImportedDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from './documents-api';

/** Cells do not open the document when used. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Project of a document, chosen in place: drafts and final documents alike (it is not printed on them).
 * @param {{ kind: 'ordo' | 'imported', document: AccountingDocumentSummary | ImportedDocument, projects: TreeOption[] }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentProjectCell({ kind, document, projects }: { kind: 'ordo' | 'imported'; document: AccountingDocumentSummary | ImportedDocument; projects: TreeOption[] }) {
  const ordo = useDocumentMutations();
  const imported = useImportedDocumentMutations();
  const mutation = kind === 'ordo' ? ordo.setProject : imported.setProject;
  return (
    <div onClick={stop}>
      <EditableSelect
        value={document.projectId ?? null}
        label={`Projet de ${document.number ?? 'ce brouillon'}`}
        nullable
        {...treeSelectProps(projects)}
        onSave={(projectId) => mutation.mutate({ id: document.id, projectId }, { onError: (error) => notifyError(error.message) })}
      />
    </div>
  );
}

/**
 * Attachments of a document made in Ordo: opened in a click, added from the computer, removed (once confirmed);
 * the file of an imported document, opened in a click.
 * @param {{ kind: 'ordo', document: AccountingDocumentSummary } | { kind: 'imported', document: ImportedDocument }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentAttachmentsCell(props: { kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument }) {
  const { addAttachments, removeAttachment } = useDocumentMutations();
  if (props.kind === 'imported') {
    const { document } = props;
    return document.fileUrl ? (
      <Badge
        size="sm"
        variant="light"
        color="gray"
        tt="none"
        leftSection={<PaperclipIcon aria-hidden />}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          stop(event);
          openFile({ url: document.fileUrl!, name: document.fileName ?? document.number, mimeType: document.fileMimeType });
        }}
      >
        {document.fileName ?? 'Fichier'}
      </Badge>
    ) : null;
  }
  const { document } = props;
  const name = document.number ?? 'ce brouillon';
  return (
    <Group gap={4} wrap="wrap" onClick={stop}>
      {document.attachments.map((attachment) => (
        <Badge
          key={attachment.id}
          size="sm"
          variant="light"
          color="gray"
          tt="none"
          leftSection={<PaperclipIcon aria-hidden />}
          style={{ cursor: 'pointer' }}
          onClick={() => openFile({ url: attachment.url, name: attachment.name })}
          rightSection={
            <ActionIcon
              size="xs"
              variant="transparent"
              color="gray"
              aria-label={`Retirer ${attachment.name}`}
              onClick={(event) => {
                stop(event);
                confirmDestructive({
                  title: 'Retirer la pièce jointe',
                  risks: `« ${attachment.name} » sera supprimée définitivement de ${name}.`,
                  onConfirm: () => removeAttachment.mutate(attachment.id, { onSuccess: () => notifySuccess('Pièce jointe retirée.'), onError: (error) => notifyError(error.message) }),
                });
              }}
            >
              <XIcon aria-hidden />
            </ActionIcon>
          }
        >
          {attachment.name.length > 24 ? `${attachment.name.slice(0, 23)}…` : attachment.name}
        </Badge>
      ))}
      <FileButton
        multiple
        onChange={(files) =>
          files.length && addAttachments.mutate({ id: document.id, files }, { onSuccess: () => notifySuccess('Pièces jointes ajoutées.'), onError: (error) => notifyError(error.message) })
        }
      >
        {(buttonProps) => (
          <Tooltip label="Joindre des fichiers">
            <ActionIcon {...buttonProps} variant="subtle" color="gray" size="sm" loading={addAttachments.isPending} aria-label={`Joindre des fichiers à ${name}`}>
              <PlusIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
      </FileButton>
    </Group>
  );
}
