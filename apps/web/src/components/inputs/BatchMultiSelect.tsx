// eslint-disable-next-line no-restricted-imports -- BatchMultiSelect wraps MultiSelect.
import { Anchor, MultiSelect, Pill, type ComboboxData, type ComboboxItem, type ComboboxItemGroup, type MultiSelectProps } from '@mantine/core';
import type { MouseEvent } from 'react';
import { MAX_STACKED, stackedCount } from '../data-table/cells/stacked';
import { ItemAvatar } from '../items/ItemAvatar';
import { hasAvatar } from '../items/item-look';
import { onMutationError } from '../../lib/notify';
import { CREATE_VALUE, keepCreate, withCreate } from './creatable';
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
 * opening: rows do not jump while checking). The values chosen show one under the other in the field: 5 at most;
 * beyond, 4 and « X de plus », unfolded or folded again.
 * @param {MultiSelectProps} props Props of Mantine's MultiSelect (value and onChange: the committed value).
 * @returns {JSX.Element} Multi-select.
 */
export function BatchMultiSelect({
  value,
  defaultValue,
  onChange,
  onDropdownOpen,
  onDropdownClose,
  data,
  classNames,
  onCreate,
  filter,
  ...props
}: MultiSelectProps & { onCreate?: (name: string) => Promise<string | null | undefined> }) {
  const [search, setSearch] = useState('');
  const [uncontrolled, setUncontrolled] = useState<string[]>(defaultValue ?? []);
  const committed = value ?? uncontrolled;
  const [draft, setDraft] = useState<string[] | null>(null);
  const draftRef = useRef<string[] | null>(null);
  // Selection the options are ordered by: the one of the opening, kept while the list is open.
  const [order, setOrder] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const shownValues = draft ?? committed;
  const shown = stackedCount(shownValues.length, expanded);

  /**
   * Unfolds or folds the values, without opening the list.
   * @param {MouseEvent} event Click.
   * @returns {void}
   */
  const toggle = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded((current) => !current);
  };
  const toggleButton = (
    <Anchor component="button" type="button" size="xs" className={classes.toggle} aria-expanded={expanded} onMouseDown={(event: MouseEvent) => event.preventDefault()} onClick={toggle}>
      {expanded ? 'Réduire' : `${shownValues.length - shown} de plus`}
    </Anchor>
  );

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
      data={onCreate ? withCreate(selectedFirst(data, order ?? committed), search) : selectedFirst(data, order ?? committed)}
      {...(onCreate && { searchable: true, searchValue: search, onSearchChange: setSearch, filter: keepCreate(filter) })}
      {...(!onCreate && filter && { filter })}
      classNames={{
        ...(typeof classNames === 'object' ? classNames : {}),
        pillsList: [classes.pillsList, typeof classNames === 'object' ? classNames.pillsList : undefined].filter(Boolean).join(' '),
        group: [classes.group, typeof classNames === 'object' ? classNames.group : undefined].filter(Boolean).join(' '),
      }}
      value={shownValues}
      renderPill={({ option, value: pill, onRemove, disabled }) => {
        const index = shownValues.indexOf(String(pill));
        const folded = shownValues.length > MAX_STACKED;
        // Beyond those shown: the first one hidden gives its place to « X de plus ».
        if (index >= shown) return index === shown ? toggleButton : null;
        const look = (option ?? {}) as { color?: string | null; iconUrl?: string | null; name?: string };
        return (
          <>
            <Pill withRemoveButton={!props.readOnly && !disabled && !option?.disabled} onRemove={onRemove} disabled={disabled} className={classes.pill}>
              {hasAvatar(look) && (
                <span className={classes.swatch}>
                  <ItemAvatar name={look.name ?? option?.label ?? ''} iconUrl={look.iconUrl} color={look.color} size={14} />
                </span>
              )}
              {option?.label ?? String(pill)}
            </Pill>
            {folded && expanded && index === shownValues.length - 1 && toggleButton}
          </>
        );
      }}
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
      onChange={(picked) => {
        // « Créer « … » »: the setting is made, then chosen with the others.
        let next = picked;
        if (onCreate && picked.includes(CREATE_VALUE)) {
          next = picked.filter((item) => item !== CREATE_VALUE);
          const name = search.trim();
          setSearch('');
          onCreate(name)
            .then((id) => {
              if (!id) return;
              const base = draftRef.current ?? committed;
              if (draftRef.current) {
                draftRef.current = [...base, id];
                setDraft(draftRef.current);
              } else commit([...base, id]);
            })
            .catch(onMutationError);
        }
        if (draftRef.current) {
          draftRef.current = next;
          setDraft(next);
        } else commit(next);
      }}
    />
  );
}
