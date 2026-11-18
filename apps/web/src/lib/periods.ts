import { calendarEnd, calendarStart, shiftCalendar, type CalendarScale } from '@ordo/shared';
import * as fmt from './format';

/** Period offered by the export forms. */
export type PeriodPreset = 'month' | 'lastMonth' | 'quarter' | 'lastQuarter' | 'year' | 'lastYear' | 'custom';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'month', label: 'Mois en cours' },
  { value: 'lastMonth', label: 'Mois précédent' },
  { value: 'quarter', label: 'Trimestre en cours' },
  { value: 'lastQuarter', label: 'Trimestre précédent' },
  { value: 'year', label: 'Année en cours' },
  { value: 'lastYear', label: 'Année précédente' },
  { value: 'custom', label: 'Dates choisies' },
];

/**
 * First and last days of a preset period.
 * @param {Exclude<PeriodPreset, 'custom'>} preset Period.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {[string, string]} First and last days.
 */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string): [string, string] {
  /**
   * First and last days of a calendar period.
   * @param {CalendarScale} scale Scale.
   * @param {number} delta 0: the current one, -1: the previous one.
   * @returns {[string, string]} First and last days.
   */
  const range = (scale: CalendarScale, delta: number): [string, string] => {
    const start = shiftCalendar(scale, calendarStart(scale, today), delta);
    return [start, calendarEnd(scale, start)];
  };
  if (preset === 'month') return range('month', 0);
  if (preset === 'lastMonth') return range('month', -1);
  if (preset === 'quarter') return range('quarter', 0);
  if (preset === 'lastQuarter') return range('quarter', -1);
  if (preset === 'year') return range('year', 0);
  return range('year', -1);
}

/**
 * Name of a quarter: "T4 2026".
 * @param {string} day A day of the quarter (YYYY-MM-DD).
 * @returns {string} Name.
 */
export const quarterName = (day: string) => `T${Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1} ${day.slice(0, 4)}`;

/**
 * Name of a calendar period: "Novembre 2026", "T4 2026", "2026".
 * @param {CalendarScale} scale Scale.
 * @param {string} start First day of the period.
 * @returns {string} Name.
 */
export function periodName(scale: CalendarScale, start: string): string {
  if (scale === 'year') return start.slice(0, 4);
  if (scale === 'quarter') return quarterName(start);
  return fmt.capitalize(fmt.month(start));
}

/** Presets of the current and previous periods of each scale. */
const RELATIVE_PRESETS: Record<CalendarScale, [PeriodPreset, PeriodPreset]> = { month: ['month', 'lastMonth'], quarter: ['quarter', 'lastQuarter'], year: ['year', 'lastYear'] };

/**
 * Name of the current or previous period of a scale: "Mois en cours", "Trimestre précédent"…
 * @param {CalendarScale} scale Scale.
 * @param {boolean} previous The previous one rather than the current one.
 * @returns {string} Name.
 */
export function relativePeriodName(scale: CalendarScale, previous: boolean): string {
  const preset = RELATIVE_PRESETS[scale][previous ? 1 : 0];
  return PERIOD_PRESETS.find((item) => item.value === preset)?.label ?? preset;
}
