import { LabeledField } from '../../../components/inputs/LabeledField';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { Group, Select, Text } from '@mantine/core';
import { sheetLinksFormSchema } from '@ordo/shared';

import { useAppForm, useFieldSave } from '../../../lib/form';
import { useSheetLinks, useSheetMutations, useSheets, type SheetOwner } from '../api';
import { MultiplierInput } from './MultiplierInput';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { unarchived, archivedIds } from '../../../lib/archive';

/** A sheet of the owner as its panel edits it: the multiplier being typed may be empty. */
interface LinkValue {
  sheetId: string;
  multiplier: number | '';
}

/** Sheets of the owner, as the panel edits them. */
interface LinksValues extends Record<string, unknown> {
  links: LinkValue[];
}

/**
 * Sheets of a routine, an event or a task, each times a multiplier, saved as they change: each occurrence (or the
 * task) gets a checklist made of them. Shown once its sheets are loaded.
 * @param {{ owner: SheetOwner }} props Routine, event or task.
 * @returns {JSX.Element | null} Field.
 */
export function SheetLinksField({ owner }: { owner: SheetOwner }) {
  const { data: links } = useSheetLinks(owner);
  if (!links) return null;
  return <SheetLinksForm owner={owner} links={links.map((link) => ({ sheetId: link.sheetId, multiplier: link.multiplier }))} />;
}

/**
 * Sheets of an owner, saved field by field (decision D22, `useFieldSave`): a sheet chosen, added or removed at once,
 * a multiplier on leaving it (and when the panel closes while it is typed, decision FJ); the sheets of the cache
 * followed.
 * @param {{ owner: SheetOwner, links: LinkValue[] }} props Owner and its sheets, as the cache holds them now.
 * @returns {JSX.Element} Field.
 */
function SheetLinksForm({ owner, links }: { owner: SheetOwner; links: LinkValue[] }) {
  const { data: sheets } = useSheets();
  const { setLinks } = useSheetMutations();
  const base = useAppForm<LinksValues>({ initialValues: { links }, schema: sheetLinksFormSchema });
  const { form, commit } = useFieldSave(base, {
    save: (_changes, values) => setLinks.mutateAsync({ owner, links: values.links.map((link) => ({ sheetId: link.sheetId, multiplier: Number(link.multiplier) })) }),
    schema: sheetLinksFormSchema,
    saved: { links },
    onBlur: ['links'],
  });
  const current = form.values.links;
  /**
   * Changes the sheets and saves them at once (a sheet chosen, added or removed).
   * @param {LinkValue[]} next Sheets.
   * @returns {void}
   */
  const change = (next: LinkValue[]) => {
    form.setFieldValue('links', next);
    commit(['links']);
  };
  // The archived sheets are not offered (those linked already stay).
  const options = unarchived(
    sheets ?? [],
    current.map((link) => link.sheetId),
  ).map((sheet) => ({ value: sheet.id, label: sheet.label }));
  const archived = archivedIds(sheets);
  const free = options.filter((option) => !archived.has(option.value) && !current.some((link) => link.sheetId === option.value));
  return (
    <LabeledField label="Fiches">
      <Text size="xs" c="dimmed">
        Chaque occurrence a sa liste à cocher, faite de ces fiches à son ouverture (modifiable ensuite).
      </Text>
      {current.map((link, index) => (
        <Group key={link.sheetId} gap="xs" wrap="nowrap" align="flex-start">
          <Select
            size="xs"
            style={{ flex: 1 }}
            aria-label={`Fiche ${index + 1}`}
            allowDeselect={false}
            data={options.filter((option) => option.value === link.sheetId || free.includes(option))}
            value={link.sheetId}
            onChange={(sheetId) => sheetId && change(current.map((other, position) => (position === index ? { ...other, sheetId } : other)))}
          />
          <MultiplierInput size="xs" w={90} aria-label={`Fois, fiche ${index + 1}`} {...form.getInputProps(`links.${index}.multiplier`)} />
          <RemoveButton label="Retirer" aria-label={`Retirer la fiche ${index + 1}`} onClick={() => change(current.filter((_, position) => position !== index))} />
        </Group>
      ))}
      <AddItemButton disabled={free.length === 0} onClick={() => change([...current, { sheetId: free[0].value, multiplier: 1 }])}>
        Ajouter une fiche
      </AddItemButton>
    </LabeledField>
  );
}
