import { z } from 'zod';
import { requiredText } from '../core/rules';
import { daySchema } from '../dates/times';
import { optionalColorSchema } from '../core/workspace';
import { itemNoteSchema, quantitySchema as quantity, unitSchema } from './shopping';

/** Place things are kept (Frigo, Congélateur…), in a tree. */
export const stockLocationSchema = z.object({
  name: requiredText(80),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
});
export type StockLocationInput = z.infer<typeof stockLocationSchema>;

/** Item of the stock: a reference followed in stock, or an item of its own. */
export const stockItemSchema = z.object({
  productId: z.string().nullable(),
  label: requiredText(200, 'Le libellé est requis.'),
  categoryId: z.string().nullable(),
  unit: unitSchema,
  locationId: z.string().nullable(),
  note: itemNoteSchema,
  perishable: z.boolean(),
  memberIds: z.array(z.string()).max(100),
  relationIds: z.array(z.string()).max(100),
});
export type StockItemInput = z.infer<typeof stockItemSchema>;

/** New item of the stock with what it starts with (a first lot). */
export const newStockItemSchema = stockItemSchema.extend({ quantity: quantity.nullable(), expiresAt: daySchema().nullable() });
export type NewStockItemInput = z.infer<typeof newStockItemSchema>;

export const STOCK_MOVEMENT_KINDS = ['PURCHASE', 'CONSUMPTION', 'COUNT', 'LOSS', 'CORRECTION'] as const;
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/** Names of the kinds of movements. */
export const STOCK_MOVEMENT_LABELS: Record<StockMovementKind, string> = {
  PURCHASE: 'Achat',
  CONSUMPTION: 'Consommation',
  COUNT: 'Inventaire',
  LOSS: 'Perte',
  CORRECTION: 'Correction',
};

/**
 * Quantity in or out of an item by hand: bought (a lot, with its date), used up or lost (from the lots that expire
 * first, or from one lot), corrected (signed).
 */
export const stockMoveSchema = z
  .object({
    itemId: z.string().min(1),
    kind: z.enum(['PURCHASE', 'CONSUMPTION', 'LOSS', 'CORRECTION']),
    /** Positive; a correction is signed. */
    quantity: z
      .number()
      .min(-999_999)
      .max(999_999)
      .refine((value) => value !== 0, 'Quantité non nulle attendue.'),
    /** Lot taken from (none: those that expire first) or added to (none: a new lot). */
    lotId: z.string().nullable(),
    /** Date of a new lot. */
    expiresAt: daySchema().nullable(),
    note: z.string().max(2000).nullable(),
  })
  .refine((move) => move.kind === 'CORRECTION' || move.quantity > 0, { path: ['quantity'], message: 'Quantité positive attendue.' });
export type StockMoveInput = z.infer<typeof stockMoveSchema>;

/** Inventory: the quantities counted (of a place, or of everything). */
export const stockCountSchema = z.object({
  locationId: z.string().nullable(),
  note: z.string().max(2000).nullable(),
  lines: z
    .array(z.object({ itemId: z.string().min(1), counted: quantity }))
    .min(1, 'Comptez au moins un article.')
    .max(2000),
});
export type StockCountInput = z.infer<typeof stockCountSchema>;

/** Stock settings of a reference. */
export const productStockSchema = z.object({
  stockTracked: z.boolean(),
  consumable: z.boolean(),
  autoStock: z.boolean(),
  stockLocationId: z.string().nullable(),
});
export type ProductStockInput = z.infer<typeof productStockSchema>;

/** Purchase added to the stock: how much (its quantity bought), where, and until when. */
export const stockPurchaseSchema = z.object({
  shoppingItemId: z.string().min(1),
  quantity: quantity.refine((value) => value > 0, 'Quantité positive attendue.'),
  locationId: z.string().nullable(),
  expiresAt: daySchema().nullable(),
});
export type StockPurchaseInput = z.infer<typeof stockPurchaseSchema>;

const url = z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' })]).nullable();

/** Remote order of a shopping list: where it is delivered. */
export const shoppingOrderSchema = z.object({
  remote: z.boolean(),
  deliveryAddress: z.string().trim().max(500).nullable(),
  deliveryLat: z.number().nullable(),
  deliveryLon: z.number().nullable(),
});
export type ShoppingOrderInput = z.infer<typeof shoppingOrderSchema>;

/** Delivery of a remote order. */
export const shoppingDeliverySchema = z
  .object({
    label: z.string().trim().max(120, '120 caractères maximum.').nullable(),
    trackingUrl: url,
    /** To pick up rather than delivered. */
    pickup: z.boolean(),
    windowFrom: daySchema().nullable(),
    windowTo: daySchema().nullable(),
    /** Where, when other than the delivery place of the order. */
    address: z.string().trim().max(500).nullable(),
    lat: z.number().nullable(),
    lon: z.number().nullable(),
    /** Items of the list it brings. */
    itemIds: z.array(z.string()).max(500),
  })
  .refine((delivery) => !delivery.windowFrom || !delivery.windowTo || delivery.windowTo >= delivery.windowFrom, { path: ['windowTo'], message: 'La fin doit suivre le début.' });
export type ShoppingDeliveryInput = z.infer<typeof shoppingDeliverySchema>;
