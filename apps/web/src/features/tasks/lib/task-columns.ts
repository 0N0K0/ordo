import { commentTotal } from '../../comments/lib/comment-column';
import { itemChoices } from '../../../components/items/item-look';
import { beneficiaryKeys } from '../../beneficiaries/hooks/use-beneficiaries';
import { personKey } from '../../../components/people/people-keys';
import {
  DEFAULT_HIDDEN_COLUMNS,
  formatDuration,
  ME,
  readSlotRule,
  TASK_COLUMNS,
  TASK_STATUS_CATEGORIES,
  TASK_STATUS_CATEGORY_LABELS,
  type TaskColumn,
  type FilterGroupOf,
  type TaskStatusCategory,
  lineageOf,
} from '@ordo/shared';
import type { ColumnChoice, ColumnFilter, DataColumn } from '../../../components/data-table/table/data-table';
import { filterRows } from '../../../components/data-table/table/table-engine';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';
import { BULK_EDITABLE_COLUMNS, COLUMN_LABELS, COLUMN_SIZES, LOCKED_COLUMNS } from './columns-meta';
import { eventCell, taskCell } from './export';
import { eventSortValue, sortValue } from './task-rows';
import { localDay } from '../../../lib/dates';

/** Row of the task table: a task, or a calendar event listed with them (read only). */
export type TaskTableRow = { kind: 'task'; key: string; task: Task } | { kind: 'event'; key: string; event: EventOccurrence };

/** What some task filters need that the tasks do not hold. */
interface TaskColumnExtras {
  /** Tasks that can be done now (their slot rule, the events of their people). */
  doableIds?: ReadonlySet<string>;
  /** Tasks with a shopping list. */
  shoppingTaskIds?: ReadonlySet<string>;
  /** Active alerts by task. */
  alarmCounts?: ReadonlyMap<string, number>;
  /** Kinds of slots (calendar schedules). */
  slotKinds?: ColumnChoice[];
}

/** Categories of the statuses, in their order. */
const STATUS_CATEGORY_ORDER = TASK_STATUS_CATEGORIES;
const STATUS_CATEGORY_LABELS = TASK_STATUS_CATEGORY_LABELS.status;

/**
 * Tasks kept by a filter in the words of the task table (its columns), a search in their texts, the archived ones
 * left out unless included; in their order.
 * @param {readonly Task[]} tasks Tasks.
 * @param {readonly DataColumn<TaskTableRow>[]} columns Columns of the tasks.
 * @param {{ filter: FilterGroupOf<string>, search?: string, includeArchived?: boolean }} query Filter, search, archived ones.
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {Task[]} Tasks.
 */
export function matchTasks(
  tasks: readonly Task[],
  columns: readonly DataColumn<TaskTableRow>[],
  { filter, search = '', includeArchived = false }: { filter: FilterGroupOf<string>; search?: string; includeArchived?: boolean },
  today: string,
): Task[] {
  const rows = tasks.filter((task) => includeArchived || !task.archived).map((task): TaskTableRow => ({ kind: 'task', key: task.id, task }));
  return filterRows(rows, columns, { search, filter }, today).flatMap((row) => (row.kind === 'task' ? [row.task] : []));
}

/**
 * Whether a filter has a condition on a field (to load what it needs only then).
 * @param {FilterGroupOf<string> | null | undefined} group Filter.
 * @param {string} field Field.
 * @returns {boolean} It has.
 */
export function filterUses(group: FilterGroupOf<string> | null | undefined, field: string): boolean {
  return Boolean(group?.children.some((child) => (child.type === 'group' ? filterUses(child, field) : child.field === field)));
}

/** Key of the row of an event. */
export const eventKey = (event: EventOccurrence) => `e:${event.key}`;

/** Relative sprints a filter chooses: the current one, the previous and next one of each project tree, past ones, future ones. */
const SPRINT_TOKENS: ColumnChoice[] = [
  { value: 'current', label: 'Sprint en cours' },
  { value: 'previous', label: 'Sprint précédent' },
  { value: 'next', label: 'Sprint suivant' },
  { value: 'past', label: 'Sprints passés' },
  { value: 'future', label: 'Sprints à venir' },
];

