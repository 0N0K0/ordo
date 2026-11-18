import { lineageOf, mapById, placeSchema, type GeoPoint, type PlaceInput, type TravelMode } from '@ordo/shared';
import { env } from '../../env';
import { treeListService } from './trees';
import { prisma } from '../../db';
import { type Place } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { deleteOrNotFound } from './lookup';
import { assertNotArchived } from './archive';

/** Address found by a search: the address in words, the label of the place and its point (as a `Place`). */
export interface AddressSuggestion {
  address: string;
  /** Label of the place, when it has one (a station, a shop…). */
  label: string | null;
  lat: number;
  lon: number;
}

/** Route between two points. */
export interface TravelTime {
  seconds: number;
  meters: number;
}

/** Waits at most this long for the services. */
const TIMEOUT = 8_000;
const HEADERS = { 'User-Agent': 'Ordo (self-hosted calendar)', Accept: 'application/json' };

/**
 * JSON of a request to a geographic service, or a user error when it fails.
 * @param {string} url URL.
 * @returns {Promise<unknown>} Body.
 */
async function getJson(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT) });
  } catch {
    throw clientError('SERVICE_UNAVAILABLE', 'Le service de cartographie ne répond pas.');
  }
  if (!response.ok) throw clientError('SERVICE_UNAVAILABLE', `Le service de cartographie a répondu ${response.status}.`);
  return response.json();
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
}

/**
 * Address of a Photon result in words: "Gare de Lyon, 20 Boulevard Diderot, 75012 Paris, France".
 * @param {Record<string, string | undefined>} p Properties.
 * @returns {{ address: string, label: string | null }} Address, and label of the place when it has one.
 */
function photonAddress(p: Record<string, string | undefined>): { address: string; label: string | null } {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const city = [p.postcode, p.city ?? p.town ?? p.village ?? p.district].filter(Boolean).join(' ');
  // A street or a city found as such has its name in "name".
  const label = p.name && p.name !== p.street && p.name !== p.city ? p.name : null;
  const parts = [label, street || (p.type === 'street' ? p.name : null), city || (p.type === 'city' ? p.name : null), p.country].filter(Boolean) as string[];
  return { address: [...new Set(parts)].join(', '), label };
}

/**
 * Points of Photon results.
 * @param {unknown} body Response.
 * @returns {AddressSuggestion[]} Addresses.
 */
function photonSuggestions(body: unknown): AddressSuggestion[] {
  const features = ((body as { features?: PhotonFeature[] })?.features ?? []).filter((feature) => feature.geometry?.coordinates);
  const seen = new Set<string>();
  return features.flatMap((feature) => {
    const [lon, lat] = feature.geometry!.coordinates!;
    const { address, label } = photonAddress(feature.properties ?? {});
    if (!address || seen.has(address)) return [];
    seen.add(address);
    return [{ address, label, lat, lon }];
  });
}

/**
 * Addresses and places matching a text (OpenStreetMap, through Photon), the closest to a point first when given.
 * @param {string} text Text typed.
 * @param {GeoPoint | null} near Point to favor (a saved place…).
 * @returns {Promise<AddressSuggestion[]>} Up to 6 addresses.
 */
export async function searchAddresses(text: string, near: GeoPoint | null): Promise<AddressSuggestion[]> {
  const query = text.trim();
  if (query.length < 3) return [];
  const params = new URLSearchParams({ q: query.slice(0, 200), limit: '6', lang: 'fr' });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lon));
  }
  return photonSuggestions(await getJson(`${env.PHOTON_URL}/api/?${params}`));
}

/**
 * Address of a point (a click on the map).
 * @param {GeoPoint} point Point.
 * @returns {Promise<AddressSuggestion | null>} Closest address, none when nothing is around.
 */
export async function reverseAddress(point: GeoPoint): Promise<AddressSuggestion | null> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lon), limit: '1', lang: 'fr' });
  const [found] = photonSuggestions(await getJson(`${env.PHOTON_URL}/reverse?${params}`));
  return found ? { ...found, lat: point.lat, lon: point.lon } : null;
}

const PROFILES: Record<TravelMode, string> = { CAR: 'car', BIKE: 'bike', FOOT: 'foot' };
/** Routes already computed (they hardly change): key → route. */
const routes = new Map<string, TravelTime>();

/**
 * Travel time between two points (OpenStreetMap roads, through OSRM).
 * @param {GeoPoint} from Start.
 * @param {GeoPoint} to End.
 * @param {TravelMode} mode Car, bike or foot.
 * @returns {Promise<TravelTime>} Route.
 */
