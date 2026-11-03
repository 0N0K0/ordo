import { Alert, Button, Divider, Grid, Group, Paper, Select, SegmentedControl, SimpleGrid, Skeleton, Stack, Switch, Text, TextInput } from '@mantine/core';
import {
  CHART_BUCKETS,
  CHART_GROUP_DIMENSIONS,
  CHART_PERIODS,
  CHART_TIME_DIMENSIONS,
  chartConfigSchema,
  chartTitleSchema,
  isTimeDimension,
  type ChartConfig,
  type ChartDimension,
  type FilterGroup,
} from '@ordo/shared';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { TaskContext } from '../tasks/use-task-context';
import { FilterBuilder } from '../tasks/views/FilterBuilder';
import { DIMENSION_LABELS, MEASURE_LABELS } from './aggregate';
import { useDashboardMutations, type DashboardChart } from './api';
import { useChartData } from './chart-data';
import { ChartView } from './ChartView';

const TYPE_LABELS: Record<ChartConfig['type'], string> = {
  bar: 'Barres',
  stackedBar: 'Barres empilées',
  line: 'Courbes',
  area: 'Aires',
  donut: 'Anneau',
  burndown: 'Burndown de sprint',
};
const BUCKET_LABELS: Record<ChartConfig['bucket'], string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };
const PERIOD_LABELS: Record<ChartConfig['period'], string> = {
  'past:28': '4 dernières semaines',
  'past:91': '3 derniers mois',
  'past:182': '6 derniers mois',
  'past:365': '12 derniers mois',
  all: 'Toute la période',
};

interface ChartEditorProps {
  dashboardId: string;
  chart?: DashboardChart;
  initial: { title: string; config: ChartConfig; wide: boolean };
  /** Scope of the dashboard (project tree), or null. */
  baseFilter: FilterGroup | null;
  /** Project of the dashboard: its sprints are offered first. */
  projectId: string | null;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Chart editor: title, kind, axis (a date by day, week or month over a period, or a field), measure, series,
 * running total, sprint of a burndown, width, filters of the tasks counted; with a live preview.
 * @param {ChartEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function ChartEditor({ dashboardId, chart, initial, baseFilter, projectId, context, onDone }: ChartEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [wide, setWide] = useState(initial.wide);
  const [config, setConfig] = useState<ChartConfig>(initial.config);
  const [titleError, setTitleError] = useState<string | null>(null);
  const { createChart, updateChart } = useDashboardMutations();
  const { data, isPending } = useChartData(config, baseFilter, context);
  const change = (changes: Partial<ChartConfig>) => setConfig((current) => ({ ...current, ...changes }));
  const burndown = config.type === 'burndown';
  const time = isTimeDimension(config.dimension);
  const validation = chartConfigSchema.safeParse(config);
  const sprints = projectId ? context.sprintsFor(projectId) : context.sprints;

  /**
   * Saves the chart.
   * @returns {void}
   */
  const save = () => {
    const titleResult = chartTitleSchema.safeParse(title);
    setTitleError(titleResult.success ? null : (titleResult.error.issues[0]?.message ?? 'Titre invalide.'));
    if (!titleResult.success || !validation.success) return;
    const input = { title: titleResult.data, config: validation.data, wide };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(chart ? 'Diagramme modifié.' : 'Diagramme ajouté.');
        onDone();
      },
      onError: (error: Error) => notifyError(error.message),
    };
    if (chart) updateChart.mutate({ id: chart.id, input }, callbacks);
    else createChart.mutate({ dashboardId, input }, callbacks);
  };

