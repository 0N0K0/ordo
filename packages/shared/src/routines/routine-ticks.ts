import { dayIn, parisParts } from '../dates/days';
import { parisInstant } from '../dates/reminders';

/** Day (YYYY-MM-DD) and time (HH:MM) in Paris a time of the day of a routine was (or is said to be) done at. */
export interface RoutineDoneAt {
  day: string;
  time: string;
}

/** A time of the day of an occurrence to tick, as a « Faite le » form reads it. */
export interface RoutineTickTarget {
  /** Due day of its occurrence (YYYY-MM-DD). */
  dueDate: string;
  /** Its « dès » (HH:MM); null: none. */
  fromTime: string | null;
  /** Its « jusqu’à » (HH:MM); null: none. */
  dueTime: string | null;
}

/**
 * Day and time a « Faite le » form proposes to tick a time of the day of an occurrence: when it is scheduled (its
 * « jusqu’à », else its « dès ») on its due day, or on the day it is ticked from (a past day shown in « Ma journée »),
 * once that is past; else now, or the day it is ticked from at the time of now when that day is already past. Every day
 * and time is read in Paris.
 * @param {RoutineTickTarget} target Time of the day to tick.
 * @param {Date} now Now.
 * @param {string | null} [day] Day it is ticked from (a past day shown in « Ma journée »); null: its due day. Optional. Default = null.
 * @returns {RoutineDoneAt} Day and time proposed.
 */
export function routineTickPrefill({ dueDate, fromTime, dueTime }: RoutineTickTarget, now: Date, day: string | null = null): RoutineDoneAt {
  const current = parisParts(now);
  const target = day ?? dueDate;
  const scheduled = dueTime ?? fromTime;
  if (scheduled && parisInstant(target, scheduled).getTime() <= now.getTime()) return { day: target, time: scheduled };
  if (day && day < current.date) return { day, time: current.time };
  return { day: current.date, time: current.time };
}

/** An occurrence as a list of a day (« Ma journée », the badge of the menu) places it. */
export interface RoutineDayOccurrence {
  /** First day it can be done (its « Ouverture »), YYYY-MM-DD. */
  startDate: string;
  /** Due day (its last day), YYYY-MM-DD. */
  dueDate: string;
  /** Cancelled: not due, never shown by this rule. Optional. Default = false. */
  cancelled?: boolean;
}

/**
 * Whether a time of the day of an occurrence shows on a day (« Ma journée », the badge of the menu): once done, on the
 * day it was done (in Paris), whichever day that is; not done yet, on each day it is open, from its first day to its
 * due day; never when the occurrence is cancelled.
 * @param {RoutineDayOccurrence} occurrence Occurrence.
 * @param {Date | string | null} doneAt When the time of the day was done (its tick); null: not done.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {boolean} It shows that day.
 */
export function routineSlotShownOn(occurrence: RoutineDayOccurrence, doneAt: Date | string | null, day: string): boolean {
  if (occurrence.cancelled) return false;
  if (doneAt) return dayIn(typeof doneAt === 'string' ? new Date(doneAt) : doneAt) === day;
  return occurrence.startDate <= day && day <= occurrence.dueDate;
}

/** Time of the day given to a time of the day ticked on a day without a time of its own, when that day is not today. */
export const ROUTINE_BULK_DEFAULT_TIME = '12:00';

/**
 * When a time of the day ticked in bulk « Faites le » a day was done: that day at its scheduled time (its
 * « jusqu’à », else its « dès »); without any, now on today and noon (`ROUTINE_BULK_DEFAULT_TIME`) another day; never
 * later than now (a time still to come is now). Every day and time is read in Paris.
 * @param {string} day Day chosen (YYYY-MM-DD).
 * @param {{ fromTime: string | null, dueTime: string | null }} slot Its times that day.
 * @param {Date} now Now.
 * @returns {Date} When it was done.
 */
export function routineBulkDoneAt(day: string, { fromTime, dueTime }: { fromTime: string | null; dueTime: string | null }, now: Date): Date {
  const scheduled = dueTime ?? fromTime;
  const at = scheduled ? parisInstant(day, scheduled) : day === parisParts(now).date ? now : parisInstant(day, ROUTINE_BULK_DEFAULT_TIME);
  return at.getTime() > now.getTime() ? now : at;
}
