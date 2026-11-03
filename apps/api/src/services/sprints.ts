import { markdownSchema, sprintNameSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Sprint } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Loads a sprint or throws NOT_FOUND.
 * @param {string} id Sprint id.
 * @returns {Promise<Sprint>} Sprint.
 */
async function findSprint(id: string): Promise<Sprint> {
  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) throw notFound('Sprint');
  return sprint;
}

const fieldsSchema = z
  .object({
    name: sprintNameSchema,
    goal: markdownSchema,
    startDate: z.iso.date({ error: 'La date de début est requise.' }),
    endDate: z.iso.date({ error: 'La date de fin est requise.' }),
  })
  .refine((fields) => fields.endDate >= fields.startDate, { path: ['endDate'], error: 'La fin doit suivre le début.' });

export interface SprintInput {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
}

/**
 * Prisma data of validated sprint fields.
 * @param {SprintInput} input Sprint.
 * @returns {object} Data.
 */
function sprintData(input: SprintInput) {
  const fields = parseInput(fieldsSchema, { ...input, goal: input.goal ?? null });
  return {
    name: fields.name,
    goal: fields.goal,
    startDate: new Date(`${fields.startDate}T00:00:00.000Z`),
    endDate: new Date(`${fields.endDate}T00:00:00.000Z`),
  };
}

/**
 * Creates a sprint of a project (its tasks and those of its project tree can be planned in it).
 * @param {string} projectId Project.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Created sprint.
 */
export async function createSprint(projectId: string, input: SprintInput): Promise<Sprint> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { archivedAt: true } });
  if (!project) throw notFound('Projet');
  if (project.archivedAt) throw clientError('BAD_USER_INPUT', 'Ce projet est archivé.');
  return prisma.sprint.create({ data: { projectId, ...sprintData(input) } });
}

/**
 * Updates a sprint.
 * @param {string} id Sprint id.
 * @param {SprintInput} input Sprint.
 * @returns {Promise<Sprint>} Updated sprint.
 */
export async function updateSprint(id: string, input: SprintInput): Promise<Sprint> {
  await findSprint(id);
  return prisma.sprint.update({ where: { id }, data: sprintData(input) });
}

/**
 * Deletes a sprint; its tasks simply leave it.
 * @param {string} id Sprint id.
 * @returns {Promise<void>}
 */
export async function deleteSprint(id: string): Promise<void> {
  await findSprint(id);
  await prisma.sprint.delete({ where: { id } });
}
