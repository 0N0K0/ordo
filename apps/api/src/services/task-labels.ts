import { TASK_STATUS_CATEGORIES } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { createLabelService } from './labels';

type Delegate = Parameters<typeof createLabelService>[0];

/**
 * Runs label reorder updates in one transaction.
 * @param {Promise<unknown>[]} operations Prisma operations.
 * @returns {Promise<unknown>} Results.
 */
const transaction = (operations: Promise<unknown>[]) => prisma.$transaction(operations as never);

export const taskStatuses = createLabelService(
  () => prisma.taskStatus as unknown as ReturnType<Delegate>,
  transaction,
  { notFound: 'Statut', conflict: 'Un statut porte déjà ce nom.' },
  z.object({ category: z.enum(TASK_STATUS_CATEGORIES).optional() }),
);

export const taskPriorities = createLabelService(
  () => prisma.taskPriority as unknown as ReturnType<Delegate>,
  transaction,
  { notFound: 'Priorité', conflict: 'Une priorité porte déjà ce nom.' },
);

export const taskTypes = createLabelService(() => prisma.taskType as unknown as ReturnType<Delegate>, transaction, {
  notFound: 'Type',
  conflict: 'Un type porte déjà ce nom.',
});

export const taskTags = createLabelService(() => prisma.taskTag as unknown as ReturnType<Delegate>, transaction, {
  notFound: 'Étiquette',
  conflict: 'Une étiquette porte déjà ce nom.',
});
