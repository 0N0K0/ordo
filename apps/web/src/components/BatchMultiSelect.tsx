import { MultiSelect, type ComboboxData, type ComboboxItem, type ComboboxItemGroup, type MultiSelectProps } from '@mantine/core';
import { useRef, useState } from 'react';
import classes from './BatchMultiSelect.module.css';

/**
 * Same values, whatever their order.
 * @param {string[]} a Values.
 * @param {string[]} b Values.
 * @returns {boolean} Same.
 */
const sameValues = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

type Option = string | ComboboxItem;

/**
 * Value of an option.
 * @param {Option} option Option.
 * @returns {string} Value.
 */
const valueOf = (option: Option) => (typeof option === 'string' ? option : option.value);

/**
 * Options with the selected ones first, in their own group, the others after (in their groups, or in one), a line
 * between the groups; the options of a tree (treeSelectProps) stay in tree order.
 * @param {ComboboxData | undefined} data Options.
 * @param {string[]} selected Values selected.
 * @returns {ComboboxData | undefined} Options.
 */
function selectedFirst(data: ComboboxData | undefined, selected: string[]): ComboboxData | undefined {
  if (!data || selected.length === 0) return data;
  const list = data as (Option | ComboboxItemGroup<Option>)[];
  // A tree keeps its order: its options only make sense under their parents.
  if (list.some((item) => typeof item === 'object' && 'depth' in item)) return data;
  const isGroup = (item: Option | ComboboxItemGroup<Option>): item is ComboboxItemGroup<Option> => typeof item === 'object' && 'group' in item;
  if (list.some(isGroup)) {
    const picked: Option[] = [];
    const rest = list.map((item) => {
      if (!isGroup(item)) return item;
      const items = item.items.filter((option) => (selected.includes(valueOf(option)) ? (picked.push(option), false) : true));
      return { ...item, items };
    });
    return [{ group: 'Sélectionnés', items: picked }, ...rest.filter((item) => !isGroup(item) || item.items.length > 0)] as ComboboxData;
  }
  const options = list as Option[];
  const others = options.filter((option) => !selected.includes(valueOf(option)));
  return [{ group: 'Sélectionnés', items: options.filter((option) => selected.includes(valueOf(option))) }, ...(others.length ? [{ group: 'Autres', items: others }] : [])] as ComboboxData;
}

/**
 * Multi-select checking several options in one go: while its list is open, the choices are a draft, given (once) when
 * it closes; a pill removed with the list closed is given at once. Saving on each choice would redraw what holds it
 * (a table row) and close the list after every click. The options already selected come first (in the order of the
 * opening: rows do not jump while checking), and the pills stay on one line.
 * @param {MultiSelectProps} props Props of Mantine's MultiSelect (value and onChange: the committed value).
 * @returns {JSX.Element} Multi-select.
 */
export function BatchMultiSelect({ value, defaultValue, onChange, onDropdownOpen, onDropdownClose, data, classNames, ...props }: MultiSelectProps) {
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue ?? []);
  const committed = value ?? uncontrolled;
  const [draft, setDraft] = useState<string[] | null>(null);
  const draftRef = useRef<string[] | null>(null);
  // Selection the options are ordered by: the one of the opening, kept while the list is open.
  const [order, setOrder] = useState<string[] | null>(null);

  /**
   * Gives the value chosen, when it changed.
   * @param {string[]} next Value.
   * @returns {void}
   */
  const commit = (next: string[]) => {
    if (sameValues(next, committed)) return;
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  };

  return (
    <MultiSelect
      {...props}
      data={selectedFirst(data, order ?? committed)}
      classNames={{
        ...(typeof classNames === 'object' ? classNames : {}),
        pillsList: [classes.pillsList, typeof classNames === 'object' ? classNames.pillsList : undefined].filter(Boolean).join(' '),
        group: [classes.group, typeof classNames === 'object' ? classNames.group : undefined].filter(Boolean).join(' '),
      }}
      value={draft ?? committed}
      onDropdownOpen={() => {
        draftRef.current = committed;
        setDraft(committed);
        setOrder(committed);
        onDropdownOpen?.();
      }}
      onDropdownClose={() => {
        const next = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        setOrder(null);
        if (next) commit(next);
        onDropdownClose?.();
      }}
      onChange={(next) => {
        if (draftRef.current) {
          draftRef.current = next;
          setDraft(next);
        } else commit(next);
      }}
    />
  );
}
