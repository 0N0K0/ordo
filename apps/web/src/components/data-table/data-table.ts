import type { ColumnLayout, TableSort } from '@ordo/shared';

/** Choice of a column filtered by its values. */
export interface ColumnChoice {
  value: string;
  label: string;
}

/**
 * How a column is filtered: its kind and the value of a row (a text by default: the text of the column).
 * Dates are YYYY-MM-DD; a choice is one value of its options, several choices a list of them.
 */
export type ColumnFilter<R> =
  | { kind: 'text'; value?: (row: R) => string | null }
  | { kind: 'number'; value: (row: R) => number | null }
  | { kind: 'date'; value: (row: R) => string | null }
  | { kind: 'boolean'; value: (row: R) => boolean }
  | { kind: 'choice'; value: (row: R) => string | null; options: ColumnChoice[] }
  | { kind: 'choices'; value: (row: R) => string[]; options: ColumnChoice[] };

/** Column of a data table. */
export interface DataColumn<R> {
  id: string;
  label: string;
  /** Default width (px). */
  size: number;
  /** Always shown (cannot be hidden). Optional. */
  locked?: boolean;
  /** Hidden until shown. Optional. */
  hiddenByDefault?: boolean;
  /** Value the rows are sorted by; not sortable without. Optional. */
  sortValue?: (row: R) => string | number | null;
  /** Text right-aligned (amounts). Optional. */
  numeric?: boolean;
  /** Text of the cell: exported, searched, and the name of its group. Optional: without, the column is left out of them. */
  text?: (row: R) => string;
  /** How the column is filtered. Optional. Default = by its text (none without text); false: not filtered. */
  filter?: ColumnFilter<R> | false;
  /** The rows can be grouped by its values (its text, in the order of its sort value). Optional. Default = false. */
  groupable?: boolean;
}

/** Column shown, with its width. */
export interface ShownColumn<R> extends DataColumn<R> {
  width: number;
}

/** Widest and narrowest width of a column (as saved). */
export const MIN_WIDTH = 40;
export const MAX_WIDTH = 1200;

/**
 * Width clamped like the saved widths.
 * @param {number} width Width.
 * @returns {number} Clamped, rounded width.
 */
