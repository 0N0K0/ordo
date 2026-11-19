import {
  legacyLabelColumn,
  tableViewConfig,
  tableViewConfigSchema,
  withFilterValues,
  withLabelColumn,
  type ColumnLayout,
  type LegacyFilterValues,
  type TableFilterGroup,
  type TableSort,
  type TableViewConfig,
} from '@ordo/shared';
import { useCallback, useState } from 'react';
import { useBulkSelection, type BulkCellProps, type BulkSelection } from '../selection/bulk-selection';
import { newConditionFor } from '../../filters/filter-meta';
import type { ColumnMenuExtras } from '../toolbar/ColumnHeaderMenu';
import { localToday } from '../../../lib/dates';
import { useSavedViews, type SavedViewsState } from './use-saved-views';
import { shownColumns, sortRows, type DataColumn, type ShownColumn } from '../table/data-table';
import { filterRows, groupRows, isGroupable, tableFilterFields, type RowGroup } from '../table/table-engine';
import { useArchivedToggle, type ArchivedToggle } from '../../../lib/archive';
import { ME_KEY } from '../../people/people-keys';

/** First view of a table: its label and what it starts with. */
export interface FirstTableView {
  label: string;
  config?: Partial<TableViewConfig>;
}

/**
 * Filter of a first view: the rows whose date field is within a period (« thisMonth », « lastYear »…).
 * @param {string} field Date field (its condition has the same id).
 * @param {string} period Period token.
 * @returns {TableFilterGroup} Filter.
 */
export const withinFilter = (field: string, period: string): TableFilterGroup => conditionFilter(field, 'within', period);

/**
 * Filter of a first view made of one condition (« closed is false », « state in OPEN »…).
 * @param {string} field Field (its condition has the same id unless `id` is given).
 * @param {string} operator Operator (`isFalse`, `in`, `within`…).
 * @param {string | number | string[] | null} [value] Value. Optional. Default = none (operators without a value).
 * @param {string} [id] Id of the condition. Optional. Default = the field.
 * @returns {TableFilterGroup} Filter.
 */
export const conditionFilter = (field: string, operator: string, value: string | number | string[] | null = null, id = field): TableFilterGroup => ({
  type: 'group',
  id: 'root',
  combinator: 'and',
  // eslint-disable-next-line no-restricted-syntax -- conditionFilter itself.
  children: [{ type: 'condition', id, field, operator, value }],
});

/** Rows checked of a table (their check boxes): every field of each edited at once. */
export interface RowSelection {
  isChecked: (key: string) => boolean;
  /** Checks or unchecks rows. */
  check: (keys: readonly string[], on: boolean) => void;
  /** Checks exactly these rows (none: unchecks all). */
  setChecked: (keys: readonly string[]) => void;
  /** Keys of the rows shown. */
  keys: readonly string[];
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
  /** Key of a row (that of the table): needed to edit cells in bulk. Optional. */
  getKey?: (row: R) => string;
  /** Cells of their own (out of the columns: a toggle before them…) also edited in bulk, with their name. Optional. */
  bulkColumns?: readonly { id: string; label: string }[];
  /** The row is archived: left out until « Afficher les archivés » is on (decision AH). Optional. */
  archived?: (row: R) => boolean;
  /** Label of that switch (« Afficher les archivées »). Optional. Default = « Afficher les archivés ». */
  archivedLabel?: string;
  /** The row is shown whatever the search and the filter (one being created…). Optional. */
  alwaysKept?: (row: R) => boolean;
  /** Its views, read before its rows (useTableViews). Optional. */
  views?: SavedViewsState<TableViewConfig>;
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
  /** « Afficher les archivés » switch of the table, when its rows can be archived (`ShowArchivedSwitch` props). */
  archivedToggle: (ArchivedToggle & { label?: string }) | null;
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
  /** Key of a row (none: no bulk editing). */
  keyOf: ((row: R) => string) | null;
  /** Cells selected in one column (among the rows kept), to edit them in bulk. */
  selection: BulkSelection | null;
  setSelection: (selection: BulkSelection | null) => void;
  /** Props of a cell: its place in the selection, and the clicks selecting it. */
  cellProps: (columnId: string, key: string) => BulkCellProps;
  /** Name of a column edited in bulk (its own cells included). */
  bulkLabel: (columnId: string) => string;
  /** Rows checked (their check boxes) to edit all their fields at once; null when nothing is edited in bulk. */
  rowSelection: RowSelection | null;
}

/** « Moi » and the everyday context of the budgets, once « none » in their filters, now ME_KEY. */
const BUDGET_KEY_VALUES: LegacyFilterValues = { who: { none: ME_KEY }, context: { none: ME_KEY } };

/** Old values of the choice filters that stored views may still hold, by table: the one alias map, read when a view is parsed. */
const LEGACY_FILTER_VALUES: Readonly<Record<string, LegacyFilterValues>> = {
  'treasury-budgets': BUDGET_KEY_VALUES,
  'treasury-budget-report': BUDGET_KEY_VALUES,
  'treasury-budget-outside': BUDGET_KEY_VALUES,
};

/**
 * Configuration of a stored view of a table (the defaults when it is invalid), the old id of its label column read as
 * `label` (decision BI) and the old values of its filters as the current ones.
 * @param {unknown} config Stored configuration.
 * @param {string} tableKey Table of the view.
 * @returns {TableViewConfig} Configuration.
 */
function parseConfig(config: unknown, tableKey: string): TableViewConfig {
  const result = tableViewConfigSchema.safeParse(withFilterValues(withLabelColumn(config, legacyLabelColumn(tableKey)), LEGACY_FILTER_VALUES[tableKey]));
  return result.success ? result.data : tableViewConfig();
}

