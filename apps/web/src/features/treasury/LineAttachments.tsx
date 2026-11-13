import { ActionIcon, Badge, Button, Checkbox, Group, Select, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { LinkIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTreasuryEntrySearch } from './api';
import { describeLink, type LineLink, type LineValues } from './lines';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { treeSelectProps, type TreeOption } from '../../components/tree-select/tree-select';

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
  const [search, setSearch] = useState('');
  const { data: found } = useTreasuryEntrySearch(search);
  const selectedDocuments = [...line.libraryDocumentIds.map((id) => `lib:${id}`), ...line.projectResourceIds.map((id) => `res:${id}`)];
  const linkedKeys = new Set(line.links.map((link) => `${link.kind}:${link.id}`));

  // Found entries of other entries: their lines, or the whole entry when it has none.
  const candidates: LineLink[] = (found ?? [])
    .filter((item) => item.id !== entryId)
    .flatMap((item): LineLink[] => {
      const base = { entryLabel: item.label, date: String(item.date) };
      if (!item.lines.length) return [{ ...base, kind: 'entry' as const, id: item.id, label: null, amount: item.amount }];
      return item.lines.map((other) => ({
        ...base,
        kind: 'line' as const,
        id: other.id,
        label: other.label ?? null,
        amount: other.mode === 'PERCENT' ? Math.round(item.amount * other.value) / 100 : other.value,
      }));
    })
    .filter((link) => !linkedKeys.has(`${link.kind}:${link.id}`));

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
            : 'Choisissez d’abord une relation dans la colonne « Pour ».'
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
        valueFormat="D MMM YYYY"
        value={line.date}
        onChange={(date) => onChange({ date: date ? String(date) : null })}
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
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          Liens
        </Text>
        <Text size="xs" c="dimmed">
          Une ligne d’un autre mouvement, ou un mouvement entier s’il n’est pas décomposé. Liés sur une même période, une entrée et une sortie se compensent dans les graphiques.
        </Text>
        {line.links.length > 0 && (
          <Group gap={6}>
            {line.links.map((link) => (
              <Badge
                key={`${link.kind}:${link.id}`}
                variant="light"
                color={link.amount < 0 ? 'red' : 'green'}
                leftSection={<LinkIcon aria-hidden />}
                rightSection={
                  <ActionIcon size="xs" variant="transparent" color="gray" aria-label={`Délier ${describeLink(link)}`} onClick={() => setLinks(line.links.filter((other) => other !== link))}>
                    <XIcon aria-hidden />
                  </ActionIcon>
                }
                tt="none"
              >
                {describeLink(link)}
              </Badge>
            ))}
          </Group>
        )}
        <Select
          aria-label="Lier une ligne ou un mouvement"
          placeholder="Rechercher un mouvement par son libellé…"
          searchable
          clearable={false}
          leftSection={<LinkIcon aria-hidden />}
          searchValue={search}
          onSearchChange={setSearch}
          // Filtered by the server.
          filter={({ options }) => options}
          nothingFoundMessage={search.trim().length < 2 ? 'Tapez au moins 2 caractères' : 'Aucun mouvement'}
          data={candidates.map((link) => ({ value: `${link.kind}:${link.id}`, label: describeLink(link) }))}
          value={null}
          onChange={(key) => {
            const link = candidates.find((item) => `${item.kind}:${item.id}` === key);
            if (!link) return;
            setLinks([...line.links, link]);
            setSearch('');
          }}
        />
      </Stack>
      <Group justify="flex-end">
        <Button onClick={onClose}>Terminé</Button>
      </Group>
    </Stack>
  );
}
