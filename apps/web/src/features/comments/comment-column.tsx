import type { DataColumn } from '../../components/data-table/data-table';

/**
 * Number of comments of an item, its description (filled) counting as one.
 * @param {Map<string, number>} counts Comments by item.
 * @param {string} id Item.
 * @param {string | null | undefined} [description] Description of the item. Optional.
 * @returns {number} Number.
 */
export const commentTotal = (counts: Map<string, number>, id: string, description?: string | null) => (counts.get(id) ?? 0) + (description?.trim() ? 1 : 0);

/**
 * « Commentaires » column of a table: the number of comments of each row, its description counting as one.
 * @param {Map<string, number>} counts Comments by item.
 * @param {(row: R) => string} idOf Item of a row.
 * @param {(row: R) => string | null | undefined} [descriptionOf] Description of a row. Optional.
 * @returns {DataColumn<R>} Column.
 */
export function commentColumn<R>(counts: Map<string, number>, idOf: (row: R) => string, descriptionOf?: (row: R) => string | null | undefined): DataColumn<R> {
  const total = (row: R) => commentTotal(counts, idOf(row), descriptionOf?.(row));
  return {
    id: 'comments',
    label: 'Commentaires',
    size: 120,
    numeric: true,
    hiddenByDefault: true,
    sortValue: total,
    text: (row) => (total(row) ? String(total(row)) : ''),
    filter: { kind: 'number', value: total },
  };
}
