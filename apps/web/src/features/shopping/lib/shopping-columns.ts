import type { DataColumn, TreeGroup } from '../../../components/data-table/table/data-table';
import { personKeyOptions } from '../../../components/people/people-keys';
import { categoryColumn, quantityColumn, unitColumn } from './product-columns';
import type { ShoppingCategory, ShoppingStore } from '../api';
import { NO_GROUP_NAME, rowPeopleKeys, type ShoppingFields } from './shopping-format';
import * as fmt from '../../../lib/format';
import { conservationKey, NOT_PERISHABLE, PERISHABLE } from './conservation';
import { withArchived } from '../../../components/data-table/table/data-table';
import { itemChoices } from '../../../components/items/item-look';

/**
 * Groups of a column grouped in the order of its settings (stores, ways of keeping), each with its color.
 * @param {readonly { id: string, label: string, color?: string | null }[]} items Settings, in their order.
 * @returns {TreeGroup[]} Groups.
 */
const flatGroups = (items: readonly { id: string; label: string; color?: string | null }[]): TreeGroup[] =>
  items.map((item) => ({ key: item.id, label: item.label, color: item.color ?? null, parentKey: null }));

/**
 * Groups of the people a row is for: the members, then the relations (people keys).
 * @param {ItemNames} names Names of the members and relations.
 * @returns {TreeGroup[]} Groups.
 */
const peopleGroups = (names: ItemNames): TreeGroup[] =>
  [...personKeyOptions('member', names.members), ...personKeyOptions('relation', names.relations)].map((option) => ({ key: option.value, label: option.label, color: null, parentKey: null }));

/** Names the columns of the products or items show. */
interface ItemNames {
  categories: readonly ShoppingCategory[];
  stores: readonly ShoppingStore[];
  /** Ways of keeping. Optional. */
  storages?: readonly { id: string; label: string; archived?: boolean }[];
  /** Names of the members and relations. */
  members: ReadonlyMap<string, string>;
  relations: ReadonlyMap<string, string>;
  /** People keys of the archived members and relations: offered in the filter only when already in it. Optional. */
  archivedPeople?: ReadonlySet<string>;
}

/**
 * Columns of a table of products or items. « Catégorie », « Magasin », « Conservation » and « Bénéficiaires » group as
 * any column (the categories as their tree, the stores, ways of keeping and people in their order), each with its
 * group « sans » (« Sans catégorie »…); a row dropped on one of their groups moves there.
 * @param {ItemNames} names Names of the categories, stores and people.
 * @param {DataColumn<T>[]} [extra] Columns of the products or of the items only, at the end. Optional.
 * @returns {DataColumn<T>[]} Columns.
 */
export function itemColumns<T extends ShoppingFields>(names: ItemNames, extra: DataColumn<T>[] = []): DataColumn<T>[] {
  const storeName = new Map(names.stores.map((store) => [store.id, store.label]));
  const storeOf = (item: T) => (item.storeId ? (storeName.get(item.storeId) ?? '') : '');
  const storageName = new Map((names.storages ?? []).map((storage) => [storage.id, storage.label]));
  const storageOf = (item: T) => (item.storageId ? (storageName.get(item.storageId) ?? '') : '');
  const people = (item: T) => [...item.memberIds.map((id) => names.members.get(id) ?? ''), ...item.relationIds.map((id) => names.relations.get(id) ?? '')].filter(Boolean);
  return [
    { id: 'label', required: true, label: 'Libellé', size: 260, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    categoryColumn<T>(names.categories, { size: 150 }),
    {
      id: 'store',
      bulk: true,
      label: 'Magasin',
      size: 150,
      sortValue: (item) => storeOf(item) || null,
      text: storeOf,
      filter: { kind: 'choice', value: (item) => item.storeId ?? null, options: itemChoices(names.stores) },
      groupTree: flatGroups(names.stores),
      groupNoneLabel: NO_GROUP_NAME.store,
    },
    quantityColumn<T>({ size: 88 }),
    unitColumn<T>({ size: 100 }),
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
      required: true,
      bulk: true,
      label: 'Conservation',
      size: 150,
      sortValue: (item) => (item.perishable ? storageOf(item) || 'Périssable' : null),
      text: (item) => (item.perishable ? storageOf(item) || 'Périssable' : ''),
      // Not perishable, perishable without a way of keeping, or each way of keeping.
      filter: {
        kind: 'choice',
        value: conservationKey,
        options: [{ value: NOT_PERISHABLE, label: 'Non périssable' }, { value: PERISHABLE, label: 'Périssable, sans mode' }, ...itemChoices(names.storages ?? [])],
      },
      // Grouped by way of keeping: the rows not perishable or without one together.
      groupValue: (item) => (item.perishable && item.storageId ? [item.storageId] : []),
      groupTree: flatGroups(names.storages ?? []),
      groupNoneLabel: NO_GROUP_NAME.storage,
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
      label: 'Bénéficiaires',
      size: 170,
      sortValue: (item) => people(item).join(', ') || null,
      text: (item) => people(item).join(', '),
      filter: {
        kind: 'choices',
        value: rowPeopleKeys,
        options: withArchived([...personKeyOptions('member', names.members), ...personKeyOptions('relation', names.relations)], names.archivedPeople ?? new Set()),
      },
      groupTree: peopleGroups(names),
      groupNoneLabel: NO_GROUP_NAME.people,
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
  return itemColumns<ShoppingFields>(names).filter((column) => SHEET_SHOPPING_COLUMNS.includes(column.id)) as unknown as DataColumn<T>[];
}
