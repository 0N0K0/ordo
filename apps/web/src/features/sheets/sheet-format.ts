import type { SheetInput, SheetItemInput } from '@ordo/shared';
import * as fmt from '../../lib/format';
import type { Sheet } from './api';

/**
 * Quantity and unit of an item: « 6 », « 250 g », « 1,5 kg », nothing without quantity.
 * @param {{ quantity?: number | null, unit?: string | null }} item Item.
 * @returns {string} Text.
 */
export const quantityText = (item: { quantity?: number | null; unit?: string | null }) =>
  item.quantity === null || item.quantity === undefined ? (item.unit ?? '') : `${fmt.number(item.quantity, 3)}${item.unit ? ` ${item.unit}` : ''}`;

/**
 * Input of a sheet as it is, with some fields changed (its items kept, with their ids).
 * @param {Sheet} sheet Sheet.
 * @param {Partial<SheetInput>} change Changed fields.
 * @returns {SheetInput} Input.
 */
export const sheetInput = (sheet: Sheet, change: Partial<SheetInput>): SheetInput => ({
  name: sheet.name,
  note: sheet.note ?? null,
  projectId: sheet.projectId ?? null,
  items: sheet.items.map((item) => ({
    id: item.id,
    productId: item.productId ?? null,
    label: item.label,
    categoryId: item.categoryId ?? null,
    quantity: item.quantity ?? null,
    unit: item.unit ?? null,
    note: item.note ?? null,
  })),
  ...change,
});

/** Item as edited (its id kept while it is saved already). */
export type SheetItemValues = SheetItemInput & { id?: string | null };

/**
 * New blank item.
 * @returns {SheetItemValues} Item.
 */
export const blankSheetItem = (): SheetItemValues => ({ id: null, productId: null, label: '', categoryId: null, quantity: null, unit: null, note: null });
