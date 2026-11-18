import { LabeledField } from '../../../components/inputs/LabeledField';
import { SegmentedControl, Select } from '@mantine/core';
import { MonthPickerInput, YearPickerInput } from '@mantine/dates';
import { CALENDAR_SCALE_OPTIONS, calendarStart, type CalendarScale, type ChartConfig } from '@ordo/shared';
import { localToday } from '../../../lib/dates';
import { calendarParts } from '../lib/aggregate';
import { relativePeriodName } from '../../../lib/periods';

/** Name of a chosen period of each scale. */
const CHOSEN: Record<CalendarScale, string> = { month: 'Mois choisi', quarter: 'Trimestre choisi', year: 'Année choisie' };

/**
 * Which period of a scale: the current one, the previous one or a chosen one.
 * @param {CalendarScale} scale Scale.
 * @returns {{ value: string, label: string }[]} Options.
 */
const which = (scale: CalendarScale) => [
  { value: '0', label: relativePeriodName(scale, false) },
  { value: '-1', label: relativePeriodName(scale, true) },
  { value: 'chosen', label: CHOSEN[scale] },
];

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
    <LabeledField label="Période">
      <SegmentedControl
        size="xs"
        data={CALENDAR_SCALE_OPTIONS}
        value={scale}
        // A chosen period keeps its first day, on the new scale.
        onChange={(next) => set(next as CalendarScale, chosen ? calendarStart(next as CalendarScale, anchor) : anchor)}
      />
      <Select
        aria-label="Quelle période"
        allowDeselect={false}
        data={which(scale)}
        value={chosen ? 'chosen' : anchor}
        onChange={(which) => which && set(scale, which === 'chosen' ? calendarStart(scale, today) : which)}
      />
      {chosen &&
        (scale === 'year' ? (
          <YearPickerInput aria-label="Année" value={anchor} onChange={(date) => date && set(scale, calendarStart(scale, date))} />
        ) : (
          <MonthPickerInput aria-label={scale === 'quarter' ? 'Un mois du trimestre' : 'Mois'} value={anchor} onChange={(date) => date && set(scale, calendarStart(scale, date))} />
        ))}
    </LabeledField>
  );
}
