import { withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { categoryOptions, categoryPaths, type TreeCategory } from '../../../components/tree/category-tree';
import * as fmt from '../../../lib/format';

/** What a table changes of a product column: its id, size, bulk edit, grouping, hidden at first… */
type ColumnOptions<T> = Partial<DataColumn<T>>;

/**
 * « Quantité » column of products (shopping items, stock items, sheet and checklist items): numeric, « 1,5 ».
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function quantityColumn<T extends { quantity?: number | null }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return {
    id: 'quantity',
    label: 'Quantité',
    size: 100,
    numeric: true,
    bulk: true,
    sortValue: (item) => item.quantity ?? null,
    text: (item) => fmt.quantity({ quantity: item.quantity }),
    filter: { kind: 'number', value: (item) => item.quantity ?? null },
    ...options,
  };
}

/**
 * « Unité » column of products.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function unitColumn<T extends { unit?: string | null }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return { id: 'unit', label: 'Unité', size: 90, bulk: true, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '', ...options };
}

/**
 * « Catégorie » column of products: the full path of their shopping category, filtered in the tree of the categories
 * (the archived ones marked).
 * @param {readonly (TreeCategory & { archived?: boolean | null })[]} categories Shopping categories.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function categoryColumn<T extends { categoryId?: string | null }>(categories: readonly (TreeCategory & { archived?: boolean | null })[], options: ColumnOptions<T> = {}): DataColumn<T> {
  const paths = categoryPaths(categories);
  const categoryOf = (item: T) => (item.categoryId ? (paths.get(item.categoryId) ?? '') : '');
  return {
    id: 'category',
    label: 'Catégorie',
    size: 170,
    bulk: true,
    sortValue: (item) => categoryOf(item) || null,
    text: categoryOf,
    filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: withArchived(categoryOptions(categories), categories) },
    groupable: true,
    ...options,
  };
}

/**
 * « Consommable » column of products: used up (stock), and so put back on the shopping lists.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function consumableColumn<T extends { consumable: boolean }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return {
    id: 'consumable',
    label: 'Consommable',
    size: 120,
    bulk: true,
    sortValue: (item) => (item.consumable ? 1 : 0),
    text: (item) => (item.consumable ? 'Consommable' : ''),
    filter: { kind: 'boolean', value: (item) => item.consumable },
    groupable: true,
    ...options,
  };
}

/**
 * « Description » column of products: their note.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function noteColumn<T extends { note?: string | null }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return { id: 'note', label: 'Description', size: 220, bulk: true, sortValue: (item) => item.note ?? null, text: (item) => item.note ?? '', ...options };
}
