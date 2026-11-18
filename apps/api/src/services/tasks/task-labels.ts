import { TASK_STATUS_CATEGORIES } from '@ordo/shared';
import { z } from 'zod';
import { createLabelService } from './labels';

export const taskStatuses = createLabelService(
  'taskStatus',
  { notFound: 'Statut', conflict: 'Un statut porte déjà ce nom.' },
  z.object({ category: z.enum(TASK_STATUS_CATEGORIES).optional() }),
);

export const taskPriorities = createLabelService('taskPriority', { notFound: 'Priorité', conflict: 'Une priorité porte déjà ce nom.' });

export const taskTypes = createLabelService('taskType', { notFound: 'Type', conflict: 'Un type porte déjà ce nom.' });

export const taskTags = createLabelService('taskTag', { notFound: 'Étiquette', conflict: 'Une étiquette porte déjà ce nom.' });
