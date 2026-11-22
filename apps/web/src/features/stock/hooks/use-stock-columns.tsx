import { STOCK_MOVEMENT_LABELS, type StockMovementKind, mapById, round2 } from '@ordo/shared';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import { WARNING_YES_NEUTRAL_NO_ICONS, withArchived, type DataColumn } from '../../../components/data-table/table/data-table';
import { monthColumn } from '../../../components/data-table/table/month-column';
import { signedText } from '../../../components/money/signed-text';
import { categoryOptions, categoryPaths } from '../../../components/tree/category-tree';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useShoppingData } from '../../shopping/api';
import { categoryColumn, consumableColumn, noteColumn, quantityColumn, unitColumn } from '../../shopping/lib/product-columns';
import { rowPeopleKeys, usePeople } from '../../shopping/lib/shopping-format';
import { useStockItems, useStockLocations, type StockCount, type StockItem, type StockLot, type StockMovement } from '../api';
import { nextExpiry } from '../lib/stock-format';

/** Columns of the movements of the stock (all, or those of an item). */
export const MOVEMENT_COLUMNS: DataColumn<StockMovement>[] = [
  {
    id: 'date',
    label: 'Date',
    size: 150,
    required: true,
    sortValue: (movement) => movement.date,
    text: (movement) => fmt.dateTime(movement.date),
    filter: { kind: 'date', value: (movement) => localDay(movement.date) },
  },
  monthColumn('month', 'Mois', (movement) => movement.date, 130),
  { id: 'item', label: 'Article', size: 200, locked: true, required: true, sortValue: (movement) => movement.itemLabel, text: (movement) => movement.itemLabel, groupable: true },
  {
    id: 'kind',
    required: true,
    label: 'Mouvement',
    size: 130,
    sortValue: (movement) => STOCK_MOVEMENT_LABELS[movement.kind as StockMovementKind],
    text: (movement) => STOCK_MOVEMENT_LABELS[movement.kind as StockMovementKind],
    filter: { kind: 'choice', value: (movement) => movement.kind, options: Object.entries(STOCK_MOVEMENT_LABELS).map(([value, label]) => ({ value, label })) },
    groupable: true,
  },
  {
    id: 'quantity',
    required: true,
    label: 'Quantité',
    size: 110,
    numeric: true,
    sortValue: (movement) => movement.quantity,
    text: (movement) => signedText(movement.quantity, (quantity) => fmt.quantity({ quantity })),
    filter: { kind: 'number', value: (movement) => movement.quantity },
  },
  { id: 'source', label: 'Origine', size: 200, sortValue: (movement) => movement.source ?? null, text: (movement) => movement.source ?? '', groupable: true },
  noteColumn({ size: 200, bulk: false }),
];

/** Columns of the lots of an item of the stock. */
export const LOT_COLUMNS: DataColumn<StockLot>[] = [
  {
    id: 'quantity',
    required: true,
    label: 'Quantité',
    size: 120,
    numeric: true,
    locked: true,
    bulk: true,
    sortValue: (lot) => lot.quantity,
    text: (lot) => fmt.quantity({ quantity: lot.quantity }),
    filter: { kind: 'number', value: (lot) => lot.quantity },
  },
  {
    id: 'expiresAt',
    label: 'Date de péremption',
    size: 150,
    bulk: true,
    sortValue: (lot) => lot.expiresAt || null,
    text: (lot) => (lot.expiresAt ? fmt.day(lot.expiresAt) : ''),
    filter: { kind: 'date', value: (lot) => lot.expiresAt || null },
  },
  {
    id: 'createdAt',
    required: true,
    label: 'Entré le',
    size: 130,
    sortValue: (lot) => lot.createdAt,
    text: (lot) => fmt.day(lot.createdAt),
    filter: { kind: 'date', value: (lot) => localDay(lot.createdAt) },
  },
];

/**
 * Columns of the table of the stock: on its tab, and in the settings.
 * @returns {DataColumn<StockItem>[]} Columns.
 */
