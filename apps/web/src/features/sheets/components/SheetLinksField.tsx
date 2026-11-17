import { ActionIcon, Button, Group, NumberInput, Select, Stack, Text, Tooltip } from '@mantine/core';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import { onMutationError } from '../../../lib/notify';
import { useSheetLinks, useSheetMutations, useSheets, type SheetOwner } from '../api';

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
  const save = (next: { sheetId: string; multiplier: number }[]) => setLinks.mutate({ owner, links: next }, { onError: onMutationError });
  const options = (sheets ?? []).map((sheet) => ({ value: sheet.id, label: sheet.name }));
  const free = options.filter((option) => !current.some((link) => link.sheetId === option.value));
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        Fiches
      </Text>
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
          <NumberInput
            size="xs"
            w={90}
            aria-label={`Fois, fiche ${index + 1}`}
            min={0.25}
            max={999}
            decimalScale={2}
            decimalSeparator=","
            prefix="× "
            value={link.multiplier}
            onBlur={(event) => {
              const value = Number(event.currentTarget.value.replace('× ', '').replace(',', '.')) || 1;
              if (value !== link.multiplier) save(current.map((other, position) => (position === index ? { ...other, multiplier: value } : other)));
            }}
          />
          <Tooltip label="Retirer la fiche">
            <ActionIcon variant="subtle" color="gray" aria-label={`Retirer la fiche ${index + 1}`} onClick={() => save(current.filter((_, position) => position !== index))}>
              <XIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Group>
      ))}
      <div>
        <Button size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} disabled={free.length === 0} onClick={() => save([...current, { sheetId: free[0].value, multiplier: 1 }])}>
          Ajouter une fiche
        </Button>
      </div>
    </Stack>
  );
}
