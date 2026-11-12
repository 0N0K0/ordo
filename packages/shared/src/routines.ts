import { z } from 'zod';
import { addDays, daysBetween, occurrenceDates, recurrenceSchema, type Recurrence } from './recurrence';
import { optionalColorSchema } from './workspace';

/** Category of routines, in a tree. */
export const routineCategorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
});
export type RoutineCategoryInput = z.input<typeof routineCategorySchema>;

/** Routine fields, as saved. */
export const routineSchema = z
  .object({
    title: z.string().trim().min(1, 'Le titre est requis.').max(200, '200 caractères maximum.'),
    description: z
      .string()
      .max(4000, '4 000 caractères maximum.')
      .transform((value) => (value.trim() ? value.trim() : null))
      .nullable(),
    /** Categories it is shown in. */
    categoryIds: z.array(z.string()).max(100),
    parentId: z.string().nullable(),
    startDate: z.iso.date({ error: 'La date de début est requise.' }),
    recurrence: recurrenceSchema,
    /** Minutes. */
    estimate: z
      .number()
      .int()
      .min(1, 'Au moins 1 minute.')
      .max(24 * 60, '24 heures maximum.')
      .nullable(),
    /** Time window to do it in (HH:MM): from fromTime, by dueTime at the latest; null: no limit on that side. */
    fromTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).')
      .nullable()
      .default(null),
    dueTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).')
      .nullable()
      .default(null),
    /** Where it is done: free text, and its point when chosen from the map or a search. */
    location: z
      .string()
      .trim()
      .max(500, '500 caractères maximum.')
      .transform((value) => value || null)
      .nullable()
      .default(null),
    locationLat: z.number().min(-90).max(90).nullable().default(null),
    locationLon: z.number().min(-180).max(180).nullable().default(null),
    /** Travel time to the place and back from it, in minutes. */
    travelBefore: z
      .number()
      .int()
      .min(0, 'Durée positive attendue.')
      .max(24 * 60, '24 h maximum.')
      .default(0),
    travelAfter: z
      .number()
      .int()
      .min(0, 'Durée positive attendue.')
      .max(24 * 60, '24 h maximum.')
      .default(0),
    projectId: z.string().nullable(),
    assigneeIds: z.array(z.string()).max(100),
    /** Routines to do before this one. */
    requiredIds: z.array(z.string()).max(100),
  })
  .refine((routine) => !routine.fromTime || !routine.dueTime || routine.fromTime < routine.dueTime, { path: ['dueTime'], message: 'L’heure maximale doit suivre l’heure de début.' });
export type RoutineInput = z.input<typeof routineSchema>;

/** Where a routine stands today. */
export type RoutineState = 'upcoming' | 'due' | 'late' | 'done';

/** Days of one period of a frequency (upper bound), to bound the scans. */
const PERIOD_DAYS: Record<Recurrence['frequency'], number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 31, YEARLY: 366 };

/**
 * Current and next occurrences of a routine: the current one is the last on or before today (ticked for it), the next
 * one the first after today.
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string} today Today.
 * @returns {{ current: string | null, next: string | null }} Dates (null: none, before the start or once the rule has ended).
 */
export function routineOccurrences(rule: Recurrence, start: string, today: string): { current: string | null; next: string | null } {
  // A period of the rule plus a year, for the paused periods and excluded dates.
  const span = PERIOD_DAYS[rule.frequency] * rule.interval + 366;
  let current: string | null = null;
  if (start <= today) {
    const from = daysBetween(start, today) > span ? addDays(today, -span) : start;
    current = occurrenceDates(rule, start, from, today).at(-1) ?? null;
  }
  const after = addDays(today, 1);
  const next = occurrenceDates(rule, start, after < start ? start : after, addDays(after < start ? start : after, span))[0] ?? null;
  // Once the rule has ended, a past last occurrence is no longer due.
  if (next === null && current !== null && current < today) current = null;
  return { current, next };
}

/**
 * State of a routine today.
 * @param {string | null} current Current occurrence.
 * @param {boolean} done It is ticked.
 * @param {string} today Today.
 * @returns {RoutineState} State.
 */
export function routineState(current: string | null, done: boolean, today: string): RoutineState {
  if (!current) return 'upcoming';
  if (done) return 'done';
  return current < today ? 'late' : 'due';
}

/**
 * Clock time shifted by some minutes, within the day ("08:30" − 25 → "08:05").
 * @param {string} time HH:MM.
 * @param {number} minutes Minutes added (negative: removed).
 * @returns {string} HH:MM.
 */
export function shiftTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Schedule of a routine done in a time window: when to leave (to be there by its latest time with its time to spend on
 * it, or at its start time) and when back.
 * @param {{ fromTime: string | null, dueTime: string | null, estimate: number | null, travelBefore: number, travelAfter: number }} routine Routine.
 * @returns {{ leaveAt: string | null, backAt: string | null }} Times (null: nothing to say).
 */
export function routineSchedule(routine: { fromTime: string | null; dueTime: string | null; estimate: number | null; travelBefore: number; travelAfter: number }): {
  leaveAt: string | null;
  backAt: string | null;
} {
  const estimate = routine.estimate ?? 0;
  if (routine.dueTime) {
    const before = routine.travelBefore + estimate;
    return { leaveAt: before > 0 ? shiftTime(routine.dueTime, -before) : null, backAt: routine.travelAfter > 0 ? shiftTime(routine.dueTime, routine.travelAfter) : null };
  }
  if (routine.fromTime) {
    return {
      leaveAt: routine.travelBefore > 0 ? shiftTime(routine.fromTime, -routine.travelBefore) : null,
      backAt: routine.travelAfter > 0 ? shiftTime(routine.fromTime, estimate + routine.travelAfter) : null,
    };
  }
  return { leaveAt: null, backAt: null };
}
