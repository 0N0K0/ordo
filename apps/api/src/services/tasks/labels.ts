import { colorSchema, labelNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { notFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { nextPositionIn } from '../core/ordering';

export interface Label {
  id: string;
  name: string;
  color: string;
  position: number;
}

/** Configurable label tables (name, color, position). */
export type LabelModel = 'taskStatus' | 'taskPriority' | 'taskType' | 'taskTag';

/** Prisma delegate subset shared by the configurable label tables. */
interface LabelDelegate {
  create(args: { data: { name: string; color: string; position: number } & Record<string, unknown> }): Promise<Label>;
  update(args: {
    where: { id: string };
    data: Partial<Pick<Label, 'name' | 'color' | 'position'>> & Record<string, unknown>;
  }): Promise<Label>;
  findUnique(args: { where: { id: string } }): Promise<Label | null>;
  deleteMany(args: { where: { id: string } }): Promise<{ count: number }>;
}

interface LabelMessages {
  /** "Statut", "Priorité"… */
  notFound: string;
  /** "Un statut porte déjà ce nom." */
  conflict: string;
}

/**
 * CRUD and ordering for a configurable label table (task statuses, priorities, types).
 * @param {LabelModel} model Table.
 * @param {LabelMessages} messages Error messages.
 * @param {z.ZodObject} [extraSchema] Extra fields of the table (e.g. status category), all optional. Optional.
 * @returns {object} Label service.
 */
export function createLabelService(
  model: LabelModel,
  messages: LabelMessages,
  extraSchema: z.ZodObject = z.object({}),
) {
  /**
   * Delegate of the table (scoped to the current workspace, as every model).
   * @returns {LabelDelegate} Delegate.
   */
  const delegate = () => (prisma as unknown as Record<LabelModel, LabelDelegate>)[model];

  /**
   * Converts a unique name violation into a field error.
   * @param {unknown} error Caught error.
   * @returns {never}
   */
  const rethrowConflict = (error: unknown): never => {
    rethrowUnique(error, messages.conflict);
  };

  return {
    /**
     * Creates a label at the end of the list.
     * @param {{ name: string, color: string }} input Label input, with the extra fields.
     * @returns {Promise<Label>} Created label.
     */
    async create(input: { name: string; color: string } & Record<string, unknown>): Promise<Label> {
      const data = parseInput(
        z.object({ name: labelNameSchema, color: colorSchema }).extend(extraSchema.shape),
        input,
      ) as { name: string; color: string } & Record<string, unknown>;
      const position = await nextPositionIn(model);
      try {
        return await delegate().create({ data: { ...data, position } });
      } catch (error) {
        return rethrowConflict(error);
      }
    },

    /**
     * Updates a label.
     * @param {string} id Label id.
     * @param {{ name?: string | null, color?: string | null }} input Changes, with the extra fields.
     * @returns {Promise<Label>} Updated label.
     */
    async update(
      id: string,
      input: { name?: string | null; color?: string | null } & Record<string, unknown>,
    ): Promise<Label> {
      if (!(await delegate().findUnique({ where: { id } }))) throw notFound(messages.notFound);
      // null means "unchanged" for these required fields.
      const changes = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value ?? undefined]));
      const data = parseInput(
        z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }).extend(extraSchema.shape),
        changes,
      );
      try {
        return await delegate().update({ where: { id }, data });
      } catch (error) {
        return rethrowConflict(error);
      }
    },

    /**
     * Deletes a label; tasks using it lose it.
     * @param {string} id Label id.
     * @returns {Promise<void>}
     */
    async remove(id: string): Promise<void> {
      const { count } = await delegate().deleteMany({ where: { id } });
      if (count === 0) throw notFound(messages.notFound);
    },
  };
}
