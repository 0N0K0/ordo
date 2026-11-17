import { createContext, useContext } from 'react';
import { notifySuccess } from '../../lib/notify';
import { ALL_COLUMNS, type BulkSelection } from './bulk-selection';

/** What saving in bulk needs of a table: its selection, the key and the order of its rows. */
export interface BulkTable<R> {
  selection: BulkSelection | null;
  keyOf: ((row: R) => string) | null;
  /** Rows shown. */
  rows: readonly R[];
}

/** Selection of the table a cell is in, given by DataTable to its cells (their edits apply to it). */
export const BulkTableContext = createContext<BulkTable<unknown> | null>(null);

/**
 * Selection of the table a cell is in (its column selection or its rows checked), with the key and the order of its
 * rows; null out of a table.
 * @returns {BulkTable<R> | null} Table.
 */
export function useBulkTable<R>(): BulkTable<R> | null {
  return useContext(BulkTableContext) as BulkTable<R> | null;
}

/** Columns a cell answers for: one, or several (a cell shown in two columns…). */
type Columns = string | readonly string[];

/**
 * Whether the bulk selection is on a column of a cell (or on whole rows).
 * @param {BulkSelection} selection Selection.
 * @param {Columns} column Columns of the cell.
 * @returns {boolean} On it.
 */
const onColumn = (selection: BulkSelection, column: Columns) => selection.column === ALL_COLUMNS || (typeof column === 'string' ? selection.column === column : column.includes(selection.column));

/**
 * Rows a change in a cell applies to: those of the bulk selection of its column (or the rows checked) when the row is
 * one of them, else the row alone.
 * @param {BulkTable<R>} view Table.
 * @param {Columns} column Columns of the cell.
 * @param {R} row Row.
 * @returns {R[]} Rows, in the order of the table.
 */
export function bulkTargets<R>(view: BulkTable<R>, column: Columns, row: R): R[] {
  const { selection, keyOf } = view;
  const key = keyOf?.(row);
  if (!keyOf || !selection || !onColumn(selection, column) || key === undefined || !selection.keys.includes(key) || selection.keys.length < 2) return [row];
  return view.rows.filter((item) => selection.keys.includes(keyOf(item)));
}

/** Change made in a cell: the same for every row, or made for each row (its own date kept…). */
export type BulkChange<R, C> = C | ((row: R) => C);

/**
 * Change of a row.
 * @param {BulkChange<R, C>} change Change.
 * @param {R} row Row.
 * @returns {C} Change of the row.
 */
export const changeOf = <R, C>(change: BulkChange<R, C>, row: R): C => (typeof change === 'function' ? (change as (row: R) => C)(row) : change);

/**
 * Saving of the cells of a table: a change made in a cell of the bulk selection applies to every selected cell of its
 * column, or of every row checked (each row saved, or all of them at once), any other one to its row only.
 * @param {BulkTable<R>} view Table (its selection, a data view…).
 * @param {(row: R, change: C) => void} save Saves a change of one row.
 * @param {(rows: R[], change: (row: R) => C) => void} [saveMany] Saves the change of several rows at once (lines of a
 *   same entry, one request for all…). Optional. Default = each row saved.
 * @param {{ label?: (count: number) => string, notify?: boolean }} [options] Rows told in the message (« 3 tâches »), and
 *   whether the message is given here (false: saveMany tells it, with an undo…). Optional.
 * @returns {(column: string | readonly string[]) => (row: R, change: BulkChange<R, C>) => void} Saving of a column (or of
 *   a cell answering for several).
 */
export function bulkSaver<R, C>(
  view: BulkTable<R>,
  save: (row: R, change: C) => void,
  saveMany?: (rows: R[], change: (row: R) => C) => void,
  { label = (count: number) => `${count} lignes`, notify = true }: { label?: (count: number) => string; notify?: boolean } = {},
) {
  return (column: Columns) =>
    (row: R, change: BulkChange<R, C>): void => {
      const rows = bulkTargets(view, column, row);
      if (rows.length < 2) {
        save(row, changeOf(change, row));
        return;
      }
      if (saveMany) saveMany(rows, (item) => changeOf(change, item));
      else for (const item of rows) save(item, changeOf(change, item));
      if (notify) notifySuccess(`Modification appliquée à ${label(rows.length)}.`);
    };
}

/**
 * Number of rows a change in a cell would change (to tell it in its label).
 * @param {BulkTable<R>} view View of the table.
 * @param {string | readonly string[]} column Columns of the cell.
 * @param {R} row Row.
 * @returns {number} Rows.
 */
export function bulkCount<R>(view: BulkTable<R>, column: Columns, row: R): number {
  return bulkTargets(view, column, row).length;
}

/**
 * Values of a multiple field once changed as in a cell: those added there added, those removed there removed, the
 * others of the row kept (several rows keep their own values).
 * @param {readonly string[]} current Values of the row.
 * @param {readonly string[]} before Values of the cell before.
 * @param {readonly string[]} after Values of the cell after.
 * @returns {string[]} Values.
 */
export function applyDiff(current: readonly string[], before: readonly string[], after: readonly string[]): string[] {
  const removed = new Set(before.filter((value) => !after.includes(value)));
  return [...new Set([...current.filter((value) => !removed.has(value)), ...after.filter((value) => !before.includes(value))])];
}
