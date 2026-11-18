import type { ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { BatchMultiSelect } from '../inputs/BatchMultiSelect';
import { EditableMultiSelect } from '../data-table/cells/EditableCells';
import type { StackedItem } from '../data-table/cells/StackedMultiCell';

/** Options of people, grouped by kind or not. */
type PeopleOptions = (ComboboxItem | { group: string; items: ComboboxItem[] })[];

interface PeopleSelectProps {
  label: string;
  /** Help under the field. Optional. */
  description?: string;
  /** Shown without anyone. Optional. Default = « Personne ». */
  placeholder?: string;
  data: PeopleOptions;
  value: string[];
  onChange: (value: string[]) => void;
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  nothingFoundMessage?: string;
  error?: ReactNode;
  disabled?: boolean;
}

/**
 * Field of a form choosing people (assignees, beneficiaries, whom a product is for…): the same multi-select
 * everywhere, searchable and clearable.
 * @param {PeopleSelectProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function PeopleSelect({ label, description, placeholder = 'Personne', data, value, onChange, renderOption, nothingFoundMessage, error, disabled }: PeopleSelectProps) {
  return (
    <BatchMultiSelect
      label={label}
      description={description}
      placeholder={value.length ? undefined : placeholder}
      data={data}
      renderOption={renderOption}
      value={value}
      onChange={onChange}
      searchable
      clearable
      error={error}
      disabled={disabled}
      nothingFoundMessage={nothingFoundMessage}
    />
  );
}

interface PeopleCellProps {
  label: string;
  data: PeopleOptions;
  value: string[];
  /** People shown (with their avatar…); default: the labels of the options. Optional. */
  items?: StackedItem[];
  renderOption?: (item: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  readOnly?: boolean;
  onSave: (value: string[]) => void;
}

/**
 * Cell of a table choosing people: one under the other, chosen in place, saved once the list closes.
 * @param {PeopleCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function PeopleCell({ label, data, value, items, renderOption, readOnly = false, onSave }: PeopleCellProps) {
  return <EditableMultiSelect label={label} value={value} data={data} items={items} renderOption={renderOption} readOnly={readOnly} onSave={onSave} />;
}
