import {
  filterDay,
  filterPeriod,
  ME,
  TASK_FILTER_FIELDS,
  type RelativeSprintOperator,
  type FilterCondition,
  type FilterGroup,
  type TaskStatusCategory,
} from '@ordo/shared';
import { prisma } from '../db';
import type { Prisma } from '../generated/prisma/client';
import { doableTaskIds } from './slot-rules';

/** Calendar context of the user: relative dates ("today", "this week") are computed in their day. */
/** Who runs the query: "@me" in assignee conditions is their contributor profile. */
export interface FilterUser {
  contributorId: string | null;
}

export interface FilterClock {
  /** User's current day, YYYY-MM-DD. */
  today: string;
  /** User's offset from UTC in minutes (e.g. 60 for UTC+1). */
  utcOffset: number;
}

const DAY = 24 * 60 * 60 * 1000;
const NEVER: Prisma.TaskWhereInput = { id: { in: [] } };

/**
 * Days are handled as UTC midnights of calendar dates (YYYY-MM-DD).
 * @param {string} day Calendar date.
 * @returns {number} Timestamp of its UTC midnight.
 */
function dayValue(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

/**
 * Resolves a day token (`YYYY-MM-DD`, `today`, `today+3`, `today-7`) to a calendar date timestamp.
 * @param {string} token Day token.
 * @param {FilterClock} clock User clock.
 * @returns {number} UTC midnight timestamp.
 */
function resolveDay(token: string, clock: FilterClock): number {
  return dayValue(filterDay(token, clock.today));
}

/**
 * Resolves a period token to its first day and the day after its last one.
 * @param {string} token Period token (thisWeek, lastMonth, past:7…).
 * @param {FilterClock} clock User clock.
 * @returns {[number, number]} [start, end) as UTC midnight timestamps.
 */
function resolvePeriod(token: string, clock: FilterClock): [number, number] {
  const [start, end] = filterPeriod(token, clock.today);
  return [dayValue(start), dayValue(end)];
}

type DateField = 'startDate' | 'endDate' | 'deadline' | 'createdAt' | 'updatedAt';

/**
 * Converts a calendar day boundary to the stored value of a field: calendar dates are stored as UTC
 * midnights, instants are compared with the user's local midnight.
 * @param {DateField} field Date field.
 * @param {number} day UTC midnight timestamp of the day.
 * @param {FilterClock} clock User clock.
 * @returns {Date} Boundary.
 */
function boundary(field: DateField, day: number, clock: FilterClock): Date {
  const isInstant = field === 'createdAt' || field === 'updatedAt';
  return new Date(isInstant ? day - clock.utcOffset * 60 * 1000 : day);
}

/** Open task: not closed (the open / closed state, not the status, says whether it is done). */
const OPEN: Prisma.TaskWhereInput = { closedAt: null };

/** Ids needed by the `inTree` and relative sprint operators, loaded once per query. */
interface Trees {
  projectDescendants: (ids: string[]) => string[];
  taskDescendants: (ids: string[]) => string[];
  /** Sprints matching a relative operator (current, previous, next, past, future). */
  sprintsWhere: (operator: RelativeSprintOperator) => string[];
  /** Open tasks allowed now by their slot rule; loaded only when a condition uses it. */
  doableIds: string[];
}

/**
 * Loads the project and task trees when a filter uses `inTree`, and the sprints when it uses a relative
 * sprint operator.
 * @param {FilterGroup} filter Filter.
 * @param {FilterClock} clock User clock.
 * @returns {Promise<Trees>} Lookups.
 */
async function loadTrees(filter: FilterGroup, clock: FilterClock): Promise<Trees> {
  const fields = new Set<string>();
  let relativeSprints = false;
  let doable = false;
  const collect = (group: FilterGroup): void =>
    group.children.forEach((child) => {
      if (child.type === 'group') collect(child);
      else if (child.field === 'doableNow') doable = true;
      else if (child.operator === 'inTree') fields.add(child.field);
      else if (child.field === 'sprint' && !['in', 'notIn', 'allOf', 'isEmpty', 'isNotEmpty'].includes(child.operator)) relativeSprints = true;
    });
  collect(filter);

  /**
   * Builds a descendants lookup from parent links.
   * @param {{ id: string, parentId: string | null }[]} items Tree items.
   * @returns {(ids: string[]) => string[]} Ids with all their descendants.
   */
  const descendantsOf = (items: { id: string; parentId: string | null }[]) => (ids: string[]) => {
    const result = new Set(ids);
    const queue = [...ids];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const item of items) {
        if (item.parentId === current && !result.has(item.id)) {
          result.add(item.id);
          queue.push(item.id);
        }
      }
    }
    return [...result];
  };

  const [projects, tasks, sprints, doableIds] = await Promise.all([
    fields.has('project') || relativeSprints ? prisma.project.findMany({ select: { id: true, parentId: true } }) : [],
    fields.has('parent') ? prisma.task.findMany({ select: { id: true, parentId: true } }) : [],
    relativeSprints ? prisma.sprint.findMany({ select: { id: true, projectId: true, startDate: true, endDate: true } }) : [],
    doable ? doableTaskIds(clock.utcOffset) : [],
  ]);
  return { projectDescendants: descendantsOf(projects), taskDescendants: descendantsOf(tasks), sprintsWhere: relativeSprintIds(sprints, projects, clock), doableIds };
}

