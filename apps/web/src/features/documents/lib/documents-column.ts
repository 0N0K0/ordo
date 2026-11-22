import type { LinkedDocumentIds } from '@ordo/shared';
import type { DataColumn } from '../../../components/data-table/table/data-table';

/**
 * Number of documents linked to an item (of the library and of projects).
 * @param {LinkedDocumentIds} item Item.
 * @returns {number} Count.
 */
export const documentCount = (item: LinkedDocumentIds): number => item.libraryDocumentIds.length + item.projectResourceIds.length;

/**
 * « Documents » column of a table of tasks or routines, hidden by default: how many documents each row has linked
 * (they are opened and chosen in its panel), sorted and filtered as a number.
 * @param {(row: R) => LinkedDocumentIds | null} documents Documents of a row (none: an empty cell, a row of another kind).
 * @returns {DataColumn<R>} Column.
 */
export function documentsColumn<R>(documents: (row: R) => LinkedDocumentIds | null): DataColumn<R> {
  /**
   * Count of a row.
   * @param {R} row Row.
   * @returns {number | null} Count, null without documents of its own.
   */
  const count = (row: R): number | null => {
    const item = documents(row);
    return item ? documentCount(item) : null;
  };
  return {
    id: 'documents',
    label: 'Documents',
    size: 110,
    numeric: true,
    hiddenByDefault: true,
    groupable: false,
    sortValue: count,
    text: (row) => String(count(row) ?? ''),
    filter: { kind: 'number', value: count },
  };
}
