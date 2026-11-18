import { TASK_STATUS_CATEGORIES } from '@ordo/shared';
import { z } from 'zod';
import { createLabelService } from '../core/labels';

export const taskStatuses = createLabelService(
  'taskStatus',
  { notFound: 'Statut', conflict: 'Un statut porte déjà ce libellé.' },
  { extraSchema: z.object({ category: z.enum(TASK_STATUS_CATEGORIES).optional() }) },
);

export const taskPriorities = createLabelService('taskPriority', { notFound: 'Priorité', conflict: 'Une priorité porte déjà ce libellé.' });

export const taskTypes = createLabelService('taskType', { notFound: 'Type', conflict: 'Un type porte déjà ce libellé.' });

export const taskTags = createLabelService('taskTag', { notFound: 'Étiquette', conflict: 'Une étiquette porte déjà ce libellé.' });