/**
 * Sprints matching a relative operator: running today, over, not started yet, or per project tree the last
 * one over (previous) and the first one not started (next).
 * @param {{ id: string, projectId: string, startDate: Date, endDate: Date }[]} sprints Sprints.
 * @param {{ id: string, parentId: string | null }[]} projects Projects.
 * @param {FilterClock} clock User clock.
 * @returns {(operator: RelativeSprintOperator) => string[]} Lookup.
 */
function relativeSprintIds(
  sprints: { id: string; projectId: string; startDate: Date; endDate: Date }[],
  projects: { id: string; parentId: string | null }[],
  clock: FilterClock,
): (operator: RelativeSprintOperator) => string[] {
  const today = dayValue(clock.today);
  const parentOf = new Map(projects.map((project) => [project.id, project.parentId]));
  /**
   * Root project of a project.
   * @param {string} id Project.
   * @returns {string} Root project.
   */
  const rootOf = (id: string): string => {
    let current = id;
    for (let parent = parentOf.get(current); parent; parent = parentOf.get(current)) current = parent;
    return current;
  };
  const past = sprints.filter((sprint) => sprint.endDate.getTime() < today);
  const future = sprints.filter((sprint) => sprint.startDate.getTime() > today);
  /**
   * The best sprint of each project tree.
   * @param {typeof sprints} candidates Sprints.
   * @param {(a: (typeof sprints)[number], b: (typeof sprints)[number]) => boolean} better Whether a beats b.
   * @returns {string[]} Ids.
   */
  const bestPerTree = (candidates: typeof sprints, better: (a: (typeof sprints)[number], b: (typeof sprints)[number]) => boolean) => {
    const best = new Map<string, (typeof sprints)[number]>();
    for (const sprint of candidates) {
      const root = rootOf(sprint.projectId);
      const current = best.get(root);
      if (!current || better(sprint, current)) best.set(root, sprint);
    }
    return [...best.values()].map((sprint) => sprint.id);
  };
  return (operator) => {
    switch (operator) {
      case 'current':
        return sprints.filter((sprint) => sprint.startDate.getTime() <= today && sprint.endDate.getTime() >= today).map((sprint) => sprint.id);
      case 'past':
        return past.map((sprint) => sprint.id);
      case 'future':
        return future.map((sprint) => sprint.id);
      case 'previous':
        return bestPerTree(past, (a, b) => a.endDate > b.endDate);
      default:
        return bestPerTree(future, (a, b) => a.startDate < b.startDate);
    }
  };
}

/**
 * Translates one condition into a Prisma filter.
 * @param {FilterCondition} condition Validated condition.
 * @param {FilterClock} clock User clock.
 * @param {Trees} trees Tree lookups.
 * @param {FilterUser} user Querying user.
 * @returns {Prisma.TaskWhereInput} Prisma filter.
 */
