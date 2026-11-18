import { Group, Text, type ComboboxItem, type ComboboxLikeRenderOptionInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { unarchived } from '../../lib/archive';
import { ItemAvatar } from './ItemAvatar';

/**
 * Whether an option shows an avatar: it has a color or an image (the items of the settings lists, projects…).
 * @param {{ color?: string | null, iconUrl?: string | null }} option Option.
 * @returns {boolean} With an avatar.
 */
export const hasAvatar = (option: { color?: string | null; iconUrl?: string | null }) => Boolean(option.color || option.iconUrl);

/** Option of an item of a settings list: its name, with its color and image for its avatar. */
interface ItemOption extends ComboboxItem {
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

/** Item of a flat settings list offered as an option. */
interface OptionItem {
  id: string;
  name: string;
  color?: string | null;
  iconUrl?: string | null;
  /** Archived: not offered, unless kept. Optional. */
  archived?: boolean | null;
}

/** Current value(s) of a field, offered even when archived. */
type KeptValues = string | readonly (string | null | undefined)[] | null | undefined;

/**
 * Options of the items of a flat settings list (a select, a column filter), each with its color and image for its
 * avatar; the archived items left out, except the current value(s).
 * @param {readonly OptionItem[]} items Items, in their order.
 * @param {(item: T) => string} [label] Label of an item. Optional. Default = its name.
 * @param {KeptValues} [keep] Current value(s), offered even when archived. Optional.
 * @returns {ItemOption[]} Options.
 */
export function itemOptions<T extends OptionItem>(items: readonly T[], label: (item: T) => string = (item) => item.name, keep?: KeptValues): ItemOption[] {
  return unarchived(items, keep).map((item) => ({ value: item.id, label: label(item), color: item.color ?? 'gray', iconUrl: item.iconUrl }));
}

/**
 * Choices of a column filter on the items of a flat settings list: all of them (archived ones keep their labels in
 * groups and saved filters), the archived flagged so the filter offers them only while they are in it.
 * @param {readonly OptionItem[]} items Items, in their order.
 * @param {(item: T) => string} [label] Label of an item. Optional. Default = its name.
 * @returns {(ItemOption & { archived?: boolean })[]} Choices.
 */
export function itemChoices<T extends OptionItem>(items: readonly T[], label: (item: T) => string = (item) => item.name): (ItemOption & { archived?: boolean })[] {
  return items.map((item) => ({ value: item.id, label: label(item), color: item.color ?? 'gray', iconUrl: item.iconUrl, ...(item.archived && { archived: true }) }));
}

/**
 * Props of a Select or MultiSelect of the items of a flat settings list: each option with its avatar (its image, or
 * its initials on its color), as the chosen ones; the archived items left out, except the current value(s).
 * @param {readonly OptionItem[]} items Items, in their order.
 * @param {(item: T) => string} [label] Label of an item. Optional. Default = its name.
 * @param {KeptValues} [keep] Current value(s), offered even when archived. Optional.
 * @returns {{ data: ItemOption[], renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode }} Props.
 */
export function listSelectProps<T extends OptionItem>(
  items: readonly T[],
  label: (item: T) => string = (item) => item.name,
  keep?: KeptValues,
): { data: ItemOption[]; renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode } {
  const data = itemOptions(items, label, keep);
  return { data, renderOption: itemRenderOption(data) };
}
