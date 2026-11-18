import { z } from 'zod';
import { requiredText } from './rules';

/** Point on the map (WGS 84). */
const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

/** Travel time to a place or back from it, in minutes (at most a day). */
const travelTimeSchema = z
  .number()
  .int()
  .min(0, 'Durée positive attendue.')
  .max(24 * 60, '24 h maximum.')
  .default(0);

/** Fields of a located item (event, routine): the point of its place, when chosen from the map or a search, and the travel times to it and back. */
export const locatedFields = {
  locationLat: geoPointSchema.shape.lat.nullable().default(null),
  locationLon: geoPointSchema.shape.lon.nullable().default(null),
  travelBefore: travelTimeSchema,
  travelAfter: travelTimeSchema,
};

/** Ways to travel a route can be computed for. */
export const TRAVEL_MODES = ['CAR', 'BIKE', 'FOOT'] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = { CAR: 'Voiture', BIKE: 'Vélo', FOOT: 'À pied' };

/** Saved place ("Maison", "Bureau"…): a name, an address and its point. */
export const placeSchema = z
  .object({
    name: requiredText(60),
    address: z.string().trim().max(300, '300 caractères maximum.').default(''),
    /** Its point; none for a zone (that of the place it is in). */
    lat: geoPointSchema.shape.lat.nullable().default(null),
    lon: geoPointSchema.shape.lon.nullable().default(null),
    /** Place a zone is in (a room of the house…); null: a place with its own address. */
    parentId: z.string().nullable().default(null),
  })
  .refine((place) => place.parentId !== null || (place.lat !== null && place.lon !== null), { path: ['address'], message: 'Choisissez une adresse proposée.' });
export type PlaceInput = z.input<typeof placeSchema>;

/**
 * Travel time rounded up to 5 minutes, as entered for an event.
 * @param {number} seconds Duration of the route.
 * @returns {number} Minutes.
 */
export function travelMinutes(seconds: number): number {
  return Math.ceil(seconds / 60 / 5) * 5;
}
