import { stopClick } from '../../../components/data-table/cells/cell-field';
import { ActionIcon, Badge, FileButton, Group, Tooltip } from '@mantine/core';
import { PaperclipIcon, PlusIcon } from '@phosphor-icons/react';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps, type TreeOption } from '../../../components/tree/tree-select';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { openFile } from '../../files/lib/open-file';
import { useDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from '../api/documents';
import { RemoveButton } from '../../../components/actions/RemoveButton';

/**
 * Project of a document, chosen in place: drafts and final documents alike (it is not printed on them); read only
 * for an archived document.
 * @param {{ document: AccountingDocumentSummary | ImportedDocument, projects: TreeOption[], onSave: (projectId: string | null) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentProjectCell({ document, projects, onSave }: { document: AccountingDocumentSummary | ImportedDocument; projects: TreeOption[]; onSave: (projectId: string | null) => void }) {
  return (
    <div onClick={stopClick}>
      <EditableSelect
        value={document.projectId ?? null}
        label={`Projet de ${document.number ?? 'ce brouillon'}`}
        nullable
        readOnly={document.archived}
        {...treeSelectProps(projects)}
        onSave={onSave}
      />
    </div>
  );
}

/**
 * Attachments of a document made in Ordo: opened in a click, added from the computer, removed (once confirmed);
 * the file of an imported document, opened in a click. An archived document's are only opened.
 * @param {({ kind: 'ordo', document: AccountingDocumentSummary } | { kind: 'imported', document: ImportedDocument }) & { onAdd: (files: File[]) => void }} props Document, and adding files (to it, or to the bulk selection).
 * @returns {JSX.Element} Cell.
 */
export function DocumentAttachmentsCell(props: ({ kind: 'ordo'; document: AccountingDocumentSummary } | { kind: 'imported'; document: ImportedDocument }) & { onAdd: (files: File[]) => void }) {
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
          stopClick(event);
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
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stopClick}>
      <StackedValues>
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
              !document.archived && (
                <RemoveButton
                  variant="field"
                  size="xs"
                  label="Retirer la pièce jointe"
                  aria-label={`Retirer ${attachment.name}`}
                  onClick={(event) => {
                    stopClick(event);
                    confirmDestructive({
                      title: 'Retirer la pièce jointe',
                      risks: `« ${attachment.name} » sera supprimée définitivement de ${name}.`,
                      onConfirm: () => removeAttachment.mutate(attachment.id, { onSuccess: () => notifySuccess('Pièce jointe retirée.'), onError: onMutationError }),
                    });
                  }}
                />
              )
            }
          >
            {attachment.name.length > 24 ? `${attachment.name.slice(0, 23)}…` : attachment.name}
          </Badge>
        ))}
      </StackedValues>
      {!document.archived && (
        <FileButton multiple onChange={(files) => files.length && props.onAdd(files)}>
          {(buttonProps) => (
            <Tooltip label="Joindre des fichiers">
              <ActionIcon {...buttonProps} variant="subtle" color="gray" size="sm" loading={addAttachments.isPending} aria-label={`Joindre des fichiers à ${name}`}>
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          )}
        </FileButton>
      )}
    </Group>
  );
}
