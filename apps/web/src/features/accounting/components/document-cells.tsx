import { IconAction } from '../../../components/actions/IconAction';
import { stopClick } from '../../../components/data-table/cells/cell-field';
import { FileButton, Group } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { FileBadge } from '../../../components/items/FileBadge';
import { confirmRemoveAttachment } from '../lib/remove-attachment';
import { StackedValues } from '../../../components/data-table/cells/StackedValues';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { treeSelectProps, type TreeOption } from '../../../components/tree/tree-select';
import { openFile } from '../../files/lib/open-file';
import { useDocumentMutations, type AccountingDocumentSummary, type ImportedDocument } from '../api/documents';
import { documentName } from '../lib/labels';

/**
 * Project of a document, chosen in place: drafts and final documents alike (it is not printed on them); read only
 * for an archived document.
 * @param {{ document: AccountingDocumentSummary | ImportedDocument, projects: TreeOption[], label: string, onSave: (projectId: string | null) => void }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DocumentProjectCell({
  document,
  projects,
  label,
  onSave,
}: {
  document: AccountingDocumentSummary | ImportedDocument;
  projects: TreeOption[];
  label: string;
  onSave: (projectId: string | null) => void;
}) {
  return (
    <div onClick={stopClick}>
      <EditableSelect value={document.projectId ?? null} label={label} nullable readOnly={document.archived} {...treeSelectProps(projects)} onSave={onSave} />
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
      <FileBadge
        filename={document.filename ?? 'Fichier'}
        onClick={(event) => {
          stopClick(event);
          openFile({ url: document.fileUrl!, filename: document.filename ?? document.number, mimeType: document.fileMimeType });
        }}
      />
    ) : null;
  }
  const { document } = props;
  const name = documentName(document.number);
  return (
    <Group gap={4} wrap="nowrap" align="flex-start" onClick={stopClick}>
      <StackedValues>
        {document.attachments.map((attachment) => (
          <FileBadge
            key={attachment.id}
            filename={attachment.filename}
            onClick={() => openFile({ url: attachment.url, filename: attachment.filename })}
            onRemove={
              document.archived
                ? undefined
                : (event) => {
                    stopClick(event);
                    confirmRemoveAttachment(attachment, name, () => removeAttachment.mutateAsync(attachment.id));
                  }
            }
          />
        ))}
      </StackedValues>
      {!document.archived && (
        <FileButton multiple onChange={(files) => files.length && props.onAdd(files)}>
          {(buttonProps) => (
            <IconAction label="Joindre des fichiers" {...buttonProps} size="sm" loading={addAttachments.isPending} item={name}>
              <PlusIcon aria-hidden />
            </IconAction>
          )}
        </FileButton>
      )}
    </Group>
  );
}
