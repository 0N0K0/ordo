import { SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { calendarStart, type CalendarScale, type ChartConfig } from '@ordo/shared';
import { localToday } from '../../lib/dates';
import { calendarParts } from './aggregate';

const SCALES: { value: CalendarScale; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];
const WHICH: Record<CalendarScale, { value: string; label: string }[]> = {
  month: [
    { value: '0', label: 'Mois en cours' },
    { value: '-1', label: 'Mois précédent' },
    { value: 'chosen', label: 'Mois choisi' },
  ],
  quarter: [
    { value: '0', label: 'Trimestre en cours' },
    { value: '-1', label: 'Trimestre précédent' },
    { value: 'chosen', label: 'Trimestre choisi' },
  ],
  year: [
    { value: '0', label: 'Année en cours' },
    { value: '-1', label: 'Année précédente' },
    { value: 'chosen', label: 'Année choisie' },
  ],
};

/**
 * Period of a chart as a calendar month, quarter or year: the current one (follows the date), the previous
 * one, or a chosen one (a quarter by one of its months).
 * @param {{ value: ChartConfig['period'], onChange: (period: ChartConfig['period']) => void }} props Period and update.
 * @returns {JSX.Element} Picker.
 */
export function CalendarPeriodPicker({ value, onChange }: { value: ChartConfig['period']; onChange: (period: ChartConfig['period']) => void }) {
  const { scale, anchor } = calendarParts(value);
  const chosen = anchor !== '0' && anchor !== '-1';
  const today = localToday();
  const set = (nextScale: CalendarScale, nextAnchor: string) => onChange(`${nextScale}:${nextAnchor}` as ChartConfig['period']);
  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        Période
      </Text>
      <SegmentedControl
        size="xs"
        data={SCALES}
        value={scale}
        // A chosen period keeps its first day, on the new scale.
        onChange={(next) => set(next as CalendarScale, chosen ? calendarStart(next as CalendarScale, anchor) : anchor)}
      />
      <Select
        aria-label="Quelle période"
        allowDeselect={false}
        data={WHICH[scale]}
        value={chosen ? 'chosen' : anchor}
        onChange={(which) => which && set(scale, which === 'chosen' ? calendarStart(scale, today) : which)}
      />
      {chosen &&
        (scale === 'year' ? (
          <YearPickerInput aria-label="Année" value={anchor} onChange={(date) => date && set(scale, calendarStart(scale, date))} />
        ) : (
          <MonthPickerInput aria-label={scale === 'quarter' ? 'Un mois du trimestre' : 'Mois'} value={anchor} onChange={(date) => date && set(scale, calendarStart(scale, date))} />
        ))}
    </Stack>
  );
}
