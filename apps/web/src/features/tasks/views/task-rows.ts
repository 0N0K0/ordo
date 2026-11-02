import type { TaskGroupBy, TaskSortKey, TaskViewConfig } from '@ordo/shared';
import type { Task } from '../api';
import type { TaskContext } from '../use-task-context';

export interface TaskRow {
  kind: 'task';
  /** Unique row id: a task can appear in several assignee groups. */
  id: string;
  task: Task;
  children: DisplayRow[];
}

export interface GroupRow {
  kind: 'group';
  id: string;
  label: string;
  color?: string;
  children: DisplayRow[];
}

export type DisplayRow = TaskRow | GroupRow;

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

type SortValue = string | number | null;

/**
 * Value a task is sorted by; null (empty) always goes last.
 * @param {Task} task Task.
 * @param {TaskSortKey} column Sort key (column id or number).
 * @param {TaskContext} context Task context.
 * @returns {SortValue} Comparable value.
 */
export function sortValue(task: Task, column: TaskSortKey, context: TaskContext): SortValue {
  switch (column) {
    case 'number':
      return task.number;
    case 'title':
      return task.title;
    case 'project':
      return context.projectLabel(task.projectId);
    case 'status':
      return task.statusId ? (context.statusById.get(task.statusId)?.position ?? null) : null;
    case 'priority':
      return task.priorityId ? (context.priorityById.get(task.priorityId)?.position ?? null) : null;
    case 'type':
      return task.typeId ? (context.typeById.get(task.typeId)?.position ?? null) : null;
    case 'assignees': {
      const names = task.assigneeIds.map((id) => context.contributorById.get(id)?.name ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'effort':
      return task.effort;
    case 'trackedTime':
      return task.trackedSeconds || null;
    case 'startDate':
      return task.startDate;
    case 'endDate':
      return task.endDate;
    case 'parent':
      return task.parentId ? (context.taskById.get(task.parentId)?.number ?? null) : null;
    case 'milestone': {
      // By due date, milestones without date after the dated ones.
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      return milestone ? `${milestone.dueDate ?? '9999-99-99'} ${milestone.title}` : null;
    }
    case 'blockedBy':
      return task.blockedByIds.length || null;
    case 'blocking':
      return task.blockingIds.length || null;
    case 'related':
      return task.relatedIds.length || null;
    case 'comments':
      return task.commentCount || null;
    case 'createdAt':
      return task.createdAt;
    case 'updatedAt':
      return task.updatedAt;
  }
}

/**
 * Sorts tasks by the sorting levels of the view; without sorting, keeps the manual order.
 * @param {Task[]} tasks Tasks in manual order.
 * @param {TaskViewConfig['sorting']} sorting Sort levels, in priority order.
 * @param {TaskContext} context Task context.
 * @returns {Task[]} Sorted copy.
 */
function sortTasks(tasks: Task[], sorting: TaskViewConfig['sorting'], context: TaskContext): Task[] {
  if (sorting.length === 0) return tasks;
  const keyed = tasks.map((task, index) => ({
    task,
    index,
    values: sorting.map((sort) => sortValue(task, sort.id, context)),
  }));
  keyed.sort((a, b) => {
    for (let level = 0; level < sorting.length; level++) {
      const x = a.values[level];
      const y = b.values[level];
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const order = typeof x === 'string' && typeof y === 'string' ? collator.compare(x, y) : x < y ? -1 : 1;
      if (order !== 0) return sorting[level].desc ? -order : order;
    }
    return a.index - b.index;
  });
  return keyed.map((item) => item.task);
}

/**
 * Builds task rows: as a tree (a sub-task under its parent when the parent is in the list) or flat.
 * @param {Task[]} tasks Tasks of the list (or group), in manual order.
 * @param {TaskViewConfig} config View configuration.
 * @param {TaskContext} context Task context.
 * @param {string} prefix Row id prefix (group key).
 * @returns {TaskRow[]} Rows.
 */
function taskRows(tasks: Task[], config: TaskViewConfig, context: TaskContext, prefix: string): TaskRow[] {
  const sorted = sortTasks(tasks, config.sorting, context);
  const toRow = (task: Task, children: TaskRow[]): TaskRow => ({ kind: 'task', id: `${prefix}t:${task.id}`, task, children });
  if (config.flat) return sorted.map((task) => toRow(task, []));

  const inList = new Set(tasks.map((task) => task.id));
  /**
   * Rows of the tasks under a parent (or the roots when parentId is null).
   * @param {string | null} parentId Parent task id.
   * @returns {TaskRow[]} Rows.
   */
  const level = (parentId: string | null): TaskRow[] =>
    sorted
      .filter((task) => (parentId === null ? !task.parentId || !inList.has(task.parentId) : task.parentId === parentId))
      .map((task) => toRow(task, level(task.id)));
  return level(null);
}

interface GroupKey {
  key: string;
  label: string;
  color?: string;
  /** Sort order of the group; empty group last. */
  order: number | string;
}

/**
 * Groups a task belongs to (several for assignees; one "none" group when empty).
 * @param {Task} task Task.
 * @param {TaskGroupBy} groupBy Grouping field.
 * @param {TaskContext} context Task context.
 * @returns {GroupKey[]} Groups.
 */
function groupsOf(task: Task, groupBy: TaskGroupBy, context: TaskContext): GroupKey[] {
  const none = (label: string): GroupKey[] => [{ key: 'none', label, order: Number.MAX_SAFE_INTEGER }];
  switch (groupBy) {
    case 'state':
      return task.closed
        ? [{ key: 'closed', label: 'Fermées', color: 'violet', order: 1 }]
        : [{ key: 'open', label: 'Ouvertes', color: 'green', order: 0 }];
    case 'project':
      return [{ key: task.projectId, label: context.projectLabel(task.projectId), order: context.projectLabel(task.projectId) }];
    case 'status':
    case 'priority':
    case 'type': {
      const id = { status: task.statusId, priority: task.priorityId, type: task.typeId }[groupBy];
      const lookup = { status: context.statusById, priority: context.priorityById, type: context.typeById }[groupBy];
      const label = id ? lookup.get(id) : undefined;
      if (!label) return none({ status: 'Sans statut', priority: 'Sans priorité', type: 'Sans type' }[groupBy]);
      return [{ key: label.id, label: label.name, color: label.color, order: label.position }];
    }
    case 'assignees': {
      const assignees = task.assigneeIds
        .map((id) => context.contributorById.get(id))
        .filter((contributor) => contributor !== undefined);
      if (assignees.length === 0) return none('Non assignées');
      return assignees.map((contributor) => ({ key: contributor.id, label: contributor.name, order: contributor.name }));
    }
    case 'parent': {
      const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
      if (!parent) return none('Sans tâche parente');
      return [{ key: parent.id, label: `#${parent.number} ${parent.title}`, order: parent.number }];
    }
    case 'milestone': {
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      if (!milestone) return none('Sans jalon');
      return [{ key: milestone.id, label: milestone.title, order: `${milestone.dueDate ?? '9999-99-99'} ${milestone.title}` }];
    }
  }
}

/**
 * Builds the rows of the table: sorted tasks, as a tree or flat, optionally grouped.
 * @param {Task[]} tasks Matching tasks, in manual order.
 * @param {TaskViewConfig} config View configuration.
 * @param {TaskContext} context Task context.
 * @returns {DisplayRow[]} Rows.
 */
export function buildRows(tasks: Task[], config: TaskViewConfig, context: TaskContext): DisplayRow[] {
  if (!config.groupBy) return taskRows(tasks, config, context, '');

  const groups = new Map<string, GroupKey & { tasks: Task[] }>();
  for (const task of tasks) {
    for (const group of groupsOf(task, config.groupBy, context)) {
      const entry = groups.get(group.key) ?? { ...group, tasks: [] };
      entry.tasks.push(task);
      groups.set(group.key, entry);
    }
  }
  return [...groups.values()]
    .sort((a, b) =>
      typeof a.order === 'number' && typeof b.order === 'number'
        ? a.order - b.order
        : a.key === 'none'
          ? 1
          : b.key === 'none'
            ? -1
            : collator.compare(String(a.order), String(b.order)),
    )
    .map((group) => {
      const children = taskRows(group.tasks, config, context, `g:${group.key}:`);
      return { kind: 'group', id: `g:${group.key}`, label: group.label, color: group.color, children };
    });
}

/**
 * Task id of a row id (`t:<taskId>` or `g:<groupKey>:t:<taskId>`).
 * @param {string} rowId Row id.
 * @returns {string | null} Task id, or null for a group row.
 */
export function taskIdOfRow(rowId: string): string | null {
  return /(?:^|:)t:([^:]+)$/.exec(rowId)?.[1] ?? null;
}
