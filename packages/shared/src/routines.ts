import { slotRuleSchema } from './slot-rules';
import { z } from 'zod';
import { addDays, daysBetween, occurrenceDates, recurrenceSchema, type Recurrence, type Span } from './recurrence';
import { caseSpans } from './repetition';
import { slotConditionSchema } from './routine-times';
import { optionalColorSchema } from './workspace';

/** Category of routines, in a tree. */
export const routineCategorySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
});
export type RoutineCategoryInput = z.input<typeof routineCategorySchema>;

/** Part of a calendar schedule a routine was tied to (former form, read but no longer used). */
export const ROUTINE_ANCHORS = ['START', 'WHOLE', 'END'] as const;
export type RoutineAnchor = (typeof ROUTINE_ANCHORS)[number];

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

const dayNumber = z.number().int().min(1).max(31);
const monthNumber = z.number().int().min(1).max(12);
const weekdayNumber = z.number().int().min(1).max(7);

/**
 * « À partir du »: day an occurrence can be done from, before its due day. A day number (the 15th, the 15th of March),
 * a weekday of the month (the 2nd Tuesday, the last Friday of March), the weekday of a week (the Monday of the 3rd week
 * of the month, of the ISO week 12 of the year), all in its period (its month, its year: the one before when that day
 * comes after its due day); or some days before its due day.
 */
export const routineOpensSchema = z.discriminatedUnion('mode', [
  /** Monthly: month null; yearly: its month. */
  z.object({ mode: z.literal('DAY'), day: dayNumber, month: monthNumber.nullable().default(null) }),
  /** The nth (1 to 4, -1 the last) weekday; monthly: month null; yearly: its month. */
  z.object({ mode: z.literal('WEEKDAY'), position: z.union([z.literal(-1), z.number().int().min(1).max(4)]), weekday: weekdayNumber, month: monthNumber.nullable().default(null) }),
  /** A weekday of a week: monthly, the week of the month (1 to 6, from the one of its 1st, weeks from Monday); yearly, the ISO week. */
  z.object({ mode: z.literal('WEEK'), week: z.number().int().min(1).max(53), weekday: weekdayNumber }),
  /** Days before its due day. */
  z.object({ mode: z.literal('BEFORE'), days: z.number().int().min(1, 'Au moins 1.').max(366, '366 maximum.') }),
]);
export type RoutineOpens = z.infer<typeof routineOpensSchema>;
export type RoutineOpensMode = RoutineOpens['mode'];

/**
 * « À partir du » as saved: an object, or the former "DD" (monthly) and "MM-DD" (yearly); null when none or invalid.
 * @param {unknown} value Saved value.
 * @returns {RoutineOpens | null} « À partir du ».
 */
