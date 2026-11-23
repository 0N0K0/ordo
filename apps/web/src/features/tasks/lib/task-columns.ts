import { commentTotal } from '../../comments/lib/comment-column';
import { itemChoices } from '../../../components/items/item-look';
import { beneficiaryKeys } from '../../beneficiaries/hooks/use-beneficiaries';
import { personKey } from '../../../components/people/people-keys';
import {
  DEFAULT_HIDDEN_COLUMNS,
  formatDuration,
  ME,
  conditionReferences,
  readSlotCondition,
  TASK_COLUMNS,
  TASK_STATUS_CATEGORIES,
  TASK_STATUS_CATEGORY_LABELS,
  TASK_CLOSE_REASON_LABELS,
  TASK_CLOSE_REASONS,
  type TaskColumn,
  type FilterGroupOf,
  type TableViewConfig,
  type TaskStatusCategory,
  lineageOf,
  relativeSprintIds,
  sprintFilterValues,
} from '@ordo/shared';
import { BADGE_COLUMN, DURATION_COLUMN, LATE_GROUP_LABELS, WARNING_YES_ICONS, type ColumnChoice, type ColumnFilter, type DataColumn, type YesNoIcons, type YesNoLabels } from '../../../components/data-table/table/data-table';
import { filterRows } from '../../../components/data-table/table/table-engine';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import type { EventOccurrence } from '../../calendar/api';
import type { Task } from '../api';
import { type TaskContext, taskNumber } from '../hooks/use-task-context';
import { BULK_EDITABLE_COLUMNS, COLUMN_LABELS, COLUMN_SIZES, LOCKED_COLUMNS } from './columns-meta';
import { eventCell, taskCell } from './export';
import { eventSortValue, sortValue } from './task-rows';
import { localDay } from '../../../lib/dates';
import { unarchived } from '../../../lib/archive';
import { isTaskOverdue } from './task-overdue';
import { taggedKey } from '../../../lib/tagged-key';
import { documentsColumn } from '../../documents/lib/documents-column';

/** Names of the two sides of « Faisable maintenant » (its groups, the sections of the home card): yes first. */
export const DOABLE_GROUP_LABELS = { yes: 'Maintenant', no: 'Plus tard' } as const;

/**
 * Kinds of the columns of the tasks that are not a text (their alignment): a badge or a button alone (status, priority,
 * type, alarms, chrono), a number, a duration; the dates and the yes / no come from their filter.
 */
const COLUMN_KINDS: Partial<Record<TaskColumn, Pick<DataColumn<TaskTableRow>, 'numeric' | 'align'>>> = {
  status: BADGE_COLUMN,
  priority: BADGE_COLUMN,
  type: BADGE_COLUMN,
  alarms: BADGE_COLUMN,
  timer: BADGE_COLUMN,
  effort: { numeric: true },
  comments: { numeric: true },
  trackedTime: DURATION_COLUMN,
};

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
  /** Calendar schedules a slot condition can name. */
  slotSchedules?: ColumnChoice[];
  /** Comments by occurrence of the events listed (their key). */
  eventComments?: ReadonlyMap<string, number>;
}

/** Categories of the statuses, in their order. */
const STATUS_CATEGORY_ORDER = TASK_STATUS_CATEGORIES;
const STATUS_CATEGORY_LABELS = TASK_STATUS_CATEGORY_LABELS.status;

/**
 * Rows of the task table made of tasks, in their manual order (then by number), as the table lists them.
 * @param {readonly Task[]} tasks Tasks.
 * @returns {TaskTableRow[]} Rows.
 */
export function taskTableRows(tasks: readonly Task[]): TaskTableRow[] {
  return [...tasks].sort((a, b) => a.position - b.position || (a.number ?? 0) - (b.number ?? 0)).map((task): TaskTableRow => ({ kind: 'task', key: task.id, task }));
}

