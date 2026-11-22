import { AsyncLocalStorage } from 'node:async_hooks';
import {
  dayText,
  filterDay,
  formatDay,
  formatOptionalDay,
  isEmptyValue,
  lineageOf,
  mapById,
  matchesFilter,
  meetsCondition,
  ME,
  readWeek,
  relativeSprintIds,
  sprintFilterValues,
  TASK_AUTOMATION_CHAIN_MAX,
  TASK_AUTOMATION_FIELD_META,
  TASK_AUTOMATION_FIELDS,
  TASK_AUTOMATION_FILTER_KINDS,
  taskAutomationActionsSchema,
  taskAutomationActionText,
  taskAutomationConditionSchema,
  taskAutomationTriggerSchema,
  type FilterConditionOf,
  type FilterFieldValue,
  type InheritState,
  type TaskAutomationAction,
  type TaskBulkChanges,
  type TaskAutomationCondition,
  type TaskAutomationField,
  type TaskAutomationFilterField,
  type TaskAutomationReport,
  type TaskAutomationRevert,
  type TaskAutomationTrigger,
  type TaskInheritableField,
  type WeekSpan,
} from '@ordo/shared';
import { prisma } from '../../db';
import { userErrorMessage } from '../../graphql/errors';
import { parisToday } from '../../today';
import { BY_POSITION } from '../core/ordering';
import { currentWorkspaceFields } from '../workspaces/current-workspace';
import { loadProjectRootOf } from '../projects/project-tree';
import { effectiveTaskOf, loadTaskInheritance } from './task-inheritance';

/**
 * Engine of the automations of the tasks: every write of tasks goes through `automated` (create, update, change of
 * several, move, transfer, close / reopen, archive, copy, delete, GitHub sync, chrono started, conversion from or to a
 * routine; milestones, sprints, projects, clients, contributors, statuses, priorities, types and tags changed, moved,
 * archived or deleted). With an active rule in the workspace, the tasks are read before and after the write; what changed on each
 * task (the values it goes by, inherited ones included) triggers the rules, in their order, on the tasks meeting their
 * condition; their actions go through the same writes (same checks). What they change may trigger other rules, up to
 * `TASK_AUTOMATION_CHAIN_MAX` rounds, a rule never twice on the same task. Each rule applied is reported to the
 * request (`taskAutomationReports`: the toasts of the app), with what undoes it.
 */

/** Value of a watched field: an id, ids, a day, a number, or none. */
type FieldValue = string | number | readonly string[] | null;

/** Task as the rules read it: the values it goes by, how its inherited fields stand, its own values. */
interface TaskState {
  id: string;
  parentId: string | null;
  label: string;
  description: string | null;
  number: number | null;
  statusId: string | null;
  statusCategory: string | null;
  closed: boolean;
  archived: boolean;
  /** Values of the watched fields, those it goes by. */
  values: Record<TaskAutomationField, FieldValue>;
  /** State of each inherited field (inherited, own, emptied). */
  states: Partial<Record<TaskInheritableField, InheritState>>;
  /** Own values of the inherited fields (what an undo gives back). */
  own: { priorityId: string | null; milestoneId: string | null; minDate: string | null; deadline: string | null; assigneeIds: string[] };
}

/** Tasks of the workspace as the rules read them, with what their filters need. */
interface Snapshot {
  tasks: Map<string, TaskState>;
  /** Sub-tasks of each task. */
  children: Map<string, string[]>;
  /** Projects, for « a project and those above it ». */
  projects: Map<string, { id: string; parentId: string | null }>;
  /** Relative sprints of today. */
  relative: ReturnType<typeof relativeSprintIds>;
}

/** A rule as read: its trigger, condition and actions checked. */
interface Rule {
  id: string;
  label: string;
  trigger: TaskAutomationTrigger;
  condition: TaskAutomationCondition;
  actions: TaskAutomationAction[];
}

/** What happened to a task during a change. */
interface TaskEvents {
  created: boolean;
  /** Watched fields changed: their values before and after. */
  changes: Map<TaskAutomationField, { before: FieldValue; after: FieldValue }>;
  closed: boolean;
  reopened: boolean;
  archived: boolean;
  subtasksClosed: boolean;
  timer: boolean;
}

