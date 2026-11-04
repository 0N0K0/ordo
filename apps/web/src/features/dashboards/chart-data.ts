import { useDebouncedValue } from '@mantine/hooks';
import { addDays, isTimeDimension, type ChartConfig, type FilterGroup } from '@ordo/shared';
import { useMemo } from 'react';
import { localToday } from '../../lib/dates';
import { useAccountingDocuments, useImportedDocuments } from '../accounting/documents-api';
import { useMatchingTaskIds, type Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { pruneFilter } from '../tasks/views/filter-meta';
import { useTreasuryAccounts, useTreasuryEntries, useTreasuryProjection } from '../treasury/api';
import { descendantIds } from '../workspace/api';
import { DIMENSION_LABELS, measureLabel, periodRange, type ChartData } from './aggregate';
import { documentChartData, treasuryChartData } from './finance-records';
import { taskChartData } from './task-records';

const PERIOD_LABELS: Record<ChartConfig['period'], string> = {
  'past:28': '4 dernières semaines',
  'past:91': '3 derniers mois',
  'past:182': '6 derniers mois',
  'past:365': '12 derniers mois',
  'past:730': '24 derniers mois',
  'next:91': '3 prochains mois',
  'next:182': '6 prochains mois',
  'next:365': '12 prochains mois',
  all: 'toute la période',
};
const BUCKET_LABELS: Record<ChartConfig['bucket'], string> = {
  day: 'par jour',
  week: 'par semaine',
  month: 'par mois',
  quarter: 'par trimestre',
  year: 'par an',
};
const SOURCE_LABELS: Record<ChartConfig['source'], string> = {
  tasks: 'Tâches',
  documents: 'Facturation',
  treasury: 'Trésorerie',
};

/**
 * What a chart shows, in words (subtitle of the charts and exports).
 * @param {ChartConfig} config Configuration.
 * @param {TaskContext} context Task context.
 * @returns {string} Description.
 */
export function describeChart(config: ChartConfig, context: TaskContext): string {
  if (config.type === 'burndown') {
    const sprint = config.sprintId ? context.sprintById.get(config.sprintId) : undefined;
    return `Burndown ${config.measure === 'effort' ? 'de l’effort' : 'des tâches'}${sprint ? ` — ${sprint.name}` : ''}`;
  }
  const parts = [SOURCE_LABELS[config.source], measureLabel(config.source, config.measure), `par ${DIMENSION_LABELS[config.dimension].toLowerCase()}`];
  if (isTimeDimension(config.dimension)) parts.push(`${BUCKET_LABELS[config.bucket]}, ${PERIOD_LABELS[config.period]}`);
  if (config.series) parts.push(`séries : ${DIMENSION_LABELS[config.series].toLowerCase()}`);
  if (config.cumulative && isTimeDimension(config.dimension)) parts.push('cumulé');
  if (config.source === 'documents' && config.documents.creditNotesNegative && config.measure !== 'count') parts.push('avoirs déduits');
  if (config.source === 'treasury' && config.treasury.includeForecast) parts.push('prévisionnel inclus');
  return parts.join(' · ');
}

/** Scope of a dashboard: every record, or those of a project tree. */
export interface ChartScope {
  /** Task filter of the project tree, or null. */
  baseFilter: FilterGroup | null;
  /** Project of the dashboard, or null. */
  projectId: string | null;
}

/**
 * Data of a chart, from its source: tasks (its filter on top of the dashboard scope), accounting documents
 * or treasury movements (of the project tree for a project dashboard).
 * @param {ChartConfig} config Configuration.
 * @param {ChartScope} scope Scope of the dashboard.
 * @param {TaskContext | null} context Task context.
 * @returns {{ data: ChartData | null, isPending: boolean, error: Error | null }} Data.
 */
export function useChartData(config: ChartConfig, scope: ChartScope, context: TaskContext | null) {
  const today = localToday();
  const source = config.source;

  // Tasks.
  const request = useMemo(() => {
    if (source !== 'tasks') return null;
    const filter = pruneFilter(config.filter);
    return {
      filter: scope.baseFilter
        ? {
            type: 'group' as const,
            id: 'context',
            combinator: 'and' as const,
            children: [scope.baseFilter, filter],
          }
        : filter,
      search: config.search,
      includeArchived: config.includeArchived,
      today,
      utcOffset: -new Date().getTimezoneOffset(),
    };
  }, [source, config.filter, config.search, config.includeArchived, scope.baseFilter, today]);
  const [query] = useDebouncedValue(request, 250);
  const matching = useMatchingTaskIds(query);

  // Documents.
  const documents = useAccountingDocuments({}, source === 'documents');
  const imported = useImportedDocuments({}, source === 'documents' && config.documents.includeImported);

  // Treasury: actual entries of the period, the projection for the balance and the expected movements.
  const [from, to] = periodRange(config.period, today);
  const range = {
    from: from ?? '2000-01-01',
    to: to ? addDays(to, -1) : addDays(today, 365),
  };
  const forecast = config.treasury.includeForecast;
  const treasury = source === 'treasury';
  const entries = useTreasuryEntries({ ...range, accountId: null }, treasury);
  const projection = useTreasuryProjection(
    {
      today,
      from: range.from,
      until: forecast ? (range.to > today ? range.to : today) : today,
    },
    treasury && (forecast || config.measure === 'balance'),
  );
  const accounts = useTreasuryAccounts(treasury);

  const projects = useMemo(() => (scope.projectId && context ? new Set([scope.projectId, ...descendantIds(context.projects, scope.projectId)]) : null), [scope.projectId, context]);

  const data = useMemo((): ChartData | null => {
    if (!context) return null;
    if (source === 'tasks') {
      if (!matching.data) return null;
      const tasks = matching.data.map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined);
      return taskChartData(tasks, config, context, today);
    }
    if (source === 'documents') {
      if (!documents.data || (config.documents.includeImported && !imported.data)) return null;
      return documentChartData(documents.data, imported.data ?? [], config, context, projects, today);
    }
    const needsProjection = forecast || config.measure === 'balance';
    if (!entries.data || !accounts.data || (needsProjection && !projection.data)) return null;
    return treasuryChartData({
      entries: entries.data,
      projection: projection.data ?? null,
      accounts: accounts.data,
      config,
      context,
      projects,
      today,
    });
  }, [context, source, matching.data, documents.data, imported.data, entries.data, projection.data, accounts.data, forecast, config, projects, today]);

  const pending = source === 'tasks' ? matching.isPending : source === 'documents' ? documents.isPending : entries.isPending;
  const error = (source === 'tasks' ? matching.error : source === 'documents' ? (documents.error ?? imported.error) : (entries.error ?? projection.error ?? accounts.error)) ?? null;
  return { data, isPending: pending && !data, error };
}
