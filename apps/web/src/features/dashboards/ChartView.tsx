import { AreaChart, BarChart, CompositeChart, DonutChart, LineChart } from '@mantine/charts';
import { Center, ColorSwatch, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ChartConfig } from '@ordo/shared';
import { ChartBarIcon } from '@phosphor-icons/react';
import { forwardRef } from 'react';
import { MONEY_MEASURES, type ChartData } from './aggregate';
import * as fmt from '../../lib/format';

/**
 * Tooltip of a mixed chart: each series with its own unit (percents for the ratios).
 * @param {object} props Component props.
 * @param {React.ReactNode} props.label Value of the axis.
 * @param {{ name: string, value: number | null, color: string }[]} props.items Values of the series.
 * @param {(name: string, value: number) => string} props.format Formats a value of a series.
 * @returns {JSX.Element | null} Tooltip.
 */
function MixedTooltip({ label, items, format }: { label: React.ReactNode; items: { name: string; value: number | null; color: string }[]; format: (name: string, value: number) => string }) {
  if (!items.length) return null;
  return (
    <Paper withBorder shadow="md" radius="md" p="xs">
      <Text size="sm" fw={600} mb={4}>
        {label}
      </Text>
      <Stack gap={2}>
        {items.map((item) => (
          <Group key={item.name} gap="xs" justify="space-between" wrap="nowrap">
            <Group gap={6} wrap="nowrap">
              <ColorSwatch color={item.color} size={10} withShadow={false} />
              <Text size="xs">{item.name}</Text>
            </Group>
            <Text size="xs" ff="monospace">
              {item.value === null || item.value === undefined ? '—' : format(item.name, item.value)}
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

interface ChartViewProps {
  config: ChartConfig;
  data: ChartData;
  height: number;
}

/**
 * Chart drawing: bars (side by side or stacked), lines, areas, donut, or a burndown (remaining against ideal).
 * The element holds the SVG used by the image exports.
 * @param {ChartViewProps} props Component props.
 * @returns {JSX.Element} Chart.
 */
export const ChartView = forwardRef<HTMLDivElement, ChartViewProps>(function ChartView({ config, data, height }, ref) {
  if (data.empty) {
    return (
      <Center h={height} ref={ref}>
        <Stack align="center" gap="xs">
          <ThemeIcon size="lg" radius="xl" variant="light" color="gray">
            <ChartBarIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center">
            {config.type === 'burndown' && !config.sprintId ? 'Choisissez le sprint suivi.' : 'Aucune donnée ne correspond à ce diagramme.'}
          </Text>
        </Stack>
      </Center>
    );
  }
  // Amounts in euros, other measures as numbers.
  const format = (value: number) => (MONEY_MEASURES.includes(config.measure) ? fmt.moneyRound(value) : fmt.number(value));
  const common = {
    h: height,
    data: data.rows,
    dataKey: 'x',
    series: data.series,
    withLegend: data.series.length > 1,
    legendProps: { verticalAlign: 'bottom' as const, height: 40 },
    valueFormatter: format,
    xAxisProps: { minTickGap: 16 },
    tickLine: 'y' as const,
  };
  return (
    <div ref={ref}>
      {data.mixed ? (
        // Several data sets: bars, lines or areas, comparisons as dashed lines (percents on the right axis).
        <CompositeChart
          {...common}
          series={data.series.map((serie) => ({ ...serie, type: serie.type ?? 'bar' }))}
          withLegend
          withRightYAxis={data.percentAxis}
          // Percents: up to 100 % at least (higher when a share exceeds it).
          rightYAxisProps={{ tickFormatter: (value: number) => `${fmt.number(value, 1)} %`, domain: [0, (dataMax: number) => Math.max(100, Math.ceil(dataMax / 10) * 10)] }}
          valueFormatter={(value) => format(value)}
          tooltipProps={{
            content: ({ label, payload }) => (
              <MixedTooltip
                label={label}
                items={(payload ?? []).map((item) => ({ name: String(item.name), value: item.value as number | null, color: String(item.color ?? '') }))}
                format={(name, value) => (data.series.find((serie) => serie.name === name)?.yAxisId === 'right' ? `${fmt.number(value, 1)} %` : format(value))}
              />
            ),
          }}
          curveType="monotone"
          connectNulls={false}
          withDots={data.rows.length <= 40}
          // The series of a data set stack together.
          barProps={(serie) => {
            const stackId = (serie as { stackId?: string }).stackId;
            return stackId ? { stackId } : {};
          }}
          areaProps={(serie) => {
            const stackId = (serie as { stackId?: string }).stackId;
            return stackId ? { stackId } : {};
          }}
        />
      ) : config.type === 'donut' ? (
        <Center>
          <DonutChart
            data={data.slices}
            // Larger when printed (page format).
            size={Math.min(height - 40, height > 400 ? 520 : 260)}
            thickness={34}
            withLabels
            withLabelsLine
            withTooltip
            valueFormatter={format}
            chartLabel={format(data.slices.reduce((sum, slice) => sum + slice.value, 0))}
          />
        </Center>
      ) : config.type === 'line' || config.type === 'burndown' ? (
        <LineChart {...common} curveType={config.type === 'burndown' ? 'linear' : 'monotone'} connectNulls={false} withDots={data.rows.length <= 40} />
      ) : config.type === 'area' ? (
        <AreaChart {...common} type={config.series ? 'stacked' : 'default'} curveType="monotone" withDots={false} />
      ) : (
        // Negative values (credit notes, money out) stack below zero.
        <BarChart {...common} type={config.type === 'stackedBar' ? 'stacked' : 'default'} barChartProps={{ stackOffset: 'sign' }} />
      )}
    </div>
  );
});
