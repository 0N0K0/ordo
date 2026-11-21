import { z } from 'zod';
import { optionalPlainText, requiredText } from '../core/rules';
import { colorSchema } from '../core/workspace';
import { itemNoteSchema, quantitySchema, shoppingItemSchema, unitSchema } from './shopping';

const shopping = shoppingItemSchema.shape;

/** Item of a sheet: a product of the base lists, or a label of its own. */
export const sheetItemSchema = z.object({
  /** Item kept (its comments with it); none: a new one. */
  id: z.string().nullish(),
  productId: z.string().nullable(),
  label: requiredText(),
  /** Category of the shopping products. */
  categoryId: z.string().nullable(),
  quantity: quantitySchema.nullable(),
  unit: unitSchema,
  /** Description (markdown). */
  note: itemNoteSchema,
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

/** Sheet: a label, a note, its project and categories (its items are changed one by one). */
export const sheetSchema = z.object({
  label: requiredText(),
  note: optionalPlainText(),
  /** Project it belongs to; none: of the workspace. */
  projectId: z.string().nullable(),
  categoryIds: z.array(z.string()).max(50),
});
export type SheetInput = z.infer<typeof sheetSchema>;

/** Category of the sheets: a label and a color. */
export const sheetCategorySchema = z.object({
  label: requiredText(),
  color: colorSchema,
});
export type SheetCategoryInput = z.infer<typeof sheetCategorySchema>;

/** How many times a sheet is added (2 × « Crêpes »). */
export const sheetMultiplierSchema = z.number().positive('Multiplicateur positif attendu.').max(999, '999 au plus.');

/** Sheet of a routine, an event or a task, times a multiplier. */
export const sheetLinkSchema = z.object({ sheetId: z.string().min(1), multiplier: sheetMultiplierSchema });
export type SheetLinkInput = z.infer<typeof sheetLinkSchema>;
/**
 * Sheets of a routine, an event or a task as their panel edits them: a multiplier emptied is not
 * positive (« Multiplicateur positif attendu. »).
 */
export const sheetLinksFormSchema = z.object({
  links: z.array(
    z.object({
      sheetId: z.string().min(1),
      multiplier: z
        .union([z.number(), z.literal('')])
        .transform((value) => (value === '' ? 0 : value))
        .pipe(sheetMultiplierSchema),
    }),
  ),
});

/** Item of a checklist added by hand, or changed. */
export const checklistItemSchema = sheetItemSchema;

/** Share of a sheet in an item of a list (shopping list or checklist). */
export interface SheetSource {
  sheetId: string;
  /** Label of the sheet when it was added. */
  label: string;
  /** Quantity it brings (none: no quantity). */
  quantity: number | null;
}

/**
 * Sources stored (JSON), validated: none when invalid.
 * @param {unknown} value Sources.
 * @returns {SheetSource[]} Sources.
 */
export function readSheetSources(value: unknown): SheetSource[] {
  const parsed = z.array(z.object({ sheetId: z.string(), label: z.string(), quantity: z.number().nullable() })).safeParse(value);
  return parsed.success ? parsed.data : [];
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
