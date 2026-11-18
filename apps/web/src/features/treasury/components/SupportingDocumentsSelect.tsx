import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { supportingKeys, supportingOfKeys, type SupportingDocuments } from '../lib/entry-env';

interface SupportingDocumentsSelectProps {
  /** Documents offered, grouped by place. */
  data: { group: string; items: { value: string; label: string }[] }[];
  value: SupportingDocuments;
  onChange: (documents: SupportingDocuments) => void;
  error?: string;
}

/**
 * « Pièces justificatives » of an entry or a line: documents of the library or of the projects, several at once.
 * @param {SupportingDocumentsSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function SupportingDocumentsSelect({ data, value, onChange, error }: SupportingDocumentsSelectProps) {
  const keys = supportingKeys(value);
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
      onChange={(chosen) => onChange(supportingOfKeys(chosen))}
      error={error}
    />
  );
}
