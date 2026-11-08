import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GeoPoint, PlaceInput, TravelMode } from '@ordo/shared';
import { graphql } from '../../graphql';
import type { PlacesQuery, SearchAddressesQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Place = PlacesQuery['places'][number];
export type AddressSuggestion = SearchAddressesQuery['searchAddresses'][number];

const placesKey = ['places'] as const;

const PlacesDocument = graphql(`
  query Places {
    places {
      id
      name
      address
      lat
      lon
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

const DeletePlaceDocument = graphql(`
  mutation DeletePlace($id: ID!) {
    deletePlace(id: $id)
  }
`);

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
  const queryClient = useQueryClient();
  const onSettled = () => queryClient.invalidateQueries({ queryKey: placesKey });
  return {
    save: useMutation({ mutationFn: async (variables: { id: string | null; input: PlaceInput }) => (await execute(SavePlaceDocument, variables)).savePlace, onSettled }),
    remove: useMutation({ mutationFn: async (id: string) => (await execute(DeletePlaceDocument, { id })).deletePlace, onSettled }),
  };
}
