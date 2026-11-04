import { z } from 'zod';
import { emptyFilter, taskFilterSchema } from './task-filters';

/** What a chart is drawn from: tasks, accounting documents (quotes, invoices…), treasury movements. */
export const CHART_SOURCES = ['tasks', 'documents', 'treasury'] as const;
export type ChartSource = (typeof CHART_SOURCES)[number];

/** Kinds of chart: bars side by side or stacked, lines, areas, donut, and the burndown of a sprint (tasks). */
export const CHART_TYPES = ['bar', 'stackedBar', 'line', 'area', 'donut', 'burndown'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Dates the records can be spread over. */
export const CHART_TIME_DIMENSIONS = ['createdAt', 'closedAt', 'startDate', 'endDate', 'issueDate', 'dueDate', 'sentAt', 'acceptedAt', 'date'] as const;
/** Fields the records can be grouped by, on the axis or as series. */
export const CHART_GROUP_DIMENSIONS = [
  'sprint',
  'milestone',
  'project',
  'status',
  'statusCategory',
  'priority',
  'type',
  'assignees',
  'tags',
  'state',
  'documentType',
  'trackingStatus',
  'client',
  'payment',
  'documentState',
  'origin',
  'category',
  'account',
  'direction',
  'entryStatus',
] as const;
export const CHART_DIMENSIONS = [...CHART_TIME_DIMENSIONS, ...CHART_GROUP_DIMENSIONS] as const;
export type ChartDimension = (typeof CHART_DIMENSIONS)[number];
export type ChartGroupDimension = (typeof CHART_GROUP_DIMENSIONS)[number];

/** What is measured: tasks (number, effort, tracked hours), documents (number, amounts), movements (amounts, balance). */
export const CHART_MEASURES = ['count', 'effort', 'trackedTime', 'totalNet', 'totalGross', 'paid', 'balance', 'amount', 'income', 'expense'] as const;
export type ChartMeasure = (typeof CHART_MEASURES)[number];

/** Dates, fields and measures of each source. */
export const SOURCE_TIME_DIMENSIONS: Record<ChartSource, readonly ChartDimension[]> = {
  tasks: ['createdAt', 'closedAt', 'startDate', 'endDate'],
  documents: ['issueDate', 'dueDate', 'sentAt', 'acceptedAt'],
  treasury: ['date'],
};
export const SOURCE_GROUP_DIMENSIONS: Record<ChartSource, readonly ChartGroupDimension[]> = {
  tasks: ['sprint', 'milestone', 'project', 'status', 'statusCategory', 'priority', 'type', 'assignees', 'tags', 'state'],
  documents: ['documentType', 'trackingStatus', 'client', 'project', 'payment', 'documentState', 'origin'],
  treasury: ['category', 'account', 'direction', 'project', 'entryStatus'],
};
export const SOURCE_MEASURES: Record<ChartSource, readonly ChartMeasure[]> = {
  tasks: ['count', 'effort', 'trackedTime'],
  documents: ['totalNet', 'totalGross', 'paid', 'balance', 'count'],
  treasury: ['amount', 'income', 'expense', 'balance', 'count'],
};

export const CHART_BUCKETS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type ChartBucket = (typeof CHART_BUCKETS)[number];

/** Period of a time axis: past or coming, or everything. */
export const CHART_PERIODS = ['past:28', 'past:91', 'past:182', 'past:365', 'past:730', 'next:91', 'next:182', 'next:365', 'all'] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];

/**
 * Whether a dimension is a date.
 * @param {ChartDimension} dimension Dimension.
 * @returns {boolean} True for a date.
 */
export function isTimeDimension(dimension: ChartDimension): boolean {
  return (CHART_TIME_DIMENSIONS as readonly string[]).includes(dimension);
}

/** Documents counted by a chart. */
export const documentChartFilterSchema = z.object({
  /** Types counted; empty: every type. */
  types: z.array(z.enum(['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'])).default([]),
  clientIds: z.array(z.string()).default([]),
  /** Tracking statuses; empty: every status. */
  statusIds: z.array(z.string()).default([]),
  includeDrafts: z.boolean().default(false),
  /** Documents issued before Ordo. */
  includeImported: z.boolean().default(true),
  /** Credit notes lower the amounts (net revenue). */
  creditNotesNegative: z.boolean().default(true),
});
export type DocumentChartFilter = z.infer<typeof documentChartFilterSchema>;

/** Movements counted by a chart. */
export const treasuryChartFilterSchema = z.object({
  accountIds: z.array(z.string()).default([]),
  categories: z.array(z.string()).default([]),
  direction: z.enum(['all', 'in', 'out']).default('all'),
  /** Expected movements too (forecasts, invoices due, coming recurring invoices). */
  includeForecast: z.boolean().default(false),
});
export type TreasuryChartFilter = z.infer<typeof treasuryChartFilterSchema>;

export const chartConfigSchema = z
  .object({
    source: z.enum(CHART_SOURCES).default('tasks'),
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
    filter: taskFilterSchema.default(emptyFilter),
    search: z.string().max(200).default(''),
    includeArchived: z.boolean().default(false),
    documents: documentChartFilterSchema.default(() => documentChartFilterSchema.parse({})),
    treasury: treasuryChartFilterSchema.default(() => treasuryChartFilterSchema.parse({})),
  })
  .superRefine((config, context) => {
    const source = config.source;
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });
    if (![...SOURCE_TIME_DIMENSIONS[source], ...SOURCE_GROUP_DIMENSIONS[source]].includes(config.dimension)) issue('dimension', 'Axe indisponible pour cette source.');
    if (!SOURCE_MEASURES[source].includes(config.measure)) issue('measure', 'Mesure indisponible pour cette source.');
    if (config.series && !SOURCE_GROUP_DIMENSIONS[source].includes(config.series)) issue('series', 'Séries indisponibles pour cette source.');
    if (config.type === 'burndown' && source !== 'tasks') issue('type', 'Le burndown suit un sprint de tâches.');
    if (config.type === 'burndown' && !config.sprintId) issue('sprintId', 'Choisissez le sprint.');
    if (config.series && config.series === config.dimension) issue('series', 'Choisissez un autre champ que l’axe.');
    if (source === 'treasury' && config.measure === 'balance' && !isTimeDimension(config.dimension)) {
      issue('measure', 'Le solde se suit dans le temps : choisissez la date comme axe.');
    }
  });
export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const chartTitleSchema = z.string().trim().min(1, 'Le titre est requis.').max(120, '120 caractères maximum.');
export const dashboardNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.');

/**
 * Configuration of a new chart of a source: tasks created per week, invoiced revenue per month, or money in
 * and out per month.
 * @param {ChartSource} [source] Source. Optional. Default = tasks.
 * @returns {ChartConfig} Configuration.
 */
export function defaultChartConfig(source: ChartSource = 'tasks'): ChartConfig {
  if (source === 'documents') {
    return chartConfigSchema.parse({
      source,
      type: 'bar',
      dimension: 'issueDate',
      bucket: 'month',
      period: 'past:365',
      measure: 'totalNet',
      documents: { types: ['INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'] },
    });
  }
  if (source === 'treasury') return chartConfigSchema.parse({ source, type: 'bar', dimension: 'date', bucket: 'month', period: 'past:365', measure: 'amount', series: 'direction' });
  return chartConfigSchema.parse({ type: 'bar', dimension: 'createdAt', filter: emptyFilter() });
}