export async function travelTime(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<TravelTime> {
  const coordinates = `${from.lon.toFixed(6)},${from.lat.toFixed(6)};${to.lon.toFixed(6)},${to.lat.toFixed(6)}`;
  const key = `${mode}:${coordinates}`;
  const known = routes.get(key);
  if (known) return known;
  const base = env.ROUTING_URL.replace('{profile}', PROFILES[mode]);
  const body = (await getJson(`${base}/route/v1/driving/${coordinates}?overview=false`)) as { code?: string; routes?: { duration: number; distance: number }[] };
  const route = body.code === 'Ok' ? body.routes?.[0] : undefined;
  if (!route) throw clientError('BAD_USER_INPUT', 'Aucun itinéraire trouvé entre ces deux points.');
  const result = { seconds: Math.round(route.duration), meters: Math.round(route.distance) };
  if (routes.size > 1000) routes.clear();
  routes.set(key, result);
  return result;
}

/** Saved place with what its zones take from the place they are in: its point, and its full label. */
export interface PlaceView {
  id: string;
  label: string;
  address: string;
  parentId: string | null;
  /** Point of the place, or of the place a zone is in. */
  lat: number;
  lon: number;
  /** « Maison › Cuisine ». */
  path: string;
  /** Color of its avatar (none: gray). */
  color: string | null;
  /** Image shown as its avatar. */
  iconId: string | null;
  /** Manual order among its siblings. */
  position: number;
  /** Archived: hidden by default, read only. */
  archived: boolean;
}

/**
 * Saved places of the workspace, in their manual order (then by label): each zone with the point and the address of the
 * place it is in.
 * @returns {Promise<PlaceView[]>} Places.
 */
export async function places(): Promise<PlaceView[]> {
  const rows = await prisma.place.findMany({ orderBy: [{ position: 'asc' }, { label: 'asc' }] });
  const byId = mapById(rows);
  return rows.flatMap((row) => {
    // From the place at the top down to this one.
    const chain = lineageOf(byId, row.id).reverse();
    const located = [...chain].reverse().find((item) => item.lat !== null && item.lon !== null);
    if (!located) return [];
    return [
      {
        id: row.id,
        label: row.label,
        address: row.address || located.address,
        parentId: row.parentId,
        lat: located.lat!,
        lon: located.lon!,
        path: chain.map((item) => item.label).join(' › '),
        color: row.color,
        iconId: row.iconId,
        position: row.position,
        archived: row.archivedAt !== null,
      },
    ];
  });
}

/** Conflicts of a place label: among the places at the top, among the zones of a place (the database checks these). */
const PLACE_TAKEN = 'Un lieu porte déjà ce libellé.';
const ZONE_TAKEN = 'Une zone de ce lieu porte déjà ce libellé.';

/** Places and their zones, as every settings tree (deleting a place deletes its zones, though: see deletePlace). */
const placeTree = treeListService<Place, ReturnType<typeof placeSchema.parse>>(
  'place',
  { notFound: 'Lieu', missingParent: 'Lieu', loop: 'Une zone ne peut pas être dans elle-même.' },
  {
    parse: async (input, current) => {
      const data = parseInput(placeSchema, input);
      // A zone has no address of its own.
      if (data.parentId) Object.assign(data, { address: '', lat: null, lon: null });
      // A label is unique among the places at the top (the database checks the zones).
      if (!data.parentId && (await prisma.place.count({ where: { parentId: null, label: data.label, ...(current && { id: { not: current.id } }) } }))) {
        throw fieldError('label', PLACE_TAKEN);
      }
      return data;
    },
    moveInput: (current, parentId) => ({ label: current.label, address: current.address, lat: current.lat, lon: current.lon, parentId }),
    save: (id, data) => prisma.place.update({ where: { id }, data }).catch((error: unknown) => rethrowUnique(error, ZONE_TAKEN)),
  },
);

/**
 * Saves a place (refused when archived, or under a new parent archived); under another parent, it goes last.
 * @param {string | null} id Place to change, or null to create one.
 * @param {PlaceInput} input Label, address and point.
 * @returns {Promise<Place>} Place.
 */
export async function savePlace(id: string | null, input: PlaceInput): Promise<Place> {
  if (id) return placeTree.update(id, input);
  try {
    return await placeTree.create(input);
  } catch (error) {
    rethrowUnique(error, ZONE_TAKEN);
  }
}

/**
 * Deletes a place (events keep their address).
 * @param {string} id Place.
 * @returns {Promise<void>}
 */
export async function deletePlace(id: string): Promise<void> {
  await deleteOrNotFound(prisma.place, id, 'Lieu');
}

/**
 * Moves a place among its siblings, or a zone under another place or zone: a place keeps its address (it never becomes
 * a zone), a zone never becomes a place (it has no address); never into itself nor one of its zones.
 * @param {string} id Place or zone moved.
 * @param {string | null} parentId New parent: null for a place, a place or a zone for a zone.
 * @param {number} index Index among its new siblings.
 * @returns {Promise<void>}
 */
export async function movePlace(id: string, parentId: string | null, index: number): Promise<void> {
  const place = await orNotFound(prisma.place.findUnique({ where: { id }, select: { parentId: true } }), 'Lieu');
  await assertNotArchived('place', id);
  if ((place.parentId === null) !== (parentId === null)) {
    throw clientError('BAD_USER_INPUT', place.parentId === null ? 'Un lieu garde son adresse : il ne peut pas devenir une zone.' : 'Une zone n’a pas d’adresse : elle ne peut pas devenir un lieu.');
  }
  await placeTree.move(id, parentId, index);
}