/**
 * Columns of the task table, as on every table: shown, sorted, filtered (as the former views of the tasks: « Moi », a
 * project with its sub-projects, the relative sprints…), grouped (the projects as their tree), exported; the bulk ones
 * edited together on a selection of cells. An event fills the columns it has (title, project, people, state, time,
 * dates).
 * @param {TaskContext} context Task context.
 * @param {string} today Today, YYYY-MM-DD.
 * @param {TaskColumnExtras} [extras] What the tasks do not hold: those doable now, their alerts, their shopping, the
 *   kinds of slots. Optional.
 * @returns {DataColumn<TaskTableRow>[]} Columns.
 */
export function taskColumns(context: TaskContext, today: string, extras: TaskColumnExtras = {}): DataColumn<TaskTableRow>[] {
  /**
   * Category of the status of a task (to do, in progress, done, cancelled).
   * @param {Task} task Task.
   * @returns {TaskStatusCategory | null} Category.
   */
  const categoryOf = (task: Task): TaskStatusCategory | null => (task.statusId ? ((context.statusById.get(task.statusId)?.category as TaskStatusCategory | undefined) ?? null) : null);
  // Relative sprints, from today.
  const sprints = context.sprints;
  const past = sprints.filter((sprint) => sprint.endDate < today);
  const future = sprints.filter((sprint) => sprint.startDate > today);
  /**
   * The best sprint of each project tree.
   * @param {typeof sprints} candidates Sprints.
   * @param {(a: (typeof sprints)[number], b: (typeof sprints)[number]) => boolean} better Whether a beats b.
   * @returns {Set<string>} Their ids.
   */
  const bestPerTree = (candidates: typeof sprints, better: (a: (typeof sprints)[number], b: (typeof sprints)[number]) => boolean) => {
    const best = new Map<string, (typeof sprints)[number]>();
    for (const sprint of candidates) {
      const root = context.rootOf(sprint.projectId) ?? sprint.projectId;
      const current = best.get(root);
      if (!current || better(sprint, current)) best.set(root, sprint);
    }
    return new Set([...best.values()].map((sprint) => sprint.id));
  };
  const relative: Record<string, Set<string>> = {
    current: new Set(sprints.filter((sprint) => sprint.startDate <= today && sprint.endDate >= today).map((sprint) => sprint.id)),
    past: new Set(past.map((sprint) => sprint.id)),
    future: new Set(future.map((sprint) => sprint.id)),
    previous: bestPerTree(past, (a, b) => a.endDate > b.endDate),
    next: bestPerTree(future, (a, b) => a.startDate < b.startDate),
  };
  const me = context.contributors.find((contributor) => contributor.isMe)?.id ?? null;
  /**
   * A project and the projects above it (a filter on a project keeps its sub-projects).
   * @param {string | null} projectId Project.
   * @returns {string[]} Ids.
   */
  const withParents = (projectId: string | null) => lineageOf(context.projectById, projectId).map((project) => project.id);
  const projectChoices = context.projectOptions(context.projects);
  const taskChoices = context.taskOptions(context.tasks);
  // Archived values keep their labels, the filter offers them only while in it (ColumnChoice.archived).
  const people = [{ value: ME, label: 'Moi' }, ...context.contributors.map((contributor) => ({ value: contributor.id, label: context.contributorName(contributor), archived: contributor.archived }))];
  /**
   * People of a row, with « Moi » for the user.
   * @param {string[]} ids Contributors.
   * @returns {string[]} Values.
   */
  const withMe = (ids: string[]) => (me && ids.includes(me) ? [...ids, ME] : ids);
  /**
   * Filter of a column on the tasks (and on the events for what they have).
   * @param {TaskColumn} id Column.
   * @returns {ColumnFilter<TaskTableRow> | false | undefined} Filter.
   */
  const filterOf = (id: TaskColumn): ColumnFilter<TaskTableRow> | false | undefined => {
    const task = (row: TaskTableRow) => (row.kind === 'task' ? row.task : null);
    switch (id) {
      case 'project':
        return { kind: 'choices', value: (row) => withParents(row.kind === 'task' ? row.task.projectId : row.event.projectId), options: projectChoices };
      case 'status':
        return {
          kind: 'choice',
          value: (row) => task(row)?.statusId ?? null,
          options: itemChoices(context.statuses),
        };
      case 'priority':
        return {
          kind: 'choice',
          value: (row) => task(row)?.priorityId ?? null,
          options: itemChoices(context.priorities),
        };
      case 'type':
        return {
          kind: 'choice',
          value: (row) => task(row)?.typeId ?? null,
          options: itemChoices(context.types),
        };
      case 'assignees':
        return { kind: 'choices', value: (row) => withMe(row.kind === 'task' ? row.task.assigneeIds : row.event.contributorIds), options: people };
      case 'tags':
        return {
          kind: 'choices',
          value: (row) => task(row)?.tagIds ?? [],
          options: itemChoices(context.tags),
        };
      case 'milestone':
        return {
          kind: 'choice',
          value: (row) => task(row)?.milestoneId ?? null,
          options: context.milestones.map((milestone) => ({ value: milestone.id, label: context.milestoneLabel(milestone), archived: milestone.archived })),
        };
      case 'sprint':
        return {
          kind: 'choices',
          value: (row) => {
            const ids = task(row)?.sprintIds ?? [];
            return [...ids, ...Object.entries(relative).flatMap(([token, set]) => (ids.some((sprintId) => set.has(sprintId)) ? [token] : []))];
          },
          options: [...SPRINT_TOKENS, ...sprints.map((sprint) => ({ value: sprint.id, label: context.sprintLabel(sprint), archived: sprint.archived }))],
        };
      case 'parent':
        // Its parent and those above it: a filter on a task keeps its sub-tasks at every level.
        return {
          kind: 'choices',
          value: (row) => lineageOf(context.taskById, task(row)?.parentId).map((parent) => parent.id),
          options: taskChoices,
        };
      case 'blockedBy':
        return { kind: 'choices', value: (row) => task(row)?.blockedByIds ?? [], options: taskChoices };
      case 'blocking':
        return { kind: 'choices', value: (row) => task(row)?.blockingIds ?? [], options: taskChoices };
      case 'related':
        return { kind: 'choices', value: (row) => task(row)?.relatedIds ?? [], options: taskChoices };
      case 'beneficiaries':
        return {
          kind: 'choices',
          value: (row) => beneficiaryKeys(row.kind === 'task' ? row.task : row.event),
          options: context.contributors.map((contributor) => ({ value: personKey('contributor', contributor.id), label: contributor.name, archived: contributor.archived })),
        };
      case 'effort':
        return { kind: 'number', value: (row) => task(row)?.effort ?? null };
      case 'trackedTime':
        return { kind: 'number', value: (row) => (row.kind === 'task' ? row.task.trackedSeconds / 3600 : null) };
      case 'comments':
        return { kind: 'number', value: (row) => (row.kind === 'task' ? commentTotal(row.task.commentCount, row.task.description) : null) };
      case 'startDate':
      case 'endDate':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? (row.task[id] ?? null) : id === 'startDate' ? row.event.startDate : row.event.endDate) };
      case 'deadline':
      case 'minDate':
        return { kind: 'date', value: (row) => (row.kind === 'task' && row.task[id] ? row.task[id] : null) };
      case 'createdAt':
      case 'updatedAt':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? localDay(row.task[id]) : null) };
      case 'slots':
        // Kinds of slots its rule names, during or out of.
        return {
          kind: 'choices',
          value: (row) => {
            const rule = row.kind === 'task' ? readSlotRule(row.task.slotRule) : null;
            return rule ? [...rule.inside, ...rule.outside] : [];
          },
          options: extras.slotKinds ?? [],
        };
      case 'timer':
      case 'subtasks':
      case 'progress':
      case 'alarms':
      case 'shopping':
        return false;
      default:
        return undefined;
    }
  };
  // Groups of a row: its own values (not « Moi », the parent projects nor the relative sprints of the filters).
  const GROUP_VALUES: Partial<Record<TaskColumn, (row: TaskTableRow) => readonly string[]>> = {
    project: (row) => {
      const projectId = row.kind === 'task' ? row.task.projectId : row.event.projectId;
      return projectId ? [projectId] : [];
    },
    assignees: (row) => (row.kind === 'task' ? row.task.assigneeIds : row.event.contributorIds),
    sprint: (row) => (row.kind === 'task' ? row.task.sprintIds : []),
  };
  const columns: DataColumn<TaskTableRow>[] = TASK_COLUMNS.map((id) => ({
    id,
    label: COLUMN_LABELS[id],
    size: COLUMN_SIZES[id],
    locked: LOCKED_COLUMNS.includes(id),
    hiddenByDefault: DEFAULT_HIDDEN_COLUMNS.includes(id),
    bulk: BULK_EDITABLE_COLUMNS.includes(id),
    numeric: id === 'effort' || id === 'trackedTime' || id === 'comments',
    sortValue: (row) => {
      const value = row.kind === 'task' ? sortValue(row.task, id, context) : eventSortValue(row.event, id, context);
      return typeof value === 'number' || typeof value === 'string' ? value : null;
    },
    text: (row) => (row.kind === 'task' ? taskCell(row.task, id, context) : eventCell(row.event, id, context)),
    filter: filterOf(id),
    formatTotal: id === 'trackedTime' ? (seconds) => formatDuration(Math.round(seconds)) : undefined,
    groupable: ['slots', 'timer', 'subtasks', 'progress', 'alarms', 'shopping', 'comments'].includes(id) ? false : undefined,
    groupTree: id === 'project' ? context.projects.map((project) => ({ key: project.id, label: project.label, color: project.color ?? null, parentKey: project.parentId ?? null })) : undefined,
    groupValue: GROUP_VALUES[id],
  }));
  // Filters of their own, out of the columns (hidden until shown).
  const flag = (id: string, label: string, value: (task: Task) => boolean): DataColumn<TaskTableRow> => ({
    id,
    label,
    size: 110,
    hiddenByDefault: true,
    text: (row) => (row.kind === 'task' && value(row.task) ? 'Oui' : ''),
    filter: { kind: 'boolean', value: (row) => row.kind === 'task' && value(row.task) },
  });
  return [
    ...columns,
    {
      id: 'number',
      label: 'Numéro',
      size: 90,
      numeric: true,
      hiddenByDefault: true,
      groupable: false,
      sortValue: (row) => (row.kind === 'task' ? row.task.number : null),
      text: (row) => (row.kind === 'task' && row.task.number !== null ? `#${row.task.number}` : ''),
      filter: { kind: 'number', value: (row) => (row.kind === 'task' ? row.task.number : null) },
    },
    {
      id: 'description',
      label: 'Description',
      size: 240,
      hiddenByDefault: true,
      groupable: false,
      text: (row) => (row.kind === 'task' ? (row.task.description ?? '') : (row.event.description ?? '')),
    },
    flag('closed', 'Fermée', (task) => context.isClosed(task)),
    flag('overdue', 'En retard', (task) => task.deadline !== null && task.deadline < today && !context.isClosed(task)),
    flag('blocked', 'Bloquée', (task) => context.isBlocked(task)),
    flag('hasSubtasks', 'A des sous-tâches', (task) => context.childrenOf(task.id).length > 0),
    flag('archived', 'Archivée', (task) => task.archived),
    flag('doableNow', 'Faisable maintenant', (task) => extras.doableIds?.has(task.id) ?? false),
    flag('hasShopping', 'A des achats', (task) => extras.shoppingTaskIds?.has(task.id) ?? false),
    flag('hasAlarms', 'A des alarmes', (task) => (extras.alarmCounts?.get(task.id) ?? 0) > 0),
    flag('hasComments', 'A des commentaires', (task) => task.commentCount > 0 || Boolean(task.description?.trim())),
    {
      id: 'statusCategory',
      label: 'Catégorie de statut',
      size: 140,
      hiddenByDefault: true,
      sortValue: (row) => (row.kind === 'task' ? STATUS_CATEGORY_ORDER.indexOf(categoryOf(row.task) ?? 'TODO') : null),
      text: (row) => {
        const category = row.kind === 'task' ? categoryOf(row.task) : null;
        return category ? STATUS_CATEGORY_LABELS[category] : '';
      },
      filter: { kind: 'choice', value: (row) => (row.kind === 'task' ? categoryOf(row.task) : null), options: STATUS_CATEGORY_ORDER.map((value) => ({ value, label: STATUS_CATEGORY_LABELS[value] })) },
    },
  ];
}
