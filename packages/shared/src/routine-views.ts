import { z } from 'zod';
import { columnLayoutSchema } from './table-layout';
import { RECURRENCE_FREQUENCIES } from './recurrence';
import { filterConditionSchemaFor, filterDepth, filterGroupSchemaFor, MAX_FILTER_DEPTH, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf } from './task-filters';

/** States of the current occurrence of a routine. */
export const ROUTINE_STATES = ['late', 'due', 'upcoming', 'done'] as const;

/** Repetitions of a routine: its rule, or the slots of a calendar schedule. */
export const ROUTINE_REPETITIONS = [...RECURRENCE_FREQUENCIES, 'SCHEDULE'] as const;

/** Filterable routine fields and their kind. */
export const ROUTINE_FILTER_FIELDS = {
  title: 'text',
  description: 'text',
  location: 'text',
  categories: 'multiReference',
  project: 'reference',
  assignees: 'multiReference',
  parent: 'reference',
  requires: 'multiReference',
  state: 'category',
  repetition: 'category',
  estimate: 'number',
  currentDate: 'date',
  firstDate: 'date',
  nextDate: 'date',
  startDate: 'date',
  lastDoneAt: 'date',
  done: 'boolean',
  waiting: 'boolean',
  hasSubRoutines: 'boolean',
  optionalTimes: 'boolean',
  /** Allowed now by its slot rule (else the default of the workspace). */
  doableNow: 'boolean',
  archived: 'boolean',
} as const satisfies Record<string, FilterFieldKind>;
export type RoutineFilterField = keyof typeof ROUTINE_FILTER_FIELDS;

export type RoutineFilterCondition = FilterConditionOf<RoutineFilterField>;
export type RoutineFilterGroup = FilterGroupOf<RoutineFilterField>;

export const routineFilterConditionSchema = filterConditionSchemaFor(ROUTINE_FILTER_FIELDS, { state: ROUTINE_STATES, repetition: ROUTINE_REPETITIONS });

/** Root filter of a routine view: a group, limited in depth (one more level for the context of a project). */
export const routineFilterSchema = filterGroupSchemaFor(routineFilterConditionSchema).refine(
  (group) => filterDepth(group) <= MAX_FILTER_DEPTH + 1,
  `Les groupes de filtres sont limités à ${MAX_FILTER_DEPTH} niveaux.`,
);

/** Sort keys of the routines. */
export const ROUTINE_SORT_KEYS = [
  'title',
  'state',
  'currentDate',
  'firstDate',
  'nextDate',
  'startDate',
  'lastDoneAt',
  'repetition',
  'estimate',
  'trackedTime',
  'project',
  'categories',
  'assignees',
] as const;
export type RoutineSortKey = (typeof ROUTINE_SORT_KEYS)[number];

/** Fields the routines can be grouped by. */
export const ROUTINE_GROUP_BY = ['category', 'project', 'assignees', 'state', 'repetition'] as const;
export type RoutineGroupBy = (typeof ROUTINE_GROUP_BY)[number];

export const routineViewConfigSchema = z.object({
  filter: routineFilterSchema,
  /** Quick text search, combined with the filter. */
  search: z.string().max(200).default(''),
  includeArchived: z.boolean().default(false),
  /** Multi-sort, in priority order. Empty: manual order (drag and drop enabled). */
  sorting: z
    .preprocess(
      (value) => (Array.isArray(value) ? value.filter((sort) => (ROUTINE_SORT_KEYS as readonly unknown[]).includes((sort as { id?: unknown })?.id)) : value),
      z.array(z.object({ id: z.enum(ROUTINE_SORT_KEYS), desc: z.boolean() })).max(ROUTINE_SORT_KEYS.length),
    )
    .default([]),
  /** Groups of the table (null: none); by category by default. */
  groupBy: z.enum(ROUTINE_GROUP_BY).nullable().catch('category').default('category'),
  /** Sub-routines as a flat list instead of under their parent. */
  flat: z.boolean().default(false),
  /** Columns of the table: order, hidden ones, widths. */
  ...columnLayoutSchema.shape,
});
export type RoutineViewConfig = z.infer<typeof routineViewConfigSchema>;

/**
 * Empty root filter of the routines (matches every routine).
 * @returns {RoutineFilterGroup} Filter.
 */
export function emptyRoutineFilter(): RoutineFilterGroup {
  return { type: 'group', id: 'root', combinator: 'and', children: [] };
}

/**
 * Configuration of a new routine view: every routine (not archived), by category, in manual order.
 * @returns {RoutineViewConfig} Config.
 */
export function defaultRoutineViewConfig(): RoutineViewConfig {
  return routineViewConfigSchema.parse({ filter: emptyRoutineFilter() });
}

/**
 * Views made the first time the routines are shown: what is left to do (opened by default), every routine, the
 * archived ones.
 * @returns {{ name: string, config: RoutineViewConfig }[]} Views.
 */
export function firstRoutineViews(): { name: string; config: RoutineViewConfig }[] {
  return [
    {
      name: 'À faire',
      config: routineViewConfigSchema.parse({
        filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'state', field: 'state', operator: 'in', value: ['late', 'due'] }] },
      }),
    },
    { name: 'Toutes', config: defaultRoutineViewConfig() },
    {
      name: 'Archivées',
      config: routineViewConfigSchema.parse({
        filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'archived', field: 'archived', operator: 'isTrue', value: null }] },
        includeArchived: true,
      }),
    },
  ];
}
