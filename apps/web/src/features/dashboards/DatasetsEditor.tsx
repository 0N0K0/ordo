import { Accordion, ActionIcon, Button, Group, Paper, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import {
  CHART_COMPARISON_KINDS,
  defaultChartConfig,
  isTimeDimension,
  MAIN_DATASET,
  SOURCE_GROUP_DIMENSIONS,
  SOURCE_MEASURES,
  SOURCE_TIME_DIMENSIONS,
  type ChartComparison,
  type ChartConfig,
  type ChartDataset,
  type ChartSource,
} from '@ordo/shared';
import { CopyIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import type { TaskContext } from '../tasks/use-task-context';
import { FilterBuilder } from '../tasks/views/FilterBuilder';
import { DIMENSION_LABELS, MEASURE_LABELS, measureLabel } from './aggregate';
import { DocumentFilters, TreasuryFilters } from './source-filters';

const SOURCE_LABELS: Record<ChartSource, string> = { tasks: 'Tâches', documents: 'Facturation', treasury: 'Trésorerie' };
const COMPARISON_LABELS: Record<ChartComparison['kind'], string> = { ratio: 'Pourcentage (A / B)', difference: 'Différence (A − B)' };

let datasetCount = 0;

/**
 * New id of a data set or comparison.
 * @param {string} prefix Prefix.
 * @returns {string} Id.
 */
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${++datasetCount}`;

interface DatasetsEditorProps {
  config: ChartConfig;
  change: (changes: Partial<ChartConfig>) => void;
  context: TaskContext;
}

/**
 * Data sets of a chart and their comparisons: the main data set (the fields above) can be named and duplicated,
 * other data sets have their own source, measure, date and filters; a comparison gives the share of a data set
 * in another (percent) or their difference.
 * @param {DatasetsEditorProps} props Component props.
 * @returns {JSX.Element} Editor.
 */
export function DatasetsEditor({ config, change, context }: DatasetsEditorProps) {
  const time = isTimeDimension(config.dimension);
  const mainName = config.name || MEASURE_LABELS[config.measure];
  const options = [{ value: MAIN_DATASET, label: mainName }, ...config.datasets.map((dataset) => ({ value: dataset.id, label: dataset.name }))];

  /**
   * Changes a data set.
   * @param {number} index Position.
   * @param {Partial<ChartDataset>} changes Changes.
   * @returns {void}
   */
  const setDataset = (index: number, changes: Partial<ChartDataset>) => change({ datasets: config.datasets.map((dataset, position) => (position === index ? { ...dataset, ...changes } : dataset)) });

  /**
   * Adds a data set: a copy of the main one (to narrow its filter), or a new one of a source.
   * @param {ChartSource | null} source Source of a new data set, null for a copy of the main one.
   * @returns {void}
   */
  const addDataset = (source: ChartSource | null) => {
    const base = source ? defaultChartConfig(source) : config;
    const dateField = time && !SOURCE_TIME_DIMENSIONS[base.source].includes(config.dimension) ? (SOURCE_TIME_DIMENSIONS[base.source][0] as ChartDataset['dateField']) : null;
    const dataset: ChartDataset = {
      id: newId('d'),
      name: source ? `${SOURCE_LABELS[source]} ${config.datasets.length + 2}` : `${mainName} (filtré)`,
      source: base.source,
      measure: base.source === 'treasury' && base.measure === 'balance' ? 'amount' : base.measure,
      dateField,
      series: source ? null : config.series,
      filter: structuredClone(base.filter),
      search: base.search,
      includeArchived: base.includeArchived,
      documents: structuredClone(base.documents),
      treasury: structuredClone(base.treasury),
    };
    change({
      datasets: [...config.datasets, dataset],
      ...(config.type === 'donut' || config.type === 'burndown' ? { type: 'bar' as const } : {}),
      ...(!config.name && { name: mainName }),
    });
  };

  /**
   * Removes a data set and the comparisons using it.
   * @param {ChartDataset} dataset Data set.
   * @returns {void}
   */
  const removeDataset = (dataset: ChartDataset) =>
    change({
      datasets: config.datasets.filter((other) => other.id !== dataset.id),
      comparisons: config.comparisons.filter((comparison) => comparison.a !== dataset.id && comparison.b !== dataset.id),
    });

  /**
   * Adds a comparison: the last data set against the main one, in percent.
   * @returns {void}
   */
  const addComparison = () => {
    const last = config.datasets.at(-1);
    const a = last?.id ?? MAIN_DATASET;
    const label = (id: string) => options.find((option) => option.value === id)?.label ?? '';
    change({ comparisons: [...config.comparisons, { id: newId('c'), name: `% ${label(a)} / ${mainName}`, kind: 'ratio', a, b: MAIN_DATASET, type: 'line' }] });
  };

  /**
   * Changes a comparison.
   * @param {number} index Position.
   * @param {Partial<ChartComparison>} changes Changes.
   * @returns {void}
   */
  const setComparison = (index: number, changes: Partial<ChartComparison>) =>
    change({ comparisons: config.comparisons.map((comparison, position) => (position === index ? { ...comparison, ...changes } : comparison)) });

  const several = config.datasets.length > 0;

  return (
    <Stack gap="sm">
      {several && (
        <TextInput
          label="Nom du jeu principal"
          description="Le jeu défini par les champs et filtres principaux."
          value={config.name}
          placeholder={MEASURE_LABELS[config.measure]}
          onChange={(event) => change({ name: event.currentTarget.value })}
        />
      )}
      {several && (
        <Accordion variant="separated" multiple chevronPosition="left">
          {config.datasets.map((dataset, index) => {
            const dateOptions = SOURCE_TIME_DIMENSIONS[dataset.source];
            return (
              <Accordion.Item key={dataset.id} value={dataset.id}>
                <Group gap={4} wrap="nowrap" pr="xs">
                  <Accordion.Control>
                    <Text size="sm" fw={600}>
                      {dataset.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {SOURCE_LABELS[dataset.source]} · {measureLabel(dataset.source, dataset.measure)}
                      {dataset.series ? ` · séries : ${DIMENSION_LABELS[dataset.series].toLowerCase()}` : ''}
                    </Text>
                  </Accordion.Control>
                  <Tooltip label="Retirer le jeu de données">
                    <ActionIcon variant="subtle" color="red" aria-label={`Retirer ${dataset.name}`} onClick={() => removeDataset(dataset)}>
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <TextInput label="Nom" required value={dataset.name} onChange={(event) => setDataset(index, { name: event.currentTarget.value })} />
                    <SegmentedControl
                      fullWidth
                      data={(Object.keys(SOURCE_LABELS) as ChartSource[]).map((value) => ({ value, label: SOURCE_LABELS[value] }))}
                      value={dataset.source}
                      // Another source starts from its defaults.
                      onChange={(value) => {
                        const next = defaultChartConfig(value as ChartSource);
                        setDataset(index, {
                          source: next.source,
                          measure: next.measure,
                          dateField: time && !SOURCE_TIME_DIMENSIONS[next.source].includes(config.dimension) ? (SOURCE_TIME_DIMENSIONS[next.source][0] as ChartDataset['dateField']) : null,
                          series: dataset.series && SOURCE_GROUP_DIMENSIONS[next.source].includes(dataset.series) ? dataset.series : null,
                          filter: next.filter,
                          documents: next.documents,
                          treasury: next.treasury,
                        });
                      }}
                    />
                    <SimpleGrid cols={time ? 2 : 1} spacing="sm">
                      <Select
                        label="Mesure"
                        allowDeselect={false}
                        data={SOURCE_MEASURES[dataset.source]
                          .filter((value) => !(dataset.source === 'treasury' && value === 'balance'))
                          .map((value) => ({ value, label: measureLabel(dataset.source, value) }))}
                        value={dataset.measure}
                        onChange={(measure) => measure && setDataset(index, { measure: measure as ChartDataset['measure'] })}
                      />
                      {time && (
                        <Select
                          label="Date"
                          description="Date des éléments sur l’axe."
                          allowDeselect={false}
                          data={dateOptions.map((value) => ({ value, label: DIMENSION_LABELS[value] }))}
                          value={dataset.dateField ?? (dateOptions.includes(config.dimension) ? config.dimension : null)}
                          onChange={(value) => setDataset(index, { dateField: (value as ChartDataset['dateField']) ?? null })}
                        />
                      )}
                    </SimpleGrid>
                    <Select
                      label="Séries"
                      placeholder="Aucune (une seule série)"
                      clearable
                      data={SOURCE_GROUP_DIMENSIONS[dataset.source].filter((value) => value !== config.dimension).map((value) => ({ value, label: DIMENSION_LABELS[value] }))}
                      value={dataset.series}
                      onChange={(series) => setDataset(index, { series: (series as ChartDataset['series']) ?? null })}
                    />
                    {dataset.source === 'tasks' && (
                      <>
                        <TextInput placeholder="Recherche (titre, description)" value={dataset.search} onChange={(event) => setDataset(index, { search: event.currentTarget.value })} />
                        <FilterBuilder filter={dataset.filter} context={context} onChange={(filter) => setDataset(index, { filter })} />
                        <Switch label="Inclure les tâches archivées" checked={dataset.includeArchived} onChange={(event) => setDataset(index, { includeArchived: event.currentTarget.checked })} />
                      </>
                    )}
                    {dataset.source === 'documents' && <DocumentFilters config={dataset} change={(changes) => changes.documents && setDataset(index, { documents: changes.documents })} />}
                    {dataset.source === 'treasury' && <TreasuryFilters config={dataset} change={(changes) => changes.treasury && setDataset(index, { treasury: changes.treasury })} />}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
      <Group gap="xs">
        <Button size="xs" variant="light" leftSection={<CopyIcon aria-hidden />} onClick={() => addDataset(null)}>
          Dupliquer le jeu principal
        </Button>
        <Button size="xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={() => addDataset(config.source)}>
          Nouveau jeu
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Dupliquez le jeu principal puis resserrez son filtre (tâches terminées…) pour comparer un sous-ensemble à l’ensemble.
      </Text>

      {several &&
        config.comparisons.map((comparison, index) => (
          <Paper key={comparison.id} withBorder radius="md" p="sm">
            <Stack gap="xs">
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <TextInput label="Comparaison" style={{ flex: 1 }} value={comparison.name} onChange={(event) => setComparison(index, { name: event.currentTarget.value })} />
                <Tooltip label="Retirer la comparaison">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    aria-label={`Retirer ${comparison.name}`}
                    onClick={() => change({ comparisons: config.comparisons.filter((other) => other.id !== comparison.id) })}
                  >
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <SegmentedControl
                size="xs"
                data={CHART_COMPARISON_KINDS.map((value) => ({ value, label: COMPARISON_LABELS[value] }))}
                value={comparison.kind}
                onChange={(kind) => setComparison(index, { kind: kind as ChartComparison['kind'] })}
              />
              <SegmentedControl
                size="xs"
                aria-label="Type de diagramme de la comparaison"
                data={[
                  { value: 'line', label: 'Courbe' },
                  { value: 'bar', label: 'Barres' },
                  { value: 'area', label: 'Aire' },
                ]}
                value={comparison.type}
                onChange={(type) => setComparison(index, { type: type as ChartComparison['type'] })}
              />
              <SimpleGrid cols={2} spacing="xs">
                <Select label="A" allowDeselect={false} data={options} value={comparison.a} onChange={(a) => a && setComparison(index, { a })} />
                <Select label="B" allowDeselect={false} data={options} value={comparison.b} onChange={(b) => b && setComparison(index, { b })} />
              </SimpleGrid>
              <Text size="xs" c="dimmed">
                {comparison.kind === 'ratio' ? 'Part du total de A dans celui de B, en %, sur l’axe de droite.' : 'Total de A moins celui de B, dans l’unité des jeux.'}
              </Text>
            </Stack>
          </Paper>
        ))}
      {several && (
        <div>
          <Button size="xs" variant="subtle" leftSection={<PlusIcon aria-hidden />} onClick={addComparison}>
            Comparer deux jeux
          </Button>
        </div>
      )}
    </Stack>
  );
}
