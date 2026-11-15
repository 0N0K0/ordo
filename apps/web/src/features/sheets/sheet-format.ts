import type { SheetInput, SheetItemInput } from '@ordo/shared';
import * as fmt from '../../lib/format';

/**
 * Quantity and unit of an item: « 6 », « 250 g », « 1,5 kg », nothing without quantity.
 * @param {{ quantity?: number | null, unit?: string | null }} item Item.
 * @returns {string} Text.
 */
export const quantityText = (item: { quantity?: number | null; unit?: string | null }) =>
  item.quantity === null || item.quantity === undefined ? (item.unit ?? '') : `${fmt.number(item.quantity, 3)}${item.unit ? ` ${item.unit}` : ''}`;

/**
 * Input of a sheet as it is, with some fields changed.
 * @param {{ name: string, note?: string | null, projectId?: string | null, categoryIds: string[] }} sheet Sheet.
 * @param {Partial<SheetInput>} change Changed fields.
 * @returns {SheetInput} Input.
 */
export const sheetInput = (sheet: { name: string; note?: string | null; projectId?: string | null; categoryIds: string[] }, change: Partial<SheetInput>): SheetInput => ({
  name: sheet.name,
  note: sheet.note ?? null,
  projectId: sheet.projectId ?? null,
  categoryIds: sheet.categoryIds,
  ...change,
});

/**
 * Input of an item of a sheet as it is, with some fields changed.
 * @param {SheetItemValues} item Item.
 * @param {Partial<SheetItemInput>} change Changed fields.
 * @returns {SheetItemInput} Input.
 */
export const sheetItemInput = (
  item: { productId?: string | null; label: string; categoryId?: string | null; quantity?: number | null; unit?: string | null; note?: string | null; consumable: boolean },
  change: Partial<SheetItemInput>,
): SheetItemInput => ({
  productId: item.productId ?? null,
  label: item.label,
  categoryId: item.categoryId ?? null,
  quantity: item.quantity ?? null,
  unit: item.unit ?? null,
  note: item.note ?? null,
  consumable: item.consumable,
  ...change,
});

/** Item as edited (its id kept while it is saved already). */
export type SheetItemValues = SheetItemInput & { id?: string | null };

/**
 * New blank item.
 * @returns {SheetItemValues} Item.
 */
export const blankSheetItem = (): SheetItemValues => ({ id: null, productId: null, label: '', categoryId: null, quantity: null, unit: null, note: null, consumable: true });
