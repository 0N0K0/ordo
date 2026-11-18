import type { CalendarScale } from '@ordo/shared';
import * as fmt from '../../../lib/format';

/** Scales of the balance chart, with their name. */
export const CHART_SCALES: { value: CalendarScale; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];

/**
 * Name of a period: "novembre 2026", "4e trimestre 2026", "2026".
 * @param {CalendarScale} scale Scale.
 * @param {string} start First day of the period.
 * @returns {string} Name.
 */
export function periodLabel(scale: CalendarScale, start: string): string {
  if (scale === 'year') return start.slice(0, 4);
  if (scale === 'quarter') {
    const quarter = Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1;
    return `${quarter}${quarter === 1 ? 'er' : 'e'} trimestre ${start.slice(0, 4)}`;
  }
  return fmt.capitalize(fmt.month(start));
}
