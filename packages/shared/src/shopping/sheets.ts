import { colorSchema } from '@ordo/shared';
import { z } from 'zod';
import { requiredText } from '../core/rules';
import { shoppingItemSchema } from './shopping';

const shopping = shoppingItemSchema.shape;

const quantity = z.number().min(0, 'Quantité positive attendue.').max(999_999, 'Quantité trop grande.').nullable();

/** Item of a sheet: a product of the base lists, or a label of its own. */
export const sheetItemSchema = z.object({
  /** Item kept (its comments with it); none: a new one. */
  id: z.string().nullish(),
  productId: z.string().nullable(),
  label: requiredText(200, 'Le libellé est requis.'),
  /** Category of the shopping products. */
  categoryId: z.string().nullable(),
  quantity,
  unit: z.string().trim().max(40, '40 caractères maximum.').nullable(),
  /** Description (markdown). */
  note: z.string().max(20_000, 'Description trop longue.').nullable(),
  /** Used up when the sheet is used (taken from the stock); a checklist item: taken when ticked. */
  consumable: z.boolean().default(true),
  /** As the items of the shopping lists: store, link, conservation, whom it is for, optional. */
  storeId: shopping.storeId.default(null),
  url: shopping.url.default(null),
  perishable: shopping.perishable,
  storageId: shopping.storageId,
  memberIds: shopping.memberIds,
  relationIds: shopping.relationIds,
  optional: shopping.optional,
});
export type SheetItemInput = z.input<typeof sheetItemSchema>;

/** Sheet: a name, a note, its project and categories (its items are changed one by one). */
export const sheetSchema = z.object({
  name: requiredText(100),
  note: z.string().max(20_000, 'Note trop longue.').nullable(),
  /** Project it belongs to; none: of the workspace. */
  projectId: z.string().nullable(),
  categoryIds: z.array(z.string()).max(50),
});
export type SheetInput = z.infer<typeof sheetSchema>;

/** Category of the sheets: a name and a color. */
export const sheetCategorySchema = z.object({
  name: requiredText(60),
  color: colorSchema,
});
export type SheetCategoryInput = z.infer<typeof sheetCategorySchema>;

/** How many times a sheet is added (2 × « Crêpes »). */
export const sheetMultiplierSchema = z.number().positive('Multiplicateur positif attendu.').max(999, '999 au plus.');

/** Sheet of a routine, an event or a task, times a multiplier. */
export const sheetLinkSchema = z.object({ sheetId: z.string().min(1), multiplier: sheetMultiplierSchema });
export type SheetLinkInput = z.infer<typeof sheetLinkSchema>;

/** Item of a checklist added by hand, or changed. */
export const checklistItemSchema = sheetItemSchema;

/** Share of a sheet in an item of a list (shopping list or checklist). */
export interface SheetSource {
  sheetId: string;
  name: string;
  /** Quantity it brings (none: no quantity). */
  quantity: number | null;
}

/**
 * Sources stored (JSON), validated: none when invalid.
 * @param {unknown} value Sources.
 * @returns {SheetSource[]} Sources.
 */
export function readSheetSources(value: unknown): SheetSource[] {
  const parsed = z.array(z.object({ sheetId: z.string(), name: z.string(), quantity: z.number().nullable() })).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Key items are summed by: their product, or else their label and unit (case and spaces aside).
 * @param {{ productId?: string | null, label: string, unit?: string | null }} item Item.
 * @returns {string} Key.
 */
export function sheetItemKey(item: { productId?: string | null; label: string; unit?: string | null }): string {
  if (item.productId) return `p:${item.productId}`;
  const clean = (text: string | null | undefined) => (text ?? '').trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
  return `l:${clean(item.label)}|${clean(item.unit)}`;
}

/**
 * Quantity rounded to the thousandth (the precision of the quantities stored).
 * @param {number} value Quantity.
 * @returns {number} Rounded quantity.
 */
export const roundQuantity = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * Sum of two quantities, one of them possibly missing.
 * @param {number | null} a Quantity.
 * @param {number | null} b Quantity.
 * @returns {number | null} Sum (none when both are missing).
 */
export const addQuantities = (a: number | null, b: number | null): number | null => (a === null && b === null ? null : roundQuantity((a ?? 0) + (b ?? 0)));

/**
 * Quantity of a sheet item times a multiplier.
 * @param {number | null} value Quantity.
 * @param {number} multiplier Multiplier.
 * @returns {number | null} Quantity.
 */
export const timesSheet = (value: number | null, multiplier: number): number | null => (value === null ? null : roundQuantity(value * multiplier));
