import { addDays, daysBetween } from '@ordo/shared';
import dayjs from 'dayjs';
import { PICKER_FORMATS } from '../../lib/format';
import { followBounds, rangeError } from './date-range';

/** Side of a period. */
export type PeriodSide = 'start' | 'end';

/** Days (YYYY-MM-DD) and times (HH:mm) of a period as it is being chosen; each one empty when null. */
export interface PeriodDraft {
  days: [string | null, string | null];
  times: [string | null, string | null];
  /** Bound the next day picked goes to. */
  side: PeriodSide;
}

/** How the days of a period are picked. */
export interface PeriodPickOptions {
  /** One day, the two times on it (a slot): the day picked is both bounds. Optional. */
  sameDay?: boolean;
  /** Moving the start moves the end by as many days (an event keeps its length). Optional. */
  keepLength?: boolean;
}

/** Default names of the bounds of a period. */
export const PERIOD_BOUNDS = ['Début', 'Fin'] as const;

/** Default words of an empty bound: the period has no start, or no end. */
export const PERIOD_OPEN_BOUNDS = ['Dès le début', 'Jusqu’à la fin'] as const;

/** Names of the actions that empty a bound. */
export const PERIOD_CLEAR_LABELS = ['Sans début', 'Sans fin'] as const;

/**
 * Period once a day was picked in its calendar: the start (then the end is next), or the end (the period is complete);
 * a start after the end moves the end to it, an end before the start moves the start (`followBounds`); with
 * `keepLength`, a start moved moves the end by as many days; with `sameDay`, both bounds.
 * @param {PeriodDraft} draft Period before.
 * @param {string} day Day picked.
 * @param {PeriodPickOptions} [options] How the days are picked. Optional.
 * @returns {{ draft: PeriodDraft, complete: boolean }} Period after, and whether both bounds were chosen.
 */
export function pickPeriodDay(draft: PeriodDraft, day: string, { sameDay = false, keepLength = false }: PeriodPickOptions = {}): { draft: PeriodDraft; complete: boolean } {
  const [start, end] = draft.days;
  if (sameDay) return { draft: { ...draft, days: [day, day] }, complete: true };
  if (draft.side === 'end') return { draft: { ...draft, days: followBounds(draft.days, 'end', day) }, complete: true };
  const days: [string | null, string | null] = keepLength && start && end ? [day, addDays(day, Math.max(0, daysBetween(start, end)))] : followBounds(draft.days, 'start', day);
  return { draft: { ...draft, days, side: 'end' }, complete: false };
}

/**
 * Error of a period whose end comes before its start, times included (strictly after for a date-time period).
 * @param {PeriodDraft['days']} days Days.
 * @param {PeriodDraft['times'] | undefined} times Times, for a date-time period.
 * @returns {string | undefined} END_AFTER_START, else none.
 */
export function periodError([start, end]: PeriodDraft['days'], times: PeriodDraft['times'] | undefined): string | undefined {
  if (!times?.[0] || !times[1]) return rangeError(start, end);
  return rangeError(start && `${start} ${times[0]}`, end && `${end} ${times[1]}`, true);
}

/**
 * A bound in words, as the pickers show a day: « 3 nov. 2026 », « lun. 3 nov. 2026 », « 3 nov. 2026 09:00 ».
 * @param {string} day Day.
 * @param {string | null} [time] Time. Optional.
 * @param {boolean} [weekday=false] With its weekday. Optional. Default = false.
 * @returns {string} Text.
 */
export function boundText(day: string, time?: string | null, weekday = false): string {
  const text = dayjs(day).locale('fr').format(weekday ? PICKER_FORMATS.weekday : PICKER_FORMATS.day);
  return time ? `${text} ${time}` : text;
}
