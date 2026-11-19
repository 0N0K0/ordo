import { dateSchema, markdownSchema, milestoneLabelSchema, parseOptionalDay } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Milestone } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { moveInList, nextPositionIn } from '../core/ordering';
import { assertNotArchived, assertActive, refuseArchived } from '../core/archive';
import { findOrNotFound } from '../core/lookup';

/**
 * Loads a milestone or throws NOT_FOUND.
 * @param {string} id Milestone id.
 * @returns {Promise<Milestone>} Milestone.
 */
function findMilestone(id: string): Promise<Milestone> {
  return findOrNotFound(prisma.milestone, id, 'Jalon');
}

/**
 * Loads a milestone that can be changed: neither it nor its project is archived (BAD_USER_INPUT « Élément archivé… »).
 * @param {string} id Milestone id.
 * @returns {Promise<Milestone>} Milestone.
 */
async function findEditableMilestone(id: string): Promise<Milestone> {
  const milestone = await findMilestone(id);
  refuseArchived(milestone);
  await assertNotArchived('project', milestone.projectId);
  return milestone;
}

const fieldsSchema = z.object({
  label: milestoneLabelSchema.optional(),
  description: markdownSchema.optional(),
  dueDate: dateSchema.optional(),
});

/**
 * Creates a milestone at the end of its project's list.
 * @param {object} input Milestone input.
 * @param {string} input.projectId Project.
 * @param {string} input.label Label.
 * @param {string | null} [input.description] Markdown description. Optional.
 * @param {string | null} [input.dueDate] Due date, YYYY-MM-DD. Optional.
 * @returns {Promise<Milestone>} Created milestone.
 */
export async function createMilestone(input: { projectId: string; label: string; description?: string | null; dueDate?: string | null }): Promise<Milestone> {
  await assertActive(prisma.project, input.projectId, 'Projet', { field: 'projectId' });
  const fields = parseInput(fieldsSchema.required({ label: true }), {
    label: input.label,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
  });
  const position = await nextPositionIn('milestone', { projectId: input.projectId });
  return prisma.milestone.create({
    data: {
      projectId: input.projectId,
      label: fields.label,
      description: fields.description,
      dueDate: parseOptionalDay(fields.dueDate),
      position,
    },
  });
}

/**
 * Updates a milestone; undefined leaves a field unchanged, null clears it.
 * @param {string} id Milestone id.
 * @param {object} input Changes.
 * @param {string | null} [input.label] New label. Optional.
 * @param {string | null} [input.description] New description. Optional.
 * @param {string | null} [input.dueDate] New due date. Optional.
 * @returns {Promise<Milestone>} Updated milestone.
 */
export async function updateMilestone(id: string, input: { label?: string | null; description?: string | null; dueDate?: string | null }): Promise<Milestone> {
  await findEditableMilestone(id);
  const fields = parseInput(fieldsSchema, {
    label: input.label ?? undefined,
    description: input.description,
    dueDate: input.dueDate,
  });
  return prisma.milestone.update({
    where: { id },
    data: { label: fields.label, description: fields.description, dueDate: parseOptionalDay(fields.dueDate) },
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
  const milestone = await findEditableMilestone(id);
  await moveInList('milestone', id, index, { projectId: milestone.projectId });
}