  const dimensionData = [
    { group: 'Dates', items: CHART_TIME_DIMENSIONS.map((value) => ({ value, label: DIMENSION_LABELS[value] })) },
    { group: 'Champs', items: CHART_GROUP_DIMENSIONS.map((value) => ({ value, label: DIMENSION_LABELS[value] })) },
  ];

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="sm">
          <TextInput label="Titre" required data-autofocus value={title} error={titleError} onChange={(event) => setTitle(event.currentTarget.value)} />
          <Select
            label="Type"
            allowDeselect={false}
            data={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            value={config.type}
            onChange={(type) => {
              if (!type) return;
              const next = type as ChartConfig['type'];
              change({
                type: next,
                // A donut has no series; a burndown follows a sprint by number or effort.
                ...(next === 'donut' && { series: null, cumulative: false }),
                ...(next === 'burndown' && { measure: config.measure === 'trackedTime' ? 'count' : config.measure, sprintId: config.sprintId ?? sprints[sprints.length - 1]?.id ?? null }),
              });
            }}
          />
          {burndown ? (
            <>
              <Select
                label="Sprint"
                required
                searchable
                placeholder={sprints.length ? 'Choisissez le sprint' : 'Aucun sprint : créez-en dans l’onglet Sprints d’un projet'}
                data={sprints.map((sprint) => ({ value: sprint.id, label: `${sprint.name} — ${context.projectById.get(sprint.projectId)?.title ?? ''}` }))}
                value={config.sprintId}
                onChange={(sprintId) => change({ sprintId })}
                error={!config.sprintId ? 'Choisissez le sprint.' : undefined}
              />
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Reste à faire
                </Text>
                <SegmentedControl
                  data={[
                    { value: 'count', label: 'Tâches' },
                    { value: 'effort', label: 'Effort' },
                  ]}
                  value={config.measure === 'effort' ? 'effort' : 'count'}
                  onChange={(measure) => change({ measure: measure as ChartConfig['measure'] })}
                />
              </Stack>
            </>
          ) : (
            <>
              <SimpleGrid cols={2} spacing="sm">
                <Select
                  label={config.type === 'donut' ? 'Parts' : 'Axe'}
                  allowDeselect={false}
                  data={dimensionData}
                  value={config.dimension}
                  onChange={(dimension) => dimension && change({ dimension: dimension as ChartDimension, ...(config.series === dimension && { series: null }) })}
                />
                <Select
                  label="Mesure"
                  allowDeselect={false}
                  data={Object.entries(MEASURE_LABELS).map(([value, label]) => ({ value, label }))}
                  value={config.measure}
                  onChange={(measure) => measure && change({ measure: measure as ChartConfig['measure'] })}
                />
              </SimpleGrid>
              {time && (
                <SimpleGrid cols={2} spacing="sm">
                  <Select
                    label="Regrouper par"
                    allowDeselect={false}
                    data={CHART_BUCKETS.map((value) => ({ value, label: BUCKET_LABELS[value] }))}
                    value={config.bucket}
                    onChange={(bucket) => bucket && change({ bucket: bucket as ChartConfig['bucket'] })}
                  />
                  <Select
                    label="Période"
                    allowDeselect={false}
                    data={CHART_PERIODS.map((value) => ({ value, label: PERIOD_LABELS[value] }))}
                    value={config.period}
                    onChange={(period) => period && change({ period: period as ChartConfig['period'] })}
                  />
                </SimpleGrid>
              )}
              {config.type !== 'donut' && (
                <Select
                  label="Séries"
                  placeholder="Aucune (une seule série)"
                  clearable
                  data={CHART_GROUP_DIMENSIONS.filter((value) => value !== config.dimension).map((value) => ({ value, label: DIMENSION_LABELS[value] }))}
                  value={config.series}
                  onChange={(series) => change({ series: (series as ChartConfig['series']) ?? null })}
                />
              )}
              {time && config.type !== 'donut' && (
                <Switch label="Cumulé (total depuis le début de la période)" checked={config.cumulative} onChange={(event) => change({ cumulative: event.currentTarget.checked })} />
              )}
            </>
          )}
          <Switch label="Pleine largeur" checked={wide} onChange={(event) => setWide(event.currentTarget.checked)} />

          <Divider label="Tâches comptées" labelPosition="left" />
          <TextInput placeholder="Recherche (titre, description)" value={config.search} onChange={(event) => change({ search: event.currentTarget.value })} />
          <FilterBuilder filter={config.filter} context={context} onChange={(filter) => change({ filter })} />
          <Switch label="Inclure les tâches archivées" checked={config.includeArchived} onChange={(event) => change({ includeArchived: event.currentTarget.checked })} />
          {!validation.success && (
            <Alert color="red" p="xs">
              {validation.error.issues[0]?.message}
            </Alert>
          )}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="sm" style={{ position: 'sticky', top: 0 }}>
          <Text size="sm" fw={600}>
            Aperçu
          </Text>
          <Paper withBorder radius="md" p="md">
            {isPending || !data ? <Skeleton height={300} /> : <ChartView config={config} data={data} height={300} />}
          </Paper>
          {data && (
            <Text size="xs" c="dimmed">
              {data.taskCount} tâche{data.taskCount > 1 ? 's' : ''} comptée{data.taskCount > 1 ? 's' : ''}
              {config.measure === 'effort' && ' · l’effort d’une tâche parente est celui de ses sous-tâches'}
              {config.dimension === 'assignees' || config.series === 'assignees' ? ' · une tâche à plusieurs assignés compte pour chacun' : ''}
            </Text>
          )}
          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="default" onClick={onDone}>
              Annuler
            </Button>
            <Button onClick={save} loading={createChart.isPending || updateChart.isPending}>
              {chart ? 'Enregistrer' : 'Ajouter le diagramme'}
            </Button>
          </Group>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
