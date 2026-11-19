import { changedList } from '@ordo/shared';
import { createContext, useContext } from 'react';
import { notifySuccess } from '../../../lib/notify';
import { countOf } from '../../../lib/text';
import { itemCellLabel } from '../cells/cell-field';
import { ALL_COLUMNS, type BulkSelection } from './bulk-selection';

/** What saving in bulk needs of a table: its selection, the key and the order of its rows. */
interface BulkTable<R> {
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

/**
 * Accessible labels of the cells of a table, the same in every table (itemCellLabel): « Unité de « Farine » », or, on a
 * selection, « Unité (appliqué aux 3 cellules sélectionnées) » (decision BD).
 * @param {BulkTable<R>} view Table (its selection).
 * @param {(row: R) => string} nameOf Name of a row (its label).
 * @returns {(column: Columns, row: R, field: string) => string} Label of the cell of a column, for a field name.
 */
export const bulkCellLabels =
  <R>(view: BulkTable<R>, nameOf: (row: R) => string) =>
  (column: Columns, row: R, field: string): string =>
    itemCellLabel(field, `« ${nameOf(row)} »`, bulkTargets(view, column, row).length);

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
  { label = (count: number) => countOf(count, 'ligne'), notify = true }: { label?: (count: number) => string; notify?: boolean } = {},
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
 * Values of a multiple field once changed as in a cell: those added there added, those removed there removed, the
 * others of the row kept (several rows keep their own values).
 * @param {readonly string[]} current Values of the row.
 * @param {readonly string[]} before Values of the cell before.
 * @param {readonly string[]} after Values of the cell after.
 * @returns {string[]} Values.
 */
export function applyDiff(current: readonly string[], before: readonly string[], after: readonly string[]): string[] {
  const { added, removed } = listDiff(before, after);
  return changedList(current, added, removed);
}

/**
 * Values added and removed between two lists of values (ids of a multi-select…).
 * @param {readonly T[]} before Values before.
 * @param {readonly T[]} after Values after.
 * @returns {{ added: T[], removed: T[] }} Values added (in `after` only) and removed (in `before` only).
 */
export function listDiff<T>(before: readonly T[], after: readonly T[]): { added: T[]; removed: T[] } {
  return { added: after.filter((value) => !before.includes(value)), removed: before.filter((value) => !after.includes(value)) };
}

/**
 * Saves a cell edit of a row of a table, on the selection of its table (bulkSaver): on a cell of the column selection
 * (or of the rows checked), the change applies to every row of it — in one bulk request when given, with its undo —,
 * otherwise to the edited row only (an empty change leaves a row as it is). The edit of the cells of every table whose
 * rows are entities with an id (tasks, routines).
 * @param {R} row Edited row.
 * @param {Columns} columns Edited column (or the columns of the table it answers for).
 * @param {object} options How the rows are saved.
 * @param {readonly R[]} options.rows Rows of the table.
 * @param {(row: R, change: C) => void} options.save Saves the change of a row.
 * @param {(rows: R[], changes: B) => void} options.saveMany Saves the same change for several rows at once (with its undo).
 * @param {(count: number) => string} options.label « 3 tâches »: in the messages.
 * @returns {{ apply: (single: C | ((row: R) => C), bulk?: B) => void, count: number, targets: string[] }} Saver, the number of rows an edit would change and their ids.
 */
export function useEntityCellEdit<R extends { id: string }, C extends object, B>(
  row: R,
  columns: Columns,
  options: { rows: readonly R[]; save: (row: R, change: C) => void; saveMany: (rows: R[], changes: B) => void; label: (count: number) => string },
) {
  const table = useBulkTable();
  // The rows of the table, by the keys of their rows (an entity's row key is its id).
  const view: BulkTable<R> = { selection: table?.selection ?? null, keyOf: (item) => item.id, rows: options.rows as R[] };
  const targets = bulkTargets(view, columns, row).map((item) => item.id);
  return {
    count: targets.length,
    /** Rows the edit applies to. */
    targets,
    /**
     * Saves the edit: on several rows, in one bulk change when given (with its undo), else row by row (the change made
     * for each).
     * @param {C | ((row: R) => C)} single Change of the edited row (or of each).
     * @param {B} [bulk] Same change for several rows at once. Optional.
     * @returns {void}
     */
    apply: (single: C | ((row: R) => C), bulk?: B) =>
      bulkSaver<R, C>(view, (item, change) => Object.keys(change).length > 0 && options.save(item, change), bulk !== undefined ? (rows) => options.saveMany(rows, bulk) : undefined, {
        label: options.label,
        notify: bulk === undefined,
      })(columns)(row, single),
  };
}
