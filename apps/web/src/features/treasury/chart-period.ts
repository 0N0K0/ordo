import { addDays } from '@ordo/shared';
import * as fmt from '../../lib/format';

/** Span of the balance chart. */
export type ChartScale = 'month' | 'quarter' | 'year';

export const CHART_SCALES: { value: ChartScale; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];

const MONTHS: Record<ChartScale, number> = { month: 1, quarter: 3, year: 12 };

/**
 * First day of a month, months overflowing the year.
 * @param {number} year Year.
 * @param {number} month Month, from 0.
 * @returns {string} YYYY-MM-DD.
 */
const firstDay = (year: number, month: number) => new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

/**
 * First day of the period of a scale containing a day.
 * @param {ChartScale} scale Scale.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} First day.
 */
export function periodStart(scale: ChartScale, day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1;
  if (scale === 'year') return `${year}-01-01`;
  return firstDay(year, scale === 'quarter' ? month - (month % 3) : month);
}

/**
 * Last day of the period starting on a day.
 * @param {ChartScale} scale Scale.
 * @param {string} start First day of the period.
 * @returns {string} Last day.
 */
export function periodEnd(scale: ChartScale, start: string): string {
  return addDays(shiftPeriod(scale, start, 1), -1);
}

/**
 * Period before or after another one.
 * @param {ChartScale} scale Scale.
 * @param {string} start First day of the period.
 * @param {number} delta Periods to move (negative: back).
 * @returns {string} First day of the new period.
 */
export function shiftPeriod(scale: ChartScale, start: string, delta: number): string {
  return firstDay(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 + delta * MONTHS[scale]);
}

/**
 * Name of a period: "novembre 2026", "4e trimestre 2026", "2026".
 * @param {ChartScale} scale Scale.
 * @param {string} start First day of the period.
 * @returns {string} Name.
 */
export function periodLabel(scale: ChartScale, start: string): string {
  if (scale === 'year') return start.slice(0, 4);
  if (scale === 'quarter') {
    const quarter = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1;
    return `${quarter}${quarter === 1 ? 'er' : 'e'} trimestre ${start.slice(0, 4)}`;
  }
  const label = fmt.month(start);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
