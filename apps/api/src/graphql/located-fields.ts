import type { InputFields } from './builder';

/** Descriptions of the travel times, the same on every type (events, routines). */
export const TRAVEL_DESCRIPTIONS = {
  before: 'Travel time there, in minutes.',
  after: 'Travel time back, in minutes.',
} as const;

/**
 * Input fields of a location: its address and its point (none: unknown).
 * @param {InputFields} t Field builder.
 * @param {string} [description] Description of the address (e.g. what null means in a patch). Optional.
 * @returns {object} Fields.
 */
export function locationInputFields(t: InputFields, description?: string) {
  return {
    location: t.string(description === undefined ? {} : { description }),
    locationLat: t.float({ description: 'Point of the location; none: unknown.' }),
    locationLon: t.float(),
  };
}

/**
 * Input fields of the travel times there and back.
 * @param {InputFields} t Field builder.
 * @param {string} omitted What an omitted value means (« none: 0 », « omitted: unchanged »).
 * @returns {object} Fields.
 */
export function travelInputFields(t: InputFields, omitted: string) {
  return {
    travelBefore: t.int({ description: `${TRAVEL_DESCRIPTIONS.before.slice(0, -1)}; ${omitted}.` }),
    travelAfter: t.int({ description: `${TRAVEL_DESCRIPTIONS.after.slice(0, -1)}; ${omitted}.` }),
  };
}

/** Location and travel fields of an input, as GraphQL gives them (omitted or null). */
interface LocatedInputValues {
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  travelBefore?: number | null;
  travelAfter?: number | null;
}

/**
 * Location and travel fields of a new item as the services read them: no location, no travel time.
 * @param {LocatedInputValues} input GraphQL input.
 * @returns {object} Service fields.
 */
export function locatedInput(input: LocatedInputValues) {
  return {
    // eslint-disable-next-line no-restricted-syntax -- locatedInput itself.
    location: input.location ?? null,
    locationLat: input.locationLat ?? null,
    locationLon: input.locationLon ?? null,
    // eslint-disable-next-line no-restricted-syntax -- locatedInput itself.
    travelBefore: input.travelBefore ?? 0,
    travelAfter: input.travelAfter ?? 0,
  };
}

/**
 * Location and travel changes of a patch: the location with its point (null: none), the travel times given.
 * @param {LocatedInputValues} input GraphQL patch.
 * @returns {object} Changes (omitted fields left out).
 */
export function locatedChanges(input: LocatedInputValues) {
  return {
    // eslint-disable-next-line no-restricted-syntax -- locatedChanges itself.
    ...(input.location !== undefined ? { location: input.location ?? null, locationLat: input.locationLat ?? null, locationLon: input.locationLon ?? null } : {}),
    ...(input.travelBefore !== undefined && input.travelBefore !== null ? { travelBefore: input.travelBefore } : {}),
    ...(input.travelAfter !== undefined && input.travelAfter !== null ? { travelAfter: input.travelAfter } : {}),
  };
}
