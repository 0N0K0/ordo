import { z } from 'zod';
import { requiredText, TEXT_MAX, TEXT_TOO_LONG } from '../core/rules';
import { TABLE_AGGREGATES } from './aggregates';
import { columnLayoutSchema, TABLE_KEY_MAX, tableSortSchema } from './table-layout';
import { filterDepth, filterGroupSchemaFor, MAX_FILTER_DEPTH, type FilterConditionOf, type FilterGroupOf } from './filters';

/** What a saved view lists (TABLE: any other table, named by its key). */
export const VIEW_KINDS = ['TASKS', 'ROUTINES', 'SHOPPING_LISTS', 'TABLE'] as const;

/** Most characters of a value of a filter condition, kept in a view (internal bound). */
const FILTER_VALUE_MAX = 500;
/** Most characters of a row key or a choice of a view (internal bound). */
const ROW_KEY_MAX = 200;

/** Text searched in a table or a chart, as typed (not trimmed), at most `TEXT_MAX`. */
export const searchTextSchema = z.string().max(TEXT_MAX, TEXT_TOO_LONG).default('');

/** Name of a table with saved views of its own (« time-log », « treasury-entries »…). */
export const tableKeySchema = z.string().regex(/^[a-z0-9-]{1,64}$/, 'Tableau invalide.');

/**
 * Condition of a filter on the columns of a table: its fields are the ids of the columns, their kinds known only by
 * the app, which skips the conditions it cannot apply.
 */
const tableFilterConditionSchema = z.object({
  type: z.literal('condition'),
  id: z.string().min(1).max(TABLE_KEY_MAX),
  field: z.string().min(1).max(TABLE_KEY_MAX),
  operator: z.string().min(1).max(TABLE_KEY_MAX),
  value: z.union([z.string().max(FILTER_VALUE_MAX), z.number(), z.array(z.string().max(ROW_KEY_MAX)).max(200), z.null()]).optional(),
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
  search: searchTextSchema,
  sorting: z.array(tableSortSchema).max(30).default([]),
  /** Column the rows are grouped by, null for none. */
  groupBy: z.string().max(TABLE_KEY_MAX).nullable().catch(null).default(null),
  /** Period of a grouping on a date. */
  groupPeriod: z.enum(GROUP_PERIODS).catch('MONTH').default('MONTH'),
  /** Sub-rows shown flat, each a row of its own (a table of rows in a tree). */
  flat: z.boolean().catch(false).default(false),
  /** Archived rows shown too (a table that has some). */
  includeArchived: z.boolean().catch(false).default(false),
  /** Options of its own a table keeps in its views (the events listed with the tasks…). */
  options: z
    .record(z.string().max(TABLE_KEY_MAX), z.union([z.string().max(ROW_KEY_MAX), z.number(), z.boolean()]))
    .catch({})
    .default({}),
  ...columnLayoutSchema.shape,
  /** Footer of the table: the total shown under each column (count, sum, average, median); null: no footer. */
  footer: z.record(z.string().max(TABLE_KEY_MAX), z.enum(TABLE_AGGREGATES)).nullable().catch(null).default(null),
  /** Rows in the order chosen by hand (their keys), used without sort; the others after, in their order. */
  manualOrder: z.array(z.string().max(ROW_KEY_MAX)).max(5000).catch([]).default([]),
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

/** Label of a saved view, of any table. */
export const viewLabelSchema = requiredText();
