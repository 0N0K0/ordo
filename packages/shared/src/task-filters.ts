import { z } from 'zod';

/** Fixed meaning of a task status. */
export const TASK_STATUS_CATEGORIES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;
export type TaskStatusCategory = (typeof TASK_STATUS_CATEGORIES)[number];

/** Categories of a closed task (not "open", never overdue). */
export const CLOSED_STATUS_CATEGORIES: readonly TaskStatusCategory[] = ['DONE', 'CANCELLED'];

/** Kind of value a filter field holds; it decides the available operators. */
export type FilterFieldKind = 'text' | 'number' | 'date' | 'reference' | 'multiReference' | 'boolean' | 'category';

/** Filterable task fields and their kind. */
export const TASK_FILTER_FIELDS = {
  title: 'text',
  description: 'text',
  number: 'number',
  effort: 'number',
  project: 'reference',
  status: 'reference',
  statusCategory: 'category',
  priority: 'reference',
  type: 'reference',
  parent: 'reference',
  milestone: 'reference',
  sprint: 'reference',
  assignees: 'multiReference',
  startDate: 'date',
  endDate: 'date',
  createdAt: 'date',
  updatedAt: 'date',
  overdue: 'boolean',
  blocked: 'boolean',
  hasSubtasks: 'boolean',
  closed: 'boolean',
  archived: 'boolean',
} as const satisfies Record<string, FilterFieldKind>;
export type TaskFilterField = keyof typeof TASK_FILTER_FIELDS;

/** Operators available for each field kind. */
export const FILTER_OPERATORS = {
  text: ['contains', 'notContains', 'is', 'isNot', 'isEmpty', 'isNotEmpty'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'isEmpty', 'isNotEmpty'],
  date: ['is', 'before', 'after', 'onOrBefore', 'onOrAfter', 'within', 'isEmpty', 'isNotEmpty'],
  // `inTree` (project, parent): the item or any of its descendants.
  reference: ['in', 'notIn', 'inTree', 'isEmpty', 'isNotEmpty'],
  multiReference: ['anyOf', 'allOf', 'noneOf', 'isEmpty', 'isNotEmpty'],
  boolean: ['isTrue', 'isFalse'],
  category: ['in', 'notIn'],
} as const satisfies Record<FilterFieldKind, readonly string[]>;
export type FilterOperator = (typeof FILTER_OPERATORS)[FilterFieldKind][number];

/** Value of an assignee condition standing for the logged-in user's contributor profile. */
export const ME = '@me';

/** Operators that take no value. */
export const VALUELESS_OPERATORS: readonly FilterOperator[] = ['isEmpty', 'isNotEmpty', 'isTrue', 'isFalse'];

/**
 * Relative date tokens: `today`, `today+3`, `today-7` (days from today),
 * or a period for `within`: `thisWeek`, `lastWeek`, `nextWeek`, `thisMonth`, `lastMonth`, `nextMonth`,
 * `past:7` / `next:7` (the last / next N days, today included).
 */
export const DATE_PERIODS = ['thisWeek', 'lastWeek', 'nextWeek', 'thisMonth', 'lastMonth', 'nextMonth'] as const;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const relativeDay = /^today([+-]\d{1,4})?$/;
const rollingPeriod = /^(past|next):\d{1,4}$/;

/** A day: YYYY-MM-DD or `today±N`. */
export const filterDaySchema = z
  .string()
  .refine((value) => isoDate.test(value) || relativeDay.test(value), 'Date invalide.');

/** A period, for the `within` operator. */
export const filterPeriodSchema = z
  .string()
  .refine(
    (value) => (DATE_PERIODS as readonly string[]).includes(value) || rollingPeriod.test(value),
    'Période invalide.',
  );

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calendar date of a timestamp at UTC midnight.
 * @param {number} value Timestamp.
 * @returns {string} YYYY-MM-DD.
 */
const isoDay = (value: number): string => new Date(value).toISOString().slice(0, 10);

/**
 * Day of a day token (`YYYY-MM-DD`, `today`, `today+3`, `today-7`).
 * @param {string} token Day token.
 * @param {string} today User's current day (YYYY-MM-DD).
 * @returns {string} YYYY-MM-DD.
 */
