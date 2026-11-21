import { z } from 'zod';
import { legacyLabelColumn, TABLE_KEY_MAX, withLabelColumn } from '../tables/table-layout';

/** Fixed meaning of a task status. */
export const TASK_STATUS_CATEGORIES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number];

/**
 * Names of the status categories, agreed with the noun they qualify: `status` for a status or its category
 * (« Terminé », « Annulé »), `task` for tasks counted or grouped by it (« Terminée », « Annulée »).
 */
export const TASK_STATUS_CATEGORY_LABELS: Record<'status' | 'task', Record<TaskStatusCategory, string>> = {
  status: { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminé', CANCELLED: 'Annulé' },
  task: { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminée', CANCELLED: 'Annulée' },
};

/** Columns of the task table (the number is shown before the label). */
export const TASK_COLUMNS = [
  'label',
  'project',
  'status',
  'priority',
  'type',
  'assignees',
  'beneficiaries',
  'tags',
  'effort',
  'trackedTime',
  'startDate',
  'endDate',
  'deadline',
  'minDate',
  'slots',
  'location',
  'timer',
  'parent',
  'subtasks',
  'progress',
  'milestone',
  'sprint',
  'blockedBy',
  'blocking',
  'related',
  'comments',
  'alarms',
  'shopping',
  'createdAt',
  'updatedAt',
] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

/** Periods of the events listed with the tasks. */
export const EVENT_PERIODS = ['thisWeek', 'nextWeek', 'thisMonth', 'nextMonth', 'next:7', 'next:30', 'next:90', 'past:30'] as const;
export type EventPeriod = (typeof EVENT_PERIODS)[number];

/** Fields the table can be grouped by. */
export const TASK_GROUP_BY = [
  'state',
  'project',
  'status',
  'priority',
  'type',
  'assignees',
  'beneficiaries',
  'tags',
  'parent',
  'milestone',
  'sprint',
  'blockedBy',
  'blocking',
  'related',
  // Dates: by month.
  'startDate',
  'endDate',
  'minDate',
  'deadline',
] as const;
export type TaskGroupBy = (typeof TASK_GROUP_BY)[number];

/** Columns of the views made by the app, unless the workspace chose its own. */
export const DEFAULT_HIDDEN_COLUMNS: TaskColumn[] = ['location', 'blocking', 'related', 'milestone', 'createdAt', 'updatedAt'];

/** Ids of columns of a table layout: any column of the table (the unknown ones are ignored by the table). */
const columnIdsSchema = z.array(z.string().max(TABLE_KEY_MAX)).max(200);

/**
 * Columns new task views of a workspace start with, as the layout of the table: their order, and those hidden (empty:
 * the columns of the app, those hidden by default hidden).
 */
export const taskColumnDefaultsSchema = z.object({
  columnOrder: columnIdsSchema.default([]),
  // The label is always shown.
  hiddenColumns: columnIdsSchema.transform((columns) => columns.filter((column) => column !== 'label')).default([]),
});
export type TaskColumnDefaults = z.infer<typeof taskColumnDefaultsSchema>;

/**
 * Columns new task views start with: those chosen for the workspace (stored value), else the app's (an empty layout).
 * @param {unknown} stored Stored value, if any.
 * @returns {TaskColumnDefaults} Order and hidden columns.
 */
export function readTaskColumnDefaults(stored: unknown): TaskColumnDefaults {
  // Old id of the label column read as `label`.
  const parsed = taskColumnDefaultsSchema.safeParse(withLabelColumn(stored ?? {}, legacyLabelColumn('tasks')));
  return parsed.success ? parsed.data : { columnOrder: [], hiddenColumns: [] };
}

/**
 * What a change of status does to a task being closed: a status « Annulé » closes it, leaving one
 * reopens it; the other categories (« Terminé » included) leave it as it is.
 * @param {TaskStatusCategory | null} from Category of its status now (null: none).
 * @param {TaskStatusCategory | null} to Category of its new status (null: none).
 * @returns {'close' | 'reopen' | null} Effect.
 */
export function statusClosing(from: TaskStatusCategory | null, to: TaskStatusCategory | null): 'close' | 'reopen' | null {
  if (to === 'CANCELLED') return 'close';
  return from === 'CANCELLED' ? 'reopen' : null;
}
