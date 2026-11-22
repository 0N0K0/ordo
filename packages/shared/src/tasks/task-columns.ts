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

/**
 * Why an open task cannot be done now, in the order they are told: its « Ouverture » is after today, its « Horaires »
 * leave the moment out, its condition on calendar schedules does, a slot « Indisponible » of the workspace holds it,
 * an event keeps its assignees busy.
 */
export const TASK_WAIT_REASONS = ['NOT_OPEN', 'OUTSIDE_HOURS', 'OUTSIDE_SLOTS', 'UNAVAILABLE', 'ASSIGNEE_BUSY'] as const;
export type TaskWaitReason = (typeof TASK_WAIT_REASONS)[number];

/** Short mention of each reason a task cannot be done now. */
export const TASK_WAIT_REASON_LABELS: Record<TaskWaitReason, string> = {
  NOT_OPEN: 'pas encore ouverte',
  OUTSIDE_HOURS: 'hors de ses horaires',
  OUTSIDE_SLOTS: 'hors de ses créneaux',
  UNAVAILABLE: 'indisponible',
  ASSIGNEE_BUSY: 'assigné occupé',
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
  'hours',
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
export const DEFAULT_HIDDEN_COLUMNS: TaskColumn[] = ['hours', 'location', 'blocking', 'related', 'milestone', 'createdAt', 'updatedAt'];

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

/** Relative sprints a filter of the sprint column chooses: the current one, the previous and next one of each project tree, past ones, future ones. */
export const RELATIVE_SPRINTS = ['current', 'previous', 'next', 'past', 'future'] as const;
export type RelativeSprint = (typeof RELATIVE_SPRINTS)[number];

/** Sprint as the relative sprints read it. */
interface DatedSprint {
  id: string;
  projectId: string;
  startDate: string;
  endDate: string;
}

/**
 * Sprints of each relative sprint, from today: the current ones, the past and future ones, the previous and next one
 * of each project tree (the one ended last, the one starting first).
 * @param {readonly DatedSprint[]} sprints Sprints (days YYYY-MM-DD).
 * @param {string} today Today (YYYY-MM-DD).
 * @param {(projectId: string) => string | null} rootOf Root project of the tree of a project.
 * @returns {Record<RelativeSprint, Set<string>>} Ids of the sprints of each.
 */
export function relativeSprintIds(sprints: readonly DatedSprint[], today: string, rootOf: (projectId: string) => string | null): Record<RelativeSprint, Set<string>> {
  const past = sprints.filter((sprint) => sprint.endDate < today);
  const future = sprints.filter((sprint) => sprint.startDate > today);
  /**
   * The best sprint of each project tree.
   * @param {readonly DatedSprint[]} candidates Sprints.
   * @param {(a: DatedSprint, b: DatedSprint) => boolean} better Whether a beats b.
   * @returns {Set<string>} Their ids.
   */
  const bestPerTree = (candidates: readonly DatedSprint[], better: (a: DatedSprint, b: DatedSprint) => boolean) => {
    const best = new Map<string, DatedSprint>();
    for (const sprint of candidates) {
      const root = rootOf(sprint.projectId) ?? sprint.projectId;
      const current = best.get(root);
      if (!current || better(sprint, current)) best.set(root, sprint);
    }
    return new Set([...best.values()].map((sprint) => sprint.id));
  };
  return {
    current: new Set(sprints.filter((sprint) => sprint.startDate <= today && sprint.endDate >= today).map((sprint) => sprint.id)),
    past: new Set(past.map((sprint) => sprint.id)),
    future: new Set(future.map((sprint) => sprint.id)),
    previous: bestPerTree(past, (a, b) => a.endDate > b.endDate),
    next: bestPerTree(future, (a, b) => a.startDate < b.startDate),
  };
}

/**
 * Values of the sprint column a task's sprints give its filter: their ids, then the relative sprints they are among.
 * @param {readonly string[]} ids Sprints of the task.
 * @param {Record<RelativeSprint, Set<string>>} relative Relative sprints (`relativeSprintIds`).
 * @returns {string[]} Values.
 */
export function sprintFilterValues(ids: readonly string[], relative: Record<RelativeSprint, Set<string>>): string[] {
  return [...ids, ...RELATIVE_SPRINTS.filter((token) => ids.some((id) => relative[token].has(id)))];
}
