import { z } from 'zod';

/** Point on the map (WGS 84). */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

/** Ways to travel a route can be computed for. */
export const TRAVEL_MODES = ['CAR', 'BIKE', 'FOOT'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { CAR: 'Voiture', BIKE: 'Vélo', FOOT: 'À pied' };

/** Saved place ("Maison", "Bureau"…): a name, an address and its point. */
export const placeSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.'),
  address: z.string().trim().max(300, '300 caractères maximum.'),
  ...geoPointSchema.shape,
});
export type PlaceInput = z.input<typeof placeSchema>;

/**
 * Travel time rounded up to 5 minutes, as entered for an event.
 * @param {number} seconds Duration of the route.
 * @returns {number} Minutes.
 */
export function travelMinutes(seconds: number): number {
  return Math.ceil(seconds / 60 / 5) * 5;
}