export function useStockItemColumns(): DataColumn<StockItem>[] {
  const { data: items } = useStockItems();
  const { data: locations } = useStockLocations();
  const { data: shopping } = useShoppingData();
  const people = usePeople();
  const places = categoryPaths(locations ?? []);
  const categories = shopping?.shoppingCategories ?? [];
  const products = mapById(shopping?.shoppingProducts ?? []);
  const comments = useCommentCounts(
    'STOCK_ITEM',
    (items ?? []).map((item) => item.id),
  );
  const whom = (item: StockItem) => [...item.memberIds.map((id) => people.members.get(id) ?? ''), ...item.relationIds.map((id) => people.relations.get(id) ?? '')].filter(Boolean);
  const value = (item: StockItem) => {
    const price = item.productId ? products.get(item.productId)?.lastPrice : null;
    return price === null || price === undefined ? null : round2(price * item.quantity);
  };
  return [
    { id: 'label', required: true, label: 'Article', size: 220, locked: true, bulk: true, sortValue: (item) => item.label, text: (item) => item.label },
    {
      id: 'location',
      label: 'Emplacement',
      size: 170,
      bulk: true,
      sortValue: (item) => (item.locationId ? (places.get(item.locationId) ?? '') : null),
      text: (item) => (item.locationId ? (places.get(item.locationId) ?? '') : ''),
      filter: { kind: 'choice', value: (item) => item.locationId ?? null, options: withArchived(categoryOptions(locations ?? []), locations ?? []) },
      groupable: true,
    },
    categoryColumn<StockItem>(categories),
    quantityColumn<StockItem>({ size: 110, bulk: false, required: true }),
    unitColumn<StockItem>({ groupable: true }),
    {
      id: 'expiry',
      label: 'Date de péremption',
      size: 150,
      sortValue: nextExpiry,
      text: (item) => (nextExpiry(item) ? fmt.day(nextExpiry(item)!) : ''),
      filter: { kind: 'date', value: nextExpiry },
      groupable: true,
    },
    {
      id: 'lots',
      required: true,
      label: 'Lots',
      size: 170,
      hiddenByDefault: true,
      text: (item) => item.lots.map((lot) => `${fmt.quantity({ quantity: lot.quantity })}${lot.expiresAt ? ` · ${fmt.day(lot.expiresAt)}` : ''}`).join(', '),
      filter: { kind: 'number', value: (item) => item.lots.length },
    },
    {
      id: 'people',
      label: 'Bénéficiaires',
      size: 170,
      bulk: true,
      sortValue: (item) => whom(item).join(', ') || null,
      text: (item) => whom(item).join(', '),
      filter: {
        kind: 'choices',
        value: (item) => rowPeopleKeys(item),
        options: withArchived(
          people.options.flatMap((group) => group.items),
          people.archived,
        ),
      },
      groupable: true,
    },
    booleanColumn<StockItem>({ id: 'perishable', label: 'Périssable', size: 110, bulk: true, hiddenByDefault: true, groupable: true, groupLabels: { yes: 'Périssable', no: 'Durable' }, icons: WARNING_YES_NEUTRAL_NO_ICONS, value: (item) => item.perishable }),
    consumableColumn<StockItem>({ bulk: false, hiddenByDefault: true }),
    {
      id: 'reference',
      label: 'Référence',
      size: 160,
      hiddenByDefault: true,
      sortValue: (item) => (item.productId ? (products.get(item.productId)?.label ?? '') : null),
      text: (item) => (item.productId ? (products.get(item.productId)?.label ?? '') : ''),
      filter: { kind: 'boolean', value: (item) => Boolean(item.productId) },
      groupable: true,
    },
    {
      id: 'value',
      label: 'Valeur',
      size: 110,
      numeric: true,
      hiddenByDefault: true,
      sortValue: value,
      formatTotal: fmt.money,
      text: (item) => (value(item) === null ? '' : fmt.money(value(item)!)),
      filter: { kind: 'number', value },
    },
    noteColumn<StockItem>({ hiddenByDefault: true }),
    {
      id: 'updatedAt',
      required: true,
      label: 'Modifié le',
      size: 130,
      hiddenByDefault: true,
      sortValue: (item) => item.updatedAt,
      text: (item) => fmt.day(item.updatedAt),
      filter: { kind: 'date', value: (item) => localDay(item.updatedAt) },
    },
    commentColumn<StockItem>(
      comments,
      (item) => item.id,
      (item) => item.note,
    ),
  ];
}

/**
 * Columns of the inventories recorded: on their tab, and in the settings.
 * @returns {DataColumn<StockCount>[]} Columns.
 */
export function useCountColumns(): DataColumn<StockCount>[] {
  const { data: locations } = useStockLocations();
  const places = categoryPaths(locations ?? []);
  /**
   * Place of an inventory: its path, or the whole stock.
   * @param {StockCount} count Inventory.
   * @returns {string} Place.
   */
  const locationOf = (count: StockCount) => (count.locationId ? (places.get(count.locationId) ?? '') : 'Tout le stock');
  return [
    {
      id: 'date',
      required: true,
      label: 'Date',
      size: 160,
      locked: true,
      sortValue: (count) => count.date,
      text: (count) => fmt.dateTime(count.date),
      filter: { kind: 'date', value: (count) => localDay(count.date) },
    },
    {
      id: 'location',
      // Without a place: the whole stock (never empty).
      required: true,
      label: 'Emplacement',
      size: 200,
      sortValue: locationOf,
      text: locationOf,
      groupable: true,
    },
    {
      id: 'lines',
      required: true,
      label: 'Écarts notés',
      size: 120,
      numeric: true,
      sortValue: (count) => count.lines,
      text: (count) => fmt.count(count.lines),
      filter: { kind: 'number', value: (count) => count.lines },
    },
    noteColumn({ size: 260, bulk: false }),
  ];
}

/**
 * Columns of an inventory being made: in its form (the counts typed), and in the settings (none).
 * @param {ReadonlyMap<string, number>} counts Quantity counted of each item.
 * @returns {DataColumn<StockItem>[]} Columns.
 */
export function useCountFormColumns(counts: ReadonlyMap<string, number>): DataColumn<StockItem>[] {
  const { data: locations } = useStockLocations();
  const places = categoryPaths(locations ?? []);
  return [
    { id: 'label', required: true, label: 'Article', size: 220, locked: true, sortValue: (item) => item.label, text: (item) => item.label },
    { id: 'location', label: 'Emplacement', size: 170, sortValue: (item) => places.get(item.locationId ?? '') ?? null, text: (item) => places.get(item.locationId ?? '') ?? '', groupable: true },
    { id: 'expected', required: true, label: 'Attendu', size: 100, numeric: true, sortValue: (item) => item.quantity, text: (item) => fmt.quantity(item) },
    {
      id: 'counted',
      label: 'Compté',
      size: 130,
      numeric: true,
      locked: true,
      sortValue: (item) => counts.get(item.id) ?? null,
      text: (item) => fmt.quantity({ quantity: counts.get(item.id) }),
    },
  ];
}
