import { Group, TextInput } from '@mantine/core';
import { ITEM_LINKS_MAX, type ItemLink } from '@ordo/shared';
import { LinkIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { AddItemButton } from '../actions/AddItemButton';
import { RemoveButton } from '../actions/RemoveButton';
import { LabeledField } from './LabeledField';

/** Form of an item with links (event, task, routine), as `useAppForm` gives it. */
interface LinksForm {
  values: { links?: ItemLink[] };
  errors: Record<string, ReactNode>;
  /** Props of the input of a link: value, change, error, blur (validation of the form). */
  getInputProps: (path: `links.${number}.${keyof ItemLink}`) => object;
  setFieldValue: (path: 'links', value: ItemLink[]) => void;
}

/**
 * Links of an item (event, task, routine), the same everywhere: an address (http or https) and an optional label
 * each, added and removed one by one, `ITEM_LINKS_MAX` at most (`itemLinksSchema` checks them).
 * @param {{ form: LinksForm }} props Form of the item (its `links` field).
 * @returns {JSX.Element} Field.
 */
export function LinksField({ form }: { form: LinksForm }) {
  const value = form.values.links ?? [];
  /**
   * Puts new links in the form.
   * @param {ItemLink[]} links Links.
   * @returns {void}
   */
  const onChange = (links: ItemLink[]) => form.setFieldValue('links', links);
  return (
    <LabeledField label="Liens" error={form.errors.links}>
      {value.map((_, index) => (
        <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
          <TextInput aria-label={`Adresse du lien ${index + 1}`} placeholder="https://…" leftSection={<LinkIcon aria-hidden />} style={{ flex: 2 }} {...form.getInputProps(`links.${index}.url`)} />
          {/* eslint-disable-next-line no-restricted-syntax -- LinksField itself. */}
          <TextInput aria-label={`Libellé du lien ${index + 1}`} placeholder="Libellé (facultatif)" style={{ flex: 1 }} {...form.getInputProps(`links.${index}.label`)} />
          <RemoveButton label="Retirer" mt={4} aria-label={`Retirer le lien ${index + 1}`} onClick={() => onChange(value.filter((__, position) => position !== index))} />
        </Group>
      ))}
      {/* eslint-disable-next-line no-restricted-syntax -- LinksField itself. */}
      <AddItemButton disabled={value.length >= ITEM_LINKS_MAX} onClick={() => onChange([...value, { url: '', label: '' }])}>
        Ajouter un lien
      </AddItemButton>
    </LabeledField>
  );
}
