import { colorSchema, labelNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

export interface Label {
  id: string;
  name: string;
  color: string;
  position: number;
}

/** Prisma delegate subset shared by the configurable label tables (name, color, position). */
interface LabelDelegate {
  aggregate(args: { _max: { position: true } }): Promise<{ _max: { position: number | null } }>;
  create(args: { data: { name: string; color: string; position: number } & Record<string, unknown> }): Promise<Label>;
  update(args: {
    where: { id: string };
    data: Partial<Pick<Label, 'name' | 'color' | 'position'>> & Record<string, unknown>;
  }): Promise<Label>;
  findUnique(args: { where: { id: string } }): Promise<Label | null>;
  findMany(args: { orderBy: object[]; select: { id: true } }): Promise<{ id: string }[]>;
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
 * @param {() => LabelDelegate} delegate Prisma delegate of the table.
 * @param {(operations: Prisma.PrismaPromise<unknown>[]) => Promise<unknown>} transaction Prisma transaction runner.
 * @param {LabelMessages} messages Error messages.
 * @param {z.ZodObject} [extraSchema] Extra fields of the table (e.g. status category), all optional. Optional.
 * @returns {object} Label service.
 */
export function createLabelService(
  delegate: () => LabelDelegate,
  transaction: (operations: Promise<unknown>[]) => Promise<unknown>,
  messages: LabelMessages,
  extraSchema: z.ZodObject = z.object({}),
) {
  /**
   * Converts a unique name violation into a field error.
   * @param {unknown} error Caught error.
   * @returns {never}
   */
  const rethrowConflict = (error: unknown): never => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw clientError('CONFLICT', messages.conflict, { fields: { name: messages.conflict } });
    }
    throw error;
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
      const { _max } = await delegate().aggregate({ _max: { position: true } });
      try {
        return await delegate().create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
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

    /**
     * Moves a label to a new index.
     * @param {string} id Label id.
     * @param {number} index Target index.
     * @returns {Promise<void>}
     */
    async move(id: string, index: number): Promise<void> {
      const labels = await delegate().findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
      if (!labels.some((label) => label.id === id)) throw notFound(messages.notFound);
      const order = moveInOrder(
        labels.map((label) => label.id),
        id,
        index,
      );
      await transaction(order.map((labelId, position) => delegate().update({ where: { id: labelId }, data: { position } })));
    },
  };
}