/** Writes of tasks the actions go through (the services of the tasks give them: no import cycle). */
export interface TaskAutomationWrites {
  bulkUpdate: (ids: string[], changes: TaskBulkChanges, restoring: boolean) => Promise<void>;
  transfer: (ids: string[], projectId: string | null) => Promise<unknown>;
  setClosed: (ids: string[], closed: boolean, restoring: boolean) => Promise<void>;
  archive: (id: string, archived: boolean) => Promise<unknown>;
}

let writes: TaskAutomationWrites | null = null;

/**
 * Gives the engine the writes of tasks its actions go through (called once by the services of the tasks).
 * @param {TaskAutomationWrites} given Writes.
 * @returns {void}
 */
export function registerTaskAutomationWrites(given: TaskAutomationWrites): void {
  writes = given;
}

/** Change of tasks running (the writes inside it apply no rule of their own): the tasks a chrono started on. */
const scopes = new AsyncLocalStorage<{ timerTaskIds: string[] }>();

/** Rules applied during the current request, for its answer. */
const requestReports = new AsyncLocalStorage<TaskAutomationReport[]>();

/**
 * Runs a request collecting the rules applied during it (`taskAutomationReports`).
 * @param {() => T} fn Request.
 * @returns {T} Its result.
 */
export function collectTaskAutomationReports<T>(fn: () => T): T {
  return requestReports.run([], fn);
}

/**
 * Rules applied so far during the current request (none out of a request: a background sync).
 * @returns {TaskAutomationReport[]} Reports.
 */
export function taskAutomationReports(): TaskAutomationReport[] {
  return requestReports.getStore() ?? [];
}

/**
 * Write of tasks through the rules of the workspace: the write, then the rules its changes trigger. Inside another
 * write (an action, a sync creating tasks), it is the write alone: the outer one applies the rules once.
 * @param {(...args: A) => Promise<R>} write Write.
 * @param {(...args: A) => readonly string[]} [timerTasks] Tasks a chrono starts on with it. Optional. Default = none.
 * @returns {(...args: A) => Promise<R>} Write applying the rules.
 */
export function automated<A extends unknown[], R>(write: (...args: A) => Promise<R>, timerTasks?: (...args: A) => readonly string[]): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const started = timerTasks?.(...args) ?? [];
    const scope = scopes.getStore();
    if (scope) {
      const result = await write(...args);
      scope.timerTaskIds.push(...started);
      return result;
    }
    const rules = await activeRules();
    if (!rules.length) return write(...args);
    const before = await loadSnapshot();
    const own = { timerTaskIds: [] as string[] };
    const result = await scopes.run(own, () => write(...args));
    own.timerTaskIds.push(...started);
    try {
      await scopes.run(own, () => applyRules(rules, before, new Set(own.timerTaskIds)));
    } catch (error) {
      // The change is done: a failure of the rules does not undo it.
      console.error('Automatisations des tâches :', error);
    }
    return result;
  };
}

/**
 * Rules of the workspace that apply: on, not archived, in their order; one unreadable is left out.
 * @returns {Promise<Rule[]>} Rules.
 */
async function activeRules(): Promise<Rule[]> {
  const rows = await prisma.taskAutomation.findMany({ where: { enabled: true, archivedAt: null }, orderBy: BY_POSITION });
  return rows.flatMap((row) => {
    const trigger = taskAutomationTriggerSchema.safeParse(row.trigger);
    const condition = taskAutomationConditionSchema.safeParse(row.condition ?? null);
    const actions = taskAutomationActionsSchema.safeParse(row.actions);
    return trigger.success && condition.success && actions.success ? [{ id: row.id, label: row.label, trigger: trigger.data, condition: condition.data, actions: actions.data }] : [];
  });
}

/**
 * Tasks of the workspace as the rules read them (archived ones too).
 * @returns {Promise<Snapshot>} Tasks.
 */
