import { addDays, calendarRange, CALENDAR_PERIOD, filterPeriod, isTimeDimension, type CalendarScale, type ChartBucket, type ChartConfig, type ChartDimension, type ChartGroupDimension, type ChartMeasure, type ChartSource } from '@ordo/shared';

/** Labels of the dimensions, measures and buckets, shared by the editor and the charts. */
export const DIMENSION_LABELS: Record<ChartDimension, string> = {
  createdAt: 'Date de création',
  closedAt: 'Date de fermeture',
  startDate: 'Date de début',
  endDate: 'Date de fin',
  issueDate: 'Date du document',
  dueDate: 'Échéance / validité',
  sentAt: 'Date d’envoi',
  acceptedAt: 'Date d’acceptation',
  date: 'Date',
  sprint: 'Sprint',
  milestone: 'Jalon',
  project: 'Projet',
  status: 'Statut',
  statusCategory: 'Catégorie de statut',
  priority: 'Priorité',
  type: 'Type',
  assignees: 'Assigné',
  tags: 'Étiquette',
  state: 'État (ouverte / fermée)',
  documentType: 'Type de document',
  trackingStatus: 'Statut de suivi',
  client: 'Client',
  payment: 'Paiement',
  documentState: 'Brouillon / définitif',
  origin: 'Ordo / importé',
  category: 'Catégorie',
  account: 'Compte',
  direction: 'Entrée / sortie',
  entryStatus: 'Réel / prévu',
};
export const MEASURE_LABELS: Record<ChartMeasure, string> = {
  count: 'Nombre',
  effort: 'Effort',
  trackedTime: 'Temps passé (h)',
  totalNet: 'Montant HT',
  totalGross: 'Montant TTC',
  paid: 'Montant payé',
  balance: 'Reste dû',
  amount: 'Montant net (entrées − sorties)',
  income: 'Entrées',
  expense: 'Sorties',
};
/** Name of the single series, by measure. */
const SERIES_NAMES: Record<ChartMeasure, string> = {
  count: 'Nombre',
  effort: 'Effort',
  trackedTime: 'Heures',
  totalNet: 'HT',
  totalGross: 'TTC',
  paid: 'Payé',
  balance: 'Reste dû',
  amount: 'Net',
  income: 'Entrées',
  expense: 'Sorties',
};
/**
 * Label of a measure in a source (the balance of the treasury is its cash, not an amount due).
 * @param {ChartSource} source Source.
 * @param {ChartMeasure} measure Measure.
 * @returns {string} Label.
 */
export function measureLabel(source: ChartSource, measure: ChartMeasure): string {
  return source === 'treasury' && measure === 'balance' ? 'Solde' : MEASURE_LABELS[measure];
}

/**
 * Number of records counted by a chart, in words (« 3 documents »).
 * @param {ChartConfig} config Configuration.
 * @param {number} count Number of records.
 * @returns {string} Count.
 */
export function countLabel(config: ChartConfig, count: number): string {
  const noun = config.source === 'tasks' ? 'tâche' : config.source === 'documents' ? 'document' : config.measure === 'balance' ? 'point' : 'mouvement';
  return `${count} ${noun}${count > 1 ? 's' : ''}`;
}

/** Title of a new chart, by source. */
export const NEW_CHART_TITLES: Record<ChartSource, string> = {
  tasks: 'Tâches créées par semaine',
  documents: 'Chiffre d’affaires HT par mois',
  treasury: 'Entrées et sorties par mois',
};

/** Measures in euros. */
export const MONEY_MEASURES: readonly ChartMeasure[] = ['totalNet', 'totalGross', 'paid', 'balance', 'amount', 'income', 'expense'];
export const PALETTE = ['blue.6', 'teal.6', 'orange.6', 'grape.6', 'red.6', 'cyan.6', 'lime.6', 'indigo.6', 'pink.6', 'yellow.6'];

export interface ChartSeries {
  name: string;
  color: string;
  strokeDasharray?: string;
  /** Mixed charts: how this series is drawn. */
  type?: 'bar' | 'line' | 'area';
  /** "right": on the percent axis. */
  yAxisId?: string;
  /** Mixed charts: series stacked together (those of a same data set). */
  stackId?: string;
}

export interface ChartData {
  /** One row per value of the axis: `x` and one number per series. */
  rows: Record<string, string | number | null>[];
  series: ChartSeries[];
  /** Donut slices. */
  slices: { name: string; value: number; color: string }[];
  /** Records counted (tasks, documents, movements). */
  taskCount: number;
  /** Nothing to draw. */
  empty: boolean;
  /** Several data sets or comparisons: drawn as a mixed chart. */
  mixed?: boolean;
  /** Some series are percents, on a right axis. */
  percentAxis?: boolean;
}

