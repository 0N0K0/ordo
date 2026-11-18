import type { CalendarScale } from '@ordo/shared';

/** Scales of the balance chart, with their name. */
export const CHART_SCALES: { value: CalendarScale; label: string }[] = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Année' },
];
