import { plural } from '../../../lib/text';
import { formCallbacks, useAppForm, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import * as fmt from '../../../lib/format';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { unarchived } from '../../../lib/archive';
import { BlockSkeleton } from '../../../components/feedback/Skeletons';
import { Divider, Fieldset, Grid, Paper, Select, SegmentedControl, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import {
  CHART_BUCKETS,
  CHART_PERIODS,
  chartConfigSchema,
  chartFormSchema,
  defaultChartConfig,
  isTimeDimension,
  SCALE_LABELS,
  SOURCE_GROUP_DIMENSIONS,
  SOURCE_MEASURES,
  SOURCE_TIME_DIMENSIONS,
  type ChartConfig,
  type ChartDimension,
  type ChartFormValues,
  type ChartSource,
} from '@ordo/shared';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { calendarParts, countLabel, DIMENSION_LABELS, measureLabel, NEW_CHART_LABELS, parseConfig, periodLabel } from '../lib/aggregate';
import { CalendarPeriodPicker } from './CalendarPeriodPicker';
import { useDashboardMutations, useDashboards, type DashboardChart } from '../api';
import { useChartData, type ChartScope } from '../lib/chart-data';
import { ChartView } from './ChartView';
import { DatasetsEditor } from './DatasetsEditor';
import { SourceFilters } from './source-filters';
import { useActiveWorkspace } from '../../workspaces/api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';

const TYPE_LABELS: Record<ChartConfig['type'], string> = {
  bar: 'Barres',
  stackedBar: 'Barres empilées',
  line: 'Courbes',
  area: 'Aires',
  donut: 'Anneau',
  burndown: 'Burndown de sprint',
};

interface ChartEditorProps {
  dashboardId: string;
  /** Chart edited; a new one when absent. */
  chart?: DashboardChart;
  /** Source of a new chart. */
  source: ChartSource;
  /** Scope of the dashboard. */
  scope: ChartScope;
  context: TaskContext;
  onDone: () => void;
}

/** Values of the chart editor: title, configuration, full width. */
type ChartValues = Omit<ChartFormValues, 'config'> & { config: ChartConfig };

/**
 * Values of the editor of a chart. Invoicing and treasury charts follow a calendar month, quarter or year (an older
 * rolling period becomes the current year).
 * @param {DashboardChart} chart Chart.
 * @returns {ChartValues} Values.
 */
function chartValues(chart: DashboardChart): ChartValues {
  const config = parseConfig(chart.config);
  const { scale, anchor } = calendarParts(config.period);
  return { label: chart.label, config: config.source !== 'tasks' ? { ...config, period: `${scale}:${anchor}` as ChartConfig['period'] } : config, wide: chart.wide };
}

/**
 * Chart editor: source (tasks, invoicing, treasury), kind, axis (a date by day, week, month, quarter or
 * year over a period, or a field), measure, series, running total, sprint of a burndown, width, filters of the
 * records counted, other data sets and their comparisons (percent or difference); with a live preview. A new chart is
 * added by its button; an existing one is saved as it changes (decision D22: each choice at once, a text on leaving
 * it, a configuration that does not validate is not saved), read only on an archived dashboard.
 * @param {ChartEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function ChartEditor({ dashboardId, chart, source: newSource, scope, context, onDone }: ChartEditorProps) {
  // No invoicing in a personal workspace.
  const { perso } = useActiveWorkspace();
  const { data: dashboards } = useDashboards(scope.projectId);
  const dashboard = dashboards?.find((item) => item.id === dashboardId);
  const current = chart && (dashboard?.charts.find((item) => item.id === chart.id) ?? chart);
  const readOnly = Boolean(dashboard?.archived);
  const { createChart, updateChart } = useDashboardMutations();
  // Renamed from its menu, in the side panel (decision CK): the default title follows the source until it is renamed.
  const base = useAppForm<ChartValues>({
    initialValues: chart ? chartValues(chart) : { label: NEW_CHART_LABELS[newSource], config: defaultChartConfig(newSource), wide: false },
    schema: chartFormSchema,
  });
  const { form, saving, commit } = useFieldSave(base, {
    save: chart ? (_changes, values) => updateChart.mutateAsync({ id: chart.id, input: { ...values, config: chartConfigSchema.parse(values.config) } }) : null,
    schema: chartFormSchema,
    saved: current && chartValues(current),
    // The configuration holds texts too: saved on leaving them (see `change`).
    onBlur: ['config'],
    readOnly,
  });
  const { label: title, config, wide } = form.values;
  const { data, isPending } = useChartData(config, scope, context);
  /**
   * Changes the configuration: saved at once, or on leaving the text being typed.
   * @param {Partial<ChartConfig>} changes Changes (none: what was typed is saved, the text being left).
   * @param {boolean} [typing=false] A text being typed. Optional. Default = false.
   * @returns {void}
   */
  const change = (changes: Partial<ChartConfig>, typing = false) => {
    form.setFieldValue('config', { ...form.getValues().config, ...changes });
    if (!typing) commit(['config']);
  };
  const source = config.source;
  const burndown = config.type === 'burndown';
  const time = isTimeDimension(config.dimension);
  // The balance of the treasury: its cash at each date, not a sum of movements.
  const treasuryBalance = source === 'treasury' && config.measure === 'balance';
  const validation = chartConfigSchema.safeParse(config);
  // Archived sprints are no longer offered, but the one of the chart stays.
  const sprints = unarchived(scope.projectId ? context.sprintsFor(scope.projectId, config.sprintId ? [config.sprintId] : []) : context.sprints, config.sprintId);

  /**
   * Adds the new chart.
   * @returns {void}
   */
  const add = () => {
    if (!validation.success) return;
    createChart.mutate({ dashboardId, input: { label: title, config: validation.data, wide } }, formCallbacks(null, 'Diagramme ajouté.', onDone));
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
        <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
          <Stack gap="sm">
            {chart && !readOnly && <SaveStatus saving={saving} />}
            <SegmentedControl
              fullWidth
              data={[{ value: 'tasks', label: 'Tâches' }, ...(perso && source !== 'documents' ? [] : [{ value: 'documents', label: 'Facturation' }]), { value: 'treasury', label: 'Trésorerie' }]}
              value={source}
              // Another source starts from its own defaults (axes and measures differ).
              onChange={(value) => {
                const next = defaultChartConfig(value as ChartSource);
                // The default title follows the source until it is changed (saved with it).
                base.setValues({
                  config: { ...next, type: config.type === 'burndown' ? next.type : config.type },
                  ...(title === NEW_CHART_LABELS[source] && { label: NEW_CHART_LABELS[value as ChartSource] }),
                });
                commit(['config', 'label']);
              }}
            />
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
                    label: `${sprint.label} — ${context.projectById.get(sprint.projectId)?.label ?? ''}`,
                  }))}
                  value={config.sprintId}
                  onChange={(sprintId) => change({ sprintId })}
                  error={!config.sprintId ? 'Choisissez le sprint.' : undefined}
                />
                <LabeledField label="Reste à faire">
                  <SegmentedControl
                    data={[
                      { value: 'count', label: 'Tâches' },
                      { value: 'effort', label: 'Effort' },
                    ]}
                    value={config.measure === 'effort' ? 'effort' : 'count'}
                    onChange={(measure) => change({ measure: measure as ChartConfig['measure'] })}
                  />
                </LabeledField>
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
                        // The series of a data set cannot be its axis either.
                        datasets: config.datasets.map((dataset) => (dataset.series === dimension ? { ...dataset, series: null } : dataset)),
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
                        label: SCALE_LABELS[value],
                      }))}
                      value={config.bucket}
                      onChange={(bucket) => bucket && change({ bucket: bucket as ChartConfig['bucket'] })}
                    />
                    {source !== 'tasks' ? (
                      <CalendarPeriodPicker value={config.period} onChange={(period) => change({ period })} />
                    ) : (
                      <Select
                        label="Période"
                        allowDeselect={false}
                        data={CHART_PERIODS.map((value) => ({
                          value,
                          label: periodLabel(value),
                        }))}
                        value={config.period}
                        onChange={(period) => period && change({ period: period as ChartConfig['period'] })}
                      />
                    )}
                  </SimpleGrid>
                )}
                {config.type !== 'donut' && !treasuryBalance && (
                  <Select
                    label={several ? 'Séries du jeu principal' : 'Séries'}
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
                {time && config.type !== 'donut' && !treasuryBalance && (
                  <Switch label="Cumulé (total depuis le début de la période)" checked={config.cumulative} onChange={(event) => change({ cumulative: event.currentTarget.checked })} />
                )}
              </>
            )}
            <Switch label="Pleine largeur" checked={wide} onChange={(event) => form.setFieldValue('wide', event.currentTarget.checked)} />

            <Divider
              label={fmt.capitalize(`${several ? 'Jeu principal — ' : ''}${source === 'tasks' ? 'tâches comptées' : source === 'documents' ? 'documents comptés' : 'mouvements comptés'}`)}
              labelPosition="left"
            />
            <SourceFilters source={source} config={config} context={context} change={change} />
            {scope.projectId && source !== 'tasks' && (
              <Text size="xs" c="dimmed">
                Tableau de bord d’un projet : seuls les {source === 'documents' ? 'documents' : 'mouvements'} rattachés au projet ou à ses sous-projets comptent
                {source === 'treasury' && ' (le solde reste celui de tous les comptes)'}.
              </Text>
            )}
            {!burndown && config.type !== 'donut' && !treasuryBalance && (
              <>
                <Divider label="Jeux de données et comparaisons" labelPosition="left" />
                <DatasetsEditor config={config} change={change} context={context} />
              </>
            )}
            {!validation.success && <ErrorAlert p="xs">{validation.error.issues[0]?.message}</ErrorAlert>}
          </Stack>
        </Fieldset>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="sm" style={{ position: 'sticky', top: 0 }}>
          <Text size="sm" fw={600}>
            Aperçu
          </Text>
          <Paper withBorder radius="md" p="md">
            {isPending || !data ? <BlockSkeleton height={12} /> : <ChartView config={config} data={data} height={288} />}
          </Paper>
          {data && (
            <Text size="xs" c="dimmed">
              {countLabel(config, data.taskCount)} {plural(data.taskCount, 'compté')}
              {source === 'tasks' && config.measure === 'effort' && ' · l’effort d’une tâche parente est celui de ses sous-tâches'}
              {source === 'tasks' && (config.dimension === 'assignees' || config.series === 'assignees') ? ' · une tâche à plusieurs assignés compte pour chacun' : ''}
            </Text>
          )}
          {!chart && <FormActions onCancel={onDone} submitLabel="Ajouter le diagramme" onSubmit={add} loading={createChart.isPending} />}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
