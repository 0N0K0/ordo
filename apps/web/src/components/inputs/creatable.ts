import { normalize } from '@ordo/shared';
import type { ComboboxData, ComboboxItem, ComboboxItemGroup, ComboboxParsedItem, OptionsFilter } from '@mantine/core';

/** Value of the option creating what was typed. */
export const CREATE_VALUE = '__create__';

/**
 * Labels of the options of a select (flat, groups opened).
 * @param {ComboboxData | undefined} data Options.
 * @returns {string[]} Labels.
 */
function labelsOf(data: ComboboxData | undefined): string[] {
  return ((data ?? []) as (string | ComboboxItem | ComboboxItemGroup<string | ComboboxItem>)[]).flatMap((item) =>
    typeof item === 'string' ? [item] : 'group' in item ? item.items.map((option) => (typeof option === 'string' ? option : option.label)) : [item.label],
  );
}

/**
 * Options of a select that creates what is typed: those given, and « Créer « … » » when the text typed is none of
 * them (same name, whatever the case).
 * @param {ComboboxData | undefined} data Options.
 * @param {string} search Text typed.
 * @returns {ComboboxData | undefined} Options.
 */
export function withCreate(data: ComboboxData | undefined, search: string): ComboboxData | undefined {
  const typed = search.trim();
  if (!typed || labelsOf(data).some((label) => label.toLocaleLowerCase('fr') === typed.toLocaleLowerCase('fr'))) return data;
  return [...((data ?? []) as ComboboxItem[]), { value: CREATE_VALUE, label: `Créer « ${typed} »` }] as ComboboxData;
}

/**
 * Search of a select keeping the creating option whatever is typed.
 * @param {OptionsFilter | undefined} filter Search of the options (none: their labels containing the text).
 * @returns {OptionsFilter} Search.
 */
export const keepCreate =
  (filter: OptionsFilter | undefined): OptionsFilter =>
  (input) => {
    const isCreate = (option: ComboboxParsedItem) => 'value' in option && option.value === CREATE_VALUE;
    const options = input.options as ComboboxParsedItem[];
    const search = normalize(input.search.trim());
    const contains = (option: ComboboxItem) => normalize(option.label).includes(search);
    const others = options.filter((option) => !isCreate(option));
    const kept: ComboboxParsedItem[] = filter
      ? (filter({ ...input, options: others }) as ComboboxParsedItem[])
      : others.flatMap((option): ComboboxParsedItem[] => {
          if (!('group' in option)) return contains(option) ? [option] : [];
          const items = option.items.filter(contains);
          return items.length ? [{ ...option, items }] : [];
        });
    return [...kept, ...options.filter(isCreate)];
  };
