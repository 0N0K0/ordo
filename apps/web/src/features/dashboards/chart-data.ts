import { useDebouncedValue } from '@mantine/hooks';
import { useQueries } from '@tanstack/react-query';
import { addDays, isTimeDimension, type ChartConfig, type FilterGroup } from '@ordo/shared';
import { useMemo } from 'react';
import { localToday } from '../../lib/dates';
import { useAccountingDocuments, useImportedDocuments } from '../accounting/documents-api';
import { matchingTaskIdsBySprintQuery, matchingTaskIdsQuery, type Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';
import { pruneFilter } from '../tasks/views/filter-meta';
import { useTreasuryAccounts, useTreasuryEntries, useTreasuryProjection, useTreasurySettings } from '../treasury/api';
import { descendantIds } from '../workspace/api';
import { DIMENSION_LABELS, measureLabel, periodLabel, periodRange, type ChartData } from './aggregate';
import { useSprintTaskStatuses } from './api';
import { datasetParts, mergeDatasets } from './datasets';
import { documentChartData, treasuryChartData } from './finance-records';
import { taskChartData, type SprintView } from './task-records';

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
  if (isTimeDimension(config.dimension)) parts.push(`${BUCKET_LABELS[config.bucket]}, ${periodLabel(config.period).toLowerCase()}`);
  if (config.series) parts.push(`séries : ${DIMENSION_LABELS[config.series].toLowerCase()}`);
  if (config.cumulative && isTimeDimension(config.dimension)) parts.push('cumulé');
  if (config.source === 'documents' && config.documents.creditNotesNegative && config.measure !== 'count') parts.push('avoirs déduits');
  if (config.source === 'treasury' && config.treasury.includeForecast) parts.push('prévisionnel inclus');
  if (config.datasets.length) parts.push(`${config.datasets.length + 1} jeux de données`);
  if (config.comparisons.length) parts.push(config.comparisons.map((comparison) => comparison.name).join(', '));
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
 * Data of a chart: each of its data sets from its source (tasks: its filter on top of the dashboard scope;
 * accounting documents or treasury movements: of the project tree for a project dashboard), joined on the
 * axis with their comparisons when there are several.
 * @param {ChartConfig} config Configuration.
 * @param {ChartScope} scope Scope of the dashboard.
 * @param {TaskContext | null} context Task context.
 * @returns {{ data: ChartData | null, isPending: boolean, error: Error | null }} Data.
 */
export function useChartData(config: ChartConfig, scope: ChartScope, context: TaskContext | null) {
  const today = localToday();
  const parts = useMemo(() => datasetParts(config), [config]);
  const sources = new Set(parts.map((part) => part.config.source));

  // Tasks: one query per data set of tasks.
  const requests = useMemo(
    () =>
      parts.map((part) => {
        if (part.config.source !== 'tasks') return null;
        const filter = pruneFilter(part.config.filter);
        return {
          filter: scope.baseFilter ? { type: 'group' as const, id: 'context', combinator: 'and' as const, children: [scope.baseFilter, filter] } : filter,
          search: part.config.search,
          includeArchived: part.config.includeArchived,
          today,
          utcOffset: -new Date().getTimezoneOffset(),
        };
      }),
    [parts, scope.baseFilter, today],
  );
  const [queries] = useDebouncedValue(requests, 250);
  const matching = useQueries({ queries: queries.map((query) => ({ ...matchingTaskIdsQuery(query), placeholderData: (previous: string[] | undefined) => previous })) });

  // Charts by sprint: the tasks matching at the end of each ended sprint, and their statuses then.
  const bySprintParts = useMemo(
    () => parts.map((part) => part.config.source === 'tasks' && part.config.type !== 'burndown' && (part.config.dimension === 'sprint' || part.config.series === 'sprint')),
    [parts],
  );
  const sprintAware = bySprintParts.some(Boolean);
  const sprintStatuses = useSprintTaskStatuses(today, sprintAware);
  const sprintMatching = useQueries({
    queries: queries.map((query, index) => ({ ...matchingTaskIdsBySprintQuery(bySprintParts[index] ? query : null), placeholderData: (previous: Map<string, Set<string>> | undefined) => previous })),
  });
  const sprintMatchingStamp = sprintMatching.map((query) => query.dataUpdatedAt).join();
  const sprintMatchingData = useMemo(
    () => sprintMatching.map((query) => query.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sprintMatchingStamp, sprintMatching.length],
  );

  // Documents.
  const documents = useAccountingDocuments({}, sources.has('documents'));
  const imported = useImportedDocuments(
    {},
    parts.some((part) => part.config.source === 'documents' && part.config.documents.includeImported),
  );

  // Treasury: actual entries of the period, the projection for the balance and the expected movements.
  const [from, to] = periodRange(config.period, today);
  const range = {
    from: from ?? '2000-01-01',
    to: to ? addDays(to, -1) : addDays(today, 365),
  };
  const treasuryParts = parts.filter((part) => part.config.source === 'treasury');
  const forecast = treasuryParts.some((part) => part.config.treasury.includeForecast);
  const needsProjection = forecast || treasuryParts.some((part) => part.config.measure === 'balance');
  const treasury = treasuryParts.length > 0;
  const entries = useTreasuryEntries({ ...range, accountId: null }, treasury);
  const projection = useTreasuryProjection(
    {
      today,
      from: range.from,
      until: forecast ? (range.to > today ? range.to : today) : today,
    },
    treasury && needsProjection,
  );
  const accounts = useTreasuryAccounts(treasury);
  const treasurySettings = useTreasurySettings();

  const projects = useMemo(() => (scope.projectId && context ? new Set([scope.projectId, ...descendantIds(context.projects, scope.projectId)]) : null), [scope.projectId, context]);
  // The task queries are followed by their update times (their array is new on each render).
  const matchingStamp = matching.map((query) => query.dataUpdatedAt).join();
  const matchingData = useMemo(
    () => matching.map((query) => query.data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchingStamp, matching.length],
  );

  const data = useMemo((): ChartData | null => {
    if (!context) return null;
    const results: { part: (typeof parts)[number]; data: ChartData }[] = [];
    for (const [index, part] of parts.entries()) {
      const partConfig = part.config;
      let partData: ChartData;
      if (partConfig.source === 'tasks') {
        const ids = matchingData[index];
        if (!ids) return null;
        const tasks = ids.map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined);
        let bySprint: SprintView | undefined;
        if (bySprintParts[index]) {
          const matches = sprintMatchingData[index];
          if (!matches || !sprintStatuses.data) return null;
          const current = new Set(ids);
          const extraIds = new Set([...matches.values()].flatMap((set) => [...set]).filter((id) => !current.has(id)));
          bySprint = {
            current,
            matches,
            statuses: sprintStatuses.data,
            extraTasks: [...extraIds].map((id) => context.taskById.get(id)).filter((task): task is Task => task !== undefined),
          };
        }
        partData = taskChartData(tasks, partConfig, context, today, bySprint);
      } else if (partConfig.source === 'documents') {
        if (!documents.data || (partConfig.documents.includeImported && !imported.data)) return null;
        partData = documentChartData(documents.data, imported.data ?? [], partConfig, context, projects, today);
      } else {
        if (!entries.data || !accounts.data || !treasurySettings.data || (needsProjection && !projection.data)) return null;
        partData = treasuryChartData({
          entries: entries.data,
          categories: treasurySettings.data.treasuryCategories,
          members: treasurySettings.data.treasuryMembers,
          contexts: treasurySettings.data.treasuryContexts,
          periods: treasurySettings.data.treasuryContextPeriods,
          projection: projection.data ?? null,
          accounts: accounts.data,
          config: partConfig,
          context,
          projects,
          today,
        });
      }
      results.push({ part, data: partData });
    }
    if (results.length === 1 && config.comparisons.length === 0) return results[0].data;
    return mergeDatasets(results, config);
  }, [
    context,
    parts,
    matchingData,
    bySprintParts,
    sprintMatchingData,
    sprintStatuses.data,
    documents.data,
    imported.data,
    entries.data,
    projection.data,
    accounts.data,
    treasurySettings.data,
    needsProjection,
    config,
    projects,
    today,
  ]);

  const pending =
    (sources.has('tasks') && matching.some((query, index) => queries[index] !== null && query.isPending)) || (sources.has('documents') && documents.isPending) || (treasury && entries.isPending);
  const error =
    matching.find((query) => query.error)?.error ??
    (sources.has('documents') ? (documents.error ?? imported.error) : null) ??
    (treasury ? (entries.error ?? projection.error ?? accounts.error) : null) ??
    null;
  return { data, isPending: pending && !data, error };
}
