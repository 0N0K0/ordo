import { TRAVEL_MODES } from '@ordo/shared';
import * as geo from '../../services/geo';
import { builder } from '../builder';

builder.prismaObject('Place', {
  description: 'Saved place ("Maison", "Bureau"…): an address and its point.',
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name'), address: t.exposeString('address'), lat: t.exposeFloat('lat'), lon: t.exposeFloat('lon') }),
});

const PlaceInput = builder.inputType('PlaceInput', {
  fields: (t) => ({ name: t.string({ required: true }), address: t.string({ required: true }), lat: t.float({ required: true }), lon: t.float({ required: true }) }),
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
  places: t.prismaField({ type: ['Place'], resolve: () => geo.places() }),
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
    resolve: async (_root, { id, input }) => (await geo.savePlace(id ?? null, input)).id,
  }),
  deletePlace: t.boolean({
    description: 'Deletes a saved place (events keep their address).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await geo.deletePlace(id);
      return true;
    },
  }),
}));
