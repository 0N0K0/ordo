import { z } from 'zod';
import { colorSchema, labelNameSchema } from './workspace';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'Texte trop long.')
    .transform((value) => value || null)
    .nullable();

const linkSchema = z
  .union([z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }), z.literal('')])
  .transform((value) => value || null)
  .nullable();

const quantitySchema = z.number({ error: 'Nombre attendu.' }).positive('La quantité doit être positive.').max(999_999, 'Quantité trop grande.').nullable();
const priceSchema = z.number({ error: 'Montant attendu.' }).min(0, 'Le prix ne peut pas être négatif.').max(9_999_999, 'Prix trop grand.').nullable();

/** Shopping category or store: a name and a color. */
export const shoppingLabelSchema = z.object({ name: labelNameSchema, color: colorSchema });
export type ShoppingLabelInput = z.input<typeof shoppingLabelSchema>;

/** Fields shared by a product of the base list and an item of a list. */
const shoppingFields = {
  name: z.string().trim().min(1, 'Le nom est requis.').max(120, '120 caractères maximum.'),
  categoryId: z.string().nullable(),
  storeId: z.string().nullable(),
  url: linkSchema,
  note: optionalText(500),
  quantity: quantitySchema,
  unit: optionalText(20),
  unitPrice: priceSchema,
  /** Members of the team or household it is for. */
  memberIds: z.array(z.string()).max(50).default([]),
  /** Relations (out of the team or household) it is for. */
  relationIds: z.array(z.string()).max(50).default([]),
};

export const shoppingProductSchema = z.object({ ...shoppingFields, missing: z.boolean() });
export type ShoppingProductInput = z.input<typeof shoppingProductSchema>;

export const shoppingItemSchema = z.object(shoppingFields);
export type ShoppingItemInput = z.input<typeof shoppingItemSchema>;

export const shoppingListNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(120, '120 caractères maximum.');

/**
 * Estimated cost of a product or an item: its quantity (1 without) times its unit price.
 * @param {{ quantity: number | null, unitPrice: number | null }} item Product or item.
 * @returns {number | null} Cost, null without price.
 */
export function shoppingCost({ quantity, unitPrice }: { quantity: number | null; unitPrice: number | null }): number | null {
  return unitPrice === null ? null : Math.round((quantity ?? 1) * unitPrice * 100) / 100;
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
    const cents = Math.round((shoppingCost(item) ?? 0) * 100);
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
