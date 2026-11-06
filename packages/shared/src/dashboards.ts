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

/** Id of the main data set of a chart (its own source, measure and filters). */
export const MAIN_DATASET = 'main';

/** Additional data set of a chart: its own source, measure and filters, on the axis of the chart. */
export const chartDatasetSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, 'Nommez le jeu de données.').max(60, '60 caractères maximum.'),
  source: z.enum(CHART_SOURCES),
  measure: z.enum(CHART_MEASURES),
  /** Date of the records on a time axis (the dates differ between sources); the axis date when null. */
  dateField: z.enum(CHART_TIME_DIMENSIONS).nullable().default(null),
  /** Its own series: one per value of this field, or none. */
  series: z.enum(CHART_GROUP_DIMENSIONS).nullable().default(null),
  filter: taskFilterSchema.default(emptyFilter),
  search: z.string().max(200).default(''),
  includeArchived: z.boolean().default(false),
  documents: documentChartFilterSchema.default(() => documentChartFilterSchema.parse({})),
  treasury: treasuryChartFilterSchema.default(() => treasuryChartFilterSchema.parse({})),
});
export type ChartDataset = z.infer<typeof chartDatasetSchema>;

/** Comparison of two data sets (their totals, whatever their series): the share of one in another (percent), or their difference. */
export const CHART_COMPARISON_KINDS = ['ratio', 'difference'] as const;
export const chartComparisonSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1, 'Nommez la comparaison.').max(60, '60 caractères maximum.'),
  kind: z.enum(CHART_COMPARISON_KINDS),
  /** Data sets compared (MAIN_DATASET or the id of another one): a / b, or a − b. */
  a: z.string().min(1),
  b: z.string().min(1),
  /** How it is drawn. */
  type: z.enum(['line', 'bar', 'area']).default('line'),
});
export type ChartComparison = z.infer<typeof chartComparisonSchema>;

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
    /** Name of the main data set (shown when there are several). */
    name: z.string().trim().max(60, '60 caractères maximum.').default(''),
    /** Other data sets, drawn on the same axis. */
    datasets: z.array(chartDatasetSchema).max(8, '8 jeux de données supplémentaires maximum.').default([]),
    /** Comparisons of data sets (ratio in percent on a right axis, or difference). */
    comparisons: z.array(chartComparisonSchema).max(8, '8 comparaisons maximum.').default([]),
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
    if (config.datasets.length || config.comparisons.length) {
      if (config.type === 'donut' || config.type === 'burndown') issue('type', 'Plusieurs jeux de données se comparent en barres, courbes ou aires.');
    }
    const ids = new Set([MAIN_DATASET]);
    const time = isTimeDimension(config.dimension);
    config.datasets.forEach((dataset, index) => {
      const path = (field: string) => ['datasets', index, field];
      if (ids.has(dataset.id)) context.addIssue({ code: 'custom', path: path('id'), message: 'Jeu de données en double.' });
      ids.add(dataset.id);
      if (!SOURCE_MEASURES[dataset.source].includes(dataset.measure)) context.addIssue({ code: 'custom', path: path('measure'), message: `« ${dataset.name} » : mesure indisponible pour sa source.` });
      if (dataset.source === 'treasury' && dataset.measure === 'balance') context.addIssue({ code: 'custom', path: path('measure'), message: `« ${dataset.name} » : le solde ne se compare pas.` });
      if (dataset.series && (!SOURCE_GROUP_DIMENSIONS[dataset.source].includes(dataset.series) || dataset.series === config.dimension)) {
        context.addIssue({ code: 'custom', path: path('series'), message: `« ${dataset.name} » : séries indisponibles.` });
      }
      if (time) {
        const field = dataset.dateField ?? config.dimension;
        if (!SOURCE_TIME_DIMENSIONS[dataset.source].includes(field)) context.addIssue({ code: 'custom', path: path('dateField'), message: `« ${dataset.name} » : choisissez sa date.` });
      } else if (!SOURCE_GROUP_DIMENSIONS[dataset.source].includes(config.dimension as ChartGroupDimension)) {
        context.addIssue({ code: 'custom', path: path('source'), message: `« ${dataset.name} » : l’axe n’existe pas pour sa source.` });
      }
    });
    config.comparisons.forEach((comparison, index) => {
      if (!ids.has(comparison.a) || !ids.has(comparison.b)) context.addIssue({ code: 'custom', path: ['comparisons', index, 'a'], message: `« ${comparison.name} » : jeu de données introuvable.` });
      if (comparison.a === comparison.b) context.addIssue({ code: 'custom', path: ['comparisons', index, 'b'], message: `« ${comparison.name} » : comparez deux jeux différents.` });
    });
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