/**
 * Whether a row of the task table is an archived task (left out until « Afficher les archivées » is on).
 * @param {TaskTableRow} row Row.
 * @returns {boolean} Archived task.
 */
export const isArchivedTaskRow = (row: TaskTableRow): boolean => row.kind === 'task' && row.task.archived;

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
  const rows = (includeArchived ? tasks : unarchived(tasks)).map((task): TaskTableRow => ({ kind: 'task', key: task.id, task }));
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

/**
 * Whether a view needs a column hidden by default (to load what it needs only then): its filter, its sort or its
 * grouping uses it, or the column is shown (shown once, it is in the column order and not hidden).
 * @param {Pick<TableViewConfig, 'filter' | 'sorting' | 'groupBy' | 'columnOrder' | 'hiddenColumns'> | null | undefined} config View.
 * @param {string} field Column hidden by default.
 * @returns {boolean} It needs it.
 */
export function viewUses(config: Pick<TableViewConfig, 'filter' | 'sorting' | 'groupBy' | 'columnOrder' | 'hiddenColumns'> | null | undefined, field: string): boolean {
  if (!config) return false;
  return (
    filterUses(config.filter, field) ||
    config.sorting.some((sort) => sort.id === field) ||
    config.groupBy === field ||
    (config.columnOrder.includes(field) && !config.hiddenColumns.includes(field))
  );
}