async function loadSnapshot(): Promise<Snapshot> {
  const [context, rows, statuses, projects, sprints, rootOf] = await Promise.all([
    loadTaskInheritance(),
    prisma.task.findMany({
      select: { id: true, parentId: true, label: true, description: true, number: true, statusId: true, typeId: true, startDate: true, endDate: true, effort: true, closedAt: true, archivedAt: true, tags: { select: { id: true } } },
    }),
    prisma.taskStatus.findMany({ select: { id: true, category: true } }),
    prisma.project.findMany({ select: { id: true, parentId: true } }),
    prisma.sprint.findMany({ select: { id: true, projectId: true, startDate: true, endDate: true } }),
    loadProjectRootOf(),
  ]);
  const categories = new Map(statuses.map((status) => [status.id, status.category]));
  const projectById = mapById(projects);
  const dated = sprints.map((sprint) => ({ id: sprint.id, projectId: sprint.projectId, startDate: formatDay(sprint.startDate), endDate: formatDay(sprint.endDate) }));
  const tasks = new Map<string, TaskState>();
  const children = new Map<string, string[]>();
  for (const row of rows) {
    const effective = effectiveTaskOf(context, row.id);
    const stored = context.tasks.get(row.id);
    if (!effective || !stored) continue;
    if (row.parentId) children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
    tasks.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      label: row.label,
      description: row.description,
      number: row.number,
      statusId: row.statusId,
      statusCategory: row.statusId ? (categories.get(row.statusId) ?? null) : null,
      closed: row.closedAt !== null,
      archived: row.archivedAt !== null,
      values: {
        STATUS: row.statusId,
        PRIORITY: effective.priorityId,
        TYPE: row.typeId,
        TAGS: row.tags.map((tag) => tag.id),
        ASSIGNEES: [...effective.assigneeIds],
        MILESTONE: effective.milestoneId,
        SPRINTS: [...effective.sprintIds],
        PROJECT: effective.projectId,
        MIN_DATE: effective.minDate,
        DEADLINE: effective.deadline,
        START_DATE: formatOptionalDay(row.startDate),
        END_DATE: formatOptionalDay(row.endDate),
        EFFORT: row.effort,
      },
      states: Object.fromEntries(effective.origins.map((origin) => [origin.field, origin.state])),
      own: { priorityId: stored.priorityId, milestoneId: stored.milestoneId, minDate: stored.minDate, deadline: stored.deadline, assigneeIds: [...stored.assigneeIds] },
    });
  }
  return { tasks, children, projects: projectById, relative: relativeSprintIds(dated, parisToday(), rootOf) };
}

/**
 * Whether two values of a field are the same (lists: the same items, in any order).
 * @param {FieldValue} a First value.
 * @param {FieldValue} b Second value.
 * @returns {boolean} Same.
 */
function sameValue(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = new Set(Array.isArray(a) ? a : []);
    const right = Array.isArray(b) ? b : [];
    return left.size === new Set(right).size && right.every((item) => left.has(item));
  }
  return a === b;
}

/**
 * Whether all the sub-tasks of a task (archived ones left out) are closed; false without any.
 * @param {Snapshot} snapshot Tasks.
 * @param {string} id Task.
 * @returns {boolean} All closed.
 */
function allSubtasksClosed(snapshot: Snapshot, id: string): boolean {
  const subtasks = (snapshot.children.get(id) ?? []).flatMap((childId) => {
    const child = snapshot.tasks.get(childId);
    return child && !child.archived ? [child] : [];
  });
  return subtasks.length > 0 && subtasks.every((child) => child.closed);
}

/**
 * What happened to each task between two readings: created, its watched fields changed (for a new task, each field
 * given a value, as if it went from empty to it), closed, reopened, archived, all its sub-tasks closed, a chrono
 * started on it. Only the tasks something happened to.
 * @param {Snapshot} before Tasks before.
 * @param {Snapshot} after Tasks after.
 * @param {ReadonlySet<string>} timers Tasks a chrono started on.
 * @returns {Map<string, TaskEvents>} Events by task.
 */
