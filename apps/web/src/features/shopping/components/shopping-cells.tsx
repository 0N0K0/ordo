import { StateSwitch } from '../../../components/inputs/StateSwitch';
import { categoryOptions, categoryTree } from '../../../components/tree/category-tree';
import { Select } from '@mantine/core';
import { localToday } from '../../../lib/dates';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { listSelectProps, itemSelectProps, chosenAvatar } from '../../../components/items/item-look';
import { DatePickerInput } from '@mantine/dates';
import { type ReactNode } from 'react';

import { useShoppingData, type ShoppingCategory, type ShoppingStorage, type ShoppingStore } from '../api';
import { EditableMultiSelect, EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { rowPeopleKeys, rowPeopleOf, unitOptions, usePeople } from '../lib/shopping-format';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { cellCombobox, cellField } from '../../../components/data-table/cells/cell-field';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { conservationKey, conservationOf, NOT_PERISHABLE, PERISHABLE, type Conservation } from '../lib/conservation';

interface UnitCellProps {
  value: string | null;
  label: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Unit cell: one of the units of the shopping settings, archived ones apart (the current one stays offered).
 * @param {UnitCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function UnitCell({ value, label, readOnly = false, onSave }: UnitCellProps) {
  const { data } = useShoppingData();
  return (
    <EditableSelect
      label={label}
      value={value}
      nullable
      readOnly={readOnly}
      data={unitOptions(unarchived(data?.shoppingUnits ?? []), value).map((unit) => ({ value: unit, label: unit }))}
      onSave={onSave}
    />
  );
}

interface StoreCellProps {
  value: string | null;
  stores: ShoppingStore[];
  label: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Store cell: one of the stores of the settings, or none.
 * @param {StoreCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function StoreCell({ value, stores, label, readOnly = false, onSave }: StoreCellProps) {
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={!readOnly}
      searchable
      {...itemSelectProps(stores, value)}
      nothingFoundMessage="Aucun magasin (ajoutez-en dans les paramètres)"
      value={value}
      onChange={(storeId) => storeId !== value && onSave(storeId)}
    />
  );
}

interface PeopleCellProps {
  memberIds: string[];
  relationIds: string[];
  label: string;
  readOnly?: boolean;
  onSave: (people: { memberIds: string[]; relationIds: string[] }) => void;
}

/**
 * "Pour" cell: contributors and relations the row is for (saved when the list closes).
 * @param {PeopleCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PeopleCell({ memberIds, relationIds, label, readOnly = false, onSave }: PeopleCellProps) {
  const people = usePeople();
  const value = rowPeopleKeys({ memberIds, relationIds });
  return (
    <EditableMultiSelect
      label={label}
      readOnly={readOnly}
      value={value}
      items={value.flatMap((key) => (people.byKey.has(key) ? [{ id: key, label: people.byKey.get(key)! }] : []))}
      data={people.optionsFor(relationIds)}
      onSave={(keys) => onSave(rowPeopleOf(keys))}
    />
  );
}

interface ConservationCellProps {
  perishable: boolean;
  storageId: string | null;
  storages: ShoppingStorage[];
  label: string;
  readOnly?: boolean;
  onSave: (conservation: Conservation) => void;
}

/**
 * Conservation cell: not perishable, perishable, or perishable in one of the storage modes of the settings.
 * @param {ConservationCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ConservationCell({ perishable, storageId, storages, label, readOnly = false, onSave }: ConservationCellProps) {
  const value = conservationKey({ perishable, storageId });
  const storageLook = listSelectProps(storages, undefined, storageId);
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      readOnly={readOnly}
      allowDeselect={false}
      data={[
        { value: NOT_PERISHABLE, label: 'Non périssable' },
        { value: PERISHABLE, label: 'Périssable' },
        ...(storageLook.data.length ? [{ group: 'Périssable, à conserver', items: storageLook.data }] : []),
      ]}
      renderOption={storageLook.renderOption}
      leftSection={perishable ? chosenAvatar(storages, storageId) : undefined}
      value={value}
      onChange={(next) => {
        if (!next || next === value) return;
        onSave(conservationOf(next));
      }}
      c={perishable ? undefined : 'dimmed'}
    />
  );
}

interface ExpiryCellProps {
  value: string | null;
  label: string;
  /** Not perishable: no date. */
  disabled?: boolean;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * "Best before" date cell of a perishable row, in red once past.
 * @param {ExpiryCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ExpiryCell({ value, label, disabled = false, readOnly = false, onSave }: ExpiryCellProps) {
  if (disabled) return null;
  const expired = Boolean(value) && (value ?? '') < localToday();
  return (
    <DatePickerInput
      {...cellField}
      aria-label={label}
      value={value}
      readOnly={readOnly}
      clearable={!readOnly}
      placeholder={readOnly ? undefined : '—'}
      popoverProps={{ withinPortal: true }}
      onChange={(date) => date !== value && onSave(date)}
      c={expired ? 'red' : undefined}
      fw={expired ? 600 : undefined}
      title={expired ? 'Date dépassée' : undefined}
    />
  );
}

interface CategoryCellProps {
  value: string | null;
  /** Categories offered (those of the base list in a base list). */
  categories: ShoppingCategory[];
  label: string;
  readOnly?: boolean;
  onSave: (value: string | null) => void;
}

/**
 * Category cell (shown when the rows are grouped by store): one of the categories, sub-categories indented, or none.
 * @param {CategoryCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function CategoryCell({ value, categories, label, readOnly = false, onSave }: CategoryCellProps) {
  const placed = value ? categoryTree(categories).find((item) => item.category.id === value) : undefined;
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={!readOnly}
      searchable
      {...treeSelectProps(categoryOptions(categories, undefined, unarchivedOffered(categories, value)))}
      leftSection={placed ? <ItemAvatar name={placed.category.label} iconUrl={placed.category.iconUrl} color={placed.color} /> : undefined}
      nothingFoundMessage="Aucune catégorie (ajoutez-en dans les paramètres)"
      value={value}
      onChange={(categoryId) => categoryId !== value && onSave(categoryId)}
    />
  );
}

/**
 * Tasks of a list, one under the other (3 at most, the others behind « X de plus »); a click opens their multi-select.
 * @param {object} props Component props.
 * @param {string} props.label Accessible name of the cell.
 * @param {{ id: string, label: string }[]} props.items Tasks of the list, labelled.
 * @param {{ value: string, label: string }[]} props.options Tasks that can be chosen.
 * @param {string[]} props.value Tasks of the list.
 * @param {(taskIds: string[]) => void} props.onSave Saves the tasks chosen.
 * @param {boolean} [props.readOnly] Not editable. Optional.
 * @returns {JSX.Element} Cell.
 */
export function TasksCell({
  label,
  items,
  options,
  value,
  onSave,
  readOnly = false,
}: {
  label: string;
  items: { id: string; label: string }[];
  options: { value: string; label: string }[];
  value: string[];
  onSave: (taskIds: string[]) => void;
  readOnly?: boolean;
}) {
  return <EditableMultiSelect label={label} readOnly={readOnly} items={items} data={options} nothingFoundMessage="Aucune tâche" value={value} onSave={onSave} />;
}

interface ToggleCellProps {
  on: boolean;
  /** Accessible name: what it tells (« Lait manque »). */
  label: string;
  /** Tooltip: what it is and what a click does. */
  hint: string;
  icon: ReactNode;
  /** Color when on. */
  color: string;
  readOnly?: boolean;
  onSave: (on: boolean) => void;
}

/**
 * State of a row that a click switches (missing, bought): a switch, coloured with its icon when on, unlike the check
 * boxes selecting rows; part of the bulk selection of its column like any cell.
 * @param {ToggleCellProps} props Component props.
 * @returns {JSX.Element} Switch.
 */
export function ToggleCell({ on, label, hint, icon, color, readOnly = false, onSave }: ToggleCellProps) {
  return <StateSwitch label={label} hint={hint} checked={on} color={color} icon={icon} disabled={readOnly} onChange={onSave} />;
}