/** Key of the row of an event. */
export const eventRowKey = (event: EventOccurrence) => taggedKey('e', event.key);

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
 *   kinds of slots, the comments of the events. Optional.
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
  const relative = relativeSprintIds(sprints, today, context.rootOf);
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
  /**
   * Comments of a row, its description counting as one.
   * @param {TaskTableRow} row Row.
   * @returns {number} Number.
   */
  const commentsOf = (row: TaskTableRow): number =>
    row.kind === 'task' ? commentTotal(row.task.commentCount, row.task.description) : commentTotal(extras.eventComments?.get(row.event.key), row.event.description);
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
          value: (row) => sprintFilterValues(task(row)?.sprintIds ?? [], relative),
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
        return { kind: 'number', value: (row) => (row.kind === 'task' ? row.task.trackedSeconds : row.event.trackedSeconds) / 3600 };
      case 'comments':
        return { kind: 'number', value: commentsOf };
      case 'startDate':
      case 'endDate':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? (row.task[id] ?? null) : id === 'startDate' ? row.event.startDate : row.event.endDate) };
      case 'deadline':
      case 'minDate': {
        // The one it goes by (`effectiveTask`): its own, else its parent's, milestone's, project's or sprint's.
        const field = id === 'deadline' ? 'effectiveDeadline' : 'effectiveMinDate';
        return { kind: 'date', value: (row) => (row.kind === 'task' && row.task[field] ? row.task[field] : null) };
      }
      case 'createdAt':
      case 'updatedAt':
        return { kind: 'date', value: (row) => (row.kind === 'task' ? localDay(row.task[id]) : null) };
      case 'slots':
        // Schedules and kinds its condition names, on or out of them.
        return {
          kind: 'choices',
          value: (row) => (row.kind === 'task' ? conditionReferences(readSlotCondition(row.task.slotCondition)) : []),
          options: extras.slotSchedules ?? [],
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
    // Tasks and events always have a title; a count or a time is never empty.
    required: id === 'label' || id === 'comments' || id === 'trackedTime',
    hiddenByDefault: DEFAULT_HIDDEN_COLUMNS.includes(id),
    bulk: BULK_EDITABLE_COLUMNS.includes(id),
    ...COLUMN_KINDS[id],
    sortValue: (row) => {
      const value = row.kind === 'task' ? sortValue(row.task, id, context) : eventSortValue(row.event, id, context, commentsOf(row));
      return typeof value === 'number' || typeof value === 'string' ? value : null;
    },
    text: (row) => (row.kind === 'task' ? taskCell(row.task, id, context) : eventCell(row.event, id, context, commentsOf(row))),
    filter: filterOf(id),
    formatTotal: id === 'trackedTime' ? (seconds) => formatDuration(Math.round(seconds)) : undefined,
    groupable: ['slots', 'hours', 'timer', 'subtasks', 'progress', 'alarms', 'shopping', 'comments'].includes(id) ? false : undefined,
    groupTree: id === 'project' ? context.projects.map((project) => ({ key: project.id, label: project.label, color: project.color ?? null, parentKey: project.parentId ?? null })) : undefined,
    groupValue: GROUP_VALUES[id],
  }));
  // Filters of their own, out of the columns (hidden until shown).
  // An event listed with the tasks is none of them: its cell stays empty, and « non » keeps it.
  const flag = (id: string, label: string, value: (task: Task) => boolean | null, groupLabels: YesNoLabels, icons?: YesNoIcons): DataColumn<TaskTableRow> =>
    booleanColumn<TaskTableRow>({
      id,
      label,
      size: 110,
      hiddenByDefault: true,
      groupLabels,
      icons,
      value: (row) => (row.kind === 'task' ? value(row.task) : false),
      blank: (row) => row.kind === 'event',
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
      text: (row) => (row.kind === 'task' ? taskNumber(row.task) : ''),
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
    documentsColumn<TaskTableRow>((row) => (row.kind === 'task' ? row.task : row.event)),
    flag('closed', 'Fermée', (task) => context.isClosed(task), { yes: 'Fermée', no: 'Ouverte' }),
    flag('overdue', 'En retard', (task) => isTaskOverdue(task, today), LATE_GROUP_LABELS, WARNING_YES_ICONS),
    flag('blocked', 'Bloquée', (task) => context.isBlocked(task), { yes: 'Bloquée', no: 'Libre' }, WARNING_YES_ICONS),
    // eslint-disable-next-line no-restricted-syntax -- a group name, not a count.
    flag('hasSubtasks', 'A des sous-tâches', (task) => context.childrenOf(task.id).length > 0, { yes: 'Avec sous-tâche(s)', no: 'Sans sous-tâche' }),
    flag('archived', 'Archivée', (task) => task.archived, { yes: 'Archivée', no: 'Active' }),
    // A closed task is neither doable now nor later.
    flag('doableNow', 'Faisable maintenant', (task) => (context.isClosed(task) ? null : (extras.doableIds?.has(task.id) ?? false)), DOABLE_GROUP_LABELS),
    flag('hasShopping', 'A des achats', (task) => extras.shoppingTaskIds?.has(task.id) ?? false, { yes: 'Avec liste d’achats', no: 'Sans liste d’achats' }),
    // eslint-disable-next-line no-restricted-syntax -- a group name, not a count.
    flag('hasAlarms', 'A des alarmes', (task) => (extras.alarmCounts?.get(task.id) ?? 0) > 0, { yes: 'Avec alarme(s)', no: 'Sans alarme' }),
    flag('hasComments', 'A des commentaires', (task) => commentTotal(task.commentCount, task.description) > 0, { yes: 'Commentée', no: 'Non commentée' }),
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
    // How a closed task was closed: done or cancelled (empty while open).
    {
      id: 'closeReason',
      label: 'Fermeture',
      size: 120,
      hiddenByDefault: true,
      sortValue: (row) => (row.kind === 'task' && row.task.closeReason ? TASK_CLOSE_REASONS.indexOf(row.task.closeReason) : null),
      text: (row) => (row.kind === 'task' && row.task.closeReason ? TASK_CLOSE_REASON_LABELS[row.task.closeReason] : ''),
      filter: { kind: 'choice', value: (row) => (row.kind === 'task' ? row.task.closeReason : null), options: TASK_CLOSE_REASONS.map((value) => ({ value, label: TASK_CLOSE_REASON_LABELS[value] })) },
    },
  ];
}
