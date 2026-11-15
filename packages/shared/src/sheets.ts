import { z } from 'zod';

const quantity = z.number().min(0, 'Quantité positive attendue.').max(999_999, 'Quantité trop grande.').nullable();

/** Item of a sheet: a product of the base lists, or a label of its own. */
export const sheetItemSchema = z.object({
  /** Item kept (its comments with it); none: a new one. */
  id: z.string().nullish(),
  productId: z.string().nullable(),
  label: z.string().trim().min(1, 'Le libellé est requis.').max(200, '200 caractères maximum.'),
  /** Category of the shopping products. */
  categoryId: z.string().nullable(),
  quantity,
  unit: z.string().trim().max(40, '40 caractères maximum.').nullable(),
  /** Description (markdown). */
  note: z.string().max(20_000, 'Description trop longue.').nullable(),
});
export type SheetItemInput = z.infer<typeof sheetItemSchema>;

/** Sheet: a name, a note, and its items. */
export const sheetSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  note: z.string().max(20_000, 'Note trop longue.').nullable(),
  /** Project it belongs to; none: of the workspace. */
  projectId: z.string().nullable(),
  items: z.array(sheetItemSchema).max(300, '300 éléments au plus.'),
});
export type SheetInput = z.infer<typeof sheetSchema>;

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
 * Sum of two quantities, one of them possibly missing.
 * @param {number | null} a Quantity.
 * @param {number | null} b Quantity.
 * @returns {number | null} Sum (none when both are missing).
 */
export const addQuantities = (a: number | null, b: number | null): number | null => (a === null && b === null ? null : Math.round(((a ?? 0) + (b ?? 0)) * 1000) / 1000);

/**
 * Quantity of a sheet item times a multiplier.
 * @param {number | null} value Quantity.
 * @param {number} multiplier Multiplier.
 * @returns {number | null} Quantity.
 */
export const timesSheet = (value: number | null, multiplier: number): number | null => (value === null ? null : Math.round(value * multiplier * 1000) / 1000);
