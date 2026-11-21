import { labelFormSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { parseInput, rethrowUnique } from '../../graphql/errors';
import { assertActive } from './archive';
import { deleteOrNotFound } from './lookup';
import { modelDelegate } from './delegate';
import { nextPositionIn } from './ordering';
import type { SETTINGS_LISTS } from './settings-lists';

export interface Label {
  id: string;
  label: string;
  color: string;
  position: number;
}

/** Model of a list of items with a label, a color and a manual position (task statuses, stores, mail flags…). */
export type LabelModel = (typeof SETTINGS_LISTS)[keyof typeof SETTINGS_LISTS];

/** Prisma delegate subset shared by the label tables. */
interface LabelDelegate<T> {
  create(args: { data: Record<string, unknown> }): Promise<T>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<T>;
  findUnique(args: { where: { id: string }; select: { archivedAt: true } }): Promise<{ archivedAt: Date | null } | null>;
  findUniqueOrThrow(args: { where: { id: string } }): Promise<T>;
  deleteMany(args: { where: { id: string } }): Promise<{ count: number }>;
}

export interface LabelMessages {
  /** "Statut", "Priorité"… */
  notFound: string;
  /** "Un statut porte déjà ce libellé." */
  conflict: string;
}

export interface LabelOptions<T = Label> {
  /** Fields of an item. Optional. Default = a label and a required color. */
  schema?: z.ZodObject;
  /** Extra fields of the table (e.g. status category), all optional. Optional. */
  extraSchema?: z.ZodObject;
  /** Writes following an update, in its transaction (e.g. the records copying its label follow it). Optional. */
  afterUpdate?: (tx: Prisma.TransactionClient, before: T, after: T) => Promise<void>;
}

/**
 * The parsed fields of a change that were given (not undefined) in the input: what a partial schema adds itself
 * (defaults) is left out, so an omitted field stays unchanged.
 * @param {T} parsed Change, parsed.
 * @param {Record<string, unknown>} given Change as given.
 * @returns {Partial<T>} Fields given.
 */
function presentFields<T extends object>(parsed: T, given: Record<string, unknown>): Partial<T> {
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => given[key] !== undefined)) as Partial<T>;
}

/**
 * CRUD of a list of items with a label and a color, in a manual order: a label taken is a CONFLICT (the tables have a
 * unique label), an archived item is not changed.
 * @param {LabelModel} model Table.
 * @param {LabelMessages} messages Error messages.
 * @param {LabelOptions<T>} [options] Fields of an item and update hook. Optional. Default = a label and a required color.
 * @returns {object} Label service.
 */
export function createLabelService<T extends { id: string } = Label>(model: LabelModel, messages: LabelMessages, options: LabelOptions<T> = {}) {
  const schema = (options.schema ?? labelFormSchema).extend(options.extraSchema?.shape ?? {});
  const patchSchema = schema.partial();

  /**
   * Delegate of the table (scoped to the current workspace, as every model).
   * @param {object} [client] Client or transaction. Optional. Default = the scoped client.
   * @returns {LabelDelegate} Delegate.
   */
  const delegate = (client: object = prisma) => modelDelegate<LabelDelegate<T>>(model, client);
  const { afterUpdate } = options;

  return {
    /**
     * Creates an item at the end of the list.
     * @param {object} input Item, with the extra fields.
     * @returns {Promise<T>} Created item.
     */
    async create(input: object): Promise<T> {
      const data = parseInput(schema, input);
      const position = await nextPositionIn(model);
      try {
        return await delegate().create({ data: { ...data, position } });
      } catch (error) {
        rethrowUnique(error, messages.conflict);
      }
    },

    /**
     * Updates an item (refused when it is archived); omitted or null fields are left unchanged.
     * @param {string} id Item id.
     * @param {object} input Changes, with the extra fields.
     * @returns {Promise<T>} Updated item.
     */
    async update(id: string, input: object): Promise<T> {
      await assertActive(delegate(), id, messages.notFound);
      // null means "unchanged" for these required fields.
      const changes = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? undefined]));
      // Only the fields given: zod 4 fills an omitted field with its default even in a partial schema, which would reset
      // it (the nature of a kind of éphémérides, set at its creation, turned back into créneaux on every change).
      const data = presentFields(parseInput(patchSchema, changes), changes);
      try {
        if (!afterUpdate) return await delegate().update({ where: { id }, data });
        return await prisma.$transaction(async (tx) => {
          const before = await delegate(tx).findUniqueOrThrow({ where: { id } });
          const after = await delegate(tx).update({ where: { id }, data });
          await afterUpdate(tx, before, after);
          return after;
        });
      } catch (error) {
        rethrowUnique(error, messages.conflict);
      }
    },

    /**
     * Deletes an item; what uses it loses it.
     * @param {string} id Item id.
     * @returns {Promise<void>}
     */
    async remove(id: string): Promise<void> {
      await deleteOrNotFound(delegate(), id, messages.notFound);
    },
  };
}

/** Service of a label table. */
export type LabelService<T extends { id: string } = Label> = ReturnType<typeof createLabelService<T>>;
