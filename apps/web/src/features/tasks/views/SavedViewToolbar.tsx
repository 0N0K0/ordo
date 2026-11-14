import { Select } from '@mantine/core';
import type { FilterGroupOf } from '@ordo/shared';
import type { ReactNode } from 'react';
import { TableOptions, TableToolbar, ToolbarFilter, ToolbarSort } from '../../../components/data-table/TableToolbar';
import { FieldsFilterBuilder, type FilterFields } from './FilterBuilder';
import { countConditions } from './filter-meta';
import { SortPanel } from './ViewToolbar';

/** What the toolbar edits of a view configuration. */
export interface ToolbarConfig<F extends string, K extends string, G extends string> {
  filter: FilterGroupOf<F>;
  search: string;
  sorting: { id: K; desc: boolean }[];
  groupBy: G | null;
}

interface SavedViewToolbarProps<F extends string, K extends string, G extends string, C extends ToolbarConfig<F, K, G>> {
  config: C;
  change: (change: (config: C) => C) => void;
  fields: FilterFields<F>;
  /** Placeholder of the search. */
  searchLabel: string;
  sortKeys: readonly K[];
  sortLabels: Record<K, string>;
  /** What the order without sort is. */
  manualText: string;
  groupBy: readonly G[];
  groupLabels: Record<G, string>;
  /** More options, under the groups. Optional. */
  options?: ReactNode;
  /** Columns panel of the table. Optional. */
  columns?: ReactNode;
  /** Export buttons. Optional. */
  exports?: ReactNode;
  /** Filter popover state, when also opened from the column menus. Optional. */
  filterOpened?: boolean;
  onFilterOpenedChange?: (opened: boolean) => void;
  dirty: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/**
 * Tools of a saved view (routines, shopping lists…), the toolbar of every table as on the tasks: quick search, filters
 * (conditions and groups), multi-sort, and the options (saving the changes, groups, more options, columns).
 * @param {SavedViewToolbarProps<F, K, G, C>} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function SavedViewToolbar<F extends string, K extends string, G extends string, C extends ToolbarConfig<F, K, G>>({
  config,
  change,
  fields,
  searchLabel,
  sortKeys,
  sortLabels,
  manualText,
  groupBy,
  groupLabels,
  options,
  columns,
  exports,
  filterOpened,
  onFilterOpenedChange,
  dirty,
  onSave,
  onRevert,
}: SavedViewToolbarProps<F, K, G, C>) {
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <TableToolbar
      search={{ value: config.search, onChange: (search) => change((current) => ({ ...current, search })), placeholder: searchLabel }}
      options={
        <TableOptions
          dirty={dirty}
          onSave={onSave}
          onRevert={onRevert}
          width={320}
          columns={columns}
          exports={exports}
          display={
            <>
              <Select
                label="Grouper par"
                placeholder="Aucun groupe"
                data={groupBy.map((value) => ({ value, label: groupLabels[value] }))}
                value={config.groupBy}
                onChange={(value) => change((current) => ({ ...current, groupBy: (value as G | null) ?? null }))}
                clearable
                comboboxProps={inPanel}
              />
              {options}
            </>
          }
        />
      }
    >
      <ToolbarFilter count={countConditions(config.filter)} opened={filterOpened} onOpenedChange={onFilterOpenedChange}>
        <FieldsFilterBuilder filter={config.filter} fields={fields} onChange={(filter) => change((current) => ({ ...current, filter }))} />
      </ToolbarFilter>
      <ToolbarSort count={config.sorting.length}>
        <SortPanel sorting={config.sorting} onChange={(sorting) => change((current) => ({ ...current, sorting }))} keys={sortKeys} labels={sortLabels} manualText={manualText} />
      </ToolbarSort>
    </TableToolbar>
  );
}
