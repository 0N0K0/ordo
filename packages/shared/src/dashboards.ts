import { z } from 'zod';
import { emptyFilter, taskFilterSchema } from './task-filters';

/** Kinds of chart: bars side by side or stacked, lines, areas, donut, and the burndown of a sprint. */
export const CHART_TYPES = ['bar', 'stackedBar', 'line', 'area', 'donut', 'burndown'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Dates the tasks can be spread over. */
export const CHART_TIME_DIMENSIONS = ['createdAt', 'closedAt', 'startDate', 'endDate'] as const;
/** Fields the tasks can be grouped by, on the axis or as series. */
export const CHART_GROUP_DIMENSIONS = ['sprint', 'milestone', 'project', 'status', 'statusCategory', 'priority', 'type', 'assignees', 'state'] as const;
export const CHART_DIMENSIONS = [...CHART_TIME_DIMENSIONS, ...CHART_GROUP_DIMENSIONS] as const;
export type ChartDimension = (typeof CHART_DIMENSIONS)[number];
export type ChartGroupDimension = (typeof CHART_GROUP_DIMENSIONS)[number];

export const CHART_BUCKETS = ['day', 'week', 'month'] as const;
export type ChartBucket = (typeof CHART_BUCKETS)[number];

/** What is measured: number of tasks, effort (tasks without sub-tasks), tracked time in hours. */
export const CHART_MEASURES = ['count', 'effort', 'trackedTime'] as const;
export type ChartMeasure = (typeof CHART_MEASURES)[number];

/** Period of a time axis: rolling, or everything. */
export const CHART_PERIODS = ['past:28', 'past:91', 'past:182', 'past:365', 'all'] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

/**
 * Whether a dimension is a date.
 * @param {ChartDimension} dimension Dimension.
 * @returns {boolean} True for a date.
 */
export function isTimeDimension(dimension: ChartDimension): boolean {
  return (CHART_TIME_DIMENSIONS as readonly string[]).includes(dimension);
}

export const chartConfigSchema = z
  .object({
    type: z.enum(CHART_TYPES),
    /** Axis (categories of a donut). */
    dimension: z.enum(CHART_DIMENSIONS),
    bucket: z.enum(CHART_BUCKETS).default('week'),
    period: z.enum(CHART_PERIODS).default('past:91'),
    measure: z.enum(CHART_MEASURES).default('count'),
    /** Series: one line, bar or area per value of this field. */
    series: z.enum(CHART_GROUP_DIMENSIONS).nullable().default(null),
    /** Running total along a time axis. */
    cumulative: z.boolean().default(false),
    /** Burndown: the sprint followed. */
    sprintId: z.string().nullable().default(null),
    /** Tasks counted: same filters as the task views. */
    filter: taskFilterSchema,
    search: z.string().max(200).default(''),
    includeArchived: z.boolean().default(false),
  })
  .superRefine((config, context) => {
    if (config.type === 'burndown' && !config.sprintId) {
      context.addIssue({ code: 'custom', path: ['sprintId'], message: 'Choisissez le sprint.' });
    }
    if (config.series && config.series === config.dimension) {
      context.addIssue({ code: 'custom', path: ['series'], message: 'Choisissez un autre champ que l’axe.' });
    }
  });
export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const chartTitleSchema = z.string().trim().min(1, 'Le titre est requis.').max(120, '120 caractères maximum.');
export const dashboardNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.');

/**
 * Configuration of a new chart: tasks created per week over three months.
 * @returns {ChartConfig} Configuration.
 */
export function defaultChartConfig(): ChartConfig {
  return chartConfigSchema.parse({ type: 'bar', dimension: 'createdAt', filter: emptyFilter() });
}
