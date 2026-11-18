import { useDebouncedValue } from '@mantine/hooks';
import { addDays, isTimeDimension, type ChartConfig } from '@ordo/shared';
import { useMemo } from 'react';
import { localToday } from '../../../lib/dates';
import { useAccountingDocuments, useImportedDocuments } from '../../accounting/api/documents';
import type { Task } from '../../tasks/api';
import { filterUses, matchTasks } from '../../tasks/lib/task-columns';
import { useTaskColumns } from '../../tasks/hooks/use-task-columns';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { useTreasuryAccounts, useTreasuryEntries, useTreasuryProjection, useTreasurySettings } from '../../treasury/api';
import { descendantIds } from '../../workspace/api';
import { DIMENSION_LABELS, measureLabel, periodLabel, periodRange, type ChartData } from './aggregate';
import { useSprintTaskStatuses } from '../api';
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
/** Name of each source of the charts. */
export const SOURCE_LABELS: Record<ChartConfig['source'], string> = {
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
  /** Project of the dashboard (its tree), or null. */
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

  // Tasks: those of the scope (a project tree) each data set keeps, filtered here in the words of the task table.
  const needsDoable = parts.some((part) => part.config.source === 'tasks' && filterUses(part.config.filter, 'doableNow'));
  const columns = useTaskColumns(context, today, { doable: needsDoable });
  const [debouncedParts] = useDebouncedValue(parts, 250);
  const projectsInScope = useMemo(() => (scope.projectId && context ? new Set([scope.projectId, ...descendantIds(context.projects, scope.projectId)]) : null), [scope.projectId, context]);
  const scoped = useMemo(() => (context?.tasks ?? []).filter((task) => !projectsInScope || (task.projectId !== null && projectsInScope.has(task.projectId))), [context, projectsInScope]);
  const matchingData = useMemo(
    () => debouncedParts.map((part) => (part.config.source === 'tasks' && context ? matchTasks(scoped, columns, part.config, today).map((task) => task.id) : undefined)),
    [debouncedParts, scoped, columns, context, today],
  );

  // Charts by sprint: the tasks matching at the end of each ended sprint, with their statuses then.
  const bySprintParts = useMemo(
    () => parts.map((part) => part.config.source === 'tasks' && part.config.type !== 'burndown' && (part.config.dimension === 'sprint' || part.config.series === 'sprint')),
    [parts],
  );
  const sprintAware = bySprintParts.some(Boolean);
  const sprintStatuses = useSprintTaskStatuses(today, sprintAware);
  const sprintMatchingData = useMemo(
    () =>
      debouncedParts.map((part, index) => {
        if (!bySprintParts[index] || !context || !sprintStatuses.data) return undefined;
        const statuses = sprintStatuses.data;
        const matches = new Map<string, Set<string>>();
        for (const sprint of context.sprints.filter((item) => String(item.endDate).slice(0, 10) < today)) {
          // Its tasks, each with the status it had at the end of the sprint.
          const tasks = scoped
            .filter((task) => task.sprintIds.includes(sprint.id))
            .map((task) => {
              const then = statuses.get(`${sprint.id}|${task.id}`);
              return then ? { ...task, statusId: then.statusId, closed: then.closed } : task;
            });
          matches.set(sprint.id, new Set(matchTasks(tasks, columns, part.config, today).map((task) => task.id)));
        }
        return matches;
      }),
    [debouncedParts, bySprintParts, context, sprintStatuses.data, scoped, columns, today],
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

  const projects = projectsInScope;

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
          relations: treasurySettings.data.treasuryRelations,
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

  const pending = (sources.has('tasks') && !context) || (sources.has('documents') && documents.isPending) || (treasury && entries.isPending);
  const error = (sources.has('documents') ? (documents.error ?? imported.error) : null) ?? (treasury ? (entries.error ?? projection.error ?? accounts.error) : null) ?? null;
  return { data, isPending: pending && !data, error };
}