function conditionWhere(
  condition: FilterCondition,
  clock: FilterClock,
  trees: Trees,
  user: FilterUser,
): Prisma.TaskWhereInput {
  const { field, operator, value } = condition;
  const text = typeof value === 'string' ? value : '';
  const number = typeof value === 'number' ? value : 0;
  // "@me" stands for the user's contributor profile (matches nothing without one).
  const ids = (Array.isArray(value) ? value : []).map((id) => (id === ME ? (user.contributorId ?? ME) : id));

  switch (TASK_FILTER_FIELDS[field]) {
    case 'text': {
      const key = field as 'title' | 'description';
      const nullable = key === 'description';
      const empty: Prisma.TaskWhereInput = nullable ? { OR: [{ description: null }, { description: '' }] } : { title: '' };
      switch (operator) {
        case 'contains':
          return { [key]: { contains: text, mode: 'insensitive' } };
        case 'notContains':
          return nullable
            ? { OR: [{ description: null }, { NOT: { description: { contains: text, mode: 'insensitive' } } }] }
            : { NOT: { title: { contains: text, mode: 'insensitive' } } };
        case 'is':
          return { [key]: { equals: text, mode: 'insensitive' } };
        case 'isNot':
          return nullable
            ? { OR: [{ description: null }, { NOT: { description: { equals: text, mode: 'insensitive' } } }] }
            : { NOT: { title: { equals: text, mode: 'insensitive' } } };
        case 'isEmpty':
          return empty;
        default:
          return { NOT: empty };
      }
    }

    case 'number': {
      const key = field as 'number' | 'effort';
      const nullable = key === 'effort';
      switch (operator) {
        case 'eq':
          return { [key]: number };
        case 'neq':
          return nullable ? { OR: [{ effort: null }, { NOT: { effort: number } }] } : { NOT: { number } };
        case 'lt':
        case 'lte':
        case 'gt':
        case 'gte':
          return { [key]: { [operator]: number } };
        case 'isEmpty':
          return nullable ? { effort: null } : NEVER;
        default:
          return nullable ? { NOT: { effort: null } } : {};
      }
    }

    case 'date': {
      const key = field as DateField;
      const nullable = key === 'startDate' || key === 'endDate' || key === 'deadline';
      if (operator === 'isEmpty') return nullable ? { [key]: null } : NEVER;
      if (operator === 'isNotEmpty') return nullable ? { NOT: { [key]: null } } : {};
      const at = (day: number) => boundary(key, day, clock);
      if (operator === 'within') {
        const [start, end] = resolvePeriod(text, clock);
        return { [key]: { gte: at(start), lt: at(end) } };
      }
      const day = resolveDay(text, clock);
      switch (operator) {
        case 'is':
          return { [key]: { gte: at(day), lt: at(day + DAY) } };
        case 'before':
          return { [key]: { lt: at(day) } };
        case 'onOrBefore':
          return { [key]: { lt: at(day + DAY) } };
        case 'after':
          return { [key]: { gte: at(day + DAY) } };
        default:
          return { [key]: { gte: at(day) } };
      }
    }

    case 'reference': {
      const key = {
        project: 'projectId',
        status: 'statusId',
        priority: 'priorityId',
        type: 'typeId',
        parent: 'parentId',
        milestone: 'milestoneId',
      }[field as 'project' | 'status' | 'priority' | 'type' | 'parent' | 'milestone'] as 'projectId' | 'statusId' | 'priorityId' | 'typeId' | 'parentId' | 'milestoneId';
      const nullable = key !== 'projectId';
      switch (operator) {
        case 'in':
          return { [key]: { in: ids } };
        case 'notIn':
          return nullable ? { OR: [{ [key]: null }, { [key]: { notIn: ids } }] } : { [key]: { notIn: ids } };
        case 'inTree':
          if (key === 'projectId') return { projectId: { in: trees.projectDescendants(ids) } };
          // Sub-tasks, at any depth, of the given tasks.
          return { id: { in: trees.taskDescendants(ids).filter((id) => !ids.includes(id)) } };
        case 'isEmpty':
          return nullable ? { [key]: null } : NEVER;
        default:
          return nullable ? { NOT: { [key]: null } } : {};
      }
    }

    case 'multiReference': {
      const key = field === 'tags' ? 'tags' : 'assignees';
      switch (operator) {
        case 'anyOf':
          return { [key]: { some: { id: { in: ids } } } };
        case 'allOf':
          return { AND: ids.map((id) => ({ [key]: { some: { id } } })) };
        case 'noneOf':
          return { [key]: { none: { id: { in: ids } } } };
        case 'isEmpty':
          return { [key]: { none: {} } };
        default:
          return { [key]: { some: {} } };
      }
    }

    case 'sprint': {
      switch (operator) {
        case 'in':
          return { sprints: { some: { id: { in: ids } } } };
        case 'notIn':
          return { sprints: { none: { id: { in: ids } } } };
        case 'allOf':
          return { AND: ids.map((id) => ({ sprints: { some: { id } } })) };
        case 'isEmpty':
          return { sprints: { none: {} } };
        case 'isNotEmpty':
          return { sprints: { some: {} } };
        default:
          return { sprints: { some: { id: { in: trees.sprintsWhere(operator as RelativeSprintOperator) } } } };
      }
    }

    case 'category': {
      const categories = ids as TaskStatusCategory[];
      // A task without status counts as "to do".
      const matches: Prisma.TaskWhereInput = {
        OR: [{ status: { category: { in: categories } } }, ...(categories.includes('TODO') ? [{ statusId: null }] : [])],
      };
      return operator === 'in' ? matches : { NOT: matches };
    }

    case 'boolean': {
      if (field === 'doableNow') return operator === 'isTrue' ? { id: { in: trees.doableIds } } : { id: { notIn: trees.doableIds } };
      const today = new Date(dayValue(clock.today));
      const truth: Prisma.TaskWhereInput = {
        // Past its "Date max".
        overdue: { AND: [{ deadline: { lt: today } }, OPEN] },
        // Blocked by at least one task that is still open.
        blocked: { blockedBy: { some: { blocker: { archivedAt: null, ...OPEN } } } },
        hasSubtasks: { children: { some: {} } },
        closed: { NOT: { closedAt: null } },
        archived: { NOT: { archivedAt: null } },
      }[field as 'overdue' | 'blocked' | 'hasSubtasks' | 'closed' | 'archived'];
      if (operator === 'isTrue') return truth;
      // NOT would drop tasks without "Date max" (SQL NULL): "not overdue" is spelled out.
      if (field === 'overdue') {
        return {
          OR: [
            { deadline: null },
            { deadline: { gte: today } },
            { NOT: { closedAt: null } },
          ],
        };
      }
      return { NOT: truth };
    }
  }
}