export function readOpens(value: unknown): RoutineOpens | null {
  if (typeof value === 'string') {
    if (/^\d{2}$/.test(value)) return { mode: 'DAY', day: Number(value), month: null };
    if (/^\d{2}-\d{2}$/.test(value)) return { mode: 'DAY', day: Number(value.slice(3)), month: Number(value.slice(0, 2)) };
    return null;
  }
  const parsed = routineOpensSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Whether an « à partir du » fits a frequency: some days before always; a day of the period for a monthly (without
 * month, a week of the month) or a yearly one (with its month, an ISO week).
 * @param {RoutineOpens} opens « À partir du ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {boolean} It fits.
 */
export function opensFits(opens: RoutineOpens, frequency: Recurrence['frequency']): boolean {
  if (opens.mode === 'BEFORE') return true;
  if (frequency === 'MONTHLY') return opens.mode === 'WEEK' ? opens.week <= 6 : opens.month === null;
  if (frequency === 'YEARLY') return opens.mode === 'WEEK' || opens.month !== null;
  return false;
}

const OPENS_MISFIT = 'Ce « à partir du » ne vaut pas pour cette répétition : un jour du mois (mensuelle), de l’année (annuelle), ou des jours avant.';

/** A case of a routine: on which days (a repetition, as the events'), and its times of the day. */
export const routineCaseSchema = z
  .object({
    /** First day its repetition counts from (none: the first date of the routine). */
    from: z.iso.date({ error: 'Date invalide.' }).nullable().default(null),
    /** Last day it applies (none: no end). */
    until: z.iso.date({ error: 'Date invalide.' }).nullable().default(null),
    /** On or out of calendar schedules, combined in groups (none: any time). */
    condition: slotConditionSchema.nullable().default(null),
    recurrence: recurrenceSchema,
    slots: z.array(routineSlotSchema).min(1, 'Ajoutez au moins un moment.').max(10, '10 moments au plus.'),
    /** « À partir du » of its occurrences (none: from their first day). */
    opens: routineOpensSchema.nullable().default(null),
  })
  .refine((item) => item.slots.some((slot) => !slot.optional), { path: ['slots'], message: 'Au moins un moment doit être obligatoire.' })
  .refine((item) => !item.opens || opensFits(item.opens, item.recurrence.frequency), { path: ['opens'], message: OPENS_MISFIT });
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
    /** Former form: calendar schedules it followed, and those it was done out of (read into its condition). */
    scheduleIds: z.array(z.string()).max(30).default([]),
    excludedScheduleIds: z.array(z.string()).max(30).default([]),
    /** Following its rule: on or out of calendar schedules, combined in groups (none: any time). */
    slotCondition: slotConditionSchema.nullable().default(null),
    /** Times of the day following its rule. */
    moments: z.array(routineSlotSchema).max(10, '10 moments au plus.').default([]),
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
    /** « Bénéficiaires »: whom the routine is for (contributors, relations). */
    beneficiaryIds: z.array(z.string()).max(100).default([]),
    beneficiaryRelationIds: z.array(z.string()).max(100).default([]),
    /** Routines to do before this one. */
    requiredIds: z.array(z.string()).max(100),
    /** « À partir du » of the occurrences of its rule (its cases have theirs); null: from their first day. */
    opensOn: routineOpensSchema.nullable().default(null),
    /** Slots (by kind) it is done on or out of; null: the default of the workspace. */
    slotRule: slotRuleSchema.nullable().default(null),
  })
  .refine((routine) => !routine.fromTime || !routine.dueTime || routine.fromTime < routine.dueTime, { path: ['dueTime'], message: 'L’heure maximale doit suivre l’heure de début.' })
  .refine((routine) => !routine.moments.length || routine.moments.some((moment) => !moment.optional), { path: ['moments'], message: 'Au moins un moment doit être obligatoire.' })
  .refine((routine) => !routine.opensOn || (!routine.cases.length && opensFits(routine.opensOn, routine.recurrence.frequency)), { path: ['opensOn'], message: OPENS_MISFIT });
export type RoutineInput = z.input<typeof routineSchema>;

/**
 * Date of a day of a month, kept within it (the 31st of a 30-day month is its 30th).
 * @param {number} year Year.
 * @param {number} month Month (1-12).
 * @param {number} day Day (1-31).
 * @returns {string} YYYY-MM-DD.
 */
