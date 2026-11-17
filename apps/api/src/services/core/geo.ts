import { mapById, type GeoPoint, lineageOf, type PlaceInput, placeSchema, type TravelMode } from '@ordo/shared';
import { env } from '../../env';
import { prisma } from '../../db';
import { Prisma, type Place } from '../../generated/prisma/client';
import { clientError, notFound, parseInput } from '../../graphql/errors';

/** Address found by a search: its label and point. */
export interface AddressSuggestion {
  label: string;
  /** Name of the place, when it has one (a station, a shop…). */
  name: string | null;
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
 * @returns {{ label: string, name: string | null }} Label and name.
 */
function photonLabel(p: Record<string, string | undefined>): { label: string; name: string | null } {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const city = [p.postcode, p.city ?? p.town ?? p.village ?? p.district].filter(Boolean).join(' ');
  // A street or a city found as such has its name in "name".
  const name = p.name && p.name !== p.street && p.name !== p.city ? p.name : null;
  const parts = [name, street || (p.type === 'street' ? p.name : null), city || (p.type === 'city' ? p.name : null), p.country].filter(Boolean) as string[];
  return { label: [...new Set(parts)].join(', '), name };
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
    const { label, name } = photonLabel(feature.properties ?? {});
    if (!label || seen.has(label)) return [];
    seen.add(label);
    return [{ label, name, lat, lon }];
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

/** Saved place with what its zones take from the place they are in: its point, and its full name. */
export interface PlaceView {
  id: string;
  name: string;
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
}

/**
 * Saved places of the workspace, in their manual order (then by name): each zone with the point and the address of the
 * place it is in.
 * @returns {Promise<PlaceView[]>} Places.
 */
export async function places(): Promise<PlaceView[]> {
  const rows = await prisma.place.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const byId = mapById(rows);
  return rows.flatMap((row) => {
    // From the place at the top down to this one.
    const chain = lineageOf(byId, row.id).reverse();
    const located = [...chain].reverse().find((item) => item.lat !== null && item.lon !== null);
    if (!located) return [];
    return [
      {
        id: row.id,
        name: row.name,
        address: row.address || located.address,
        parentId: row.parentId,
        lat: located.lat!,
        lon: located.lon!,
        path: chain.map((item) => item.name).join(' › '),
        color: row.color,
        iconId: row.iconId,
        position: row.position,
      },
    ];
  });
}

/**
 * Saves a place.
 * @param {string | null} id Place to change, or null to create one.
 * @param {PlaceInput} input Name, address and point.
 * @returns {Promise<Place>} Place.
 */
export async function savePlace(id: string | null, input: PlaceInput): Promise<Place> {
  const data = parseInput(placeSchema, input);
  if (id && !(await prisma.place.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Lieu');
  if (data.parentId) {
    // A zone is in a saved place, never in itself nor in one of its zones.
    const all = await prisma.place.findMany({ select: { id: true, parentId: true } });
    const parentOf = new Map(all.map((place) => [place.id, place.parentId]));
    if (!parentOf.has(data.parentId)) throw clientError('BAD_USER_INPUT', 'Lieu introuvable.', { fields: { parentId: 'Lieu introuvable.' } });
    for (let current: string | null | undefined = data.parentId; current; current = parentOf.get(current)) {
      if (current === id) throw clientError('BAD_USER_INPUT', 'Une zone ne peut pas être dans elle-même.', { fields: { parentId: 'Une zone ne peut pas être dans elle-même.' } });
    }
    // A zone has no address of its own.
    Object.assign(data, { address: '', lat: null, lon: null });
  }
  // A name is unique among the places at the top, and among the zones of a place (the database checks the zones).
  const taken = data.parentId ? 'Une zone de ce lieu porte déjà ce nom.' : 'Un lieu porte déjà ce nom.';
  if (!data.parentId && (await prisma.place.count({ where: { parentId: null, name: data.name, ...(id && { id: { not: id } }) } }))) {
    throw clientError('BAD_USER_INPUT', taken, { fields: { name: taken } });
  }
  try {
    if (id) return await prisma.place.update({ where: { id }, data });
    // Added last among its siblings.
    const { _max } = await prisma.place.aggregate({ where: { parentId: data.parentId }, _max: { position: true } });
    return await prisma.place.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw clientError('BAD_USER_INPUT', taken, { fields: { name: taken } });
    }
    throw error;
  }
}

/**
 * Deletes a place (events keep their address).
 * @param {string} id Place.
 * @returns {Promise<void>}
 */
export async function deletePlace(id: string): Promise<void> {
  const { count } = await prisma.place.deleteMany({ where: { id } });
  if (!count) throw notFound('Lieu');
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
  const all = await prisma.place.findMany({ select: { id: true, parentId: true, name: true, position: true }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  const place = all.find((item) => item.id === id);
  if (!place) throw notFound('Lieu');
  if ((place.parentId === null) !== (parentId === null)) {
    throw clientError('BAD_USER_INPUT', place.parentId === null ? 'Un lieu garde son adresse : il ne peut pas devenir une zone.' : 'Une zone n’a pas d’adresse : elle ne peut pas devenir un lieu.');
  }
  const parentOf = new Map(all.map((item) => [item.id, item.parentId]));
  if (parentId) {
    if (!parentOf.has(parentId)) throw clientError('BAD_USER_INPUT', 'Lieu introuvable.');
    for (let current: string | null | undefined = parentId; current; current = parentOf.get(current)) {
      if (current === id) throw clientError('BAD_USER_INPUT', 'Une zone ne peut pas être dans elle-même.');
    }
  }
  const siblings = all.filter((item) => item.parentId === parentId && item.id !== id);
  if (siblings.some((item) => item.name === place.name)) throw clientError('BAD_USER_INPUT', parentId ? 'Une zone de ce lieu porte déjà ce nom.' : 'Un lieu porte déjà ce nom.');
  siblings.splice(Math.max(0, Math.min(index, siblings.length)), 0, place);
  // All at once or not at all.
  await prisma.$transaction(
    siblings.flatMap((item, position) =>
      item.id === id ? [prisma.place.update({ where: { id }, data: { parentId, position } })] : item.position !== position ? [prisma.place.update({ where: { id: item.id }, data: { position } })] : [],
    ),
  );
}
