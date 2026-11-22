import { taskAutomationSchema } from '@ordo/shared';
import { Prisma, type TaskAutomation } from '../../generated/prisma/client';
import { createLabelService } from '../core/labels';

/**
 * Automations of the tasks (« quand … alors … ») of the workspace: a settings list (name, color, image, manual order,
 * archive), each rule on or off, with its trigger, condition and actions (`taskAutomationSchema`). The engine applying
 * them is `task-automation-engine.ts`.
 */

/** CRUD of the rules: a name taken is a conflict; the condition may be emptied (every task). */
export const taskAutomations = createLabelService<TaskAutomation>(
  'taskAutomation',
  { notFound: 'Règle', conflict: 'Une règle porte déjà ce nom.' },
  {
    schema: taskAutomationSchema,
    clearable: ['condition'],
    // No condition (every task): an empty JSON column.
    stored: (data) => ('condition' in data && data.condition === null ? { ...data, condition: Prisma.DbNull } : data),
  },
);
