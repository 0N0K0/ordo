import type { NewStockItemInput } from '@ordo/shared';
import type { StockItem } from '../api';

/**
 * Input of an item of the stock as it is, with some fields changed (its quantities aside).
 * @param {StockItem} item Item.
 * @param {Partial<NewStockItemInput>} change Changed fields.
 * @returns {NewStockItemInput} Input.
 */
export const stockItemInput = (item: StockItem, change: Partial<NewStockItemInput>): NewStockItemInput => ({
  productId: item.productId ?? null,
  label: item.label,
  categoryId: item.categoryId ?? null,
  unit: item.unit ?? null,
  locationId: item.locationId ?? null,
  note: item.note ?? null,
  perishable: item.perishable,
  memberIds: item.memberIds,
  relationIds: item.relationIds,
  quantity: null,
  expiresAt: null,
  ...change,
});

/**
 * First date among the lots of an item (the one to use first).
 * @param {StockItem} item Item.
 * @returns {string | null} YYYY-MM-DD.
 */
export const nextExpiry = (item: StockItem): string | null =>
  item.lots
    .map((lot) => lot.expiresAt || null)
    .filter((date): date is string => date !== null)
    .sort()[0] ?? null;
