import { categoryOptions, categoryTree } from '../../../components/tree/category-tree';
import { ActionIcon, Select, Tooltip } from '@mantine/core';
import { PeopleCell as SharedPeopleCell } from '../../../components/people/PeopleSelect';
import { localToday } from '../../../lib/dates';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { listSelectProps } from '../../../components/settings/item-look';
import { DatePickerInput } from '@mantine/dates';
import { type ReactNode } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { StackedMultiCell } from '../../../components/data-table/cells/StackedMultiCell';
import { useShoppingData, type ShoppingCategory, type ShoppingStorage, type ShoppingStore } from '../api';
import { EditableSelect } from '../../../components/data-table/cells/EditableCells';
import { rowPeopleKeys, rowPeopleOf, unitOptions, usePeople } from '../lib/shopping-format';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { cellCombobox, cellField, cellMulti } from '../../../components/data-table/cells/cell-field';
import { unarchived, unarchivedOffered } from '../../../lib/archive';

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
  const current = stores.find((store) => store.id === value);
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      placeholder={readOnly ? undefined : '—'}
      readOnly={readOnly}
      clearable={!readOnly}
      searchable
      {...listSelectProps(stores, undefined, value)}
      leftSection={current ? <ItemAvatar name={current.name} iconUrl={current.iconUrl} color={current.color} /> : undefined}
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
    <SharedPeopleCell
      label={label}
      readOnly={readOnly}
      value={value}
      items={value.flatMap((key) => (people.byKey.has(key) ? [{ id: key, label: people.byKey.get(key)! }] : []))}
      data={people.options}
      onSave={(keys) => onSave(rowPeopleOf(keys))}
    />
  );
}

/** Value of the conservation cell for a perishable row without storage mode. */
const PERISHABLE = 'perishable';
/** Value of the conservation cell for a row that is not perishable. */
const LASTING = 'lasting';

interface ConservationCellProps {
  perishable: boolean;
  storageId: string | null;
  storages: ShoppingStorage[];
  label: string;
  readOnly?: boolean;
  onSave: (conservation: { perishable: boolean; storageId: string | null }) => void;
}

/**
 * Conservation cell: not perishable, perishable, or perishable in one of the storage modes of the settings.
 * @param {ConservationCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ConservationCell({ perishable, storageId, storages, label, readOnly = false, onSave }: ConservationCellProps) {
  const value = !perishable ? LASTING : (storageId ?? PERISHABLE);
  const current = perishable ? storages.find((storage) => storage.id === storageId) : undefined;
  const storageLook = listSelectProps(storages, undefined, storageId);
  return (
    <Select
      {...cellCombobox}
      aria-label={label}
      readOnly={readOnly}
      allowDeselect={false}
      data={[
        { value: LASTING, label: 'Non périssable' },
        { value: PERISHABLE, label: 'Périssable' },
        ...(storageLook.data.length ? [{ group: 'Périssable, à conserver', items: storageLook.data }] : []),
      ]}
      renderOption={storageLook.renderOption}
      leftSection={current ? <ItemAvatar name={current.name} iconUrl={current.iconUrl} color={current.color} /> : undefined}
      value={value}
      onChange={(next) => {
        if (!next || next === value) return;
        onSave(next === LASTING ? { perishable: false, storageId: null } : { perishable: true, storageId: next === PERISHABLE ? null : next });
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
      leftSection={placed ? <ItemAvatar name={placed.category.name} iconUrl={placed.category.iconUrl} color={placed.color} /> : undefined}
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
  return (
    <StackedMultiCell
      label={label}
      readOnly={readOnly}
      items={items}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={label}
          data={options}
          searchable
          nothingFoundMessage="Aucune tâche"
          value={value}
          onChange={onSave}
          onDropdownClose={onDropdownClose}
          placeholder={value.length ? undefined : '—'}
        />
      )}
    />
  );
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
 * State of a row that a click switches (missing, bought): an icon button, coloured when on, grey when off, unlike the
 * check boxes selecting rows; part of the bulk selection of its column like any cell.
 * @param {ToggleCellProps} props Component props.
 * @returns {JSX.Element} Toggle.
 */
export function ToggleCell({ on, label, hint, icon, color, readOnly = false, onSave }: ToggleCellProps) {
  return (
    <Tooltip label={hint} withinPortal>
      <ActionIcon variant={on ? 'filled' : 'subtle'} color={on ? color : 'gray'} radius="xl" aria-label={label} aria-pressed={on} disabled={readOnly} onClick={() => onSave(!on)}>
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
