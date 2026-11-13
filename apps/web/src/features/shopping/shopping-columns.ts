import type { DataColumn } from '../../components/data-table/data-table';
import { categoryTree } from '../../components/category-tree/category-tree';
import type { ShoppingCategory, ShoppingStore } from './api';
import type { ShoppingFields, ShoppingGrouping } from './shopping-format';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const priceFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Names the columns of the products or items show. */
export interface ItemNames {
  categories: readonly ShoppingCategory[];
  stores: readonly ShoppingStore[];
  /** Names of the members and relations. */
  members: ReadonlyMap<string, string>;
  relations: ReadonlyMap<string, string>;
}

/**
 * Columns of a table of products or items: the place shown is the one it is not grouped by (both can be shown).
 * @param {ShoppingGrouping} grouping Groups of the table.
 * @param {ItemNames} names Names of the categories, stores and people.
 * @param {DataColumn<T>[]} [extra] Columns of the products or of the items only, at the end. Optional.
 * @returns {DataColumn<T>[]} Columns.
 */
export function itemColumns<T extends ShoppingFields>(grouping: ShoppingGrouping, names: ItemNames, extra: DataColumn<T>[] = []): DataColumn<T>[] {
  const paths = new Map(categoryTree(names.categories).map((item) => [item.category.id, item.path]));
  const storeName = new Map(names.stores.map((store) => [store.id, store.name]));
  const categoryOf = (item: T) => (item.categoryId ? (paths.get(item.categoryId) ?? '') : '');
  const storeOf = (item: T) => (item.storeId ? (storeName.get(item.storeId) ?? '') : '');
  const people = (item: T) => [...item.memberIds.map((id) => names.members.get(id) ?? ''), ...item.relationIds.map((id) => names.relations.get(id) ?? '')].filter(Boolean);
  return [
    { id: 'name', label: 'Produit', size: 260, locked: true, sortValue: (item) => item.name, text: (item) => item.name },
    {
      id: 'category',
      label: 'Catégorie',
      size: 150,
      hiddenByDefault: grouping === 'category',
      sortValue: (item) => categoryOf(item) || null,
      text: categoryOf,
      filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: names.categories.map((category) => ({ value: category.id, label: paths.get(category.id) ?? category.name })) },
    },
    {
      id: 'store',
      label: 'Magasin',
      size: 150,
      hiddenByDefault: grouping === 'store',
      sortValue: (item) => storeOf(item) || null,
      text: storeOf,
      filter: { kind: 'choice', value: (item) => item.storeId ?? null, options: names.stores.map((store) => ({ value: store.id, label: store.name })) },
    },
    { id: 'quantity', label: 'Quantité', size: 88, numeric: true, sortValue: (item) => item.quantity ?? null, text: (item) => (item.quantity == null ? '' : String(item.quantity).replace('.', ',')) },
    { id: 'unit', label: 'Unité', size: 100, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '' },
    {
      id: 'unitPrice',
      label: 'Prix unitaire',
      size: 110,
      numeric: true,
      sortValue: (item) => item.unitPrice ?? null,
      text: (item) => (item.unitPrice == null ? '' : priceFormat.format(item.unitPrice)),
    },
    {
      id: 'conservation',
      label: 'Conservation',
      size: 150,
      sortValue: (item) => (item.perishable ? 1 : 0),
      text: (item) => (item.perishable ? 'Périssable' : ''),
      filter: { kind: 'boolean', value: (item) => item.perishable },
    },
    {
      id: 'expiresAt',
      label: 'Péremption',
      size: 120,
      sortValue: (item) => item.expiresAt ?? null,
      text: (item) => (item.expiresAt ? dayFormat.format(new Date(`${item.expiresAt}T00:00:00Z`)) : ''),
      filter: { kind: 'date', value: (item) => item.expiresAt ?? null },
    },
    { id: 'people', label: 'Pour', size: 170, text: (item) => people(item).join(', ') },
    { id: 'url', label: 'Lien', size: 150, sortValue: (item) => item.url ?? null, text: (item) => item.url ?? '' },
    ...extra,
  ];
}