function taskEvents(before: Snapshot, after: Snapshot, timers: ReadonlySet<string>): Map<string, TaskEvents> {
  const events = new Map<string, TaskEvents>();
  for (const [id, task] of after.tasks) {
    const previous = before.tasks.get(id);
    const changes = new Map<TaskAutomationField, { before: FieldValue; after: FieldValue }>();
    for (const field of TASK_AUTOMATION_FIELDS) {
      // A new task goes from empty to each value it is given (its own or inherited).
      const was = previous ? previous.values[field] : Array.isArray(task.values[field]) ? [] : null;
      if (!sameValue(was, task.values[field])) changes.set(field, { before: was, after: task.values[field] });
    }
    const event: TaskEvents = {
      created: !previous,
      changes,
      closed: Boolean(previous && !previous.closed && task.closed),
      reopened: Boolean(previous && previous.closed && !task.closed),
      archived: Boolean(previous && !previous.archived && task.archived),
      subtasksClosed: allSubtasksClosed(after, id) && !(previous && allSubtasksClosed(before, id)),
      timer: timers.has(id),
    };
    if (event.created || changes.size || event.closed || event.reopened || event.archived || event.subtasksClosed || event.timer) events.set(id, event);
  }
  return events;
}

/**
 * Whether a trigger fits what happened to a task (a new task triggers « créée » and the changes of the fields it is
 * given, never « est vidé »).
 * @param {TaskAutomationTrigger} trigger Trigger.
 * @param {TaskEvents} events What happened.
 * @returns {boolean} Triggered.
 */
function triggered(trigger: TaskAutomationTrigger, events: TaskEvents): boolean {
  if (events.created && trigger.event !== 'CREATED' && trigger.event !== 'FIELD_CHANGED') return false;
  switch (trigger.event) {
    case 'CREATED':
      return events.created;
    case 'CLOSED':
      return events.closed;
    case 'REOPENED':
      return events.reopened;
    case 'ARCHIVED':
      return events.archived;
    case 'SUBTASKS_CLOSED':
      return events.subtasksClosed;
    case 'TIMER_STARTED':
      return events.timer;
    case 'FIELD_CHANGED': {
      const change = trigger.field ? events.changes.get(trigger.field) : undefined;
      if (!change) return false;
      const has = (value: FieldValue, wanted: string) => (Array.isArray(value) ? value.includes(wanted) : value === wanted);
      switch (trigger.change) {
        case 'SET':
          return isEmptyValue(change.before) && !isEmptyValue(change.after);
        case 'CLEARED':
          return !isEmptyValue(change.before) && isEmptyValue(change.after);
        case 'IS':
          return trigger.value !== null && has(change.after, trigger.value) && !has(change.before, trigger.value);
        default:
          return true;
      }
    }
  }
}

/**
 * Value of a column of the task table for a task, as its filter reads it (the values it goes by).
 * @param {TaskAutomationFilterField} field Column.
 * @param {TaskState} task Task.
 * @param {Snapshot} snapshot Tasks, projects, sprints.
 * @param {string | null} meId Contributor of the user (« Moi »).
 * @returns {FilterFieldValue} Value.
 */
