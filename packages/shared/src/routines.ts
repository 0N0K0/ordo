import { z } from 'zod';
import { addDays, daysBetween, occurrenceDates, recurrenceSchema, type Recurrence } from './recurrence';
import { plannedSlots, type WorkScheduleRule } from './work-schedules';
import { optionalColorSchema } from './workspace';

/** Category of routines, in a tree. */
export const routineCategorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
});
export type RoutineCategoryInput = z.input<typeof routineCategorySchema>;

/** Part of a calendar schedule a routine is tied to: before its start, during it, or after its end. */
export const ROUTINE_ANCHORS = ['START', 'WHOLE', 'END'] as const;
export type RoutineAnchor = (typeof ROUTINE_ANCHORS)[number];
export const ROUTINE_ANCHOR_LABELS: Record<RoutineAnchor, string> = { START: 'Avant le début', WHOLE: 'Pendant', END: 'Après la fin' };

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).')
  .nullable()
  .default(null);

/** One time of the day a routine is done in a case (brushing teeth in the morning, at noon, in the evening). */
export const routineSlotSchema = z
  .object({
    /** From when, by when at the latest; null: no limit on that side. */
    fromTime: timeOfDay,
    dueTime: timeOfDay,
    /** Not needed for the day to be done ("2 to 3 times a day": the third one). */
    optional: z.boolean().default(false),
  })
  .refine((slot) => !slot.fromTime || !slot.dueTime || slot.fromTime < slot.dueTime, { path: ['dueTime'], message: 'L’heure maximale doit suivre l’heure de début.' });
export type RoutineSlot = z.infer<typeof routineSlotSchema>;

/** A case of a routine: on which days (a repetition, as the events'), and its times of the day. */
export const routineCaseSchema = z
  .object({
    recurrence: recurrenceSchema,
    slots: z.array(routineSlotSchema).min(1, 'Ajoutez au moins un moment.').max(10, '10 moments au plus.'),
  })
  .refine((item) => item.slots.some((slot) => !slot.optional), { path: ['slots'], message: 'Au moins un moment doit être obligatoire.' });
export type RoutineCase = z.infer<typeof routineCaseSchema>;
export type RoutineCaseInput = z.input<typeof routineCaseSchema>;

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
    /** Cases (days and times of the day) instead of the repetition and the time window; empty: the repetition. */
    cases: z.array(routineCaseSchema).max(20, '20 cas au plus.').default([]),
    /** Calendar schedule it follows instead of its own times and repetition (its days, and the times of its slots). */
    scheduleId: z.string().nullable().default(null),
    scheduleAnchor: z.enum(ROUTINE_ANCHORS).nullable().default(null),
    /** Alerts, in minutes before its moment (when to leave, else its start, else its latest time). */
    reminders: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(24 * 60),
      )
      .max(10, '10 alertes maximum.')
      .default([]),
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
  .refine((routine) => !routine.fromTime || !routine.dueTime || routine.fromTime < routine.dueTime, { path: ['dueTime'], message: 'L’heure maximale doit suivre l’heure de début.' })
  .refine((routine) => !routine.scheduleId || routine.scheduleAnchor !== null, { path: ['scheduleAnchor'], message: 'Choisissez le moment de la plage.' });
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

/** Days scanned to find the occurrences of a routine following a schedule. */
const SCHEDULE_SPAN = 366;

/**
 * Current and next occurrences of a routine following a calendar schedule: the days the schedule has slots on, from the
 * first date of the routine.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} start First date of the routine.
 * @param {string} today Today.
 * @returns {{ current: string | null, next: string | null }} Dates.
 */
export function scheduleOccurrences(schedule: WorkScheduleRule, start: string, today: string): { current: string | null; next: string | null } {
  let current: string | null = null;
  if (start <= today) {
    const from = daysBetween(start, today) > SCHEDULE_SPAN ? addDays(today, -SCHEDULE_SPAN) : start;
    current = plannedSlots([schedule], from, today).at(-1)?.date ?? null;
  }
  const after = addDays(today, 1) < start ? start : addDays(today, 1);
  const next = plannedSlots([schedule], after, addDays(after, SCHEDULE_SPAN))[0]?.date ?? null;
  return { current, next };
}

/**
 * Time window of a routine on a day of its schedule: before the start of its first slot, during its slots (first start
 * to last end), or after the end of its last slot.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {RoutineAnchor} anchor Part of the schedule.
 * @param {string} date Day.
 * @returns {{ fromTime: string | null, dueTime: string | null }} Window (none when the schedule has no slot that day).
 */
export function scheduleWindow(schedule: WorkScheduleRule, anchor: RoutineAnchor, date: string): { fromTime: string | null; dueTime: string | null } {
  const slots = plannedSlots([schedule], date, date).filter((slot) => !slot.allDay);
  if (!slots.length) return { fromTime: null, dueTime: null };
  const first = slots[0].start;
  const last = slots.reduce((end, slot) => (slot.end > end ? slot.end : end), slots[0].end);
  if (anchor === 'START') return { fromTime: null, dueTime: first };
  if (anchor === 'END') return { fromTime: last === '24:00' ? null : last, dueTime: null };
  return { fromTime: first, dueTime: last === '24:00' ? null : last };
}

/**
 * Moment the alerts of a routine count from, on a day: when to leave (its way there), else the start of its window,
 * else its latest time.
 * @param {{ fromTime: string | null, dueTime: string | null, estimate: number | null, travelBefore: number, travelAfter: number }} routine Routine and its window that day.
 * @returns {string | null} HH:MM, null without any time.
 */
export function routineAlertTime(routine: { fromTime: string | null; dueTime: string | null; estimate: number | null; travelBefore: number; travelAfter: number }): string | null {
  return routineSchedule(routine).leaveAt ?? routine.fromTime ?? routine.dueTime;
}

/**
 * Case of a routine on a date: the first of its cases whose repetition (from the first date of the routine) includes it.
 * @param {readonly RoutineCase[]} cases Cases.
 * @param {string} start First date of the routine.
 * @param {string} date Day.
 * @returns {RoutineCase | null} Case.
 */
export function routineCaseOn(cases: readonly RoutineCase[], start: string, date: string): RoutineCase | null {
  if (date < start) return null;
  return cases.find((item) => occurrenceDates(item.recurrence, start, date, date).length > 0) ?? null;
}

/**
 * Current and next occurrences of a routine with cases: the latest and the next of the days of their repetitions.
 * @param {readonly RoutineCase[]} cases Cases.
 * @param {string} start First date of the routine.
 * @param {string} today Today.
 * @returns {{ current: string | null, next: string | null }} Dates.
 */
export function casesOccurrences(cases: readonly RoutineCase[], start: string, today: string): { current: string | null; next: string | null } {
  let current: string | null = null;
  let next: string | null = null;
  for (const item of cases) {
    const found = routineOccurrences(item.recurrence, start, today);
    if (found.current && (!current || found.current > current)) current = found.current;
    if (found.next && (!next || found.next < next)) next = found.next;
  }
  return { current, next };
}