/** Statuses of tasks at a moment (end of a sprint), used by the status conditions instead of the current ones. */
export interface StatusAt {
  /** Status and state of each task with a recorded status at that moment; the others keep their current one. */
  statuses: ReadonlyMap<string, { statusId: string | null; closed: boolean }>;
  /** Category of each status. */
  categoryOf: ReadonlyMap<string, TaskStatusCategory>;
}

/** Conditions on the status of a task. */
const STATUS_FIELDS = new Set(['status', 'statusCategory', 'closed']);

/**
 * Whether a status condition holds for a status and state (same rules as its Prisma translation).
 * @param {FilterCondition} condition Condition on the status, its category or the closed state.
 * @param {{ statusId: string | null, closed: boolean }} at Status and state.
 * @param {ReadonlyMap<string, TaskStatusCategory>} categoryOf Category of each status.
 * @returns {boolean} Holds.
 */
function statusHolds(condition: FilterCondition, at: { statusId: string | null; closed: boolean }, categoryOf: ReadonlyMap<string, TaskStatusCategory>): boolean {
  const ids = Array.isArray(condition.value) ? (condition.value as string[]) : [];
  if (condition.field === 'closed') return condition.operator === 'isTrue' ? at.closed : !at.closed;
  if (condition.field === 'statusCategory') {
    // A task without status counts as "to do".
    const category = at.statusId ? categoryOf.get(at.statusId) : 'TODO';
    const inside = category !== undefined && ids.includes(category);
    return condition.operator === 'in' ? inside : !inside;
  }
  switch (condition.operator) {
    case 'in':
      return at.statusId !== null && ids.includes(at.statusId);
    case 'notIn':
      return at.statusId === null || !ids.includes(at.statusId);
    case 'isEmpty':
      return at.statusId === null;
    default:
      return at.statusId !== null;
  }
}