function filterValue(field: TaskAutomationFilterField, task: TaskState, snapshot: Snapshot, meId: string | null): FilterFieldValue {
  const { values } = task;
  const ids = (value: FieldValue) => (Array.isArray(value) ? [...value] : []);
  switch (field) {
    case 'label':
      return { kind: 'text', value: task.label };
    case 'description':
      return { kind: 'text', value: task.description ?? '' };
    case 'number':
      return { kind: 'number', value: task.number };
    case 'project':
      return { kind: 'choices', value: lineageOf(snapshot.projects, values.PROJECT as string | null).map((project) => project.id) };
    case 'status':
      return { kind: 'choice', value: task.statusId };
    case 'statusCategory':
      return { kind: 'choice', value: task.statusCategory };
    case 'priority':
      return { kind: 'choice', value: values.PRIORITY };
    case 'type':
      return { kind: 'choice', value: values.TYPE };
    case 'milestone':
      return { kind: 'choice', value: values.MILESTONE };
    case 'assignees': {
      const assignees = ids(values.ASSIGNEES);
      return { kind: 'choices', value: meId && assignees.includes(meId) ? [...assignees, ME] : assignees };
    }
    case 'tags':
      return { kind: 'choices', value: ids(values.TAGS) };
    case 'sprint':
      return { kind: 'choices', value: sprintFilterValues(ids(values.SPRINTS), snapshot.relative) };
    case 'parent':
      return { kind: 'choices', value: lineageOf(snapshot.tasks, task.parentId).map((parent) => parent.id) };
    case 'effort':
      return { kind: 'number', value: values.EFFORT };
    case 'startDate':
      return { kind: 'date', value: values.START_DATE };
    case 'endDate':
      return { kind: 'date', value: values.END_DATE };
    case 'deadline':
      return { kind: 'date', value: values.DEADLINE };
    case 'minDate':
      return { kind: 'date', value: values.MIN_DATE };
    case 'closed':
      return { kind: 'boolean', value: task.closed };
    case 'archived':
      return { kind: 'boolean', value: task.archived };
    case 'hasSubtasks':
      return { kind: 'boolean', value: (snapshot.children.get(task.id) ?? []).length > 0 };
  }
}

/** What a condition is read with: today, the week of the workspace, the contributor of the user. */
interface ConditionContext {
  today: string;
  week: WeekSpan;
  meId: string | null;
}

/**
 * Whether a task meets the condition of a rule (none: every task), with the filter of the task table.
 * @param {TaskAutomationCondition} condition Condition.
 * @param {TaskState} task Task.
 * @param {Snapshot} snapshot Tasks.
 * @param {ConditionContext} context Today, week, « Moi ».
 * @returns {boolean} Met.
 */
function meetsRule(condition: TaskAutomationCondition, task: TaskState, snapshot: Snapshot, context: ConditionContext): boolean {
  if (!condition) return true;
  return matchesFilter(condition, (item: FilterConditionOf<string>) =>
    item.field in TASK_AUTOMATION_FILTER_KINDS ? meetsCondition(item, filterValue(item.field as TaskAutomationFilterField, task, snapshot, context.meId), context.today, context.week) : false,
  );
}

/** Keys of the change of several tasks adding to and removing from each list field. */
const LIST_KEYS = {
  TAGS: ['addTagIds', 'removeTagIds'],
  ASSIGNEES: ['addAssigneeIds', 'removeAssigneeIds'],
  SPRINTS: ['addSprintIds', 'removeSprintIds'],
} as const;

/** Key of the change of several tasks giving each other field a value. */
const VALUE_KEYS = {
  STATUS: 'statusId',
  PRIORITY: 'priorityId',
  TYPE: 'typeId',
  MILESTONE: 'milestoneId',
  MIN_DATE: 'minDate',
  DEADLINE: 'deadline',
  START_DATE: 'startDate',
  END_DATE: 'endDate',
  EFFORT: 'effort',
} as const;

/** Inherited field of each watched field that is one. */
const INHERITED: Partial<Record<TaskAutomationField, TaskInheritableField>> = {
  PRIORITY: 'PRIORITY',
  MILESTONE: 'MILESTONE',
  MIN_DATE: 'MIN_DATE',
  DEADLINE: 'DEADLINE',
  ASSIGNEES: 'ASSIGNEES',
  PROJECT: 'PROJECT',
};

/** What the actions of a rule do to one task, in the writes of the tasks. */
interface TaskWrite {
  /** Project it moves to (undefined: stays). */
  projectId?: string | null;
  changes: TaskBulkChanges;
  closed?: boolean;
  archive: boolean;
}

/**
 * Writes of the actions of a rule on a task: the values given (a day from today), the items of a list added, removed
 * or set, the fields emptied, the task closed, reopened or archived; the later action wins on the same item.
 * @param {readonly TaskAutomationAction[]} actions Actions.
 * @param {TaskState} task Task.
 * @param {string} today Today.
 * @returns {TaskWrite} Writes.
 */