export function filterDay(token: string, today: string): string {
  const relative = /^today([+-]\d+)?$/.exec(token);
  if (!relative) return token;
  return isoDay(Date.parse(`${today}T00:00:00.000Z`) + Number(relative[1] ?? 0) * DAY_MS);
}

/**
 * First day and the day after the last one of a period token (`thisWeek`, `lastMonth`, `past:7`, `next:30`…).
 * Weeks start on Monday.
 * @param {string} token Period token.
 * @param {string} today User's current day (YYYY-MM-DD).
 * @returns {[string, string]} [first day, day after the last one], YYYY-MM-DD.
 */
export function filterPeriod(token: string, today: string): [string, string] {
  const day = Date.parse(`${today}T00:00:00.000Z`);
  const rolling = /^(past|next):(\d+)$/.exec(token);
  if (rolling) {
    const days = Number(rolling[2]);
    return rolling[1] === 'past' ? [isoDay(day - (days - 1) * DAY_MS), isoDay(day + DAY_MS)] : [isoDay(day), isoDay(day + days * DAY_MS)];
  }
  const date = new Date(day);
  if (token.endsWith('Week')) {
    const monday = day - ((date.getUTCDay() + 6) % 7) * DAY_MS;
    const shift = token === 'lastWeek' ? -7 : token === 'nextWeek' ? 7 : 0;
    return [isoDay(monday + shift * DAY_MS), isoDay(monday + (shift + 7) * DAY_MS)];
  }
  const shift = token === 'lastMonth' ? -1 : token === 'nextMonth' ? 1 : 0;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + shift;
  return [isoDay(Date.UTC(year, month, 1)), isoDay(Date.UTC(year, month + 1, 1))];
}

export const filterConditionSchema = z
  .object({
    type: z.literal('condition'),
    /** Stable id, for the filter builder UI. */
    id: z.string().min(1).max(64),
    field: z.enum(Object.keys(TASK_FILTER_FIELDS) as [TaskFilterField, ...TaskFilterField[]]),
    operator: z.string(),
    /** string (text, day, period), number, or list of ids / categories, depending on the operator. */
    value: z.union([z.string(), z.number(), z.array(z.string()), z.null()]).optional(),
  })
  .superRefine((condition, ctx) => {
    const kind = TASK_FILTER_FIELDS[condition.field];
    const operators = FILTER_OPERATORS[kind] as readonly string[];
    if (!operators.includes(condition.operator)) {
      ctx.addIssue({ code: 'custom', path: ['operator'], message: 'Opérateur invalide pour ce champ.' });
      return;
    }
    const operator = condition.operator as FilterOperator;
    if (VALUELESS_OPERATORS.includes(operator)) return;

    const { value } = condition;
    const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['value'], message });
    switch (kind) {
      case 'text':
        if (typeof value !== 'string') issue('Texte attendu.');
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) issue('Nombre attendu.');
        break;
      case 'date': {
        const schema = operator === 'within' ? filterPeriodSchema : filterDaySchema;
        if (!schema.safeParse(value).success) issue(operator === 'within' ? 'Période invalide.' : 'Date invalide.');
        break;
      }
      case 'reference':
      case 'multiReference':
        if (!Array.isArray(value) || value.length === 0) issue('Choisissez au moins une valeur.');
        break;
      case 'category':
        if (
          !Array.isArray(value) ||
          value.length === 0 ||
          !value.every((item) => (TASK_STATUS_CATEGORIES as readonly string[]).includes(item))
        ) {
          issue('Choisissez au moins une catégorie.');
        }
        break;
    }
  });
export type FilterCondition = z.infer<typeof filterConditionSchema>;

export interface FilterGroup {
  type: 'group';
  id: string;
  /** How the children combine: all of them (and) or at least one (or). */
  combinator: 'and' | 'or';
  children: (FilterGroup | FilterCondition)[];
}

/** Maximum nesting of filter groups. */
export const MAX_FILTER_DEPTH = 5;

export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.object({
    type: z.literal('group'),
    id: z.string().min(1).max(64),
    combinator: z.enum(['and', 'or']),
    children: z.array(z.union([filterGroupSchema, filterConditionSchema])).max(50),
  }),
);

/**
 * Nesting depth of a filter tree (1 for a group of conditions).
 * @param {FilterGroup} group Root group.
 * @returns {number} Depth.
 */
