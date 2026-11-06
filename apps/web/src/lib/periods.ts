import { addDays } from '@ordo/shared';

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
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  /**
   * First day of a month (months may overflow the year).
   * @param {number} y Year.
   * @param {number} m Month, from 0.
   * @returns {string} YYYY-MM-DD.
   */
  const first = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const quarter = month - (month % 3);
  if (preset === 'month') return [first(year, month), addDays(first(year, month + 1), -1)];
  if (preset === 'lastMonth') return [first(year, month - 1), addDays(first(year, month), -1)];
  if (preset === 'quarter') return [first(year, quarter), addDays(first(year, quarter + 3), -1)];
  if (preset === 'lastQuarter') return [first(year, quarter - 3), addDays(first(year, quarter), -1)];
  if (preset === 'year') return [`${year}-01-01`, `${year}-12-31`];
  return [`${year - 1}-01-01`, `${year - 1}-12-31`];
}