function taskWrite(actions: readonly TaskAutomationAction[], task: TaskState, today: string): TaskWrite {
  const result: TaskWrite = { changes: {}, archive: false };
  const lists = new Map<keyof typeof LIST_KEYS, Map<string, boolean>>();
  /**
   * Adds or removes items of a list.
   * @param {keyof typeof LIST_KEYS} field List.
   * @param {readonly string[]} items Items.
   * @param {boolean} add Added (else removed).
   * @returns {void}
   */
  const mark = (field: keyof typeof LIST_KEYS, items: readonly string[], add: boolean) => {
    const marks = lists.get(field) ?? new Map<string, boolean>();
    items.forEach((item) => marks.set(item, add));
    lists.set(field, marks);
  };
  for (const action of actions) {
    if (action.kind === 'CLOSE' || action.kind === 'REOPEN') result.closed = action.kind === 'CLOSE';
    if (action.kind === 'ARCHIVE') result.archive = true;
    const field = action.field;
    if (!field) continue;
    const current = task.values[field];
    if (field in LIST_KEYS) {
      const list = field as keyof typeof LIST_KEYS;
      const items = Array.isArray(action.value) ? (action.value as string[]) : [];
      const had = Array.isArray(current) ? current : [];
      if (action.kind === 'ADD') mark(list, items, true);
      else if (action.kind === 'REMOVE') mark(list, items, false);
      else if (action.kind === 'CLEAR') mark(list, had, false);
      else {
        mark(list, had, false);
        mark(list, items, true);
      }
      continue;
    }
    const value = action.kind === 'CLEAR' ? null : action.value;
    if (field === 'PROJECT') {
      result.projectId = typeof value === 'string' ? value : null;
      continue;
    }
    const key = VALUE_KEYS[field as keyof typeof VALUE_KEYS];
    const day = TASK_AUTOMATION_FIELD_META[field].kind === 'day' && typeof value === 'string' ? filterDay(value, today) : value;
    Object.assign(result.changes, { [key]: day });
  }
  for (const [field, marks] of lists) {
    const had = new Set(Array.isArray(task.values[field]) ? (task.values[field] as string[]) : []);
    const [addKey, removeKey] = LIST_KEYS[field];
    const added = [...marks].filter(([item, add]) => add && !had.has(item)).map(([item]) => item);
    const removed = [...marks].filter(([item, add]) => !add && had.has(item)).map(([item]) => item);
    if (added.length) result.changes[addKey] = added;
    if (removed.length) result.changes[removeKey] = removed;
  }
  return result;
}

/**
 * Applies the writes of a rule on a task, through the writes of the tasks (same checks): its project first (the
 * milestones and sprints of its new tree), its fields, its open / closed state, then its archive. A task archived by
 * the change triggering the rule takes the changes of its fields and state still (as an undo does); not a project.
 * @param {TaskWrite} write Writes.
 * @param {TaskState} task Task.
 * @returns {Promise<void>}
 */
async function applyWrite(write: TaskWrite, task: TaskState): Promise<void> {
  if (!writes) throw new Error('Task writes not registered.');
  if (write.projectId !== undefined && write.projectId !== task.values.PROJECT) await writes.transfer([task.id], write.projectId);
  if (Object.keys(write.changes).length) await writes.bulkUpdate([task.id], write.changes, task.archived);
  if (write.closed !== undefined && write.closed !== task.closed) await writes.setClosed([task.id], write.closed, task.archived);
  if (write.archive && !task.archived) await writes.archive(task.id, true);
}

/**
 * What gives a task back as it was before a rule: its project, its fields (inherited again, emptied again, or their
 * values: those of the lists added or removed), its open / closed state, restored when archived; none when the rule
 * changed nothing.
 * @param {TaskState} before Task before the rule.
 * @param {TaskState} after Task after it.
 * @returns {TaskAutomationRevert | null} Undo.
 */
