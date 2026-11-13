import { tableViewConfig, tableViewConfigSchema, type ColumnLayout, type TableSort, type TableViewConfig } from '@ordo/shared';
import { useCallback, useState } from 'react';
import { newConditionFor } from '../../features/tasks/views/filter-meta';
import type { ColumnMenuExtras } from './ColumnHeaderMenu';
import { localToday } from '../../lib/dates';
import { useSavedViews, type SavedViewsState } from '../../features/tasks/views/use-saved-views';
import { shownColumns, sortRows, type DataColumn, type ShownColumn } from './data-table';
import { filterRows, groupRows, tableFilterFields, type RowGroup } from './table-engine';

/** First view of a table: its name and what it starts with. */
export interface FirstTableView {
  name: string;
  config?: Partial<TableViewConfig>;
}

interface DataViewOptions<R> {
  /** Name of the table (its views are its own). */
  tableKey: string;
  /** Project of the views (a project's tab), null for the page. Optional. Default = null. */
  projectId?: string | null;
  columns: readonly DataColumn<R>[];
  /** Every row, in their default order. */
  rows: readonly R[];
  /** Title of the exports. */
  title: string;
  /** Views made the first time the table is shown, the first one opened. Optional. Default = « Toutes ». */
  first?: readonly FirstTableView[];
}

/** Saved views of a table, the current one applied to its rows. */
export interface DataView<R> {
  tableKey: string;
  title: string;
  views: SavedViewsState<TableViewConfig>;
  /** Working configuration of the current view; null while the views load. */
  config: TableViewConfig | null;
  columns: readonly DataColumn<R>[];
  shown: ShownColumn<R>[];
  layout: ColumnLayout;
  sorting: TableSort[];
  /** Rows kept by the search and the filter, sorted. */
  rows: R[];
  /** Number of rows before the search and the filter. */
  total: number;
  /** Groups of the rows (one of every row, without heading, when not grouped). */
  groups: RowGroup<R>[];
  /** Column the rows are grouped by. */
  groupColumn: DataColumn<R> | null;
  change: (change: (config: TableViewConfig) => TableViewConfig) => void;
  setLayout: (layout: ColumnLayout) => void;
  setSorting: (sorting: TableSort[]) => void;
  /** Filter popover of the toolbar, also opened from the column menus. */
  filterOpened: boolean;
  setFilterOpened: (opened: boolean) => void;
  /** Filter and group actions of a column, in its menu. */
  columnExtras: (id: string) => ColumnMenuExtras;
}

/**
 * Configuration of a stored view (the defaults when it is invalid).
 * @param {unknown} config Stored configuration.
 * @returns {TableViewConfig} Configuration.
 */
function parseConfig(config: unknown): TableViewConfig {
  const result = tableViewConfigSchema.safeParse(config);
  return result.success ? result.data : tableViewConfig();
}

/**
 * Saved views of a table, as those of the tasks (tabs, unsaved changes, default one), and the current one applied to
 * its rows: search and filter on its columns, sorts, groups, columns shown, their order and widths.
 * @param {DataViewOptions<R>} options Table.
 * @returns {DataView<R>} View.
 */
export function useDataView<R>({ tableKey, projectId = null, columns, rows, title, first }: DataViewOptions<R>): DataView<R> {
  const firstKey = JSON.stringify(first ?? null);
  // Stable while the first views do not change: the hook makes them once.
  const firstViews = useCallback(
    () => ((JSON.parse(firstKey) as FirstTableView[] | null) ?? [{ name: 'Toutes' }]).map((view) => ({ name: view.name, config: tableViewConfig(view.config) })),
    [firstKey],
  );
  const views = useSavedViews<TableViewConfig>({ projectId, kind: 'TABLE', tableKey, parse: parseConfig, blank: tableViewConfig, first: firstViews, param: `${tableKey}-view` });
  const { config } = views;
  const layout = { columnOrder: config?.columnOrder ?? [], hiddenColumns: config?.hiddenColumns ?? [], columnSizing: config?.columnSizing ?? {} };
  const sorting = config?.sorting ?? [];
  const kept = config ? sortRows(filterRows(rows, columns, config, localToday()), sorting, columns) : [];
  const [filterOpened, setFilterOpened] = useState(false);
  const fields = tableFilterFields(columns);
  const groupColumn = (config?.groupBy && columns.find((column) => column.id === config.groupBy && column.groupable && column.text)) || null;
  return {
    tableKey,
    title,
    views,
    config,
    columns,
    shown: shownColumns(columns, layout),
    layout,
    sorting,
    rows: kept,
    total: rows.length,
    groups: groupColumn ? groupRows(kept, groupColumn, sorting) : [{ key: '', label: '', rows: kept }],
    groupColumn,
    change: views.change,
    setLayout: (next) => views.change((current) => ({ ...current, ...next })),
    setSorting: (next) => views.change((current) => ({ ...current, sorting: next })),
    filterOpened,
    setFilterOpened,
    columnExtras: (id) => {
      const column = columns.find((item) => item.id === id);
      return {
        onFilter:
          id in fields.kinds
            ? () => {
                views.change((current) => ({ ...current, filter: { ...current.filter, children: [...current.filter.children, newConditionFor(fields.kinds, id)] } }));
                setFilterOpened(true);
              }
            : undefined,
        group:
          column?.groupable && column.text ? { active: groupColumn?.id === id, onToggle: () => views.change((current) => ({ ...current, groupBy: current.groupBy === id ? null : id })) } : undefined,
      };
    },
  };
}
