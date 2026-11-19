import { modelDelegate } from '../services/core/delegate';
import type { InputObjectRef } from '@pothos/core';
import type PrismaTypes from '../generated/pothos-types';
import { prisma } from '../db';
import type { LabelService } from '../services/core/labels';
import { builder, type BuilderTypes } from './builder';
import { done } from './errors';
import { reloaded } from './reload';
import { unchecked } from './unchecked';

/** Label and color of an item of a simple list (a status, a category, a store…). */
export const LabelColorInput = builder.inputType('LabelColorInput', {
  description: 'Label and color of an item of a simple list.',
  fields: (t) => ({ label: t.string({ required: true }), color: t.string({ required: true }) }),
});

/** Changes of the label and color of an item of a simple list (omitted fields unchanged). */
export const LabelColorPatch = builder.inputType('LabelColorPatch', {
  description: 'Changes of an item of a simple list (omitted fields unchanged).',
  fields: (t) => ({ label: t.string(), color: t.string() }),
});

/** Prisma model of an item of a simple list: an id, a label, a required color, a manual position and its archive date. */
type LabelModel = {
  [Name in keyof PrismaTypes]: PrismaTypes[Name]['Shape'] extends { id: string; label: string; color: string; position: number; archivedAt: Date | null } ? Name : never;
}[keyof PrismaTypes];

/** Field builder of the GraphQL object of a Prisma model. */
type ObjectFields<Model extends keyof PrismaTypes> = PothosSchemaTypes.PrismaObjectFieldBuilder<BuilderTypes, PrismaTypes[Model]>;

/** Description of the `archived` field of every archivable type. */
// eslint-disable-next-line no-restricted-syntax -- the description itself.
export const ARCHIVED_DESCRIPTION = 'Archived: hidden by default, read only.';

/**
 * Defines the GraphQL object of a model with fields typed against another model of the same kind (labels, tree items).
 * @param {keyof PrismaTypes} name Prisma model (and GraphQL type) name.
 * @param {string | undefined} description Description of the type.
 * @param {(t: never) => object} fields Fields, typed with a model of the kind.
 * @returns {void}
 */
function modelObject<Model extends keyof PrismaTypes>(name: keyof PrismaTypes, description: string | undefined, fields: (t: ObjectFields<Model>) => object): void {
  builder.prismaObject(name as Model, unchecked({ ...(description === undefined ? {} : { description }), fields }));
}

/**
 * Defines the GraphQL object of an item of a simple list, exposing its id, label, color, position and whether it is archived.
 * @param {LabelModel} name Prisma model (and GraphQL type) name.
 * @param {{ description?: string; colorDescription?: string }} [options] Descriptions of the type and of its color.
 * @returns {void}
 */
export function labelObject(name: LabelModel, options: { description?: string; colorDescription?: string } = {}): void {
  const { description, colorDescription } = options;
  // Every LabelModel has the four exposed fields, so typing the fields with one of them checks the others too.
  modelObject(name, description, (t: ObjectFields<'TaskPriority'>) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color', colorDescription === undefined ? {} : { description: colorDescription }),
    position: t.exposeInt('position'),
    archived: t.boolean({ description: ARCHIVED_DESCRIPTION, resolve: (item) => item.archivedAt !== null }),
  }));
}

/** Prisma model of an item of a settings tree: an id, a label, an optional color, a parent and a manual position. */
type TreeItemModel = {
  [Name in keyof PrismaTypes]: PrismaTypes[Name]['Shape'] extends { id: string; label: string; color: string | null; parentId: string | null; position: number } ? Name : never;
}[keyof PrismaTypes];

/**
 * Defines the GraphQL object of an item of a settings tree, exposing its id, label, color, parent and position.
 * @param {TreeItemModel} name Prisma model (and GraphQL type) name.
 * @param {{ description?: string, positionDescription?: string }} [options] Descriptions of the type and of its position. Optional.
 * @returns {void}
 */
export function treeItemObject(name: TreeItemModel, options: { description?: string; positionDescription?: string } = {}): void {
  const { description, positionDescription } = options;
  // Every TreeItemModel has the exposed fields, so typing the fields with one of them checks the others too.
  modelObject(name, description, (t: ObjectFields<'RoutineCategory'>) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color', { nullable: true }),
    parentId: t.exposeID('parentId', { nullable: true }),
    position: t.exposeInt('position', positionDescription === undefined ? {} : { description: positionDescription }),
  }));
}

/** Inputs of the mutations of a list of label and color items: all fields to create, the changed ones to update. */
// eslint-disable-next-line no-restricted-syntax -- LABEL_COLOR_INPUTS itself.
export const LABEL_COLOR_INPUTS = { create: LabelColorInput, update: LabelColorPatch };

/** Input type of the create or update mutation of a simple list (`LabelColorInput`, `TaskLabelInput`, `ScheduleTypeInput`…). */
type LabelInputRef = InputObjectRef<BuilderTypes, object>;

/**
 * Defines the create, update and delete mutations of a simple list (`createTaskStatus`, `updateTaskStatus`,
 * `deleteTaskStatus`…), the saved item reloaded with the fields the query asks for.
 * @param {LabelModel} name Prisma model (and GraphQL type) name, also the suffix of the mutations.
 * @param {LabelService<{ id: string }>} service Label service of the model.
 * @param {{ create: LabelInputRef, update: LabelInputRef }} [inputs] Input types of the create and update mutations. Optional. Default = `LABEL_COLOR_INPUTS`.
 * @param {Partial<Record<'create' | 'update' | 'delete', string>>} [descriptions] Descriptions of the mutations (what follows them). Optional.
 * @returns {void}
 */
export function labelMutations(
  name: LabelModel,
  service: LabelService<{ id: string }>,
  inputs: { create: LabelInputRef; update: LabelInputRef } = LABEL_COLOR_INPUTS,
  descriptions: Partial<Record<'create' | 'update' | 'delete', string>> = {},
): void {
  // Every LabelModel is an object of the schema, so typing the calls with one of them is enough.
  const type = name as 'TaskPriority';
  const model = modelDelegate<typeof prisma.taskPriority>(name.charAt(0).toLowerCase() + name.slice(1));

  builder.mutationFields((t) => ({
    [`create${name}`]: t.prismaField({
      type,
      ...(descriptions.create === undefined ? {} : { description: descriptions.create }),
      args: { input: t.arg({ type: inputs.create as typeof LabelColorInput, required: true }) },
      resolve: async (query, _root, { input }) => reloaded(model, query, service.create(input)),
    }),
    [`update${name}`]: t.prismaField({
      type,
      ...(descriptions.update === undefined ? {} : { description: descriptions.update }),
      args: { id: t.arg.id({ required: true }), input: t.arg({ type: inputs.update as typeof LabelColorPatch, required: true }) },
      resolve: async (query, _root, { id, input }) => reloaded(model, query, service.update(id, input)),
    }),
    [`delete${name}`]: t.boolean({
      ...(descriptions.delete === undefined ? {} : { description: descriptions.delete }),
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => done(service.remove(id)),
    }),
  }));
}
