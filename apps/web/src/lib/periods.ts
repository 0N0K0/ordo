import { calendarEnd, calendarStart, shiftCalendar, type CalendarScale } from '@ordo/shared';

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
