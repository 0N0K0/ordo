import { Select, type SelectProps } from '@mantine/core';
import { useState } from 'react';
import { notifyError } from '../lib/notify';
import { CREATE_VALUE, keepCreate, withCreate } from './creatable';

interface CreatableSelectProps extends SelectProps {
  /** Creates a choice named as typed (a setting: category, store…), resolving its value. Optional: without, a plain select. */
  onCreate?: (name: string) => Promise<string | null | undefined>;
}

/**
 * Select of a setting (category, store, unit…) that also creates what is typed: « Créer « … » » when it is none of the
 * choices; the new choice is then picked.
 * @param {CreatableSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function CreatableSelect({ onCreate, data, onChange, filter, searchable, ...props }: CreatableSelectProps) {
  const [search, setSearch] = useState('');
  if (!onCreate) return <Select data={data} onChange={onChange} filter={filter} searchable={searchable} {...props} />;
  return (
    <Select
      {...props}
      searchable
      data={withCreate(data, search)}
      filter={keepCreate(filter)}
      searchValue={search}
      onSearchChange={setSearch}
      onChange={(value, option) => {
        if (value !== CREATE_VALUE) return onChange?.(value, option);
        const name = search.trim();
        onCreate(name)
          .then((id) => id && onChange?.(id, { value: id, label: name }))
          .catch((error: Error) => notifyError(error.message));
      }}
    />
  );
}
