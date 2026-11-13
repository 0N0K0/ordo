import type { DataColumn } from '../../components/data-table/data-table';
import type { ShoppingFields, ShoppingGrouping } from './shopping-format';

/**
 * Columns of a table of products or items: the place shown is the one it is not grouped by (both can be shown).
 * @param {ShoppingGrouping} grouping Groups of the table.
 * @param {string} [extra] Title of the extra column, if any. Optional.
 * @returns {DataColumn<T>[]} Columns.
 */
export function itemColumns<T extends ShoppingFields>(grouping: ShoppingGrouping, extra?: string): DataColumn<T>[] {
  return [
    { id: 'name', label: 'Produit', size: 260, locked: true, sortValue: (item) => item.name },
    { id: 'category', label: 'Catégorie', size: 150, hiddenByDefault: grouping === 'category' },
    { id: 'store', label: 'Magasin', size: 150, hiddenByDefault: grouping === 'store' },
    { id: 'quantity', label: 'Quantité', size: 88, numeric: true, sortValue: (item) => item.quantity ?? null },
    { id: 'unit', label: 'Unité', size: 100, sortValue: (item) => item.unit ?? null },
    { id: 'unitPrice', label: 'Prix unitaire', size: 110, numeric: true, sortValue: (item) => item.unitPrice ?? null },
    { id: 'conservation', label: 'Conservation', size: 150, sortValue: (item) => (item.perishable ? 1 : 0) },
    { id: 'expiresAt', label: 'Péremption', size: 120, sortValue: (item) => item.expiresAt ?? null },
    { id: 'people', label: 'Pour', size: 170 },
    { id: 'url', label: 'Lien', size: 150, sortValue: (item) => item.url ?? null },
    ...(extra ? [{ id: 'extra', label: extra, size: 120 }] : []),
  ];
}
