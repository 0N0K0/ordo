import { dateSchema, markdownSchema, milestoneTitleSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Milestone } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

/**
 * Loads a milestone or throws NOT_FOUND.
 * @param {string} id Milestone id.
 * @returns {Promise<Milestone>} Milestone.
 */
async function findMilestone(id: string): Promise<Milestone> {
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  if (!milestone) throw notFound('Jalon');
  return milestone;
}

/**
 * Converts a YYYY-MM-DD date to a UTC Date, keeping null and undefined.
 * @param {string | null | undefined} date Calendar date.
 * @returns {Date | null | undefined} Date at midnight UTC.
 */
function toDate(date: string | null | undefined): Date | null | undefined {
  if (date === undefined || date === null) return date;
  return new Date(`${date}T00:00:00.000Z`);
}

const fieldsSchema = z.object({
  title: milestoneTitleSchema.optional(),
  description: markdownSchema.optional(),
  dueDate: dateSchema.optional(),
});

/**
 * Creates a milestone at the end of its project's list.
 * @param {object} input Milestone input.
 * @param {string} input.projectId Project.
 * @param {string} input.title Title.
 * @param {string | null} [input.description] Markdown description. Optional.
 * @param {string | null} [input.dueDate] Due date, YYYY-MM-DD. Optional.
 * @returns {Promise<Milestone>} Created milestone.
 */
export async function createMilestone(input: {
  projectId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}): Promise<Milestone> {
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { archivedAt: true } });
  if (!project) throw notFound('Projet');
  if (project.archivedAt) throw clientError('BAD_USER_INPUT', 'Ce projet est archivé.');
  const fields = parseInput(fieldsSchema.required({ title: true }), {
    title: input.title,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
  });
  const { _max } = await prisma.milestone.aggregate({ where: { projectId: input.projectId }, _max: { position: true } });
  return prisma.milestone.create({
    data: {
      projectId: input.projectId,
      title: fields.title,
      description: fields.description,
      dueDate: toDate(fields.dueDate),
      position: (_max.position ?? -1) + 1,
    },
  });
}

/**
 * Updates a milestone; undefined leaves a field unchanged, null clears it.
 * @param {string} id Milestone id.
 * @param {object} input Changes.
 * @param {string | null} [input.title] New title. Optional.
 * @param {string | null} [input.description] New description. Optional.
 * @param {string | null} [input.dueDate] New due date. Optional.
 * @returns {Promise<Milestone>} Updated milestone.
 */
export async function updateMilestone(
  id: string,
  input: { title?: string | null; description?: string | null; dueDate?: string | null },
): Promise<Milestone> {
  await findMilestone(id);
  const fields = parseInput(fieldsSchema, {
    title: input.title ?? undefined,
    description: input.description,
    dueDate: input.dueDate,
  });
  return prisma.milestone.update({
    where: { id },
    data: { title: fields.title, description: fields.description, dueDate: toDate(fields.dueDate) },
  });
}

/**
 * Deletes a milestone; its tasks simply lose it.
 * @param {string} id Milestone id.
 * @returns {Promise<void>}
 */
export async function deleteMilestone(id: string): Promise<void> {
  await findMilestone(id);
  await prisma.milestone.delete({ where: { id } });
}

/**
 * Moves a milestone in its project's list.
 * @param {string} id Milestone id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveMilestone(id: string, index: number): Promise<void> {
  const milestone = await findMilestone(id);
  const siblings = await prisma.milestone.findMany({
    where: { projectId: milestone.projectId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const order = moveInOrder(
    siblings.map((item) => item.id),
    id,
    index,
  );
  await prisma.$transaction(
    order.map((milestoneId, position) => prisma.milestone.update({ where: { id: milestoneId }, data: { position } })),
  );
}