function revertOf(before: TaskState, after: TaskState): TaskAutomationRevert | null {
  const changes: TaskBulkChanges = {};
  const revert: TaskAutomationRevert = { taskId: before.id, changes };
  let changed = false;
  for (const field of TASK_AUTOMATION_FIELDS) {
    if (sameValue(before.values[field], after.values[field])) continue;
    changed = true;
    const inherited = INHERITED[field];
    const state = inherited ? before.states[inherited] : undefined;
    // A field it inherited or had emptied comes back so, not as a value of its own.
    if (inherited && state === 'INHERITED') {
      changes.inheritFields = [...(changes.inheritFields ?? []), inherited];
      continue;
    }
    if (inherited && inherited !== 'PROJECT' && state === 'CLEARED') {
      changes.clearFields = [...(changes.clearFields ?? []), inherited];
      continue;
    }
    if (field === 'PROJECT') {
      revert.projectId = before.values.PROJECT as string | null;
      continue;
    }
    if (field in LIST_KEYS) {
      const [addKey, removeKey] = LIST_KEYS[field as keyof typeof LIST_KEYS];
      const had = (before.values[field] ?? []) as readonly string[];
      const has = (after.values[field] ?? []) as readonly string[];
      const removed = had.filter((item) => !has.includes(item));
      const added = has.filter((item) => !had.includes(item));
      if (removed.length) changes[addKey] = removed;
      if (added.length) changes[removeKey] = added;
      continue;
    }
    const own = field === 'PRIORITY' ? before.own.priorityId : field === 'MILESTONE' ? before.own.milestoneId : field === 'MIN_DATE' ? before.own.minDate : field === 'DEADLINE' ? before.own.deadline : before.values[field];
    Object.assign(changes, { [VALUE_KEYS[field as keyof typeof VALUE_KEYS]]: own });
  }
  if (before.closed !== after.closed) {
    changed = true;
    revert.closed = before.closed;
  }
  if (!before.archived && after.archived) {
    changed = true;
    revert.restore = true;
  }
  return changed ? revert : null;
}

/**
 * Names of the items a rule may name (statuses, tags, people…), for the words of its actions.
 * @returns {Promise<(field: TaskAutomationField, value: string) => string>} Name of an item of a field.
 */
async function loadNames(): Promise<(field: TaskAutomationField, value: string) => string> {
  const [statuses, priorities, types, tags, contributors, milestones, sprints, projects] = await Promise.all([
    prisma.taskStatus.findMany({ select: { id: true, label: true } }),
    prisma.taskPriority.findMany({ select: { id: true, label: true } }),
    prisma.taskType.findMany({ select: { id: true, label: true } }),
    prisma.taskTag.findMany({ select: { id: true, label: true } }),
    prisma.contributor.findMany({ select: { id: true, name: true } }),
    prisma.milestone.findMany({ select: { id: true, label: true } }),
    prisma.sprint.findMany({ select: { id: true, label: true } }),
    prisma.project.findMany({ select: { id: true, label: true } }),
  ]);
  const byField: Partial<Record<TaskAutomationField, Map<string, string>>> = {
    STATUS: new Map(statuses.map((item) => [item.id, item.label])),
    PRIORITY: new Map(priorities.map((item) => [item.id, item.label])),
    TYPE: new Map(types.map((item) => [item.id, item.label])),
    TAGS: new Map(tags.map((item) => [item.id, item.label])),
    ASSIGNEES: new Map(contributors.map((item) => [item.id, item.name])),
    MILESTONE: new Map(milestones.map((item) => [item.id, item.label])),
    SPRINTS: new Map(sprints.map((item) => [item.id, item.label])),
    PROJECT: new Map(projects.map((item) => [item.id, item.label])),
  };
  return (field, value) => byField[field]?.get(value) ?? value;
}

/**
 * Text of a day of an action: « aujourd’hui », « aujourd’hui + 3 j », a date.
 * @param {string} token Day (`YYYY-MM-DD`, `today`, `today+3`).
 * @returns {string} Text.
 */
function dayWords(token: string): string {
  const relative = /^today([+-]\d+)?$/.exec(token);
  if (!relative) return dayText(token);
  const shift = Number(relative[1] ?? 0);
  return shift === 0 ? 'aujourd’hui' : `aujourd’hui ${shift > 0 ? '+' : '−'} ${Math.abs(shift)} j`;
}

