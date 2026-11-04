import { AreaChart, BarChart, DonutChart, LineChart } from '@mantine/charts';
import { Center, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ChartConfig } from '@ordo/shared';
import { ChartBarIcon } from '@phosphor-icons/react';
import { forwardRef } from 'react';
import { MONEY_MEASURES, type ChartData } from './aggregate';

const numberFormat = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 2,
});
const moneyFormat = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
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
  const format = (value: number) => (MONEY_MEASURES.includes(config.measure) ? moneyFormat : numberFormat).format(value);
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
      {config.type === 'donut' ? (
        <Center>
          <DonutChart
            data={data.slices}
            size={Math.min(height - 40, 260)}
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
