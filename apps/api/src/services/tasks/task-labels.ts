import { statusClosing, TASK_STATUS_CATEGORIES } from '@ordo/shared';
import { z } from 'zod';
import type { TaskStatus } from '../../generated/prisma/client';
import { createLabelService, type LabelService } from '../core/labels';
import { automated } from './task-automation-engine';

/**
 * Label service of the tasks whose change or deletion goes through the rules of the tasks (a status that closes or
 * reopens its tasks, a value deleted that its tasks lose).
 * @param {S} service Label service.
 * @returns {S} Same service, its update and deletion applying the rules.
 */
function automatedLabels<S extends LabelService<{ id: string }>>(service: S): S {
  return { ...service, update: automated(service.update), remove: automated(service.remove) };
}

/**
 * Statuses of the tasks, with their category; a category changed to or out of « Annulé » closes or reopens their tasks
 * (`statusClosing`; archived ones too, as the migration of the rule). The web confirms it first.
 */
export const taskStatuses = automatedLabels(
  createLabelService<TaskStatus>(
    'taskStatus',
    { notFound: 'Statut', conflict: 'Un statut porte déjà ce libellé.' },
    {
      extraSchema: z.object({ category: z.enum(TASK_STATUS_CATEGORIES).optional() }),
      afterUpdate: async (tx, before, after) => {
        if (before.category === after.category) return;
        const effect = statusClosing(before.category, after.category);
        if (effect === 'close') await tx.task.updateMany({ where: { statusId: after.id, closedAt: null }, data: { closedAt: new Date() } });
        if (effect === 'reopen') await tx.task.updateMany({ where: { statusId: after.id, closedAt: { not: null } }, data: { closedAt: null } });
      },
    },
  ),
);

export const taskPriorities = automatedLabels(createLabelService('taskPriority', { notFound: 'Priorité', conflict: 'Une priorité porte déjà ce libellé.' }));

export const taskTypes = automatedLabels(createLabelService('taskType', { notFound: 'Type', conflict: 'Un type porte déjà ce libellé.' }));

export const taskTags = automatedLabels(createLabelService('taskTag', { notFound: 'Étiquette', conflict: 'Une étiquette porte déjà ce libellé.' }));
