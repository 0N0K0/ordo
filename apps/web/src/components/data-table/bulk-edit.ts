import { notifySuccess } from '../../lib/notify';
import { ALL_COLUMNS, type BulkSelection } from './bulk-selection';

/** What saving in bulk needs of a table: its selection, the key and the order of its rows. */
export interface BulkTable<R> {
  selection: BulkSelection | null;
  keyOf: ((row: R) => string) | null;
  /** Rows shown. */
  rows: readonly R[];
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
 *   same entry…). Optional. Default = each row saved.
 * @returns {(column: string) => (row: R, change: BulkChange<R, C>) => void} Saving of a column.
 */
export function bulkSaver<R, C>(view: BulkTable<R>, save: (row: R, change: C) => void, saveMany?: (rows: R[], change: (row: R) => C) => void) {
  return (column: string) =>
    (row: R, change: BulkChange<R, C>): void => {
      const { selection, keyOf } = view;
      const key = keyOf?.(row);
      if (!keyOf || !selection || (selection.column !== column && selection.column !== ALL_COLUMNS) || key === undefined || !selection.keys.includes(key) || selection.keys.length < 2) {
        save(row, changeOf(change, row));
        return;
      }
      const rows = view.rows.filter((item) => selection.keys.includes(keyOf(item)));
      if (saveMany) saveMany(rows, (item) => changeOf(change, item));
      else for (const item of rows) save(item, changeOf(change, item));
      notifySuccess(`Modification appliquée à ${rows.length} lignes.`);
    };
}

/**
 * Number of rows a change in a cell would change (to tell it in its label).
 * @param {BulkTable<R>} view View of the table.
 * @param {string} column Column.
 * @param {R} row Row.
 * @returns {number} Rows.
 */
export function bulkCount<R>(view: BulkTable<R>, column: string, row: R): number {
  const key = view.keyOf?.(row);
  return (view.selection?.column === column || view.selection?.column === ALL_COLUMNS) && key !== undefined && view.selection.keys.includes(key) ? view.selection.keys.length : 1;
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
