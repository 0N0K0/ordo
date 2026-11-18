import { LabeledField } from '../../../components/inputs/LabeledField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Group, Select, Text } from '@mantine/core';

import { ON_ERROR } from '../../../lib/notify';
import { useSheetLinks, useSheetMutations, useSheets, type SheetOwner } from '../api';
import { MultiplierInput } from './MultiplierInput';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { unarchived } from '../../../lib/archive';

/**
 * Sheets of a routine, an event or a task, each times a multiplier, saved as they change: each occurrence (or the
 * task) gets a checklist made of them.
 * @param {{ owner: SheetOwner }} props Routine, event or task.
 * @returns {JSX.Element} Field.
 */
export function SheetLinksField({ owner }: { owner: SheetOwner }) {
  const { data: sheets } = useSheets();
  const { data: links } = useSheetLinks(owner);
  const { setLinks } = useSheetMutations();
  const current = (links ?? []).map((link) => ({ sheetId: link.sheetId, multiplier: link.multiplier }));
  const save = (next: { sheetId: string; multiplier: number }[]) => setLinks.mutate({ owner, links: next }, ON_ERROR);
  // The archived sheets are not offered (those linked already stay).
  const options = unarchived(
    sheets ?? [],
    current.map((link) => link.sheetId),
  ).map((sheet) => ({ value: sheet.id, label: sheet.label }));
  const archivedIds = new Set((sheets ?? []).filter((sheet) => sheet.archived).map((sheet) => sheet.id));
  const free = options.filter((option) => !archivedIds.has(option.value) && !current.some((link) => link.sheetId === option.value));
  return (
    <LabeledField label="Fiches">
      <Text size="xs" c="dimmed">
        Chaque occurrence a sa liste à cocher, faite de ces fiches à son ouverture (modifiable ensuite).
      </Text>
      {current.map((link, index) => (
        <Group key={link.sheetId} gap="xs" wrap="nowrap">
          <Select
            size="xs"
            style={{ flex: 1 }}
            aria-label={`Fiche ${index + 1}`}
            allowDeselect={false}
            data={options.filter((option) => option.value === link.sheetId || free.includes(option))}
            value={link.sheetId}
            onChange={(sheetId) => sheetId && save(current.map((other, position) => (position === index ? { ...other, sheetId } : other)))}
          />
          <MultiplierInput
            size="xs"
            w={90}
            aria-label={`Fois, fiche ${index + 1}`}
            value={link.multiplier}
            onBlur={(event) => {
              const value = Number(event.currentTarget.value.replace('× ', '').replace(',', '.')) || 1;
              if (value !== link.multiplier) save(current.map((other, position) => (position === index ? { ...other, multiplier: value } : other)));
            }}
          />
          <RemoveButton label="Retirer" aria-label={`Retirer la fiche ${index + 1}`} onClick={() => save(current.filter((_, position) => position !== index))} />
        </Group>
      ))}
      <AddItemButton disabled={free.length === 0} onClick={() => save([...current, { sheetId: free[0].value, multiplier: 1 }])}>
        Ajouter une fiche
      </AddItemButton>
    </LabeledField>
  );
}
