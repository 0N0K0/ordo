import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import type { LinkedDocumentIds } from '@ordo/shared';
import { documentIdsOfKeys, documentKeys, type DocumentGroup } from '../../documents/lib/document-keys';

interface SupportingDocumentsSelectProps {
  /** Documents offered, grouped by place. */
  data: DocumentGroup[];
  value: LinkedDocumentIds;
  onChange: (documents: LinkedDocumentIds) => void;
  error?: string;
}

/**
 * « Pièces justificatives » of an entry or a line: documents of the library or of the projects, several at once.
 * @param {SupportingDocumentsSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function SupportingDocumentsSelect({ data, value, onChange, error }: SupportingDocumentsSelectProps) {
  const keys = documentKeys(value);
  return (
    <BatchMultiSelect
      label="Pièces justificatives"
      description="Documents de la bibliothèque ou des projets."
      placeholder={keys.length ? undefined : 'Rechercher un document…'}
      searchable
      clearable
      nothingFoundMessage="Aucun document"
      data={data}
      value={keys}
      onChange={(chosen) => onChange(documentIdsOfKeys(chosen))}
      error={error}
    />
  );
}
