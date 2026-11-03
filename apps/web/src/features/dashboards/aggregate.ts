import { addDays, filterPeriod, isTimeDimension, type ChartBucket, type ChartConfig, type ChartDimension, type ChartGroupDimension, type ChartMeasure } from '@ordo/shared';
import type { Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';

/** Labels of the dimensions, measures and buckets, shared by the editor and the charts. */
export const DIMENSION_LABELS: Record<ChartDimension, string> = {
  createdAt: 'Date de création',
  closedAt: 'Date de fermeture',
  startDate: 'Date de début',
  endDate: 'Date de fin',
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
};
export const MEASURE_LABELS: Record<ChartMeasure, string> = { count: 'Nombre de tâches', effort: 'Effort', trackedTime: 'Temps passé (h)' };
const SERIES_NAMES: Record<ChartMeasure, string> = { count: 'Tâches', effort: 'Effort', trackedTime: 'Heures' };
const CATEGORY_LABELS: Record<string, string> = { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Terminée', CANCELLED: 'Annulée' };
const PALETTE = ['blue.6', 'teal.6', 'orange.6', 'grape.6', 'red.6', 'cyan.6', 'lime.6', 'indigo.6', 'pink.6', 'yellow.6'];

export interface ChartSeries {
  name: string;
  color: string;
  strokeDasharray?: string;
}

export interface ChartData {
  /** One row per value of the axis: `x` and one number per series. */
  rows: Record<string, string | number | null>[];
  series: ChartSeries[];
  /** Donut slices. */
  slices: { name: string; value: number; color: string }[];
  /** Tasks counted. */
  taskCount: number;
  /** Nothing to draw. */
  empty: boolean;
}

interface Key {
  key: string;
  label: string;
  /** Sort order. */
  order: string | number;
  color?: string;
}

const NONE_ORDER = '￿';
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
const dayLabel = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/**
 * Local day of an instant (YYYY-MM-DD).
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
function localDay(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * Bucket of a day: the day, the Monday of its week, or the first of its month.
 * @param {string} day YYYY-MM-DD.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} First day of the bucket.
 */
function bucketOf(day: string, bucket: ChartBucket): string {
  if (bucket === 'day') return day;
  if (bucket === 'month') return `${day.slice(0, 7)}-01`;
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/**
 * Next bucket.
 * @param {string} start First day of a bucket.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} First day of the next one.
 */
function nextBucket(start: string, bucket: ChartBucket): string {
  if (bucket === 'day') return addDays(start, 1);
  if (bucket === 'week') return addDays(start, 7);
  const date = new Date(`${start}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/**
 * Label of a bucket.
 * @param {string} start First day of the bucket.
 * @param {ChartBucket} bucket Bucket.
 * @returns {string} "3 nov.", "sem. 3 nov.", "nov. 2026".
 */
function bucketLabel(start: string, bucket: ChartBucket): string {
  const date = new Date(`${start}T00:00:00Z`);
  if (bucket === 'month') return monthLabel.format(date);
  return bucket === 'week' ? `sem. ${dayLabel.format(date)}` : dayLabel.format(date);
}

/**
 * Day of a task for a date dimension, or null when the task has none.
 * @param {Task} task Task.
 * @param {ChartDimension} dimension Date dimension.
 * @returns {string | null} YYYY-MM-DD.
 */
function taskDay(task: Task, dimension: ChartDimension): string | null {
  switch (dimension) {
    case 'createdAt':
      return localDay(task.createdAt);
    case 'closedAt':
      return task.closedAt ? localDay(String(task.closedAt)) : null;
    case 'startDate':
      return task.startDate ? String(task.startDate) : null;
    case 'endDate':
      return task.endDate ? String(task.endDate) : null;
    default:
      return null;
  }
}

/**
 * Values of a field for a task (several for assignees; "none" when empty).
 * @param {Task} task Task.
 * @param {ChartGroupDimension} dimension Field.
 * @param {TaskContext} context Task context.
 * @returns {Key[]} Values.
 */
function groupKeys(task: Task, dimension: ChartGroupDimension, context: TaskContext): Key[] {
  const none = (label: string): Key[] => [{ key: 'none', label, order: NONE_ORDER, color: 'gray.5' }];
  switch (dimension) {
    case 'sprint': {
      const sprint = task.sprintId ? context.sprintById.get(task.sprintId) : undefined;
      if (!sprint) return none('Sans sprint');
      const shared = context.sprints.some((other) => other.name === sprint.name && other.projectId !== sprint.projectId);
      return [{ key: sprint.id, label: shared ? `${sprint.name} — ${context.projectById.get(sprint.projectId)?.title ?? ''}` : sprint.name, order: `${sprint.startDate} ${sprint.name}` }];
    }
    case 'milestone': {
      const milestone = task.milestoneId ? context.milestoneById.get(task.milestoneId) : undefined;
      if (!milestone) return none('Sans jalon');
      const shared = context.milestones.some((other) => other.title === milestone.title && other.projectId !== milestone.projectId);
      const label = shared ? `${milestone.title} — ${context.projectById.get(milestone.projectId)?.title ?? ''}` : milestone.title;
      return [{ key: milestone.id, label, order: `${milestone.dueDate ?? '9999'} ${milestone.title}` }];
    }
    case 'project':
      return [{ key: task.projectId, label: context.projectById.get(task.projectId)?.title ?? '', order: context.projectLabel(task.projectId) }];
    case 'status':
    case 'priority':
    case 'type': {
      const id = { status: task.statusId, priority: task.priorityId, type: task.typeId }[dimension];
      const label = id ? { status: context.statusById, priority: context.priorityById, type: context.typeById }[dimension].get(id) : undefined;
      if (!label) return none({ status: 'Sans statut', priority: 'Sans priorité', type: 'Sans type' }[dimension]);
      return [{ key: label.id, label: label.name, order: label.position, color: label.color ?? undefined }];
    }
    case 'statusCategory': {
      const category = task.statusId ? context.statusById.get(task.statusId)?.category : undefined;
      if (!category) return none('Sans statut');
      return [{ key: category, label: CATEGORY_LABELS[category] ?? category, order: Object.keys(CATEGORY_LABELS).indexOf(category) }];
    }
    case 'assignees': {
      const people = task.assigneeIds.map((id) => context.contributorById.get(id)).filter((contributor) => contributor !== undefined);
      return people.length ? people.map((person) => ({ key: person.id, label: person.name, order: person.name })) : none('Non assignées');
    }
    case 'tags': {
      const tags = task.tagIds.map((id) => context.tagById.get(id)).filter((tag) => tag !== undefined);
      return tags.length ? tags.map((tag) => ({ key: tag.id, label: tag.name, order: tag.position, color: tag.color })) : none('Sans étiquette');
    }
    case 'state':
      return context.isClosed(task)
        ? [{ key: 'closed', label: 'Fermées', order: 1, color: 'violet.6' }]
        : [{ key: 'open', label: 'Ouvertes', order: 0, color: 'green.6' }];
  }
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
 * Value a task adds: 1, its effort (tasks without sub-tasks: a parent's effort is its sub-tasks'), or its
 * tracked hours.
 * @param {Task} task Task.
 * @param {ChartMeasure} measure Measure.
 * @param {TaskContext} context Task context.
 * @returns {number} Value.
 */
function valueOf(task: Task, measure: ChartMeasure, context: TaskContext): number {
  if (measure === 'count') return 1;
  if (measure === 'effort') return context.childrenOf(task.id).length === 0 ? (task.effort ?? 0) : 0;
  return task.trackedSeconds / 3600;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Burndown of a sprint: what is left (tasks or effort) at the end of each day of the sprint, against the
 * ideal straight line. Tasks closed after the sprint count as still open on its days.
 * @param {Task[]} tasks Matching tasks.
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day.
 * @returns {ChartData} Data.
 */
function burndown(tasks: Task[], config: ChartConfig, context: TaskContext, today: string): ChartData {
  const sprint = config.sprintId ? context.sprintById.get(config.sprintId) : undefined;
  const empty: ChartData = { rows: [], series: [], slices: [], taskCount: 0, empty: true };
  if (!sprint) return empty;
  const measure = config.measure === 'trackedTime' ? 'count' : config.measure;
  const inSprint = tasks.filter((task) => task.sprintId === sprint.id);
  const total = inSprint.reduce((sum, task) => sum + valueOf(task, measure, context), 0);
  const days: string[] = [];
  for (let day = String(sprint.startDate); day <= String(sprint.endDate); day = addDays(day, 1)) days.push(day);
  const rows = days.map((day, index) => ({
    x: dayLabel.format(new Date(`${day}T00:00:00Z`)),
    Restant:
      day > today
        ? null
        : round(inSprint.filter((task) => !task.closedAt || localDay(String(task.closedAt)) > day).reduce((sum, task) => sum + valueOf(task, measure, context), 0)),
    Idéal: round(days.length > 1 ? total * (1 - index / (days.length - 1)) : 0),
  }));
  return {
    rows,
    series: [
      { name: 'Restant', color: 'blue.6' },
      { name: 'Idéal', color: 'gray.5', strokeDasharray: '5 5' },
    ],
    slices: [],
    taskCount: inSprint.length,
    empty: inSprint.length === 0,
  };
}

/**
 * Data of a chart: the matching tasks spread over the axis (dates by day, week or month over the period, or
 * values of a field) and the series, measured in number, effort or tracked time, optionally cumulated; a
 * task with several assignees counts for each. Burndowns follow a sprint day by day.
 * @param {Task[]} tasks Matching tasks.
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @param {string} today User's day (YYYY-MM-DD).
 * @returns {ChartData} Data.
 */
export function chartData(tasks: Task[], config: ChartConfig, context: TaskContext, today: string): ChartData {
  if (config.type === 'burndown') return burndown(tasks, config, context, today);

  const time = isTimeDimension(config.dimension);
  const [from, to] = time && config.period !== 'all' ? filterPeriod(config.period, today) : [null, null];
  const axis = new Map<string, Key>();
  const seriesKeys = new Map<string, Key>();
  const cells = new Map<string, number>();
  let counted = 0;

  for (const task of tasks) {
    let xs: Key[];
    if (time) {
      const day = taskDay(task, config.dimension);
      if (!day || (from && day < from) || (to && day >= to)) continue;
      const start = bucketOf(day, config.bucket);
      xs = [{ key: start, label: bucketLabel(start, config.bucket), order: start }];
    } else {
      xs = groupKeys(task, config.dimension as ChartGroupDimension, context);
    }
    const series = config.series ? groupKeys(task, config.series, context) : [{ key: 'all', label: SERIES_NAMES[config.measure], order: 0 }];
    const value = valueOf(task, config.measure, context);
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
      if (!axis.has(start)) axis.set(start, { key: start, label: bucketLabel(start, config.bucket), order: start });
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
  const colored = series.map((serie, index) => ({ name: serie.label, color: serie.color ?? PALETTE[index % PALETTE.length] }));
  const slices = xs
    .map((x, index) => ({
      name: x.label,
      value: round(series.reduce((sum, serie) => sum + (cells.get(`${x.key}|${serie.key}`) ?? 0), 0)),
      color: x.color ?? PALETTE[index % PALETTE.length],
    }))
    .filter((slice) => slice.value > 0);
  return { rows, series: colored, slices, taskCount: counted, empty: counted === 0 };
}
