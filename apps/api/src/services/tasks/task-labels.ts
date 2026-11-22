import { TASK_STATUS_CATEGORIES } from '@ordo/shared';
import { z } from 'zod';
import type { TaskStatus } from '../../generated/prisma/client';
import { createLabelService, type LabelService } from '../core/labels';
import { automated } from './task-automation-engine';

/**
 * Label service of the tasks whose change or deletion goes through the rules of the tasks (a value deleted that its
 * tasks lose).
 * @param {S} service Label service.
 * @returns {S} Same service, its update and deletion applying the rules.
 */
function automatedLabels<S extends LabelService<{ id: string }>>(service: S): S {
  return { ...service, update: automated(service.update), remove: automated(service.remove) };
}

/**
 * Statuses of the tasks, with their category (a classification: it neither closes nor reopens their tasks; the rules of
 * the workspace may).
 */
export const taskStatuses = automatedLabels(
  createLabelService<TaskStatus>(
    'taskStatus',
    { notFound: 'Statut', conflict: 'Un statut porte déjà ce libellé.' },
    { extraSchema: z.object({ category: z.enum(TASK_STATUS_CATEGORIES).optional() }) },
  ),
);

export const taskPriorities = automatedLabels(createLabelService('taskPriority', { notFound: 'Priorité', conflict: 'Une priorité porte déjà ce libellé.' }));

export const taskTypes = automatedLabels(createLabelService('taskType', { notFound: 'Type', conflict: 'Un type porte déjà ce libellé.' }));

export const taskTags = automatedLabels(createLabelService('taskTag', { notFound: 'Étiquette', conflict: 'Une étiquette porte déjà ce libellé.' }));
