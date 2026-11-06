import { Alert, Button, Divider, Grid, Group, Paper, Select, SegmentedControl, SimpleGrid, Skeleton, Stack, Switch, Text, TextInput } from '@mantine/core';
import {
  CHART_BUCKETS,
  CHART_PERIODS,
  chartConfigSchema,
  chartTitleSchema,
  defaultChartConfig,
  isTimeDimension,
  SOURCE_GROUP_DIMENSIONS,
  SOURCE_MEASURES,
  SOURCE_TIME_DIMENSIONS,
  type ChartConfig,
  type ChartDimension,
  type ChartSource,
} from '@ordo/shared';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import type { TaskContext } from '../tasks/use-task-context';
import { FilterBuilder } from '../tasks/views/FilterBuilder';
import { countLabel, DIMENSION_LABELS, measureLabel, NEW_CHART_TITLES } from './aggregate';
import { useDashboardMutations, type DashboardChart } from './api';
import { useChartData, type ChartScope } from './chart-data';
import { ChartView } from './ChartView';
import { DatasetsEditor } from './DatasetsEditor';
import { DocumentFilters, TreasuryFilters } from './source-filters';

const TYPE_LABELS: Record<ChartConfig['type'], string> = {
  bar: 'Barres',
  stackedBar: 'Barres empilées',
  line: 'Courbes',
  area: 'Aires',
  donut: 'Anneau',
  burndown: 'Burndown de sprint',
};
const BUCKET_LABELS: Record<ChartConfig['bucket'], string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
  quarter: 'Trimestre',
  year: 'Année',
};
const PERIOD_LABELS: Record<ChartConfig['period'], string> = {
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

interface ChartEditorProps {
  dashboardId: string;
  chart?: DashboardChart;
  initial: { title: string; config: ChartConfig; wide: boolean };
  /** Scope of the dashboard. */
  scope: ChartScope;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Chart editor: source (tasks, invoicing, treasury), title, kind, axis (a date by day, week, month, quarter or
 * year over a period, or a field), measure, series, running total, sprint of a burndown, width, filters of the
 * records counted, other data sets and their comparisons (percent or difference); with a live preview.
 * @param {ChartEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function ChartEditor({ dashboardId, chart, initial, scope, context, onDone }: ChartEditorProps) {
  const [title, setTitle] = useState(initial.title);
  const [wide, setWide] = useState(initial.wide);
  const [config, setConfig] = useState<ChartConfig>(initial.config);
  const [titleError, setTitleError] = useState<string | null>(null);
  const { createChart, updateChart } = useDashboardMutations();
  const { data, isPending } = useChartData(config, scope, context);
  const change = (changes: Partial<ChartConfig>) => setConfig((current) => ({ ...current, ...changes }));
  const source = config.source;
  const burndown = config.type === 'burndown';
  const time = isTimeDimension(config.dimension);
  const validation = chartConfigSchema.safeParse(config);
  const sprints = scope.projectId ? context.sprintsFor(scope.projectId) : context.sprints;

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
    {
      group: 'Dates',
      items: SOURCE_TIME_DIMENSIONS[source].map((value) => ({
        value,
        label: DIMENSION_LABELS[value],
      })),
    },
    {
      group: 'Champs',
      items: SOURCE_GROUP_DIMENSIONS[source].map((value) => ({
        value,
        label: DIMENSION_LABELS[value],
      })),
    },
  ];
  const several = config.datasets.length > 0 || config.comparisons.length > 0;
  const typeData = Object.entries(TYPE_LABELS)
    .filter(([value]) => value !== 'burndown' || source === 'tasks')
    // Several data sets: bars, lines or areas.
    .filter(([value]) => !several || (value !== 'donut' && value !== 'burndown'))
    .map(([value, label]) => ({ value, label }));

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Stack gap="sm">
          <SegmentedControl
            fullWidth
            data={[
              { value: 'tasks', label: 'Tâches' },
              { value: 'documents', label: 'Facturation' },
              { value: 'treasury', label: 'Trésorerie' },
            ]}
            value={source}
            // Another source starts from its own defaults (axes and measures differ).
            onChange={(value) => {
              const next = defaultChartConfig(value as ChartSource);
              // The default title follows the source until it is changed.
              if (title === NEW_CHART_TITLES[source]) setTitle(NEW_CHART_TITLES[value as ChartSource]);
              setConfig({
                ...next,
                type: config.type === 'burndown' ? next.type : config.type,
              });
            }}
          />
          <TextInput label="Titre" required data-autofocus value={title} error={titleError} onChange={(event) => setTitle(event.currentTarget.value)} />
          <Select
            label="Type"
            allowDeselect={false}
            data={typeData}
            value={config.type}
            onChange={(type) => {
              if (!type) return;
              const next = type as ChartConfig['type'];
              change({
                type: next,
                // A donut has no series; a burndown follows a sprint by number or effort.
                ...(next === 'donut' && { series: null, cumulative: false }),
                ...(next === 'burndown' && {
                  measure: config.measure === 'effort' ? 'effort' : 'count',
                  sprintId: config.sprintId ?? sprints[sprints.length - 1]?.id ?? null,
                }),
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
                data={sprints.map((sprint) => ({
                  value: sprint.id,
                  label: `${sprint.name} — ${context.projectById.get(sprint.projectId)?.title ?? ''}`,
                }))}
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
                  onChange={(dimension) =>
                    dimension &&
                    change({
                      dimension: dimension as ChartDimension,
                      ...(config.series === dimension && { series: null }),
                    })
                  }
                />
                <Select
                  label="Mesure"
                  allowDeselect={false}
                  data={SOURCE_MEASURES[source].map((value) => ({
                    value,
                    label: measureLabel(source, value),
                  }))}
                  value={config.measure}
                  onChange={(measure) => measure && change({ measure: measure as ChartConfig['measure'] })}
                />
              </SimpleGrid>
              {time && (
                <SimpleGrid cols={2} spacing="sm">
                  <Select
                    label="Regrouper par"
                    allowDeselect={false}
                    data={CHART_BUCKETS.map((value) => ({
                      value,
                      label: BUCKET_LABELS[value],
                    }))}
                    value={config.bucket}
                    onChange={(bucket) => bucket && change({ bucket: bucket as ChartConfig['bucket'] })}
                  />
                  <Select
                    label="Période"
                    allowDeselect={false}
                    data={CHART_PERIODS.map((value) => ({
                      value,
                      label: PERIOD_LABELS[value],
                    }))}
                    value={config.period}
                    onChange={(period) => period && change({ period: period as ChartConfig['period'] })}
                  />
                </SimpleGrid>
              )}
              {config.type !== 'donut' && !several && !(source === 'treasury' && config.measure === 'balance') && (
                <Select
                  label="Séries"
                  placeholder="Aucune (une seule série)"
                  clearable
                  data={SOURCE_GROUP_DIMENSIONS[source]
                    .filter((value) => value !== config.dimension)
                    .map((value) => ({
                      value,
                      label: DIMENSION_LABELS[value],
                    }))}
                  value={config.series}
                  onChange={(series) =>
                    change({
                      series: (series as ChartConfig['series']) ?? null,
                    })
                  }
                />
              )}
              {time && config.type !== 'donut' && !(source === 'treasury' && config.measure === 'balance') && (
                <Switch label="Cumulé (total depuis le début de la période)" checked={config.cumulative} onChange={(event) => change({ cumulative: event.currentTarget.checked })} />
              )}
            </>
          )}
          <Switch label="Pleine largeur" checked={wide} onChange={(event) => setWide(event.currentTarget.checked)} />

          <Divider
            label={`${several ? 'Jeu principal — ' : ''}${source === 'tasks' ? 'tâches comptées' : source === 'documents' ? 'documents comptés' : 'mouvements comptés'}`.replace(/^./, (letter) => letter.toUpperCase())}
            labelPosition="left"
          />
          {source === 'tasks' && (
            <>
              <TextInput placeholder="Recherche (titre, description)" value={config.search} onChange={(event) => change({ search: event.currentTarget.value })} />
              <FilterBuilder filter={config.filter} context={context} onChange={(filter) => change({ filter })} />
              <Switch label="Inclure les tâches archivées" checked={config.includeArchived} onChange={(event) => change({ includeArchived: event.currentTarget.checked })} />
            </>
          )}
          {source === 'documents' && <DocumentFilters config={config} change={change} />}
          {source === 'treasury' && <TreasuryFilters config={config} change={change} />}
          {scope.projectId && source !== 'tasks' && (
            <Text size="xs" c="dimmed">
              Tableau de bord d’un projet : seuls les {source === 'documents' ? 'documents' : 'mouvements'} rattachés au projet ou à ses sous-projets comptent
              {source === 'treasury' && ' (le solde reste celui de tous les comptes)'}.
            </Text>
          )}
          {!burndown && config.type !== 'donut' && !(source === 'treasury' && config.measure === 'balance') && (
            <>
              <Divider label="Jeux de données et comparaisons" labelPosition="left" />
              <DatasetsEditor config={config} change={change} context={context} />
            </>
          )}
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
              {countLabel(config, data.taskCount)} compté
              {data.taskCount > 1 ? 's' : ''}
              {source === 'tasks' && config.measure === 'effort' && ' · l’effort d’une tâche parente est celui de ses sous-tâches'}
              {source === 'tasks' && (config.dimension === 'assignees' || config.series === 'assignees') ? ' · une tâche à plusieurs assignés compte pour chacun' : ''}
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