/**
 * Saved views of a table (tabs, unsaved changes, default one), the first ones made once: what a table reads before its
 * rows when they depend on its view (the events listed with the tasks).
 * @param {{ tableKey: string, projectId?: string | null, first?: readonly FirstTableView[], defaults?: Partial<TableViewConfig>, ready?: boolean }} options Table, project of the views, first views, what every new view starts with (the columns chosen for the workspace…), whether it makes them.
 * @returns {SavedViewsState<TableViewConfig>} Views.
 */
export function useTableViews({
  tableKey,
  projectId = null,
  first,
  defaults,
  ready = true,
}: {
  tableKey: string;
  projectId?: string | null;
  first?: readonly FirstTableView[];
  defaults?: Partial<TableViewConfig>;
  ready?: boolean;
}) {
  const firstKey = JSON.stringify(first ?? null);
  const defaultsKey = JSON.stringify(defaults ?? {});
  // A new view: what the table starts with, then its own.
  const blank = useCallback(() => tableViewConfig(JSON.parse(defaultsKey) as Partial<TableViewConfig>), [defaultsKey]);
  // Stable while the first views do not change: the hook makes them once.
  const firstViews = useCallback(
    () =>
      ((JSON.parse(firstKey) as FirstTableView[] | null) ?? [{ label: 'Toutes' }]).map((view) => ({
        label: view.label,
        config: tableViewConfig({ ...(JSON.parse(defaultsKey) as Partial<TableViewConfig>), ...view.config }),
      })),
    [firstKey, defaultsKey],
  );
  const parse = useCallback((config: unknown) => parseConfig(config, tableKey), [tableKey]);
  return useSavedViews<TableViewConfig>({ projectId, kind: 'TABLE', tableKey, parse, blank, first: firstViews, ready, param: `${tableKey}-view` });
}

/**
 * Archived test of a table whose rows cannot be archived.
 * @returns {boolean} Never archived.
 */
const NEVER_ARCHIVED = (): boolean => false;

/**
 * Saved views of a table, as those of the tasks (tabs, unsaved changes, default one), and the current one applied to
 * its rows: search and filter on its columns, sorts, groups, columns shown, their order and widths.
 * @param {DataViewOptions<R>} options Table.
 * @returns {DataView<R>} View.
 */
export function useDataView<R>({
  tableKey,
  projectId = null,
  columns,
  rows,
  title,
  first,
  getKey,
  bulkColumns = [],
  archived,
  archivedLabel,
  alwaysKept,
  views: given,
}: DataViewOptions<R>): DataView<R> {
  // Its own views, unless read before by the table (useTableViews).
  const own = useTableViews({ tableKey, projectId, first, ready: !given });
  const views = given ?? own;
  const { config } = views;
  const layout = { columnOrder: config?.columnOrder ?? [], hiddenColumns: config?.hiddenColumns ?? [], columnSizing: config?.columnSizing ?? {} };
  const sorting = config?.sorting ?? [];
  // The archived rows, once asked.
  const { shown: pool, toggle } = useArchivedToggle(rows, archived ?? NEVER_ARCHIVED);
  const matched = config ? filterRows(pool, columns, config, localToday()) : [];
  const forced = alwaysKept ? new Set(matched) : null;
  const kept = config ? sortRows(forced ? pool.filter((row) => forced.has(row) || alwaysKept!(row)) : matched, sorting, columns) : [];
  const [filterOpened, setFilterOpened] = useState(false);
  const fields = tableFilterFields(columns);
  const groupColumn = (config?.groupBy && columns.find((column) => column.id === config.groupBy && isGroupable(column))) || null;
  const keys = getKey ? kept.map(getKey) : [];
  const bulk = useBulkSelection({ keys, isBulk: (id) => Boolean(getKey && (bulkColumns.some((column) => column.id === id) || columns.find((column) => column.id === id)?.bulk)) });
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
    archivedToggle: archived ? { ...toggle, label: archivedLabel } : null,
    groups: groupColumn ? groupRows(kept, groupColumn, sorting, config?.groupPeriod) : [{ key: '', label: '', rows: kept }],
    groupColumn,
    change: views.change,
    setLayout: (next) => views.change((current) => ({ ...current, ...next })),
    setSorting: (next) => views.change((current) => ({ ...current, sorting: next })),
    filterOpened,
    setFilterOpened,
    keyOf: getKey ?? null,
    selection: bulk.selection,
    setSelection: bulk.setSelection,
    cellProps: bulk.cellProps,
    rowSelection: getKey && (bulkColumns.length > 0 || columns.some((column) => column.bulk)) ? { isChecked: bulk.isChecked, check: bulk.check, setChecked: bulk.setChecked, keys: bulk.keys } : null,
    bulkLabel: (id) => bulkColumns.find((column) => column.id === id)?.label ?? columns.find((column) => column.id === id)?.label ?? '',
    columnExtras: (id) => {
      const column = columns.find((item) => item.id === id);
      return {
        onFilter:
          id in fields.kinds
            ? () => {
                views.change((current) => ({ ...current, filter: { ...current.filter, children: [...current.filter.children, newConditionFor(fields, id)] } }));
                setFilterOpened(true);
              }
            : undefined,
        group: column && isGroupable(column) ? { active: groupColumn?.id === id, onToggle: () => views.change((current) => ({ ...current, groupBy: current.groupBy === id ? null : id })) } : undefined,
        onSelect: column?.bulk && getKey ? () => bulk.selectColumn(id) : undefined,
      };
    },
  };
}
