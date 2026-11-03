import { useDebouncedValue } from '@mantine/hooks';
import { isTimeDimension, type ChartConfig, type FilterGroup } from '@ordo/shared';
import { useMemo } from 'react';
import { localToday } from '../../lib/dates';
import { useMatchingTaskIds, type Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { pruneFilter } from '../tasks/views/filter-meta';
import { chartData, DIMENSION_LABELS, MEASURE_LABELS } from './aggregate';

const PERIOD_LABELS: Record<ChartConfig['period'], string> = {
  'past:28': '4 dernières semaines',
  'past:91': '3 derniers mois',
  'past:182': '6 derniers mois',
  'past:365': '12 derniers mois',
  all: 'toute la période',
};
const BUCKET_LABELS: Record<ChartConfig['bucket'], string> = { day: 'par jour', week: 'par semaine', month: 'par mois' };

/**
 * What a chart shows, in words (subtitle of exports).
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @returns {string} Description.
 */
export function describeChart(config: ChartConfig, context: TaskContext): string {
  if (config.type === 'burndown') {
    const sprint = config.sprintId ? context.sprintById.get(config.sprintId) : undefined;
    return `Burndown ${config.measure === 'effort' ? 'de l’effort' : 'des tâches'}${sprint ? ` — ${sprint.name}` : ''}`;
  }
  const parts = [MEASURE_LABELS[config.measure], `par ${DIMENSION_LABELS[config.dimension].toLowerCase()}`];
  if (isTimeDimension(config.dimension)) parts.push(`${BUCKET_LABELS[config.bucket]}, ${PERIOD_LABELS[config.period]}`);
  if (config.series) parts.push(`séries : ${DIMENSION_LABELS[config.series].toLowerCase()}`);
  if (config.cumulative && isTimeDimension(config.dimension)) parts.push('cumulé');
  return parts.join(' · ');
}

/**
 * Tasks of a chart (its filter on top of the dashboard scope) and its data.
 * @param {ChartConfig} config Configuration.
 * @param {FilterGroup | null} baseFilter Scope of the dashboard (project tree), or null.
 * @param {TaskContext | null} context Task context.
 * @returns {{ data: ChartData | null, isPending: boolean, error: Error | null }} Data.
 */
export function useChartData(config: ChartConfig, baseFilter: FilterGroup | null, context: TaskContext | null) {
  const today = localToday();
  const request = useMemo(() => {
    const filter = pruneFilter(config.filter);
    return {
      filter: baseFilter ? { type: 'group' as const, id: 'context', combinator: 'and' as const, children: [baseFilter, filter] } : filter,
      search: config.search,
      includeArchived: config.includeArchived,
      today,
      utcOffset: -new Date().getTimezoneOffset(),
    };
  }, [config.filter, config.search, config.includeArchived, baseFilter, today]);
  const [query] = useDebouncedValue(request, 250);
  const matching = useMatchingTaskIds(query);
  const data = useMemo(() => {
    if (!context || !matching.data) return null;
    const tasks = matching.data.map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined);
    return chartData(tasks, config, context, today);
  }, [context, matching.data, config, today]);
  return { data, isPending: matching.isPending, error: matching.error };
}
