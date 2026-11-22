import { withArchived, type DataColumn, type YesNoStates } from '../../../components/data-table/table/data-table';
import { categoryOptions, categoryPaths, categoryTree, type TreeCategory } from '../../../components/tree/category-tree';
import * as fmt from '../../../lib/format';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';

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
 * (the archived ones marked), grouped as that tree (a sub-category under its parent, with its color), the products
 * without category in « Sans catégorie ».
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
    groupTree: categoryTree(categories).map(({ category, color }) => ({ key: category.id, label: category.label, color, parentKey: category.parentId ?? null })),
    groupNoneLabel: 'Sans catégorie',
    ...options,
  };
}

/** States of « Consommable », in its column and on its state buttons. */
export const CONSUMABLE_STATES: YesNoStates = {
  labels: { yes: 'Consommable', no: 'Permanent' },
  toggleLabels: { yes: 'Marquer comme consommable', no: 'Marquer comme permanent' },
};

/**
 * « Consommable » column of products: used up (stock), and so put back on the shopping lists.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function consumableColumn<T extends { consumable: boolean }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return booleanColumn<T>({ id: 'consumable', label: 'Consommable', size: 120, bulk: true, groupable: true, groupLabels: CONSUMABLE_STATES.labels, ...options, value: (item) => item.consumable });
}

/**
 * « Description » column of products: their note.
 * @param {ColumnOptions<T>} [options] What the table changes. Optional.
 * @returns {DataColumn<T>} Column.
 */
export function noteColumn<T extends { note?: string | null }>(options: ColumnOptions<T> = {}): DataColumn<T> {
  return { id: 'note', label: 'Description', size: 220, bulk: true, sortValue: (item) => item.note ?? null, text: (item) => item.note ?? '', ...options };
}
