import { round2, toCents } from '../accounting/accounting-documents';
import { z } from 'zod';
import { markdownSchema, optionalText, requiredText } from '../core/rules';
import { nameKey } from '../core/text';
import { joinedKey } from '../core/collections';
import { dateSchema, optionalColorSchema, type LabelFormValues } from '../core/workspace';

const linkSchema = z
  .union([z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }), z.literal('')])
  .transform((value) => value || null)
  .nullable();

/** Quantity of a product (sheet, stock or shopping item): 0 or more. */
export const quantitySchema = z.number({ error: 'Nombre attendu.' }).min(0, 'Quantité positive attendue.').max(999_999, 'Quantité trop grande.');
/** Unit of a product (sheet, stock or shopping item): may be left empty (null). */
export const unitSchema = optionalText();
/** Note of a product (sheet, stock or shopping item, markdown): may be left empty (null). */
export const itemNoteSchema = markdownSchema;
const priceSchema = z.number({ error: 'Montant attendu.' }).min(0, 'Le prix ne peut pas être négatif.').max(9_999_999, 'Prix trop grand.').nullable();

/** Store, storage mode or unit: a label and a color (labelFormSchema). */
export type ShoppingStoreInput = LabelFormValues;

/** Category of products, in a tree. */
export const shoppingCategorySchema = z.object({
  label: requiredText(),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
  /** Base lists it is offered in (none: all; a sub-category without any takes those of its parent). */
  baseListIds: z.array(z.string()).max(100).default([]),
});
export type ShoppingCategoryInput = z.input<typeof shoppingCategorySchema>;

/** Fields shared by a product of the base list and an item of a list. */
const shoppingFields = {
  label: requiredText(),
  categoryId: z.string().nullable(),
  storeId: z.string().nullable(),
  url: linkSchema,
  note: itemNoteSchema,
  quantity: quantitySchema.nullable(),
  unit: unitSchema,
  unitPrice: priceSchema,
  /** Members of the team or household it is for. */
  memberIds: z.array(z.string()).max(50).default([]),
  /** Relations (out of the team or household) it is for. */
  relationIds: z.array(z.string()).max(50).default([]),
  /** Perishable: kept in a storage mode until a "best before" date (both ignored otherwise). */
  perishable: z.boolean().default(false),
  storageId: z.string().nullable().default(null),
  /** "Best before" date, YYYY-MM-DD. */
  expiresAt: dateSchema.default(null),
};

/** Product of a base list: its fields, the base list holding it and whether it is missing. */
export const shoppingProductSchema = z.object({ ...shoppingFields, baseListId: z.string().min(1, 'La liste type est requise.'), missing: z.boolean() });
export type ShoppingProductInput = z.input<typeof shoppingProductSchema>;

/** Item of a list: its fields, and whether it is optional (bought if possible, the list done without it). */
export const shoppingItemSchema = z.object({ ...shoppingFields, optional: z.boolean().default(false) });
export type ShoppingItemInput = z.input<typeof shoppingItemSchema>;

/** Base list ("liste type"): its label. */
export const shoppingBaseListLabelSchema = requiredText();

export const shoppingListLabelSchema = requiredText();

/** Label and tasks of a shopping list, as its forms edit them. */
export const shoppingListFormSchema = z.object({ label: shoppingListLabelSchema, taskIds: z.array(z.string()) });

/**
 * Estimated cost of a product or an item: its quantity (1 without) times its unit price.
 * @param {{ quantity: number | null, unitPrice: number | null }} item Product or item.
 * @returns {number | null} Cost, null without price.
 */
export function shoppingCost({ quantity, unitPrice }: { quantity: number | null; unitPrice: number | null }): number | null {
  return unitPrice === null ? null : round2((quantity ?? 1) * unitPrice);
}

/**
 * Share of each person in the cost of items: an item for several people is split evenly; an item for nobody is
 * left out.
 * @param {readonly { quantity: number | null, unitPrice: number | null, memberIds: readonly string[], relationIds: readonly string[] }[]} items Items.
 * @returns {{ members: Map<string, number>, relations: Map<string, number>, total: number }} Shares in cents, and the total in cents.
 */
export function shoppingShares(items: readonly { quantity: number | null; unitPrice: number | null; memberIds: readonly string[]; relationIds: readonly string[] }[]): {
  members: Map<string, number>;
  relations: Map<string, number>;
  total: number;
} {
  const members = new Map<string, number>();
  const relations = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const cents = toCents(shoppingCost(item) ?? 0);
    total += cents;
    const people = item.memberIds.length + item.relationIds.length;
    if (!cents || !people) continue;
    // Cents left by an uneven split go to the first people.
    const base = Math.floor(cents / people);
    let left = cents - base * people;
    const share = () => base + (left-- > 0 ? 1 : 0);
    for (const id of item.memberIds) members.set(id, (members.get(id) ?? 0) + share());
    for (const id of item.relationIds) relations.set(id, (relations.get(id) ?? 0) + share());
  }
  return { members, relations, total };
}

/** Units of quantity a new workspace starts with (then set in the shopping settings). */
export const DEFAULT_SHOPPING_UNITS = ['pièce', 'kg', 'g', 'L', 'cl', 'boîte', 'paquet', 'bouteille', 'sachet', 'lot', 'rouleau', 'carton', 'paire'] as const;

/**
 * Key of what a product line holds, the same in the sheets, the shopping lists and the stock: its product, or else its
 * label and unit (case, accents and spaces aside, as `sameName`). Two lines of the same key are the same product (summed, stored together).
 * @param {{ productId?: string | null, label: string, unit?: string | null }} item Item.
 * @returns {string} Key.
 */
export function productKey(item: { productId?: string | null; label: string; unit?: string | null }): string {
  if (item.productId) return `p:${item.productId}`;
  return `l:${joinedKey(nameKey(item.label), nameKey(item.unit))}`;
}
