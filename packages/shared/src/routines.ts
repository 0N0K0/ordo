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
export const routineSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis.').max(200, '200 caractères maximum.'),
  description: z
    .string()
    .max(4000, '4 000 caractères maximum.')
    .transform((value) => (value.trim() ? value.trim() : null))
    .nullable(),
  categoryId: z.string().nullable(),
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
  projectId: z.string().nullable(),
  assigneeIds: z.array(z.string()).max(100),
  /** Routines to do before this one. */
  requiredIds: z.array(z.string()).max(100),
});
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
