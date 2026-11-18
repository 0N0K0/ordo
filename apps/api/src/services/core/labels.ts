import { colorSchema, labelNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { parseInput, rethrowUnique } from '../../graphql/errors';
import { assertNotArchived } from './archive';
import { assertExists, deleteOrNotFound } from './lookup';
import { nextPositionIn } from './ordering';
import type { SETTINGS_LISTS } from './settings-lists';

export interface Label {
  id: string;
  name: string;
  color: string;
  position: number;
}

/** Model of a list of items with a name, a color and a manual position (task statuses, stores, mail flags…). */
export type LabelModel = (typeof SETTINGS_LISTS)[keyof typeof SETTINGS_LISTS];

/** Prisma delegate subset shared by the label tables. */
interface LabelDelegate<T> {
  create(args: { data: Record<string, unknown> }): Promise<T>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<T>;
  findUnique(args: { where: { id: string }; select: { id: true } }): Promise<unknown>;
  deleteMany(args: { where: { id: string } }): Promise<{ count: number }>;
}

export interface LabelMessages {
  /** "Statut", "Priorité"… */
  notFound: string;
  /** "Un statut porte déjà ce nom." */
  conflict: string;
}

export interface LabelOptions {
  /** Fields of an item. Optional. Default = a label name and a required color. */
  schema?: z.ZodObject;
  /** Extra fields of the table (e.g. status category), all optional. Optional. */
  extraSchema?: z.ZodObject;
}

/** Fields of a label when the table sets none. */
const LABEL_SCHEMA = z.object({ name: labelNameSchema, color: colorSchema });

/**
 * CRUD of a list of items with a name and a color, in a manual order: a name taken is a CONFLICT (the tables have a
 * unique name), an archived item is not changed.
 * @param {LabelModel} model Table.
 * @param {LabelMessages} messages Error messages.
 * @param {LabelOptions} [options] Fields of an item. Optional. Default = a label name and a required color.
 * @returns {object} Label service.
 */
export function createLabelService<T extends { id: string } = Label>(model: LabelModel, messages: LabelMessages, options: LabelOptions = {}) {
  const schema = (options.schema ?? LABEL_SCHEMA).extend(options.extraSchema?.shape ?? {});
  const patchSchema = schema.partial();

  /**
   * Delegate of the table (scoped to the current workspace, as every model).
   * @returns {LabelDelegate} Delegate.
   */
  const delegate = () => (prisma as unknown as Record<LabelModel, LabelDelegate<T>>)[model];

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
      await assertExists(delegate(), id, messages.notFound);
      await assertNotArchived(model, id);
      // null means "unchanged" for these required fields.
      const changes = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? undefined]));
      const data = parseInput(patchSchema, changes);
      try {
        return await delegate().update({ where: { id }, data });
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
