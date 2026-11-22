import type { ShoppingDeliveryInput } from '@ordo/shared';
import * as fmt from '../../../lib/format';
import type { ShoppingList } from '../api';

type Delivery = ShoppingList['deliveries'][number];

/**
 * When a delivery is expected: « du 12 au 14 nov. », « le 12 nov. », nothing without dates.
 * @param {Delivery} delivery Delivery.
 * @returns {string} Text.
 */
export function deliveryWindow(delivery: Delivery): string {
  const from = delivery.windowFrom ? fmt.day(delivery.windowFrom) : null;
  const to = delivery.windowTo ? fmt.day(String(delivery.windowTo)) : null;
  if (from && to && from !== to) return `du ${from} au ${to}`;
  return from || to ? `le ${from ?? to}` : '';
}

/**
 * Name of a delivery of a list: its label, else « Retrait » / « Livraison » and when it is expected; nothing for none.
 * @param {readonly Delivery[]} deliveries Deliveries of the list.
 * @param {string | null | undefined} id Delivery.
 * @returns {string} Name.
 */
export function deliveryLabel(deliveries: readonly Delivery[], id: string | null | undefined): string {
  const delivery = deliveries.find((item) => item.id === id);
  return delivery ? delivery.label || `${delivery.pickup ? 'Retrait' : 'Livraison'} ${deliveryWindow(delivery)}`.trim() : '';
}

/**
 * Input of a delivery as it is, with the items it brings.
 * @param {Delivery} delivery Delivery.
 * @param {string[]} itemIds Items.
 * @returns {ShoppingDeliveryInput} Input.
 */
export const deliveryInput = (delivery: Delivery, itemIds: string[]): ShoppingDeliveryInput => ({
  label: delivery.label ?? null,
  trackingUrl: delivery.trackingUrl ?? null,
  pickup: delivery.pickup,
  windowFrom: delivery.windowFrom || null,
  windowTo: delivery.windowTo || null,
  address: delivery.address ?? null,
  lat: delivery.lat ?? null,
  lon: delivery.lon ?? null,
  itemIds,
});
