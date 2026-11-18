import type { InputObjectRef } from '@pothos/core';
import type PrismaTypes from '../generated/pothos-types';
import { prisma } from '../db';
import type { LabelService } from '../services/core/labels';
import { builder } from './builder';
import { done } from './errors';

/** Schema types of the builder. */
type BuilderTypes = typeof builder extends PothosSchemaTypes.SchemaBuilder<infer Types> ? Types : never;

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

/** Prisma model of an item of a simple list: an id, a name, a required color, a manual position and its archive date. */
type LabelModel = {
  [Name in keyof PrismaTypes]: PrismaTypes[Name]['Shape'] extends { id: string; name: string; color: string; position: number; archivedAt: Date | null } ? Name : never;
}[keyof PrismaTypes];

/**
 * Defines the GraphQL object of an item of a simple list, exposing its id, name, color, position and whether it is archived.
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
      archived: t.boolean({ description: 'Archived: hidden by default, read only.', select: { archivedAt: true }, resolve: (item) => item.archivedAt !== null }),
    }),
  });
}

/** Input type of the create or update mutation of a simple list (`NameColorInput`, `TaskLabelInput`, `ScheduleTypeInput`…). */
type LabelInputRef = InputObjectRef<BuilderTypes, object>;

/**
 * Defines the create, update and delete mutations of a simple list (`createTaskStatus`, `updateTaskStatus`,
 * `deleteTaskStatus`…), the saved item reloaded with the fields the query asks for.
 * @param {LabelModel} name Prisma model (and GraphQL type) name, also the suffix of the mutations.
 * @param {LabelService<{ id: string }>} service Label service of the model.
 * @param {{ create: LabelInputRef, update: LabelInputRef }} inputs Input types of the create and update mutations.
 * @param {Partial<Record<'create' | 'update' | 'delete', string>>} [descriptions] Descriptions of the mutations (what follows them). Optional.
 * @returns {void}
 */
export function labelMutations(
  name: LabelModel,
  service: LabelService<{ id: string }>,
  inputs: { create: LabelInputRef; update: LabelInputRef },
  descriptions: Partial<Record<'create' | 'update' | 'delete', string>> = {},
): void {
  // Every LabelModel is an object of the schema, so typing the calls with one of them is enough.
  const type = name as 'TaskPriority';
  const model = (prisma as unknown as Record<string, typeof prisma.taskPriority>)[name.charAt(0).toLowerCase() + name.slice(1)];

  /**
   * Reloads an item with the fields requested by the query.
   * @param {object} query Pothos Prisma selection.
   * @param {{ id: string }} item Saved item.
   * @returns {Promise<object>} Item.
   */
  const reload = (query: object, item: { id: string }) => model.findUniqueOrThrow({ ...query, where: { id: item.id } });

  builder.mutationFields((t) => ({
    [`create${name}`]: t.prismaField({
      type,
      ...(descriptions.create === undefined ? {} : { description: descriptions.create }),
      args: { input: t.arg({ type: inputs.create as typeof NameColorInput, required: true }) },
      resolve: async (query, _root, { input }) => reload(query, await service.create(input)),
    }),
    [`update${name}`]: t.prismaField({
      type,
      ...(descriptions.update === undefined ? {} : { description: descriptions.update }),
      args: { id: t.arg.id({ required: true }), input: t.arg({ type: inputs.update as typeof NameColorPatch, required: true }) },
      resolve: async (query, _root, { id, input }) => reload(query, await service.update(id, input)),
    }),
    [`delete${name}`]: t.boolean({
      ...(descriptions.delete === undefined ? {} : { description: descriptions.delete }),
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => done(service.remove(id)),
    }),
  }));
}
