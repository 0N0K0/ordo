import { DEFAULT_HIDDEN_COLUMNS, formatDuration, ME, TASK_COLUMNS, type TaskColumn } from '@ordo/shared';
import type { ColumnChoice, ColumnFilter, DataColumn } from '../../components/data-table/data-table';
import type { EventOccurrence } from '../calendar/api';
import type { Task } from './api';
import type { TaskContext } from './use-task-context';
import { BULK_EDITABLE_COLUMNS, COLUMN_LABELS, COLUMN_SIZES, LOCKED_COLUMNS } from './views/columns-meta';
import { eventCell, taskCell } from './views/export';
import { eventSortValue, sortValue } from './views/task-rows';

/** Row of the task table: a task, or a calendar event listed with them (read only). */
export type TaskTableRow = { kind: 'task'; key: string; task: Task } | { kind: 'event'; key: string; event: EventOccurrence };

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
 * Local day of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
const localDay = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

/**
 * Columns of the task table, as on every table: shown, sorted, filtered (as the former views of the tasks: « Moi », a
 * project with its sub-projects, the relative sprints…), grouped (the projects as their tree), exported; the bulk ones
 * edited together on a selection of cells. An event fills the columns it has (title, project, people, state, time,
 * dates).
 * @param {TaskContext} context Task context.
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {DataColumn<TaskTableRow>[]} Columns.
 */
export function taskColumns(context: TaskContext, today: string): DataColumn<TaskTableRow>[] {
  const day = (value: unknown) => String(value).slice(0, 10);
  // Relative sprints, from today.
  const sprints = context.sprints;
  const past = sprints.filter((sprint) => day(sprint.endDate) < today);
  const future = sprints.filter((sprint) => day(sprint.startDate) > today);
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
    current: new Set(sprints.filter((sprint) => day(sprint.startDate) <= today && day(sprint.endDate) >= today).map((sprint) => sprint.id)),
    past: new Set(past.map((sprint) => sprint.id)),
    future: new Set(future.map((sprint) => sprint.id)),
    previous: bestPerTree(past, (a, b) => day(a.endDate) > day(b.endDate)),
    next: bestPerTree(future, (a, b) => day(a.startDate) < day(b.startDate)),
  };
  const me = context.contributors.find((contributor) => contributor.isMe)?.id ?? null;
  /**
   * A project and the projects above it (a filter on a project keeps its sub-projects).
   * @param {string | null} projectId Project.
   * @returns {string[]} Ids.
   */
  const withParents = (projectId: string | null) => {
    const ids: string[] = [];
    for (let current = projectId; current; current = context.projects.find((project) => project.id === current)?.parentId ?? null) ids.push(current);
    return ids;
  };
  const projectChoices = context.projectOptions(context.projects);
  const taskChoices = context.taskOptions(context.tasks);
  const people = [{ value: ME, label: 'Moi' }, ...context.contributors.map((contributor) => ({ value: contributor.id, label: contributor.name }))];
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
        return { kind: 'choice', value: (row) => task(row)?.statusId ?? null, options: context.statuses.map((status) => ({ value: status.id, label: status.name })) };
      case 'priority':
        return { kind: 'choice', value: (row) => task(row)?.priorityId ?? null, options: context.priorities.map((priority) => ({ value: priority.id, label: priority.name })) };
      case 'type':
        return { kind: 'choice', value: (row) => task(row)?.typeId ?? null, options: context.types.map((type) => ({ value: type.id, label: type.name })) };
      case 'assignees':
        return { kind: 'choices', value: (row) => withMe(row.kind === 'task' ? row.task.assigneeIds : row.event.contributorIds), options: people };
      case 'tags':
        return { kind: 'choices', value: (row) => task(row)?.tagIds ?? [], options: context.tags.map((tag) => ({ value: tag.id, label: tag.name })) };
      case 'milestone':
        return { kind: 'choice', value: (row) => task(row)?.milestoneId ?? null, options: context.milestones.map((milestone) => ({ value: milestone.id, label: milestone.title })) };
      case 'sprint':
        return {
          kind: 'choices',
          value: (row) => {
            const ids = task(row)?.sprintIds ?? [];
            return [...ids, ...Object.entries(relative).flatMap(([token, set]) => (ids.some((sprintId) => set.has(sprintId)) ? [token] : []))];
          },
          options: [...SPRINT_TOKENS, ...sprints.map((sprint) => ({ value: sprint.id, label: sprint.name }))],
        };
      case 'parent':
        return { kind: 'choice', value: (row) => task(row)?.parentId ?? null, options: taskChoices };
      case 'blockedBy':
        return { kind: 'choices', value: (row) => task(row)?.blockedByIds ?? [], options: taskChoices };
      case 'blocking':
        return { kind: 'choices', value: (row) => task(row)?.blockingIds ?? [], options: taskChoices };
      case 'related':
        return { kind: 'choices', value: (row) => task(row)?.relatedIds ?? [], options: taskChoices };
      case 'beneficiaries':
        return {
          kind: 'choices',
          value: (row) => {
            const item = row.kind === 'task' ? row.task : row.event;
            return [...item.beneficiaryIds.map((id) => `c:${id}`), ...item.beneficiaryRelationIds.map((id) => `r:${id}`)];
          },
          options: [...context.contributors.map((contributor) => ({ value: `c:${contributor.id}`, label: contributor.name }))],
        };
      case 'effort':
        return { kind: 'number', value: (row) => task(row)?.effort ?? null };
      case 'trackedTime':
        return { kind: 'number', value: (row) => (row.kind === 'task' ? row.task.trackedSeconds / 3600 : null) };
      case 'comments':
        return { kind: 'number', value: (row) => (row.kind === 'task' ? row.task.commentCount + (row.task.description?.trim() ? 1 : 0) : null) };
      case 'startDate':
      case 'endDate':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? (row.task[id] ? day(row.task[id]) : null) : day(id === 'startDate' ? row.event.start : row.event.end)) };
      case 'deadline':
      case 'minDate':
        return { kind: 'date', value: (row) => (row.kind === 'task' && row.task[id] ? day(row.task[id]) : null) };
      case 'createdAt':
      case 'updatedAt':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? localDay(String(row.task[id])) : null) };
      case 'slots':
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
    groupTree: id === 'project' ? context.projects.map((project) => ({ key: project.id, label: project.title, color: project.color ?? null, parentKey: project.parentId ?? null })) : undefined,
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
      text: (row) => (row.kind === 'task' ? `#${row.task.number}` : ''),
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
    flag('overdue', 'En retard', (task) => task.deadline !== null && day(task.deadline) < today && !context.isClosed(task)),
    flag('blocked', 'Bloquée', (task) => context.isBlocked(task)),
    flag('hasSubtasks', 'A des sous-tâches', (task) => context.childrenOf(task.id).length > 0),
    flag('archived', 'Archivée', (task) => task.archived),
  ];
}
