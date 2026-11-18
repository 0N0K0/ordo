import type { ComboboxItem, ComboboxLikeRenderOptionInput } from '@mantine/core';
import type { ReactNode } from 'react';
import { BatchMultiSelect } from '../inputs/BatchMultiSelect';

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
