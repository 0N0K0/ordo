import { Group, Text, type ComboboxItem, type ComboboxLikeRenderOptionInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { ItemAvatar } from './ItemAvatar';

/**
 * Whether an option shows an avatar: it has a color or an image (the items of the settings lists, projects…).
 * @param {{ color?: string | null, iconUrl?: string | null }} option Option.
 * @returns {boolean} With an avatar.
 */
export const hasAvatar = (option: { color?: string | null; iconUrl?: string | null }) => Boolean(option.color || option.iconUrl);

/** Option of an item of a settings list: its name, with its color and image for its avatar. */
export interface ItemOption extends ComboboxItem {
  color?: string | null;
  iconUrl?: string | null;
}

/**
 * Look of the options with an avatar (their image, or their initials on their color), the others by their label alone.
 * @param {readonly ItemOption[]} options Options.
 * @returns {(input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode} Render of an option.
 */
export function itemRenderOption(options: readonly ItemOption[]): (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode {
  const byValue = new Map(options.map((option) => [option.value, option]));
  return ({ option }) => {
    const item = byValue.get(option.value);
    return (
      <Group gap="xs" wrap="nowrap">
        {item && hasAvatar(item) && <ItemAvatar name={item.label} iconUrl={item.iconUrl} color={item.color} />}
        <Text size="sm" truncate>
          {option.label}
        </Text>
      </Group>
    );
  };
}

/**
 * Props of a Select or MultiSelect of the items of a flat settings list: each option with its avatar (its image, or
 * its initials on its color), as the chosen ones.
 * @param {readonly { id: string, name: string, color?: string | null, iconUrl?: string | null }[]} items Items, in their order.
 * @param {(item: T) => string} [label] Label of an item. Optional. Default = its name.
 * @returns {{ data: ItemOption[], renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode }} Props.
 */
export function listSelectProps<T extends { id: string; name: string; color?: string | null; iconUrl?: string | null }>(
  items: readonly T[],
  label: (item: T) => string = (item) => item.name,
): { data: ItemOption[]; renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode } {
  const data = items.map((item) => ({ value: item.id, label: label(item), color: item.color ?? 'gray', iconUrl: item.iconUrl }));
  return { data, renderOption: itemRenderOption(data) };
}