/**
 * Translates a condition, a status condition on the statuses of a moment when given: the tasks with a status
 * recorded then match on it, the others on their current status.
 * @param {FilterCondition} condition Condition.
 * @param {FilterClock} clock User clock.
 * @param {Trees} trees Tree lookups.
 * @param {FilterUser} user Querying user.
 * @param {StatusAt} [statusAt] Statuses of a moment. Optional.
 * @returns {Prisma.TaskWhereInput} Prisma filter.
 */
function conditionAt(condition: FilterCondition, clock: FilterClock, trees: Trees, user: FilterUser, statusAt?: StatusAt): Prisma.TaskWhereInput {
  const current = conditionWhere(condition, clock, trees, user);
  if (!statusAt || !STATUS_FIELDS.has(condition.field)) return current;
  const known = [...statusAt.statuses.keys()];
  const matched = known.filter((id) => statusHolds(condition, statusAt.statuses.get(id)!, statusAt.categoryOf));
  return { OR: [{ id: { in: matched } }, { AND: [{ id: { notIn: known } }, current] }] };
}

/**
 * Translates a filter group; an empty group matches every task.
 * @param {FilterGroup} group Validated group.
 * @param {FilterClock} clock User clock.
 * @param {Trees} trees Tree lookups.
 * @param {FilterUser} user Querying user.
 * @returns {Prisma.TaskWhereInput} Prisma filter.
 */
function groupWhere(group: FilterGroup, clock: FilterClock, trees: Trees, user: FilterUser, statusAt?: StatusAt): Prisma.TaskWhereInput {
  const parts = group.children.map((child) =>
    child.type === 'group' ? groupWhere(child, clock, trees, user, statusAt) : conditionAt(child, clock, trees, user, statusAt),
  );
  if (parts.length === 0) return {};
  return group.combinator === 'and' ? { AND: parts } : { OR: parts };
}

/**
 * Quick search: number (`12` or `#12`), title or description.
 * @param {string} search Search text.
 * @returns {Prisma.TaskWhereInput} Prisma filter.
 */
function searchWhere(search: string): Prisma.TaskWhereInput {
  const text = search.trim();
  if (!text) return {};
  const number = /^#?(\d{1,9})$/.exec(text);
  return {
    OR: [
      ...(number ? [{ number: Number(number[1]) }] : []),
      { title: { contains: text, mode: 'insensitive' } },
      { description: { contains: text, mode: 'insensitive' } },
    ],
  };
}

/**
 * Builds the Prisma filter of a task query.
 * @param {object} options Query options.
 * @param {FilterGroup} options.filter Validated filter tree.
 * @param {string} options.search Quick search.
 * @param {boolean} options.includeArchived Whether archived tasks are included.
 * @param {FilterClock} options.clock User clock.
 * @param {FilterUser} options.user Querying user.
 * @param {StatusAt} [options.statusAt] Statuses the status conditions use instead of the current ones (end of a sprint). Optional.
 * @returns {Promise<Prisma.TaskWhereInput>} Prisma filter.
 */
export async function buildTaskWhere({
  filter,
  search,
  includeArchived,
  clock,
  user,
  statusAt,
}: {
  filter: FilterGroup;
  search: string;
  includeArchived: boolean;
  clock: FilterClock;
  user: FilterUser;
  statusAt?: StatusAt;
}): Promise<Prisma.TaskWhereInput> {
  const trees = await loadTrees(filter, clock);
  return {
    AND: [
      includeArchived ? {} : { archivedAt: null },
      searchWhere(search),
      groupWhere(filter, clock, trees, user, statusAt),
    ],
  };
}
