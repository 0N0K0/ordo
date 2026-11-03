import {
  filterDay,
  filterPeriod,
  ME,
  TASK_FILTER_FIELDS,
  type FilterCondition,
  type FilterGroup,
  type TaskStatusCategory,
} from '@ordo/shared';
import { prisma } from '../db';
import type { Prisma } from '../generated/prisma/client';

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

type DateField = 'startDate' | 'endDate' | 'createdAt' | 'updatedAt';

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

/** Ids needed by the `inTree` operators, loaded once per query. */
interface Trees {
  projectDescendants: (ids: string[]) => string[];
  taskDescendants: (ids: string[]) => string[];
}

/**
 * Loads the project and task trees when a filter uses `inTree`.
 * @param {FilterGroup} filter Filter.
 * @returns {Promise<Trees>} Lookups.
 */
async function loadTrees(filter: FilterGroup): Promise<Trees> {
  const fields = new Set<string>();
  const collect = (group: FilterGroup): void =>
    group.children.forEach((child) =>
      child.type === 'group' ? collect(child) : child.operator === 'inTree' && fields.add(child.field),
    );
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

  const [projects, tasks] = await Promise.all([
    fields.has('project') ? prisma.project.findMany({ select: { id: true, parentId: true } }) : [],
    fields.has('parent') ? prisma.task.findMany({ select: { id: true, parentId: true } }) : [],
  ]);
  return { projectDescendants: descendantsOf(projects), taskDescendants: descendantsOf(tasks) };
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
      const nullable = key === 'startDate' || key === 'endDate';
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
        sprint: 'sprintId',
      }[field as 'project' | 'status' | 'priority' | 'type' | 'parent' | 'milestone' | 'sprint'] as
        | 'projectId'
        | 'statusId'
        | 'priorityId'
        | 'typeId'
        | 'parentId'
        | 'milestoneId'
        | 'sprintId';
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

    case 'category': {
      const categories = ids as TaskStatusCategory[];
      // A task without status counts as "to do".
      const matches: Prisma.TaskWhereInput = {
        OR: [{ status: { category: { in: categories } } }, ...(categories.includes('TODO') ? [{ statusId: null }] : [])],
      };
      return operator === 'in' ? matches : { NOT: matches };
    }

    case 'boolean': {
      const today = new Date(dayValue(clock.today));
      const truth: Prisma.TaskWhereInput = {
        overdue: { AND: [{ endDate: { lt: today } }, OPEN] },
        // Blocked by at least one task that is still open.
        blocked: { blockedBy: { some: { blocker: { archivedAt: null, ...OPEN } } } },
        hasSubtasks: { children: { some: {} } },
        closed: { NOT: { closedAt: null } },
        archived: { NOT: { archivedAt: null } },
      }[field as 'overdue' | 'blocked' | 'hasSubtasks' | 'closed' | 'archived'];
      if (operator === 'isTrue') return truth;
      // NOT would drop tasks without end date (SQL NULL): "not overdue" is spelled out.
      if (field === 'overdue') {
        return {
          OR: [
            { endDate: null },
            { endDate: { gte: today } },
            { NOT: { closedAt: null } },
          ],
        };
      }
      return { NOT: truth };
    }
  }
}

/**
 * Translates a filter group; an empty group matches every task.
 * @param {FilterGroup} group Validated group.
 * @param {FilterClock} clock User clock.
 * @param {Trees} trees Tree lookups.
 * @param {FilterUser} user Querying user.
 * @returns {Prisma.TaskWhereInput} Prisma filter.
 */
function groupWhere(group: FilterGroup, clock: FilterClock, trees: Trees, user: FilterUser): Prisma.TaskWhereInput {
  const parts = group.children.map((child) =>
    child.type === 'group' ? groupWhere(child, clock, trees, user) : conditionWhere(child, clock, trees, user),
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
 * @returns {Promise<Prisma.TaskWhereInput>} Prisma filter.
 */
export async function buildTaskWhere({
  filter,
  search,
  includeArchived,
  clock,
  user,
}: {
  filter: FilterGroup;
  search: string;
  includeArchived: boolean;
  clock: FilterClock;
  user: FilterUser;
}): Promise<Prisma.TaskWhereInput> {
  const trees = await loadTrees(filter);
  return {
    AND: [
      includeArchived ? {} : { archivedAt: null },
      searchWhere(search),
      groupWhere(filter, clock, trees, user),
    ],
  };
}