export const clampWidth = (width: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

/**
 * Full order of the columns: the saved one, then the columns it misses (added later), in their default order.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {ColumnLayout} layout Layout.
 * @returns {string[]} Column ids.
 */
export function columnOrder<R>(columns: readonly DataColumn<R>[], layout: ColumnLayout): string[] {
  const known = new Set(columns.map((column) => column.id));
  const saved = layout.columnOrder.filter((id) => known.has(id));
  return [...saved, ...columns.map((column) => column.id).filter((id) => !saved.includes(id))];
}

/**
 * Whether a column is hidden: hidden in the layout, or hidden by default until shown (then saved as shown).
 * @param {DataColumn<R>} column Column.
 * @param {ColumnLayout} layout Layout.
 * @returns {boolean} Hidden.
 */
export function isHidden<R>(column: DataColumn<R>, layout: ColumnLayout): boolean {
  if (column.locked) return false;
  if (layout.hiddenColumns.includes(column.id)) return true;
  return Boolean(column.hiddenByDefault) && !layout.columnOrder.includes(column.id);
}

/**
 * Columns shown, in their order, with their widths.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {ColumnLayout} layout Layout.
 * @returns {ShownColumn<R>[]} Columns.
 */
export function shownColumns<R>(columns: readonly DataColumn<R>[], layout: ColumnLayout): ShownColumn<R>[] {
  const byId = new Map(columns.map((column) => [column.id, column]));
  return columnOrder(columns, layout)
    .map((id) => byId.get(id)!)
    .filter((column) => !isHidden(column, layout))
    .map((column) => ({ ...column, width: layout.columnSizing[column.id] ?? column.size }));
}

/**
 * Layout with a column hidden or shown (a column hidden by default, once shown, is saved in the order).
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {ColumnLayout} layout Layout.
 * @param {string} id Column.
 * @param {boolean} visible Shown.
 * @returns {ColumnLayout} Layout.
 */
export function withVisibility<R>(columns: readonly DataColumn<R>[], layout: ColumnLayout, id: string, visible: boolean): ColumnLayout {
  // The order is saved whole: the columns hidden by default, not shown yet, are saved as hidden.
  const hidden = hiddenIds(columns, layout);
  return {
    ...layout,
    columnOrder: columnOrder(columns, layout),
    hiddenColumns: visible ? hidden.filter((item) => item !== id) : [...new Set([...hidden, id])],
  };
}

/**
 * Layout with the columns in a new order (the columns hidden by default, not shown yet, stay hidden).
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {ColumnLayout} layout Layout.
 * @param {string[]} order Every column id, in its new order.
 * @returns {ColumnLayout} Layout.
 */
export function withOrder<R>(columns: readonly DataColumn<R>[], layout: ColumnLayout, order: string[]): ColumnLayout {
  return { ...layout, columnOrder: order, hiddenColumns: hiddenIds(columns, layout) };
}

/**
 * Hidden columns of a layout once its order is saved: the columns hidden by default that are not shown yet.
 * @param {readonly DataColumn<R>[]} columns Columns.
 * @param {ColumnLayout} layout Layout.
 * @returns {string[]} Hidden ids.
 */
export function hiddenIds<R>(columns: readonly DataColumn<R>[], layout: ColumnLayout): string[] {
  return columns.filter((column) => isHidden(column, layout)).map((column) => column.id);
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Rows sorted by the sorts of a table (in priority order, empty values last), else left in their order.
 * @param {readonly R[]} rows Rows.
 * @param {readonly TableSort[]} sorting Sorts.
 * @param {readonly DataColumn<R>[]} columns Columns (their sort values).
 * @returns {R[]} Sorted copy.
 */
export function sortRows<R>(rows: readonly R[], sorting: readonly TableSort[], columns: readonly DataColumn<R>[]): R[] {
  const valueOf = new Map(columns.flatMap((column) => (column.sortValue ? [[column.id, column.sortValue] as const] : [])));
  const sorts = sorting.filter((sort) => valueOf.has(sort.id));
  if (sorts.length === 0) return [...rows];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { id, desc } of sorts) {
        const get = valueOf.get(id)!;
        const [x, y] = [get(a.row), get(b.row)];
        if (x === y) continue;
        if (x === null || x === '') return 1;
        if (y === null || y === '') return -1;
        const order = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
        if (order) return desc ? -order : order;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

/**
 * Next sorts after a click on a column header: ascending, then descending, then none; with Shift, the column is added
 * to (or changed in) the other sorts instead of replacing them.
 * @param {readonly TableSort[]} sorting Current sorts.
 * @param {string} id Column.
 * @param {boolean} multi Shift held.
 * @returns {TableSort[]} Sorts.
 */
export function toggleSort(sorting: readonly TableSort[], id: string, multi: boolean): TableSort[] {
  const current = sorting.find((sort) => sort.id === id);
  const next: TableSort | null = !current ? { id, desc: false } : !current.desc ? { id, desc: true } : null;
  if (!multi) return next ? [next] : [];
  if (!current) return [...sorting, next!];
  return next ? sorting.map((sort) => (sort.id === id ? next : sort)) : sorting.filter((sort) => sort.id !== id);
}

/**
 * Width of a table of fixed columns: its shown columns and the cells around them.
 * @param {readonly ShownColumn<R>[]} shown Shown columns.
 * @param {number} [extra] Width of the other cells (selection, actions…). Optional. Default = 0.
 * @returns {number} Width (px).
 */
export function tableWidth<R>(shown: readonly ShownColumn<R>[], extra = 0): number {
  return shown.reduce((sum, column) => sum + column.width, extra);
}