/**
 * Applies the rules that changes trigger, round after round: the rules in their order, each on the tasks its trigger
 * fits and its condition keeps (the tasks read again after each rule), then the rules what they changed triggers,
 * `TASK_AUTOMATION_CHAIN_MAX` rounds at most, a rule never twice on the same task. Each rule applied is reported.
 * @param {readonly Rule[]} rules Active rules.
 * @param {Snapshot} before Tasks before the change.
 * @param {ReadonlySet<string>} timers Tasks a chrono started on.
 * @returns {Promise<void>}
 */
async function applyRules(rules: readonly Rule[], before: Snapshot, timers: ReadonlySet<string>): Promise<void> {
  const today = parisToday();
  const [workspace, me] = await Promise.all([currentWorkspaceFields({ weekStart: true, weekEnd: true }), prisma.contributor.findFirst({ where: { userId: { not: null } }, select: { id: true } })]);
  const context: ConditionContext = { today, week: readWeek(workspace), meId: me?.id ?? null };
  const applied = new Map<string, Set<string>>();
  let names: Awaited<ReturnType<typeof loadNames>> | null = null;
  let previous = before;
  let state = await loadSnapshot();
  let started: ReadonlySet<string> = timers;
  for (let round = 0; round < TASK_AUTOMATION_CHAIN_MAX; round += 1) {
    const roundStart = state;
    const events = taskEvents(previous, roundStart, started);
    started = new Set();
    let any = false;
    for (const rule of rules) {
      const targets = [...events].flatMap(([id, taskEventsOf]) => {
        const task = state.tasks.get(id);
        if (!task || applied.get(id)?.has(rule.id) || !triggered(rule.trigger, taskEventsOf)) return [];
        // An archived task is read only: only the rules of its archiving apply to it.
        if (task.archived && rule.trigger.event !== 'ARCHIVED') return [];
        return meetsRule(rule.condition, task, state, context) ? [task] : [];
      });
      if (!targets.length) continue;
      any = true;
      const errors = new Map<string, string[]>();
      for (const task of targets) {
        applied.set(task.id, new Set([...(applied.get(task.id) ?? []), rule.id]));
        try {
          await applyWrite(taskWrite(rule.actions, task, today), task);
        } catch (error) {
          const message = userErrorMessage(error, 'Une erreur inattendue est survenue.', `Règle « ${rule.label} »`);
          errors.set(message, [...(errors.get(message) ?? []), task.id]);
        }
      }
      const after = await loadSnapshot();
      names ??= await loadNames();
      report(rule, targets, state, after, errors, names);
      state = after;
    }
    if (!any) break;
    previous = roundStart;
  }
}

/**
 * Tells the request a rule applied: the tasks it changed with their undo, and the refusals.
 * @param {Rule} rule Rule.
 * @param {readonly TaskState[]} targets Tasks it applied to.
 * @param {Snapshot} before Tasks before it.
 * @param {Snapshot} after Tasks after it.
 * @param {Map<string, string[]>} errors Refusals, by message: their tasks.
 * @param {(field: TaskAutomationField, value: string) => string} nameOf Name of an item of a field.
 * @returns {void}
 */
function report(rule: Rule, targets: readonly TaskState[], before: Snapshot, after: Snapshot, errors: Map<string, string[]>, nameOf: (field: TaskAutomationField, value: string) => string): void {
  const store = requestReports.getStore();
  if (!store) return;
  const reverts = targets.flatMap((task) => {
    const now = after.tasks.get(task.id);
    const revert = now ? revertOf(before.tasks.get(task.id) ?? task, now) : null;
    return revert ? [revert] : [];
  });
  const base = { ruleId: rule.id, label: rule.label, changes: rule.actions.map((action) => taskAutomationActionText(action, nameOf, dayWords)) };
  if (reverts.length) store.push({ ...base, taskIds: reverts.map((revert) => revert.taskId), reverts, error: null });
  for (const [message, taskIds] of errors) store.push({ ...base, taskIds, reverts: [], error: message });
}
