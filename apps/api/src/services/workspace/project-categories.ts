import { labelNameSchema, colorSchema } from '@ordo/shared';
import { nextPosition } from '../core/settings-lists';
import { assertNotArchived } from '../core/archive';
import { z } from 'zod';
import { prisma } from '../../db';
import { type ProjectCategory } from '../../generated/prisma/client';
import { notFound, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';

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
    return await prisma.projectCategory.create({ data: { ...data, position: await nextPosition('PROJECT_CATEGORY') } });
  } catch (error) {
    rethrowUnique(error, 'Une catégorie porte déjà ce nom.');
  }
}

/**
 * Updates a project category (refused when it is archived).
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
  await orNotFound(prisma.projectCategory.findUnique({ where: { id } }), 'Catégorie');
  await assertNotArchived('projectCategory', id);
  const data = parseInput(z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }), {
    name: input.name ?? undefined,
    color: input.color ?? undefined,
  });
  try {
    return await prisma.projectCategory.update({ where: { id }, data });
  } catch (error) {
    rethrowUnique(error, 'Une catégorie porte déjà ce nom.');
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
