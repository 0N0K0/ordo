import { labelNameSchema, colorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type ProjectStatus } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

/**
 * Converts a unique name violation into a field error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
function rethrowNameConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const message = 'Un statut porte déjà ce nom.';
    throw clientError('CONFLICT', message, { fields: { name: message } });
  }
  throw error;
}

/**
 * Creates a status at the end of the list.
 * @param {object} input Status input.
 * @param {string} input.name Unique name.
 * @param {string} input.color Hex color.
 * @returns {Promise<ProjectStatus>} Created status.
 */
export async function createStatus(input: { name: string; color: string }): Promise<ProjectStatus> {
  const data = parseInput(z.object({ name: labelNameSchema, color: colorSchema }), input);
  const { _max } = await prisma.projectStatus.aggregate({ _max: { position: true } });
  try {
    return await prisma.projectStatus.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
  } catch (error) {
    rethrowNameConflict(error);
  }
}

/**
 * Updates a status.
 * @param {string} id Status id.
 * @param {object} input Changes; omitted fields are left unchanged.
 * @param {string | null} [input.name] New name. Optional.
 * @param {string | null} [input.color] New color. Optional.
 * @returns {Promise<ProjectStatus>} Updated status.
 */
export async function updateStatus(
  id: string,
  input: { name?: string | null; color?: string | null },
): Promise<ProjectStatus> {
  if (!(await prisma.projectStatus.findUnique({ where: { id } }))) throw notFound('Statut');
  const data = parseInput(z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }), {
    name: input.name ?? undefined,
    color: input.color ?? undefined,
  });
  try {
    return await prisma.projectStatus.update({ where: { id }, data });
  } catch (error) {
    rethrowNameConflict(error);
  }
}

/**
 * Deletes a status; its projects end up without status.
 * @param {string} id Status id.
 * @returns {Promise<void>}
 */
export async function deleteStatus(id: string): Promise<void> {
  const { count } = await prisma.projectStatus.deleteMany({ where: { id } });
  if (count === 0) throw notFound('Statut');
}

/**
 * Moves a status to a new index in the list.
 * @param {string} id Status id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveStatus(id: string, index: number): Promise<void> {
  const statuses = await prisma.projectStatus.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  if (!statuses.some((status) => status.id === id)) throw notFound('Statut');
  const order = moveInOrder(
    statuses.map((status) => status.id),
    id,
    index,
  );
  await prisma.$transaction(
    order.map((statusId, position) => prisma.projectStatus.update({ where: { id: statusId }, data: { position } })),
  );
}
