import type { TaskGroupBy, TaskSortKey, TaskViewConfig } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import type { TaskContext } from '../use-task-context';
import { beneficiaryNames } from '../../beneficiaries/use-beneficiaries';

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

export interface EventRow {
  kind: 'event';
  /** Unique row id: an event can appear in several groups. */
  id: string;
  event: EventOccurrence;
  children: DisplayRow[];
}

export type DisplayRow = TaskRow | GroupRow | EventRow;

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
    case 'beneficiaries':
      return beneficiaryNames(task, context).sort(collator.compare)[0] ?? null;
    case 'assignees': {
      const names = task.assigneeIds.map((id) => context.contributorById.get(id)?.name ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'tags': {
      const names = task.tagIds.map((id) => context.tagById.get(id)?.name ?? '').sort(collator.compare);
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
    case 'deadline':
      return task.deadline;
    case 'parent':
      return task.parentId ? (context.taskById.get(task.parentId)?.number ?? null) : null;
    case 'milestone': {
      // In the milestone order chosen by the user.
      return task.milestoneId ? (context.milestoneRank.get(task.milestoneId) ?? null) : null;
    }
    case 'sprint': {
      // The earliest of its sprints.
      const keys = task.sprintIds
        .map((id) => context.sprintById.get(id))
        .filter((sprint) => sprint !== undefined)
        .map((sprint) => `${sprint.startDate} ${sprint.name}`)
        .sort();
      return keys[0] ?? null;
    }
    case 'blockedBy':
      return task.blockedByIds.length || null;
    case 'blocking':
      return task.blockingIds.length || null;
    case 'related':
      return task.relatedIds.length || null;
    case 'comments':
      // A description counts as a comment.
      return task.commentCount + (task.description?.trim() ? 1 : 0) || null;
    case 'createdAt':
      return task.createdAt;
    case 'updatedAt':
      return task.updatedAt;
  }
}

/**
 * Value an event is sorted by: its title, project, people and dates; null for what only tasks have.
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskSortKey} column Sort key.
 * @param {TaskContext} context Task context.
 * @returns {SortValue} Comparable value.
 */
export function eventSortValue(event: EventOccurrence, column: TaskSortKey, context: TaskContext): SortValue {
  switch (column) {
    case 'title':
      return event.title;
    case 'project':
      return event.projectId ? context.projectLabel(event.projectId) : null;
    case 'assignees': {
      const names = event.contributorIds.map((id) => context.contributorById.get(id)?.name ?? '').sort(collator.compare);
      return names[0] ?? null;
    }
    case 'startDate':
      return `${event.startDate} ${event.startTime ?? ''}`.trim();
    case 'endDate':
      return `${event.endDate} ${event.endTime ?? ''}`.trim();
    default:
      return null;
  }
}

/**
 * Sorts items by the sorting levels of the view; without sorting, keeps their order.
 * @param {T[]} items Items, in their default order.
 * @param {TaskViewConfig['sorting']} sorting Sort levels, in priority order.
 * @param {(item: T, column: TaskSortKey) => SortValue} valueOf Sort value of an item.
 * @returns {T[]} Sorted copy.
 */
function sortItems<T>(items: T[], sorting: TaskViewConfig['sorting'], valueOf: (item: T, column: TaskSortKey) => SortValue): T[] {
  if (sorting.length === 0) return items;
  const keyed = items.map((item, index) => ({
    item,
    index,
    values: sorting.map((sort) => valueOf(item, sort.id)),
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
  return keyed.map((entry) => entry.item);
}

/**
 * Task rows and event rows of a list (or group). Without sorting, the events come first by date, then the
 * tasks in manual order; with sorting, the events take their place among the top-level tasks.
 * @param {Task[]} tasks Tasks, in manual order.
 * @param {EventOccurrence[]} events Events, by date.
 * @param {TaskViewConfig} config View configuration.
 * @param {TaskContext} context Task context.
 * @param {string} prefix Row id prefix (group key).
 * @returns {DisplayRow[]} Rows.
 */
function listRows(tasks: Task[], events: EventOccurrence[], config: TaskViewConfig, context: TaskContext, prefix: string): DisplayRow[] {
  const rows = taskRows(tasks, config, context, prefix);
  if (events.length === 0) return rows;
  const eventRows: EventRow[] = events.map((event) => ({ kind: 'event', id: `${prefix}e:${event.key}`, event, children: [] }));
  if (config.sorting.length === 0) return [...eventRows, ...rows];
  return sortItems<DisplayRow>([...rows, ...eventRows], config.sorting, (row, column) =>
    row.kind === 'event' ? eventSortValue(row.event, column, context) : row.kind === 'task' ? sortValue(row.task, column, context) : null,
  );
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
  const sorted = sortItems(tasks, config.sorting, (task, column) => sortValue(task, column, context));
  const toRow = (task: Task, children: TaskRow[]): TaskRow => ({ kind: 'task', id: `${prefix}t:${task.id}`, task, children });
  if (config.flat) return sorted.map((task) => toRow(task, []));

  const inList = new Set(tasks.map((task) => task.id));
  /**
   * Rows of the tasks under a parent (or the roots when parentId is null).
   * @param {string | null} parentId Parent task id.
   * @returns {TaskRow[]} Rows.
   */
  const level = (parentId: string | null): TaskRow[] =>
    sorted.filter((task) => (parentId === null ? !task.parentId || !inList.has(task.parentId) : task.parentId === parentId)).map((task) => toRow(task, level(task.id)));
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
      return task.closed ? [{ key: 'closed', label: 'Fermées', color: 'violet', order: 1 }] : [{ key: 'open', label: 'Ouvertes', color: 'green', order: 0 }];
    case 'project':
      return [{ key: task.projectId ?? 'none', label: context.projectLabel(task.projectId), order: task.projectId ? context.projectLabel(task.projectId) : '\uffff' }];
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
      const assignees = task.assigneeIds.map((id) => context.contributorById.get(id)).filter((contributor) => contributor !== undefined);
      if (assignees.length === 0) return none('Non assignées');
      return assignees.map((contributor) => ({ key: contributor.id, label: contributor.name, order: contributor.name }));
    }
    case 'tags': {
      const tags = task.tagIds.map((id) => context.tagById.get(id)).filter((tag) => tag !== undefined);
      if (tags.length === 0) return none('Sans étiquette');
      return tags.map((tag) => ({ key: tag.id, label: tag.name, color: tag.color, order: tag.position }));
    }
    case 'parent': {
      const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
      if (!parent) return none('Sans tâche parente');
      return [{ key: parent.id, label: context.taskLabel(parent, task.projectId), order: parent.number ?? parent.title }];
    }
    case 'milestone': {
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      if (!milestone) return none('Sans jalon');
      return [{ key: milestone.id, label: milestone.title, order: context.milestoneRank.get(milestone.id) ?? Number.MAX_SAFE_INTEGER - 1 }];
    }
    case 'sprint': {
      // In the group of each of its sprints.
      const sprints = task.sprintIds.map((id) => context.sprintById.get(id)).filter((sprint) => sprint !== undefined);
      if (sprints.length === 0) return none('Sans sprint');
      return sprints.map((sprint) => ({ key: sprint.id, label: sprint.name, order: `${sprint.startDate} ${sprint.name}` }));
    }
  }
}

/** Group of the events when the grouping field is one only tasks have. */
const EVENTS_GROUP = 'events';

/**
 * Groups an event belongs to: its project or people, else the events group.
 * @param {EventOccurrence} event Occurrence.
 * @param {TaskGroupBy} groupBy Grouping field.
 * @param {TaskContext} context Task context.
 * @returns {GroupKey[]} Groups.
 */
function eventGroupsOf(event: EventOccurrence, groupBy: TaskGroupBy, context: TaskContext): GroupKey[] {
  if (groupBy === 'project') {
    if (!event.projectId) return [{ key: 'none', label: 'Sans projet', order: Number.MAX_SAFE_INTEGER }];
    const label = context.projectLabel(event.projectId);
    return [{ key: event.projectId, label, order: label }];
  }
  if (groupBy === 'assignees') {
    const people = event.contributorIds.map((id) => context.contributorById.get(id)).filter((contributor) => contributor !== undefined);
    if (people.length === 0) return [{ key: 'none', label: 'Non assignées', order: Number.MAX_SAFE_INTEGER }];
    return people.map((contributor) => ({ key: contributor.id, label: contributor.name, order: contributor.name }));
  }
  return [{ key: EVENTS_GROUP, label: 'Évènements', color: 'blue', order: -1 }];
}

/**
 * Builds the rows of the table: sorted tasks, as a tree or flat, and the events, optionally grouped.
 * @param {Task[]} tasks Matching tasks, in manual order.
 * @param {EventOccurrence[]} events Matching events, by date.
 * @param {TaskViewConfig} config View configuration.
 * @param {TaskContext} context Task context.
 * @returns {DisplayRow[]} Rows.
 */
export function buildRows(tasks: Task[], events: EventOccurrence[], config: TaskViewConfig, context: TaskContext): DisplayRow[] {
  if (!config.groupBy) return listRows(tasks, events, config, context, '');

  const groups = new Map<string, GroupKey & { tasks: Task[]; events: EventOccurrence[] }>();
  const entry = (group: GroupKey) => {
    const found = groups.get(group.key) ?? { ...group, tasks: [], events: [] };
    groups.set(group.key, found);
    return found;
  };
  for (const task of tasks) for (const group of groupsOf(task, config.groupBy, context)) entry(group).tasks.push(task);
  for (const event of events) for (const group of eventGroupsOf(event, config.groupBy, context)) entry(group).events.push(event);
  return [...groups.values()]
    .sort((a, b) =>
      // The events group first, the "none" group last.
      a.key === EVENTS_GROUP
        ? -1
        : b.key === EVENTS_GROUP
          ? 1
          : typeof a.order === 'number' && typeof b.order === 'number'
            ? a.order - b.order
            : a.key === 'none'
              ? 1
              : b.key === 'none'
                ? -1
                : collator.compare(String(a.order), String(b.order)),
    )
    .map((group) => {
      const children = listRows(group.tasks, group.events, config, context, `g:${group.key}:`);
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
