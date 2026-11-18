import { Checkbox, Group, Select, Stack } from '@mantine/core';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { DatePickerInput } from '@mantine/dates';
import { linkKey, type LineLink, type LineValues } from '../lib/lines';
import { EntryLinkSelect, LinkBadge } from './entry-links';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps, type TreeOption } from '../../../components/tree/tree-select';
import { FormActions } from '../../../components/dialogs/FormActions';

interface LineAttachmentsProps {
  line: LineValues;
  onChange: (changes: Partial<LineValues>) => void;
  /** Entry edited (its own lines cannot be linked). */
  entryId: string | null;
  projects: TreeOption[];
  /** Supporting documents, grouped by place; values "lib:<id>" or "res:<id>". */
  documentGroups: { group: string; items: { value: string; label: string }[] }[];
  onClose: () => void;
}

/**
 * What a line is attached to: a project, supporting documents, and linked lines of other entries or whole entries
 * without lines (linked money in and out offset each other in the charts).
 * @param {LineAttachmentsProps} props Component props.
 * @returns {JSX.Element} Fields.
 */
export function LineAttachments({ line, onChange, entryId, projects, documentGroups, onClose }: LineAttachmentsProps) {
  const selectedDocuments = [...line.libraryDocumentIds.map((id) => `lib:${id}`), ...line.projectResourceIds.map((id) => `res:${id}`)];

  /**
   * Replaces the links of the line.
   * @param {LineLink[]} links Links.
   * @returns {void}
   */
  const setLinks = (links: LineLink[]) =>
    onChange({
      links,
      linkedLineIds: links.filter((link) => link.kind === 'line').map((link) => link.id),
      linkedEntryIds: links.filter((link) => link.kind === 'entry').map((link) => link.id),
    });

  return (
    <Stack gap="sm">
      <Checkbox
        label="Prêt"
        description={
          line.relationId
            ? 'Une sortie prête à la relation (ou lui rembourse ce que vous lui devez), une entrée vous fait prêter par elle (ou vous rembourse). Suivi dans l’onglet Prêts.'
            : 'Choisissez d’abord une relation dans la colonne « Bénéficiaire ».'
        }
        disabled={!line.relationId}
        checked={line.loan}
        onChange={(event) => onChange({ loan: event.currentTarget.checked })}
      />
      <DatePickerInput
        label="Date d’achat"
        description="Si elle diffère de celle du mouvement (carte à débit différé) : budgets et graphiques la comptent ce jour-là."
        placeholder="Celle du mouvement"
        clearable
        value={line.date}
        onChange={(date) => onChange({ date: date ? date : null })}
      />
      <Select label="Projet" clearable searchable {...treeSelectProps(projects)} value={line.projectId} onChange={(projectId) => onChange({ projectId })} />
      <BatchMultiSelect
        label="Pièces justificatives"
        description="Documents de la bibliothèque ou des projets."
        placeholder={selectedDocuments.length ? undefined : 'Rechercher un document…'}
        searchable
        clearable
        nothingFoundMessage="Aucun document"
        data={documentGroups}
        value={selectedDocuments}
        onChange={(keys) =>
          onChange({
            libraryDocumentIds: keys.filter((key) => key.startsWith('lib:')).map((key) => key.slice(4)),
            projectResourceIds: keys.filter((key) => key.startsWith('res:')).map((key) => key.slice(4)),
          })
        }
      />
      <LabeledField
        label="Liens"
        description="Une ligne d’un autre mouvement, ou un mouvement entier s’il n’est pas décomposé. Liés sur une même période, une entrée et une sortie se compensent dans les graphiques."
      >
        {line.links.length > 0 && (
          <Group gap={6}>
            {line.links.map((link) => (
              <LinkBadge key={linkKey(link)} link={link} onUnlink={() => setLinks(line.links.filter((other) => other !== link))} />
            ))}
          </Group>
        )}
        <EntryLinkSelect aria-label="Lier une ligne ou un mouvement" entryId={entryId} links={line.links} onLink={(link) => setLinks([...line.links, link])} />
      </LabeledField>
      <FormActions submitLabel="Terminé" onSubmit={onClose} />
    </Stack>
  );
}
