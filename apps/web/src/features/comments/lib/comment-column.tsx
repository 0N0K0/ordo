import * as fmt from '../../../lib/format';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { CommentCount } from '../components/CommentCount';

/**
 * Number of comments of an item, its description (filled) counting as one.
 * @param {number | undefined} count Comments of the item (none: 0).
 * @param {string | null | undefined} [description] Description of the item. Optional.
 * @returns {number} Number.
 */
export const commentTotal = (count: number | undefined, description?: string | null) => (count ?? 0) + (description?.trim() ? 1 : 0);

/**
 * « Commentaires » column of a table: the number of comments of each row, its description counting as one, with its
 * icon in the cell (CommentCount).
 * @param {Map<string, number>} counts Comments by item.
 * @param {(row: R) => string} idOf Item of a row.
 * @param {(row: R) => string | null | undefined} [descriptionOf] Description of a row. Optional.
 * @returns {DataColumn<R>} Column.
 */
export function commentColumn<R>(counts: Map<string, number>, idOf: (row: R) => string, descriptionOf?: (row: R) => string | null | undefined): DataColumn<R> {
  const total = (row: R) => commentTotal(counts.get(idOf(row)), descriptionOf?.(row));
  return {
    // eslint-disable-next-line no-restricted-syntax -- commentColumn itself.
    id: 'comments',
    required: true,
    label: 'Commentaires',
    size: 120,
    numeric: true,
    hiddenByDefault: true,
    sortValue: total,
    text: (row) => fmt.count(total(row)),
    cell: (row) => <CommentCount count={total(row)} />,
    filter: { kind: 'number', value: total },
  };
}
