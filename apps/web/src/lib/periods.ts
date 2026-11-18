import { addDays, DATE_PERIOD_LABELS, filterPeriod, type CalendarScale, type DatePeriod } from '@ordo/shared';
import * as fmt from './format';

/** Period offered by the export forms: a period of the filters (« Ce mois-ci », « Le mois dernier »…), or dates chosen. */
export type PeriodPreset = Extract<DatePeriod, 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear'> | 'custom';

const PRESET_PERIODS = ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear'] as const satisfies readonly PeriodPreset[];

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  ...PRESET_PERIODS.map((value) => ({ value, label: DATE_PERIOD_LABELS[value] })),
  { value: 'custom', label: 'Dates choisies' },
];

/**
 * First and last days of a preset period: the period of the filters (`filterPeriod`, whose end is the day after the
 * last one), its end made inclusive for the export forms.
 * @param {Exclude<PeriodPreset, 'custom'>} preset Period.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {[string, string]} First and last days (both included).
 */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, today: string): [string, string] {
  const [first, after] = filterPeriod(preset, today);
  return [first, addDays(after, -1)];
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

/** Periods of the current and previous periods of each scale. */
const RELATIVE_PERIODS: Record<CalendarScale, [DatePeriod, DatePeriod]> = { month: ['thisMonth', 'lastMonth'], quarter: ['thisQuarter', 'lastQuarter'], year: ['thisYear', 'lastYear'] };

/**
 * Name of the current or previous period of a scale: "Ce mois-ci", "Le trimestre dernier"…
 * @param {CalendarScale} scale Scale.
 * @param {boolean} previous The previous one rather than the current one.
 * @returns {string} Name.
 */
export function relativePeriodName(scale: CalendarScale, previous: boolean): string {
  return DATE_PERIOD_LABELS[RELATIVE_PERIODS[scale][previous ? 1 : 0]];
}

/** Where a period (a sprint, an event, a schedule) stands at a moment. */
export type PeriodState = 'upcoming' | 'current' | 'past';

/** Label and color of each state of a period, the same everywhere (« Passée », as « une période »). */
export const PERIOD_STATES: Record<PeriodState, { label: string; color: string }> = {
  upcoming: { label: 'À venir', color: 'blue' },
  current: { label: 'En cours', color: 'green' },
  past: { label: 'Passée', color: 'gray' },
};

/**
 * Where a period stands at a moment: to come before its start, past after its end, current in between.
 * @param {T} start Its start (a day YYYY-MM-DD, or an instant in ms).
 * @param {T | null} end Its end, of the same kind (null: none, never past).
 * @param {T} now The moment, of the same kind.
 * @param {{ endExclusive?: boolean }} [options] `endExclusive`: past from its end on (an instant), else after it (a last day). Optional.
 * @returns {PeriodState} State.
 */
export function periodState<T extends string | number>(start: T, end: T | null, now: T, { endExclusive = false }: { endExclusive?: boolean } = {}): PeriodState {
  if (start > now) return 'upcoming';
  if (end !== null && (endExclusive ? end <= now : end < now)) return 'past';
  return 'current';
}
