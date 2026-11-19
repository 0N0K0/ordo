import type { AddressValue } from '../components/AddressInput';

/** Location of an item (event, routine, task): its text and the point of its place (none: unknown). */
export interface ItemLocation {
  location: string | null;
  locationLat: number | null;
  locationLon: number | null;
}

/**
 * Address of the location of an item, for its field: its text, and its point when it has both coordinates.
 * @param {Partial<ItemLocation>} item Event, routine or task (or the values of its form).
 * @returns {AddressValue} Address.
 */
export function addressOf({ location, locationLat, locationLon }: Partial<ItemLocation>): AddressValue {
  return { text: location ?? '', point: locationLat != null && locationLon != null ? { lat: locationLat, lon: locationLon } : null };
}

/**
 * Location fields of an address typed or chosen (as typed: the schema trims it).
 * @param {AddressValue} value Address.
 * @returns {{ location: string, locationLat: number | null, locationLon: number | null }} Fields.
 */
export function locationOf(value: AddressValue): { location: string; locationLat: number | null; locationLon: number | null } {
  return { location: value.text, locationLat: value.point?.lat ?? null, locationLon: value.point?.lon ?? null };
}