/** Value of a field: a group of the axis or of the series. */
export interface Key {
  key: string;
  label: string;
  /** Sort order. */
  order: string | number;
  color?: string;
}

/** What the aggregation needs of a record (task, document, movement). */
export interface ChartRecord {
  /** Day of a date field (YYYY-MM-DD), or null. */
  day: (dimension: ChartDimension) => string | null;
  /** Values of a field (several for assignees or tags; a "none" value when empty). */
  keys: (dimension: ChartGroupDimension) => Key[];
  /** Value of a measure. */
  value: (measure: ChartMeasure) => number;
}

export const NONE_ORDER = '￿';
const collator = new Intl.Collator('fr', {
  numeric: true,
  sensitivity: 'base',
});
const dayLabel = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const monthLabel = new Intl.DateTimeFormat('fr-FR', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * "None" value of a field.
 * @param {string} label Label.
 * @returns {Key[]} Value.
 */
export const none = (label: string): Key[] => [{ key: 'none', label, order: NONE_ORDER, color: 'gray.5' }];

export const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Local day of an instant (YYYY-MM-DD).
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
export function localDay(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Bucket of a day: the day, the Monday of its week, the first of its month, quarter or year.
 * @param {string} day YYYY-MM-DD.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} First day of the bucket.
 */
export function bucketOf(day: string, bucket: ChartBucket): string {
  if (bucket === 'day') return day;
  if (bucket === 'month') return `${day.slice(0, 7)}-01`;
  if (bucket === 'year') return `${day.slice(0, 4)}-01-01`;
  if (bucket === 'quarter') return `${day.slice(0, 4)}-${String(Math.floor((Number(day.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/**
 * Next bucket.
 * @param {string} start First day of a bucket.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} First day of the next one.
 */
export function nextBucket(start: string, bucket: ChartBucket): string {
  if (bucket === 'day') return addDays(start, 1);
  if (bucket === 'week') return addDays(start, 7);
  const date = new Date(`${start}T00:00:00Z`);
  const months = bucket === 'month' ? 1 : bucket === 'quarter' ? 3 : 12;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)).toISOString().slice(0, 10);
}

/**
 * Label of a bucket.
 * @param {string} start First day of the bucket.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} "3 nov.", "sem. 3 nov.", "nov. 2026", "T4 2026", "2026".
 */
export function bucketLabel(start: string, bucket: ChartBucket): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (bucket === 'year') return start.slice(0, 4);
  if (bucket === 'quarter') return `T${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
  if (bucket === 'month') return monthLabel.format(date);
  return bucket === 'week' ? `sem. ${dayLabel.format(date)}` : dayLabel.format(date);
}

/**
 * First day and day after the last one of the period of a time axis, or nulls for everything.
 * @param {ChartConfig['period']} period Period.
 * @param {string} today User's day.
 * @returns {[string | null, string | null]} Range.
 */
export function periodRange(period: ChartConfig['period'], today: string): [string | null, string | null] {
  return calendarRange(period, today) ?? (period === 'all' ? [null, null] : filterPeriod(period, today));
}

const ROLLING_LABELS: Record<string, string> = {
  'past:28': '4 dernières semaines',
  'past:91': '3 derniers mois',
  'past:182': '6 derniers mois',
  'past:365': '12 derniers mois',
  'past:730': '24 derniers mois',
  'next:91': '3 prochains mois',
  'next:182': '6 prochains mois',
  'next:365': '12 prochains mois',
  all: 'Toute la période',
};
const CURRENT_LABELS = { month: ['Mois en cours', 'Mois précédent'], quarter: ['Trimestre en cours', 'Trimestre précédent'], year: ['Année en cours', 'Année précédente'] } as const;
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Name of a period: rolling ("12 derniers mois"), current or previous ("Mois en cours"), or chosen ("mars 2026",
 * "T2 2026", "2026").
 * @param {ChartConfig['period']} period Period.
 * @returns {string} Name.
 */
export function periodLabel(period: ChartConfig['period']): string {
  const match = CALENDAR_PERIOD.exec(period);
  if (!match) return ROLLING_LABELS[period] ?? period;
  const scale = match[1] as keyof typeof CURRENT_LABELS;
  if (match[2] === '0' || match[2] === '-1') return CURRENT_LABELS[scale][match[2] === '0' ? 0 : 1];
  const start = match[2];
  if (scale === 'year') return start.slice(0, 4);
  if (scale === 'quarter') return `T${Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1} ${start.slice(0, 4)}`;
  const label = monthName.format(new Date(`${start}T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Compares two keys by their order, "none" last.
 * @param {Key} a Key.
 * @param {Key} b Key.
 * @returns {number} Order.
 */
function compareKeys(a: Key, b: Key): number {
  if (typeof a.order === 'number' && typeof b.order === 'number') return a.order - b.order;
  if (a.order === NONE_ORDER) return 1;
  if (b.order === NONE_ORDER) return -1;
  return collator.compare(String(a.order), String(b.order));
}

/**
 * Data of a chart from records: spread over the axis (dates by day, week, month, quarter or year over the
 * period, or values of a field) and the series, measured, optionally cumulated; a record with several values
 * of a field counts for each.
 * @param {ChartRecord[]} records Records.
 * @param {ChartConfig} config Configuration.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {ChartData} Data.
 */
export function aggregate(records: ChartRecord[], config: ChartConfig, today: string): ChartData {
  const time = isTimeDimension(config.dimension);
  const [from, to] = time ? periodRange(config.period, today) : [null, null];
  const axis = new Map<string, Key>();
  const seriesKeys = new Map<string, Key>();
  const cells = new Map<string, number>();
  let counted = 0;

  for (const record of records) {
    let xs: Key[];
    if (time) {
      const day = record.day(config.dimension);
      if (!day || (from && day < from) || (to && day >= to)) continue;
      const start = bucketOf(day, config.bucket);
      xs = [{ key: start, label: bucketLabel(start, config.bucket), order: start }];
    } else {
      xs = record.keys(config.dimension as ChartGroupDimension);
    }
    const series = config.series ? record.keys(config.series) : [{ key: 'all', label: SERIES_NAMES[config.measure], order: 0 }];
    const value = record.value(config.measure);
    counted += 1;
    for (const x of xs) {
      axis.set(x.key, x);
      for (const serie of series) {
        seriesKeys.set(serie.key, serie);
        cells.set(`${x.key}|${serie.key}`, (cells.get(`${x.key}|${serie.key}`) ?? 0) + value);
      }
    }
  }

  // A time axis has every bucket of the period, empty ones included.
  if (time && axis.size > 0) {
    const starts = [...axis.keys()].sort();
    const first = from ? bucketOf(from, config.bucket) : starts[0];
    const last = to ? bucketOf(addDays(to, -1), config.bucket) : starts[starts.length - 1];
    for (let start = first; start <= last; start = nextBucket(start, config.bucket)) {
      if (!axis.has(start))
        axis.set(start, {
          key: start,
          label: bucketLabel(start, config.bucket),
          order: start,
        });
    }
  }

  const xs = [...axis.values()].sort(compareKeys);
  const series = [...seriesKeys.values()].sort(compareKeys);
  const names = new Map(series.map((serie) => [serie.key, serie.label]));
  const running = new Map<string, number>();
  const rows = xs.map((x) => {
    const row: Record<string, string | number | null> = { x: x.label };
    for (const serie of series) {
      let value = cells.get(`${x.key}|${serie.key}`) ?? 0;
      if (config.cumulative && time) {
        value += running.get(serie.key) ?? 0;
        running.set(serie.key, value);
      }
      row[names.get(serie.key)!] = round(value);
    }
    return row;
  });
  const colored = series.map((serie, index) => ({
    name: serie.label,
    color: serie.color ?? PALETTE[index % PALETTE.length],
  }));
  const slices = xs
    .map((x, index) => ({
      name: x.label,
      value: round(series.reduce((sum, serie) => sum + (cells.get(`${x.key}|${serie.key}`) ?? 0), 0)),
      color: x.color ?? PALETTE[index % PALETTE.length],
    }))
    .filter((slice) => slice.value !== 0);
  return {
    rows,
    series: colored,
    slices,
    taskCount: counted,
    empty: counted === 0,
  };
}

/**
 * Scale and anchor of a calendar period (a rolling period counts as the current year).
 * @param {ChartConfig['period']} period Period.
 * @returns {{ scale: CalendarScale, anchor: string }} Scale and "0", "-1" or the first day chosen.
 */
export function calendarParts(period: ChartConfig['period']): { scale: CalendarScale; anchor: string } {
  const match = CALENDAR_PERIOD.exec(period);
  return match ? { scale: match[1] as CalendarScale, anchor: match[2] } : { scale: 'year', anchor: '0' };
}
