import { isTimeDimension, MAIN_DATASET, type ChartComparison, type ChartConfig } from '@ordo/shared';
import { MEASURE_LABELS, PALETTE, round, type ChartData, type ChartSeries } from './aggregate';

/** A data set of a chart, as a configuration of its own. */
export interface DatasetPart {
  id: string;
  name: string;
  config: ChartConfig;
}

/**
 * Data sets of a chart: the main one (its own fields), then the others, each as a full configuration on the
 * axis of the chart (its own date on a time axis), without series.
 * @param {ChartConfig} config Chart configuration.
 * @returns {DatasetPart[]} Data sets.
 */
export function datasetParts(config: ChartConfig): DatasetPart[] {
  const time = isTimeDimension(config.dimension);
  const several = config.datasets.length > 0 || config.comparisons.length > 0;
  const main: DatasetPart = {
    id: MAIN_DATASET,
    name: config.name || MEASURE_LABELS[config.measure],
    config: several ? { ...config, series: null, datasets: [], comparisons: [] } : config,
  };
  return [
    main,
    ...config.datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      config: {
        ...config,
        source: dataset.source,
        measure: dataset.measure,
        dimension: time ? (dataset.dateField ?? config.dimension) : config.dimension,
        filter: dataset.filter,
        search: dataset.search,
        includeArchived: dataset.includeArchived,
        documents: dataset.documents,
        treasury: dataset.treasury,
        series: null,
        datasets: [],
        comparisons: [],
      },
    })),
  ];
}

/**
 * Value of a comparison of two values: share of a in b (percent), or a − b.
 * @param {ChartComparison['kind']} kind Kind.
 * @param {number | null} a First value.
 * @param {number | null} b Second value.
 * @returns {number | null} Value (null: share of nothing).
 */
function compare(kind: ChartComparison['kind'], a: number | null, b: number | null): number | null {
  if (kind === 'difference') return round((a ?? 0) - (b ?? 0));
  return b ? round(((a ?? 0) / b) * 100) : null;
}

/**
 * One chart from several data sets on the same axis: one series per data set (rows joined by axis value, in
 * the order of the main data set then the others), and one per comparison (percents on a right axis).
 * @param {{ part: DatasetPart, data: ChartData }[]} results Data of each data set.
 * @param {ChartConfig} config Chart configuration.
 * @returns {ChartData} Data.
 */
export function mergeDatasets(results: { part: DatasetPart; data: ChartData }[], config: ChartConfig): ChartData {
  // Series names are the row keys: unique.
  const used = new Set<string>(['x']);
  const unique = (name: string) => {
    let candidate = name;
    for (let index = 2; used.has(candidate); index++) candidate = `${name} (${index})`;
    used.add(candidate);
    return candidate;
  };
  const kind: ChartSeries['type'] = config.type === 'line' ? 'line' : config.type === 'area' ? 'area' : 'bar';
  const names = new Map(results.map(({ part }) => [part.id, unique(part.name)]));
  const order: string[] = [];
  const rows = new Map<string, Record<string, string | number | null>>();
  for (const { part, data } of results) {
    for (const row of data.rows) {
      const x = String(row.x);
      if (!rows.has(x)) {
        rows.set(x, { x });
        order.push(x);
      }
      // Single series of the data set.
      const value = data.series[0] ? row[data.series[0].name] : null;
      rows.get(x)![names.get(part.id)!] = typeof value === 'number' ? value : 0;
    }
  }
  // An axis value missing from a data set counts zero there.
  for (const row of rows.values()) for (const name of names.values()) row[name] ??= 0;
  const series: ChartSeries[] = results.map(({ part }, index) => ({ name: names.get(part.id)!, color: PALETTE[index % PALETTE.length], type: kind }));
  for (const [index, comparison] of config.comparisons.entries()) {
    const a = names.get(comparison.a);
    const b = names.get(comparison.b);
    if (!a || !b) continue;
    const name = unique(comparison.name);
    for (const row of rows.values()) row[name] = compare(comparison.kind, row[a] as number | null, row[b] as number | null);
    series.push({
      name,
      color: PALETTE[(results.length + index) % PALETTE.length],
      type: 'line',
      strokeDasharray: '5 5',
      ...(comparison.kind === 'ratio' && { yAxisId: 'right' }),
    });
  }
  return {
    rows: order.map((x) => rows.get(x)!),
    series,
    slices: [],
    taskCount: results.reduce((sum, { data }) => sum + data.taskCount, 0),
    empty: results.every(({ data }) => data.empty),
    mixed: true,
    percentAxis: config.comparisons.some((comparison) => comparison.kind === 'ratio'),
  };
}
