import type { DataColumn } from '../../components/data-table/data-table';
import { personKey } from '../../components/people/people-keys';
import { categoryOptions, categoryTree } from '../../components/category-tree/category-tree';
import type { ShoppingCategory, ShoppingStore } from './api';
import { rowPeopleKeys, type ShoppingFields, type ShoppingGrouping } from './shopping-format';
import * as fmt from '../../lib/format';

/** Filter values of the rows not perishable, and perishable without a way of keeping. */
const NOT_PERISHABLE = 'no';
const PERISHABLE = 'yes';

/** Names the columns of the products or items show. */
interface ItemNames {
  categories: readonly ShoppingCategory[];
  stores: readonly ShoppingStore[];
  /** Ways of keeping. Optional. */
  storages?: readonly { id: string; name: string }[];
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
  const storageName = new Map((names.storages ?? []).map((storage) => [storage.id, storage.name]));
  const storageOf = (item: T) => (item.storageId ? (storageName.get(item.storageId) ?? '') : '');
  const people = (item: T) => [...item.memberIds.map((id) => names.members.get(id) ?? ''), ...item.relationIds.map((id) => names.relations.get(id) ?? '')].filter(Boolean);
  return [
    { id: 'name', label: 'Label', size: 260, locked: true, bulk: true, sortValue: (item) => item.name, text: (item) => item.name },
    {
      id: 'category',
      bulk: true,
      label: 'Catégorie',
      size: 150,
      hiddenByDefault: grouping === 'category',
      sortValue: (item) => categoryOf(item) || null,
      text: categoryOf,
      filter: { kind: 'choice', value: (item) => item.categoryId ?? null, options: categoryOptions(names.categories) },
    },
    {
      id: 'store',
      bulk: true,
      label: 'Magasin',
      size: 150,
      hiddenByDefault: grouping === 'store',
      sortValue: (item) => storeOf(item) || null,
      text: storeOf,
      filter: { kind: 'choice', value: (item) => item.storeId ?? null, options: names.stores.map((store) => ({ value: store.id, label: store.name })) },
    },
    {
      id: 'quantity',
      bulk: true,
      label: 'Quantité',
      size: 88,
      numeric: true,
      sortValue: (item) => item.quantity ?? null,
      text: (item) => (item.quantity == null ? '' : String(item.quantity).replace('.', ',')),
      filter: { kind: 'number', value: (item) => item.quantity ?? null },
    },
    { id: 'unit', bulk: true, label: 'Unité', size: 100, sortValue: (item) => item.unit ?? null, text: (item) => item.unit ?? '' },
    {
      id: 'unitPrice',
      bulk: true,
      label: 'Prix unitaire estimé',
      size: 130,
      numeric: true,
      sortValue: (item) => item.unitPrice ?? null,
      formatTotal: fmt.money,
      text: (item) => (item.unitPrice == null ? '' : fmt.money(item.unitPrice)),
      filter: { kind: 'number', value: (item) => item.unitPrice ?? null },
    },
    {
      id: 'conservation',
      bulk: true,
      label: 'Conservation',
      size: 150,
      hiddenByDefault: grouping === 'storage',
      sortValue: (item) => (item.perishable ? storageOf(item) || 'Périssable' : null),
      text: (item) => (item.perishable ? storageOf(item) || 'Périssable' : ''),
      // Not perishable, perishable without a way of keeping, or each way of keeping.
      filter: {
        kind: 'choice',
        value: (item) => (item.perishable ? (item.storageId ?? PERISHABLE) : NOT_PERISHABLE),
        options: [
          { value: NOT_PERISHABLE, label: 'Non périssable' },
          { value: PERISHABLE, label: 'Périssable, sans mode' },
          ...(names.storages ?? []).map((storage) => ({ value: storage.id, label: storage.name })),
        ],
      },
    },
    {
      id: 'expiresAt',
      bulk: true,
      label: 'Date de péremption',
      size: 140,
      sortValue: (item) => item.expiresAt ?? null,
      text: (item) => (item.expiresAt ? fmt.day(item.expiresAt) : ''),
      filter: { kind: 'date', value: (item) => item.expiresAt ?? null },
    },
    {
      id: 'people',
      bulk: true,
      label: 'Bénéficiaire',
      size: 170,
      hiddenByDefault: grouping === 'people',
      sortValue: (item) => people(item).join(', ') || null,
      text: (item) => people(item).join(', '),
      filter: {
        kind: 'choices',
        value: rowPeopleKeys,
        options: [
          ...[...names.members].map(([id, name]) => ({ value: personKey('member', id), label: name })),
          ...[...names.relations].map(([id, name]) => ({ value: personKey('relation', id), label: name })),
        ],
      },
    },
    { id: 'url', bulk: true, label: 'Lien vers le produit', size: 160, sortValue: (item) => item.url ?? null, text: (item) => item.url ?? '' },
    ...extra,
  ];
}

/**
 * « Facultatif » column of the items of the shopping lists and of the sheets: not needed, bought if possible.
 * @returns {DataColumn<T>} Column.
 */
export function optionalColumn<T extends { optional?: boolean | null }>(): DataColumn<T> {
  return {
    id: 'optional',
    bulk: true,
    label: 'Facultatif',
    size: 110,
    sortValue: (item) => (item.optional ? 1 : 0),
    text: (item) => (item.optional ? 'Facultatif' : ''),
    filter: { kind: 'boolean', value: (item) => Boolean(item.optional) },
    groupable: true,
  };
}

/** Columns of the shopping items a sheet item has too (store, conservation, whom it is for, link). */
const SHEET_SHOPPING_COLUMNS = ['store', 'conservation', 'people', 'url'];

/**
 * Columns of the shopping items a sheet item has too, as those of the shopping lists (same labels, filters, sorts).
 * @param {ItemNames} names Names of the categories, stores, ways of keeping and people.
 * @returns {DataColumn<T>[]} Columns.
 */
export function sheetShoppingColumns<T extends Pick<ShoppingFields, 'storeId' | 'perishable' | 'storageId' | 'memberIds' | 'relationIds' | 'url'>>(names: ItemNames): DataColumn<T>[] {
  // Those columns only read the fields a sheet item has.
  return itemColumns<ShoppingFields>('category', names).filter((column) => SHEET_SHOPPING_COLUMNS.includes(column.id)) as unknown as DataColumn<T>[];
}