export function filterDepth(group: FilterGroup): number {
  return 1 + Math.max(0, ...group.children.map((child) => (child.type === 'group' ? filterDepth(child) : 0)));
}

/**
 * Root filter: a group, limited in depth. The app may wrap a view filter in a context filter
 * (project, home period), hence two extra levels over what the builder allows.
 */
export const taskFilterSchema = filterGroupSchema.refine(
  (group) => filterDepth(group) <= MAX_FILTER_DEPTH + 2,
  `Les groupes de filtres sont limités à ${MAX_FILTER_DEPTH} niveaux.`,
);

/**
 * Empty root filter (matches every task).
 * @returns {FilterGroup} Filter.
 */
export function emptyFilter(): FilterGroup {
  return { type: 'group', id: 'root', combinator: 'and', children: [] };
}

/** Columns of the task table (the number is shown before the title). */
export const TASK_COLUMNS = [
  'title',
  'project',
  'status',
  'priority',
  'type',
  'assignees',
  'effort',
  'trackedTime',
  'startDate',
  'endDate',
  'parent',
  'milestone',
  'sprint',
  'blockedBy',
  'blocking',
  'related',
  'comments',
  'createdAt',
  'updatedAt',
] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

/** Sort keys: the columns, plus the task number. */
export const TASK_SORT_KEYS = [...TASK_COLUMNS, 'number'] as const;
export type TaskSortKey = (typeof TASK_SORT_KEYS)[number];

/** Periods of the events listed with the tasks. */
export const EVENT_PERIODS = ['thisWeek', 'nextWeek', 'thisMonth', 'nextMonth', 'next:7', 'next:30', 'next:90', 'past:30'] as const;
export type EventPeriod = (typeof EVENT_PERIODS)[number];

/** Fields the table can be grouped by. */
export const TASK_GROUP_BY = ['state', 'project', 'status', 'priority', 'type', 'assignees', 'parent', 'milestone', 'sprint'] as const;
export type TaskGroupBy = (typeof TASK_GROUP_BY)[number];

const columnSchema = z.enum(TASK_COLUMNS);

/**
 * List of columns that drops unknown ids, so views saved with a removed column stay valid.
 * @returns {z.ZodType<TaskColumn[]>} Schema.
 */
const columnListSchema = () =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.filter((id) => (TASK_COLUMNS as readonly unknown[]).includes(id)) : value),
    z.array(columnSchema),
  );

export const taskViewConfigSchema = z.object({
  filter: taskFilterSchema,
  /** Quick text search, combined with the filter. */
  search: z.string().max(200).default(''),
  includeArchived: z.boolean().default(false),
  /** Multi-sort, in priority order. Empty: manual order (drag and drop enabled). */
  sorting: z
    .preprocess(
      (value) =>
        Array.isArray(value)
          ? value.filter((sort) => (TASK_SORT_KEYS as readonly unknown[]).includes((sort as { id?: unknown })?.id))
          : value,
      z.array(z.object({ id: z.enum(TASK_SORT_KEYS), desc: z.boolean() })).max(TASK_SORT_KEYS.length),
    )
    .default([]),
  columnOrder: columnListSchema().default([...TASK_COLUMNS]),
  hiddenColumns: columnListSchema().default([]),
  columnSizing: z.record(z.string(), z.number().min(40).max(1200)).default({}),
  groupBy: z.enum(TASK_GROUP_BY).nullable().default(null),
  /** Show sub-tasks as a flat list instead of expandable rows. */
  flat: z.boolean().default(false),
  /** Calendar events listed with the tasks, over a period (a `within` period token). */
  events: z
    .object({ show: z.boolean().default(false), period: z.enum(EVENT_PERIODS).catch('next:30').default('next:30') })
    .default({ show: false, period: 'next:30' }),
});
export type TaskViewConfig = z.infer<typeof taskViewConfigSchema>;

/**
 * Configuration of a new view: every task, manual order, default columns.
 * @returns {TaskViewConfig} Config.
 */
export function defaultTaskViewConfig(): TaskViewConfig {
  return taskViewConfigSchema.parse({
    filter: emptyFilter(),
    hiddenColumns: ['blocking', 'related', 'milestone', 'createdAt', 'updatedAt'],
  });
}

export const taskViewNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.');
