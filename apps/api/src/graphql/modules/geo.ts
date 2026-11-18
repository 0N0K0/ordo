import { done } from '../errors';
import { TRAVEL_MODES } from '@ordo/shared';
import * as geo from '../../services/core/geo';
import { iconUrl } from '../../services/core/icons';
import { builder } from '../builder';

const PlaceRef = builder.objectRef<geo.PlaceView>('Place').implement({
  description: 'Saved place ("Maison", "Bureau"…): an address and its point; or a zone of one (a room of the house), with its point.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    address: t.exposeString('address', { description: 'Its address, or that of the place a zone is in.' }),
    parentId: t.exposeID('parentId', { nullable: true, description: 'Place a zone is in; null: a place with its own address.' }),
    lat: t.exposeFloat('lat'),
    lon: t.exposeFloat('lon'),
    path: t.exposeString('path', { description: 'Full name (« Maison › Cuisine »).' }),
    color: t.exposeString('color', { nullable: true }),
    iconUrl: t.string({ nullable: true, description: 'Image shown as its avatar (none: its initials on its color).', resolve: (place) => iconUrl(place.iconId) }),
    position: t.exposeInt('position'),
    archived: t.exposeBoolean('archived'),
  }),
});

const PlaceInput = builder.inputType('PlaceInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    address: t.string(),
    lat: t.float({ description: 'None for a zone.' }),
    lon: t.float({ description: 'None for a zone.' }),
    parentId: t.id({ description: 'Place a zone is in.' }),
  }),
});

const GeoPointInput = builder.inputType('GeoPointInput', {
  fields: (t) => ({ lat: t.float({ required: true }), lon: t.float({ required: true }) }),
});

const TravelModeEnum = builder.enumType('TravelMode', { values: TRAVEL_MODES });

const AddressSuggestionRef = builder.objectRef<geo.AddressSuggestion>('AddressSuggestion').implement({
  description: 'Address found by a search (OpenStreetMap).',
  fields: (t) => ({
    label: t.exposeString('label'),
    name: t.exposeString('name', { nullable: true, description: 'Name of the place, when it has one (a station, a shop…).' }),
    lat: t.exposeFloat('lat'),
    lon: t.exposeFloat('lon'),
  }),
});

const TravelTimeRef = builder.objectRef<geo.TravelTime>('TravelTime').implement({
  fields: (t) => ({ seconds: t.exposeInt('seconds'), meters: t.exposeInt('meters') }),
});

builder.queryFields((t) => ({
  places: t.field({ type: [PlaceRef], resolve: () => geo.places() }),
  searchAddresses: t.field({
    type: [AddressSuggestionRef],
    description: 'Addresses and places matching a text (3 characters at least), the closest to `near` first.',
    args: { text: t.arg.string({ required: true }), near: t.arg({ type: GeoPointInput }) },
    resolve: (_root, { text, near }) => geo.searchAddresses(text, near ?? null),
  }),
  reverseAddress: t.field({
    type: AddressSuggestionRef,
    nullable: true,
    description: 'Address of a point (a click on the map).',
    args: { point: t.arg({ type: GeoPointInput, required: true }) },
    resolve: (_root, { point }) => geo.reverseAddress(point),
  }),
  travelTime: t.field({
    type: TravelTimeRef,
    description: 'Travel time between two points by car, bike or foot.',
    args: { from: t.arg({ type: GeoPointInput, required: true }), to: t.arg({ type: GeoPointInput, required: true }), mode: t.arg({ type: TravelModeEnum, required: true }) },
    resolve: (_root, { from, to, mode }) => geo.travelTime(from, to, mode),
  }),
}));

builder.mutationFields((t) => ({
  savePlace: t.id({
    args: { id: t.arg.id(), input: t.arg({ type: PlaceInput, required: true }) },
    resolve: async (_root, { id, input }) =>
      (await geo.savePlace(id ?? null, { name: input.name, address: input.address ?? '', lat: input.lat ?? null, lon: input.lon ?? null, parentId: input.parentId || null })).id,
  }),
  movePlace: t.boolean({
    description: 'Moves a place among the places, or a zone under another place or zone, at an index among its siblings.',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int({ required: true }) },
    resolve: (_root, { id, parentId, index }) => done(geo.movePlace(id, parentId || null, index)),
  }),
  deletePlace: t.boolean({
    description: 'Deletes a saved place (events keep their address).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(geo.deletePlace(id)),
  }),
}));
