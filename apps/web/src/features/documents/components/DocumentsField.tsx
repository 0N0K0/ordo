import { Text } from '@mantine/core';
import type { LinkedDocumentIds } from '@ordo/shared';
import type { ReactNode } from 'react';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { DocumentsPicker } from './DocumentsPicker';
import { documentGroups, documentKey, documentKeys } from '../lib/document-keys';
import { useDocumentOptions, type LinkedDocument } from '../api';

interface DocumentsFieldProps {
  /** Documents linked. */
  value: LinkedDocumentIds;
  /** Project the item goes by: its documents first. */
  projectId: string | null;
  /** Whether a project is in the project tree of the item: only its documents are offered (none without project). */
  inTree: (projectId: string | null) => boolean;
  /** Shown only (archived). Optional. Default = false. */
  readOnly?: boolean;
  /** Help under the label. Optional. */
  description?: ReactNode;
  error?: ReactNode;
  onChange: (documents: LinkedDocumentIds) => void;
}

/**
 * « Documents » of a task, a routine or an event, in the « Ressources » group of its panel: documents of the library
 * and of its project tree, chosen from the pencil, opened in a click, removed from their cross, each change saved at
 * once by `onChange`.
 * @param {DocumentsFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function DocumentsField({ value, projectId, inTree, readOnly = false, description, error, onChange }: DocumentsFieldProps) {
  const { data: options = [] } = useDocumentOptions();
  const byKey = new Map(options.map((document) => [documentKey(document), document]));
  const documents = documentKeys(value).flatMap((key): LinkedDocument[] => { const document = byKey.get(key); return document ? [document] : []; });
  const offered = options.filter((document) => document.source === 'LIBRARY' || inTree(document.projectId));
  return (
    <LabeledField label="Documents" description={description} error={error}>
      {documents.length === 0 && (
        <Text size="sm" c="dimmed">
          Aucun document.
        </Text>
      )}
      <DocumentsPicker documents={documents} options={documentGroups(offered, projectId)} label="Documents" removable readOnly={readOnly} onSave={onChange} />
    </LabeledField>
  );
}
