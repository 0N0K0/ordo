import { labelNameSchema, colorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type ProjectCategory } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Converts a unique name violation into a field error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
function rethrowNameConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const message = 'Une catégorie porte déjà ce nom.';
    throw clientError('CONFLICT', message, { fields: { name: message } });
  }
  throw error;
}

/**
 * Creates a project category.
 * @param {object} input Category input.
 * @param {string} input.name Unique name.
 * @param {string} input.color Hex color.
 * @returns {Promise<ProjectCategory>} Created category.
 */
export async function createProjectCategory(input: { name: string; color: string }): Promise<ProjectCategory> {
  const data = parseInput(z.object({ name: labelNameSchema, color: colorSchema }), input);
  try {
    return await prisma.projectCategory.create({ data });
  } catch (error) {
    rethrowNameConflict(error);
  }
}

/**
 * Updates a project category.
 * @param {string} id Category id.
 * @param {object} input Changes; omitted fields are left unchanged.
 * @param {string | null} [input.name] New name. Optional.
 * @param {string | null} [input.color] New color. Optional.
 * @returns {Promise<ProjectCategory>} Updated category.
 */
export async function updateProjectCategory(
  id: string,
  input: { name?: string | null; color?: string | null },
): Promise<ProjectCategory> {
  if (!(await prisma.projectCategory.findUnique({ where: { id } }))) throw notFound('Catégorie');
  const data = parseInput(z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }), {
    name: input.name ?? undefined,
    color: input.color ?? undefined,
  });
  try {
    return await prisma.projectCategory.update({ where: { id }, data });
  } catch (error) {
    rethrowNameConflict(error);
  }
}

/**
 * Deletes a project category; projects simply lose it.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteProjectCategory(id: string): Promise<void> {
  const { count } = await prisma.projectCategory.deleteMany({ where: { id } });
  if (count === 0) throw notFound('Catégorie');
}
