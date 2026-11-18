import { labelNameSchema, colorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { type ProjectStatus } from '../../generated/prisma/client';
import { notFound, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { nextPositionIn } from '../core/ordering';
import { assertNotArchived } from '../core/archive';

/**
 * Creates a status at the end of the list.
 * @param {object} input Status input.
 * @param {string} input.name Unique name.
 * @param {string} input.color Hex color.
 * @returns {Promise<ProjectStatus>} Created status.
 */
export async function createStatus(input: { name: string; color: string }): Promise<ProjectStatus> {
  const data = parseInput(z.object({ name: labelNameSchema, color: colorSchema }), input);
  const position = await nextPositionIn('projectStatus');
  try {
    return await prisma.projectStatus.create({ data: { ...data, position } });
  } catch (error) {
    rethrowUnique(error, 'Un statut porte déjà ce nom.');
  }
}

/**
 * Updates a status (refused when it is archived).
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
  await orNotFound(prisma.projectStatus.findUnique({ where: { id } }), 'Statut');
  await assertNotArchived('projectStatus', id);
  const data = parseInput(z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }), {
    name: input.name ?? undefined,
    color: input.color ?? undefined,
  });
  try {
    return await prisma.projectStatus.update({ where: { id }, data });
  } catch (error) {
    rethrowUnique(error, 'Un statut porte déjà ce nom.');
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

