import { z } from 'zod';
import { requiredText } from '../core/rules';
import { TABLE_AGGREGATES } from './aggregates';
import { columnLayoutSchema, tableSortSchema } from './table-layout';
import { filterDepth, filterGroupSchemaFor, MAX_FILTER_DEPTH, type FilterConditionOf, type FilterGroupOf } from './filters';

/** Name of a table with saved views of its own (« time-log », « treasury-entries »…). */
export const tableKeySchema = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Tableau invalide.');

/**
 * Condition of a filter on the columns of a table: its fields are the ids of the columns, their kinds known only by
 * the app, which skips the conditions it cannot apply.
 */
const tableFilterConditionSchema = z.object({
  type: z.literal('condition'),
  id: z.string().min(1).max(64),
  field: z.string().min(1).max(64),
  operator: z.string().min(1).max(32),
  value: z.union([z.string().max(500), z.number(), z.array(z.string().max(200)).max(200), z.null()]).optional(),
}) as unknown as z.ZodType<FilterConditionOf<string>>;

export type TableFilterGroup = FilterGroupOf<string>;

/** Root filter of a view of a table: a group, limited in depth. */
export const tableFilterSchema = filterGroupSchemaFor(tableFilterConditionSchema).refine(
  (group) => filterDepth(group) <= MAX_FILTER_DEPTH + 1,
  `Les groupes de filtres sont limités à ${MAX_FILTER_DEPTH} niveaux.`,
);

/** Periods the rows are grouped by on a date: its day, week, month, quarter or year. */
export const GROUP_PERIODS = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;
export type GroupPeriod = (typeof GROUP_PERIODS)[number];

/** Configuration of a view of any table: search, filter, sorts, groups and columns. */
export const tableViewConfigSchema = z.object({
  filter: tableFilterSchema.catch({ type: 'group', id: 'root', combinator: 'and', children: [] }),
  search: z.string().max(200).default(''),
  sorting: z.array(tableSortSchema).max(30).default([]),
  /** Column the rows are grouped by, null for none. */
  groupBy: z.string().max(64).nullable().catch(null).default(null),
  /** Period of a grouping on a date. */
  groupPeriod: z.enum(GROUP_PERIODS).catch('MONTH').default('MONTH'),
  /** Sub-rows shown flat, each a row of its own (a table of rows in a tree). */
  flat: z.boolean().catch(false).default(false),
  /** Archived rows shown too (a table that has some). */
  includeArchived: z.boolean().catch(false).default(false),
  /** Options of its own a table keeps in its views (the events listed with the tasks…). */
  options: z
    .record(z.string().max(64), z.union([z.string().max(200), z.number(), z.boolean()]))
    .catch({})
    .default({}),
  ...columnLayoutSchema.shape,
  /** Footer of the table: the total shown under each column (count, sum, average, median); null: no footer. */
  footer: z.record(z.string().max(64), z.enum(TABLE_AGGREGATES)).nullable().catch(null).default(null),
  /** Rows in the order chosen by hand (their keys), used without sort; the others after, in their order. */
  manualOrder: z.array(z.string().max(200)).max(5000).catch([]).default([]),
});
export type TableViewConfig = z.infer<typeof tableViewConfigSchema>;

/**
 * Empty root filter of a table (matches every row).
 * @returns {TableFilterGroup} Filter.
 */
export function emptyTableFilter(): TableFilterGroup {
  return { type: 'group', id: 'root', combinator: 'and', children: [] };
}

/**
 * Configuration of a view of a table: every row, the given settings over the defaults.
 * @param {Partial<TableViewConfig>} [config] Settings. Optional.
 * @returns {TableViewConfig} Config.
 */
export function tableViewConfig(config: Partial<TableViewConfig> = {}): TableViewConfig {
  return tableViewConfigSchema.parse({ filter: emptyTableFilter(), ...config });
}

/** Label of a saved view of a table. */
/** Longest label of a saved view. */
export const VIEW_LABEL_MAX = 60;

export const taskViewLabelSchema = requiredText(VIEW_LABEL_MAX);
