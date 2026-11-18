import { mapById, LEVEL, lineageOf } from '@ordo/shared';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { useQuery } from '@tanstack/react-query';
import type { GeoPoint, PlaceInput, TravelMode } from '@ordo/shared';
import { graphql } from '../../../graphql';
import type { PlacesQuery, SearchAddressesQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type Place = PlacesQuery['places'][number];
export type AddressSuggestion = SearchAddressesQuery['searchAddresses'][number];

const placesKey = ['places'] as const;

const PlacesDocument = graphql(`
  query Places {
    places {
      id
      archived
      label
      address
      parentId
      lat
      lon
      path
      color
      iconUrl
      position
    }
  }
`);

const SearchAddressesDocument = graphql(`
  query SearchAddresses($text: String!, $near: GeoPointInput) {
    searchAddresses(text: $text, near: $near) {
      label
      name
      lat
      lon
    }
  }
`);

const ReverseAddressDocument = graphql(`
  query ReverseAddress($point: GeoPointInput!) {
    reverseAddress(point: $point) {
      label
      name
      lat
      lon
    }
  }
`);

const TravelTimeDocument = graphql(`
  query TravelTime($from: GeoPointInput!, $to: GeoPointInput!, $mode: TravelMode!) {
    travelTime(from: $from, to: $to, mode: $mode) {
      seconds
      meters
    }
  }
`);

const SavePlaceDocument = graphql(`
  mutation SavePlace($id: ID, $input: PlaceInput!) {
    savePlace(id: $id, input: $input)
  }
`);

const MovePlaceDocument = graphql(`
  mutation MovePlace($id: ID!, $parentId: ID, $index: Int!) {
    movePlace(id: $id, parentId: $parentId, index: $index)
  }
`);

const DeletePlaceDocument = graphql(`
  mutation DeletePlace($id: ID!) {
    deletePlace(id: $id)
  }
`);

/**
 * Places in tree order: each place followed by its zones (theirs too), with their depth.
 * @param {readonly Place[]} places Places, by name.
 * @returns {(Place & { depth: number })[]} Places.
 */
export function placesInTree(places: readonly Place[]): (Place & { depth: number })[] {
  const ids = new Set(places.map((place) => place.id));
  const out: (Place & { depth: number })[] = [];
  /**
   * Adds the places under a parent, and theirs.
   * @param {string | null} parent Parent.
   * @param {number} depth Their depth.
   * @returns {void}
   */
  const visit = (parent: string | null, depth: number) => {
    for (const place of places.filter((item) => (item.parentId && ids.has(item.parentId) ? item.parentId : null) === parent)) {
      out.push({ ...place, depth });
      visit(place.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** Between the zones of a place, in the text of a location. */
const ZONE_SEPARATOR = ', ';

/**
 * Place with an address a place or a zone is in (itself for a place).
 * @param {Place} place Place or zone.
 * @param {ReadonlyMap<string, Place>} byId Places by id.
 * @returns {Place} Place.
 */
export function rootPlace(place: Place, byId: ReadonlyMap<string, Place>): Place {
  return lineageOf(byId, place.id).at(-1) ?? place;
}

/**
 * Text of a location on zones of a place: « Maison › Cuisine, Salle de bain » (a zone in a zone: « Maison › Étage › Chambre »).
 * @param {Place} root Place.
 * @param {readonly Place[]} zones Its zones chosen, in their order.
 * @returns {string} Text.
 */
export function zonesText(root: Place, zones: readonly Place[]): string {
  const prefix = `${root.label}${LEVEL}`;
  return `${prefix}${zones.map((zone) => (zone.path.startsWith(prefix) ? zone.path.slice(prefix.length) : zone.label)).join(ZONE_SEPARATOR)}`;
}

/**
 * Zones of a place a location text names (as written by zonesText); null when it names none.
 * @param {string} text Text of the location.
 * @param {readonly Place[]} places Places and zones.
 * @returns {{ root: Place, zoneIds: string[] } | null} Place and zones.
 */
export function zonesOfText(text: string, places: readonly Place[]): { root: Place; zoneIds: string[] } | null {
  const byId = mapById(places);
  for (const root of places.filter((place) => !place.parentId)) {
    const prefix = `${root.label}${LEVEL}`;
    if (!text.startsWith(prefix)) continue;
    const zones = places.filter((place) => place.parentId && rootPlace(place, byId).id === root.id);
    const ids = text
      .slice(prefix.length)
      .split(ZONE_SEPARATOR)
      .map((name) => zones.find((zone) => zone.path === `${prefix}${name}`)?.id);
    if (ids.length && ids.every(Boolean)) return { root, zoneIds: ids as string[] };
  }
  return null;
}

/**
 * Saved places of the workspace ("Maison", "Bureau"…).
 * @returns {UseQueryResult} Query state.
 */
export function usePlaces() {
  return useQuery({ queryKey: placesKey, queryFn: async () => (await execute(PlacesDocument)).places });
}

/**
 * Addresses matching a text (3 characters at least), as typed: the request waits for the typing to pause.
 * @param {string} text Text typed.
 * @param {GeoPoint | null} near Point to favor.
 * @returns {UseQueryResult} Query state.
 */
export function useAddressSearch(text: string, near: GeoPoint | null) {
  const query = text.trim();
  return useQuery({
    queryKey: ['address-search', query, near?.lat ?? null, near?.lon ?? null],
    queryFn: async ({ signal }) => {
      // Waits for the typing to pause (a new key cancels this one).
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (signal.aborted) return [];
      return (await execute(SearchAddressesDocument, { text: query, near })).searchAddresses;
    },
    enabled: query.length >= 3,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Address of a point (a click on the map).
 * @param {GeoPoint} point Point.
 * @returns {Promise<AddressSuggestion | null>} Address.
 */
export async function reverseAddress(point: GeoPoint): Promise<AddressSuggestion | null> {
  return (await execute(ReverseAddressDocument, { point })).reverseAddress ?? null;
}

/**
 * Travel time between two points.
 * @param {GeoPoint} from Start.
 * @param {GeoPoint} to End.
 * @param {TravelMode} mode Car, bike or foot.
 * @returns {Promise<{ seconds: number, meters: number }>} Route.
 */
export async function travelTime(from: GeoPoint, to: GeoPoint, mode: TravelMode): Promise<{ seconds: number; meters: number }> {
  return (await execute(TravelTimeDocument, { from: { lat: from.lat, lon: from.lon }, to: { lat: to.lat, lon: to.lon }, mode })).travelTime;
}

/**
 * Saved places edition.
 * @returns {object} Mutations.
 */
export function usePlaceMutations() {
  const invalidate = [placesKey];
  return {
    save: useInvalidatingMutation(async (variables: { id: string | null; input: PlaceInput }) => (await execute(SavePlaceDocument, variables)).savePlace, { invalidate }),
    remove: useInvalidatingMutation(async (id: string) => (await execute(DeletePlaceDocument, { id })).deletePlace, { invalidate }),
    move: useInvalidatingMutation(async (variables: { id: string; parentId: string | null; index: number }) => (await execute(MovePlaceDocument, variables)).movePlace, { invalidate }),
  };
}
