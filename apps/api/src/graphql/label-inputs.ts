import type PrismaTypes from '../generated/pothos-types';
import { builder } from './builder';

/** Name and color of an item of a simple list (a status, a category, a store…). */
export const NameColorInput = builder.inputType('NameColorInput', {
  description: 'Name and color of an item of a simple list.',
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

/** Changes of the name and color of an item of a simple list (omitted fields unchanged). */
export const NameColorPatch = builder.inputType('NameColorPatch', {
  description: 'Changes of an item of a simple list (omitted fields unchanged).',
  fields: (t) => ({ name: t.string(), color: t.string() }),
});

/** Prisma model of an item of a simple list: an id, a name, a required color and a manual position. */
type LabelModel = {
  [Name in keyof PrismaTypes]: PrismaTypes[Name]['Shape'] extends { id: string; name: string; color: string; position: number } ? Name : never;
}[keyof PrismaTypes];

/**
 * Defines the GraphQL object of an item of a simple list, exposing its id, name, color and position.
 * @param {LabelModel} name Prisma model (and GraphQL type) name.
 * @param {{ description?: string; colorDescription?: string }} [options] Descriptions of the type and of its color.
 * @returns {void}
 */
export function labelObject(name: LabelModel, options: { description?: string; colorDescription?: string } = {}): void {
  const { description, colorDescription } = options;
  // Every LabelModel has the four exposed fields, so typing the call with one of them checks the others too.
  builder.prismaObject(name as 'TaskPriority', {
    ...(description === undefined ? {} : { description }),
    fields: (t) => ({
      id: t.exposeID('id'),
      name: t.exposeString('name'),
      color: t.exposeString('color', colorDescription === undefined ? {} : { description: colorDescription }),
      position: t.exposeInt('position'),
    }),
  });
}