const monthDate = (year: number, month: number, day: number) => {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(Math.max(day, 1), last)).padStart(2, '0')}`;
};

/**
 * Weekday of a date, 1 (Monday) to 7 (Sunday).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Weekday.
 */
const weekdayOf = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * Day of a month an « à partir du » points to (its month for a yearly one).
 * @param {Extract<RoutineOpens, { mode: 'DAY' | 'WEEKDAY' | 'WEEK' }>} opens « À partir du ».
 * @param {number} year Year.
 * @param {number} month Month (1-12).
 * @returns {string} YYYY-MM-DD.
 */
function opensInMonth(opens: Extract<RoutineOpens, { mode: 'DAY' | 'WEEKDAY' | 'WEEK' }>, year: number, month: number): string {
  const first = monthDate(year, month, 1);
  if (opens.mode === 'DAY') return monthDate(year, month, opens.day);
  if (opens.mode === 'WEEKDAY') {
    const firstOne = 1 + ((opens.weekday - weekdayOf(first) + 7) % 7);
    if (opens.position > 0) return monthDate(year, month, firstOne + 7 * (opens.position - 1));
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return monthDate(year, month, last - ((weekdayOf(monthDate(year, month, last)) - opens.weekday + 7) % 7));
  }
  // Weeks from Monday, the first one that of the 1st; kept within the month.
  return monthDate(year, month, 2 - weekdayOf(first) + 7 * (opens.week - 1) + opens.weekday - 1);
}

/**
 * Day of an ISO week of a year (its Monday that of the week of January 4th).
 * @param {number} year ISO year.
 * @param {number} week Week (1-53).
 * @param {number} weekday Weekday (1-7).
 * @returns {string} YYYY-MM-DD.
 */
function isoWeekDate(year: number, week: number, weekday: number): string {
  const january4 = `${year}-01-04`;
  return addDays(january4, 1 - weekdayOf(january4) + 7 * (week - 1) + weekday - 1);
}

/**
 * Day an occurrence can be done from: its « à partir du » in its period (its month, its year; the one before when
 * that day comes after its due day), or some days before its due day; its due day without « à partir du ».
 * @param {string} due Due day (YYYY-MM-DD).
 * @param {RoutineOpens | null} opens « À partir du ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {string} YYYY-MM-DD.
 */
export function routineOpenDate(due: string, opens: RoutineOpens | null, frequency: Recurrence['frequency']): string {
  if (!opens || !opensFits(opens, frequency)) return due;
  if (opens.mode === 'BEFORE') return addDays(due, -opens.days);
  const year = Number(due.slice(0, 4));
  const month = Number(due.slice(5, 7));
  let open: string;
  if (frequency === 'MONTHLY') {
    open = opensInMonth(opens, year, month);
    if (open > due) open = month === 1 ? opensInMonth(opens, year - 1, 12) : opensInMonth(opens, year, month - 1);
  } else if (opens.mode === 'WEEK') {
    open = isoWeekDate(year + 1, opens.week, opens.weekday);
    for (let back = 0; open > due && back < 3; back += 1) open = isoWeekDate(year - back, opens.week, opens.weekday);
  } else {
    open = opensInMonth(opens, year, opens.month!);
    if (open > due) open = opensInMonth(opens, year - 1, opens.month!);
  }
  return open;
}

/**
 * Days at most between the day an occurrence can be done from and its due day.
 * @param {RoutineOpens | null} opens « À partir du ».
 * @returns {number} Days.
 */
export const opensReach = (opens: RoutineOpens | null): number => (!opens ? 0 : opens.mode === 'BEFORE' ? opens.days : 400);

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
 * @param {RoutineOpens | null} [opensOn] Day an occurrence can be done from (« à partir du »): the next one is the current one
 * from then. Optional. Default = null.
 * @returns {{ current: string | null, next: string | null }} Dates (null: none, before the start or once the rule has ended).
 */
export function routineOccurrences(rule: Recurrence, start: string, today: string, opensOn: RoutineOpens | null = null): { current: string | null; next: string | null } {
  if (opensOn) {
    // The next occurrence is the current one as soon as it can be done (from its « à partir du »).
    const found = routineOccurrences(rule, start, today);
    if (found.next && today >= routineOpenDate(found.next, opensOn, rule.frequency)) return { current: found.next, next: routineOccurrences(rule, start, found.next).next };
    return found;
  }
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
 * Case of a routine an occurrence comes from: the first of its cases with an occurrence due on that day (its last
 * day), within its period.
 * @param {readonly RoutineCase[]} cases Cases.
 * @param {string} start First date of the routine.
 * @param {string} date Due day.
 * @returns {RoutineCase | null} Case.
 */
export function routineCaseOn(cases: readonly RoutineCase[], start: string, date: string): RoutineCase | null {
  return cases.find((item) => routineCaseSpans(item, start, date, date).some((span) => span.end === date)) ?? null;
}

/**
 * Occurrences of a case of a routine overlapping a period, each from its first day to its due (last) day.
 * @param {RoutineCase} item Case.
 * @param {string} start First date of the routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {Span[]} Occurrences.
 */
export function routineCaseSpans(item: RoutineCase, start: string, from: string, to: string): Span[] {
  const first = caseStart(item, start);
  return caseSpans({ since: first, until: item.until ?? null, anchor: null, rule: item.recurrence, times: null }, start, from, to);
}

/**
 * First day the repetition of a case counts from: its own, else the first date of the routine (never before it).
 * @param {{ from?: string | null }} item Case.
 * @param {string} start First date of the routine.
 * @returns {string} YYYY-MM-DD.
 */
export function caseStart(item: { from?: string | null }, start: string): string {
  return item.from && item.from > start ? item.from : start;
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
    const found = routineOccurrences(item.recurrence, caseStart(item, start), today, item.opens);
    if (found.current && (!current || found.current > current)) current = found.current;
    if (found.next && (!next || found.next < next)) next = found.next;
  }
  return { current, next };
}

/** Times of the day of an occurrence changed by an exception (by index; null: those of its rule). */
export const routineMoveTimesSchema = z
  .array(z.object({ fromTime: timeOfDay, dueTime: timeOfDay }).nullable())
  .max(10)
  .nullable()
  .default(null);
export type RoutineMoveTimes = z.infer<typeof routineMoveTimesSchema>;

/**
 * Exception to the rule of a routine for one occurrence: moved to another day (postponed or brought forward), its
 * times of the day changed, or deleted (no new day).
 */
export const routineMoveSchema = z
  .object({ from: z.iso.date({ error: 'Date invalide.' }), to: z.iso.date({ error: 'Date invalide.' }).nullable(), times: routineMoveTimesSchema })
  .refine((move) => move.from !== move.to || move.times !== null, 'Choisissez un autre jour ou d’autres horaires.');
export type RoutineMove = z.infer<typeof routineMoveSchema>;

/**
 * Whether an exception takes the occurrence away from its day (moved elsewhere or deleted).
 * @param {RoutineMove} move Exception.
 * @returns {boolean} Away.
 */
export const movesAway = (move: RoutineMove) => move.to !== move.from;

/**
 * Times of the day of an occurrence, with those its exception changes.
 * @param {readonly T[]} slots Times of its rule.
 * @param {RoutineMoveTimes} times Changed times.
 * @returns {T[]} Times.
 */
export function withMovedTimes<T extends { fromTime: string | null; dueTime: string | null }>(slots: readonly T[], times: RoutineMoveTimes): T[] {
  return slots.map((slot, index) => (times?.[index] ? { ...slot, ...times[index] } : slot));
}

/** Moves kept on a routine at most. */
export const MAX_ROUTINE_MOVES = 500;

/** Occurrences scanned at most to skip the moved ones in a row. */
const MOVED_SCAN = 60;

/**
 * Current and next occurrences of a routine with its exceptions: a moved occurrence no longer occurs on its day but on
 * the day it was moved to. When the latest occurrence of the rule is moved away, nothing is due until the day it went
 * to (the occurrences before it do not come back).
 * @param {(today: string) => { current: string | null, next: string | null }} compute Occurrences of the rule alone, on a day.
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} today Today.
 * @returns {{ current: string | null, next: string | null }} Dates.
 */
export function movedOccurrences(
  compute: (today: string) => { current: string | null; next: string | null },
  moves: readonly RoutineMove[],
  today: string,
): { current: string | null; next: string | null } {
  const base = compute(today);
  if (!moves.length) return base;
  const movedAway = new Set(moves.filter(movesAway).map((move) => move.from));
  const latest = base.current;
  const kept = latest && !movedAway.has(latest) ? latest : null;
  let current = kept;
  for (const move of moves) {
    if (!move.to || !movesAway(move) || move.to > today) continue;
    // After the latest occurrence of the rule, or the latest one itself brought forward / postponed to today at most.
    const counts = latest === null || (kept ? move.to > kept : move.from >= latest);
    if (counts && (!current || move.to > current)) current = move.to;
  }
  let next = base.next;
  for (let scanned = 0; next && movedAway.has(next) && scanned < MOVED_SCAN; scanned += 1) next = compute(next).next;
  if (next && movedAway.has(next)) next = null;
  for (const move of moves) if (move.to && movesAway(move) && move.to > today && (!next || move.to < next)) next = move.to;
  return { current, next };
}

/**
 * Day of the rule an occurrence comes from: the day it was moved from, or itself.
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} date Occurrence.
 * @returns {string} Day of the rule (its times of the day are those of that day).
 */
export function movedFrom(moves: readonly RoutineMove[], date: string): string {
  return moves.find((move) => move.to === date)?.from ?? date;
}

/**
 * Exceptions once an occurrence is moved, deleted (no new day) or its times changed: changing a moved one again changes
 * its exception (back to its own day with its own times: no exception).
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} date Occurrence (its day now).
 * @param {string | null} to New day (null: deleted).
 * @param {RoutineMoveTimes} [times] Changed times. Optional. Default = those already changed.
 * @returns {RoutineMove[]} Exceptions.
 */
export function withMove(moves: readonly RoutineMove[], date: string, to: string | null, times?: RoutineMoveTimes): RoutineMove[] {
  const from = movedFrom(moves, date);
  const current = moves.find((move) => move.from === from);
  const others = moves.filter((move) => move.from !== from);
  const kept = to === null ? null : times === undefined ? (current?.times ?? null) : times && times.some(Boolean) ? times : null;
  return from === to && !kept ? others : [...others, { from, to, times: kept }].sort((a, b) => a.from.localeCompare(b.from));
}
