import { dayInMonth, dayOfMonthOf, daysInMonth } from '../dates/months';
import { plural } from '../core/text';
import { minutesToTime, timeToMinutes } from '../dates/times';
import { z } from 'zod';
import { endAfter, markdownSchema, optionalText, requiredText, UserError } from '../core/rules';
import { locatedFields } from '../core/geo';
import { itemLinksSchema } from '../core/links';
import { linkedDocumentsFields } from '../core/documents';
import { addDays, daysBetween, weekdayOfDate, monthOfYear, yearOfDay } from '../dates/days';
import {
  isLastDayRule,
  LAST_DAY,
  monthDaySchema,
  lastDayStandIn,
  occurrenceDates,
  occurrencesBefore,
  proposedMovedRule,
  MAX_RULE_EXCEPTIONS,
  recurrenceSchema,
  rulePattern,
  rhythmInterval,
  RuleChoiceRequired,
  ruleMovedTo,
  shiftedDates,
  type Recurrence,
  type Span,
} from '../dates/recurrence';
import { caseSpans, caseUntil } from '../dates/repetition';
import { lengthLimits, limitsError, repetitionLimits, type RepetitionLimitError, type RepetitionLimits } from '../dates/repetition-limits';
import { timeOfDaySchema, daySchema, startDaySchema } from '../dates/times';
import { remindersSchema } from '../dates/reminders';
import { deadTimesSchema } from '../dates/countdowns';
import { conditionConstrains, slotConditionSchema, type SlotCondition } from '../calendar/slot-conditions';
import { optionalColorSchema } from '../core/workspace';
import { formatNumber } from '../core/numbers';
import { ROUTINE_INHERITABLE_FIELDS, type RoutineInheritableField } from './routine-inheritance';

/** Category of routines, in a tree. */
export const routineCategorySchema = z.object({
  label: requiredText(),
  color: optionalColorSchema,
  parentId: z.string().nullable(),
});
export type RoutineCategoryInput = z.input<typeof routineCategorySchema>;

/** Part of a calendar schedule a routine was tied to (former form, read but no longer used). */
const ROUTINE_ANCHORS = ['START', 'WHOLE', 'END'] as const;
export type RoutineAnchor = (typeof ROUTINE_ANCHORS)[number];

const timeOfDay = timeOfDaySchema.nullable().default(null);

/** One time of the day a routine is done in a case (brushing teeth in the morning, at noon, in the evening). */
export const routineSlotSchema = z
  .object({
    /** From when, by when at the latest; null: no limit on that side. */
    fromTime: timeOfDay,
    dueTime: timeOfDay,
    /** Not needed for the day to be done ("2 to 3 times a day": the third one). */
    optional: z.boolean().default(false),
  })
  .refine(...endAfter('fromTime', 'dueTime', true));
export type RoutineSlot = z.infer<typeof routineSlotSchema>;

const monthNumber = z.number().int().min(1).max(12);
const weekdayNumber = z.number().int().min(1).max(7);

/** Units of an « Ouverture » some time before the due day. */
export const OPENS_UNITS = ['DAYS', 'WEEKS', 'MONTHS'] as const;
export type OpensUnit = (typeof OPENS_UNITS)[number];

/**
 * « Ouverture »: day an occurrence can be done from, before its due day. A day number (the 15th, the 15th of March),
 * a weekday of the month (the 2nd Tuesday, the last Friday of March), the weekday of a week (the Monday of the 3rd week
 * of the month, of the ISO week 12 of the year), all in its period (its month, its year: the one before when that day
 * comes after its due day); or some days before its due day.
 */
const routineOpensSchema = z.discriminatedUnion('mode', [
  /** The day number, or -1 the last day of the month (`LAST_DAY`); monthly: month null; yearly: its month. */
  z.object({ mode: z.literal('DAY'), day: monthDaySchema, month: monthNumber.nullable().default(null) }),
  /** The nth (1 to 4, -1 the last) weekday; monthly: month null; yearly: its month. */
  z.object({ mode: z.literal('WEEKDAY'), position: z.union([z.literal(-1), z.number().int().min(1).max(4)]), weekday: weekdayNumber, month: monthNumber.nullable().default(null) }),
  /** A weekday of a week: monthly, the week of the month (1 to 6, from the one of its 1st, weeks from Monday); yearly, the ISO week. */
  z.object({ mode: z.literal('WEEK'), week: z.number().int().min(1).max(53), weekday: weekdayNumber }),
  /** Some days, weeks or months before its due day (`days`: how many of its unit; none saved: days). */
  z.object({ mode: z.literal('BEFORE'), days: z.number().int().min(1, 'Au moins 1.').max(366, '366 maximum.'), unit: z.enum(OPENS_UNITS).optional() }),
]);
export type RoutineOpens = z.infer<typeof routineOpensSchema>;
export type RoutineOpensMode = RoutineOpens['mode'];

/**
 * « Ouverture » as saved: an object, or the former "DD" (monthly) and "MM-DD" (yearly); null when none or invalid.
 * @param {unknown} value Saved value.
 * @returns {RoutineOpens | null} « Ouverture ».
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
 * Whether an « Ouverture » fits a frequency: some days before always; a day of the period for a monthly (without
 * month, a week of the month) or a yearly one (with its month, an ISO week).
 * @param {RoutineOpens} opens « Ouverture ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {boolean} It fits.
 */
export function opensFits(opens: RoutineOpens, frequency: Recurrence['frequency']): boolean {
  if (opens.mode === 'BEFORE') return true;
  if (frequency === 'MONTHLY') return opens.mode === 'WEEK' ? opens.week <= 6 : opens.month === null;
  if (frequency === 'YEARLY') return opens.mode === 'WEEK' || opens.month !== null;
  return false;
}

/** Refusal of an « Ouverture » that does not fit the repetition of its routine. */
export const OPENS_MISFIT = 'Cette ouverture ne vaut pas pour cette répétition : un jour du mois (mensuelle), de l’année (annuelle), ou des jours avant.';

/**
 * Whether the « Ouverture » of the rule of a routine does not fit it: a routine with cases has none (its cases have
 * theirs), and it must fit the frequency of its repetition (`opensFits`).
 * @param {{ opensOn: RoutineOpens | null, cases: readonly unknown[], recurrence: Pick<Recurrence, 'frequency'> | null }} routine Routine.
 * @returns {boolean} It does not fit.
 */
export function opensMisfits(routine: { opensOn: RoutineOpens | null; cases: readonly unknown[]; recurrence: Pick<Recurrence, 'frequency'> | null }): boolean {
  return routine.opensOn !== null && (routine.cases.length > 0 || !routine.recurrence || !opensFits(routine.opensOn, routine.recurrence.frequency));
}

/** Fields an « Ouverture » is checked with: inherited, the API checks it on the values the routine goes by. */
const OPENS_CHECKED_WITH: readonly RoutineInheritableField[] = ['OPENS_ON', 'RECURRENCE', 'CASES'];

/** Fields of a case of a routine: on which days (a repetition, as the events'), and its times of the day. */
const routineCaseFields = {
  /** « Début »: first day its repetition counts from (none: the first date of the routine). Its end is its rule's. */
  from: daySchema().nullable().default(null),
  /** On or out of calendar schedules, combined in groups (none: any time). */
  condition: slotConditionSchema.nullable().default(null),
  recurrence: recurrenceSchema,
  slots: z.array(routineSlotSchema).min(1, 'Ajoutez au moins un moment.').max(10, '10 moments au plus.'),
  /** « Ouverture » of its occurrences (none: from their first day). */
  opens: routineOpensSchema.nullable().default(null),
};

/**
 * Refinements of a case of a routine: a moment required, an « Ouverture » fitting its rule.
 * @template T
 * @param {T} schema Schema of a case.
 * @returns {z.ZodEffects} Schema refined.
 */
const refinedCase = <T extends z.ZodType<{ slots: { optional: boolean }[]; opens: RoutineOpens | null; recurrence: Recurrence }>>(schema: T) =>
  schema
    .refine((item) => item.slots.some((slot) => !slot.optional), { path: ['slots'], message: 'Au moins un moment doit être obligatoire.' })
    .refine((item) => !item.opens || opensFits(item.opens, item.recurrence.frequency), { path: ['opens'], message: OPENS_MISFIT });

/** A case of a routine: on which days (a repetition, as the events'), and its times of the day. */
export const routineCaseSchema = refinedCase(z.object(routineCaseFields));
export type RoutineCase = z.infer<typeof routineCaseSchema>;
export type RoutineCaseInput = z.input<typeof routineCaseSchema>;

/** A case of a routine as stored: maybe with a last day of its own (`until`, its former period), only read (`readRoutineCases`). */
const storedRoutineCaseSchema = refinedCase(z.object({ ...routineCaseFields, until: daySchema().nullable().default(null) }));

/**
 * Stored cases of a routine as read (invalid ones: none): one stored with a last day of its own (its former period)
 * gets it as the end of its rule (`caseUntil`: a number of occurrences reduced to those up to it, an earlier end date
 * kept), written so on the next save; one without any occurrence up to it keeps none (its rule ends before its start).
 * @param {unknown} value Stored JSON.
 * @param {string} start First date of the routine.
 * @returns {RoutineCase[]} Cases.
 */
export function readRoutineCases(value: unknown, start: string): RoutineCase[] {
  const parsed = z.array(storedRoutineCaseSchema).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.flatMap(({ until, ...item }) => {
    if (!until) return [item];
    const first = caseStart(item, start);
    const kept = caseUntil({ start: first, rule: item.recurrence, times: null }, until, start);
    // None up to its last day: kept without any occurrence (its place among the cases stays).
    return [{ ...item, recurrence: kept?.rule ?? { ...item.recurrence, count: null, until: addDays(first, -1) } }];
  });
}

/**
 * Rows (comments, checklist, links with events) a merged occurrence notes at most (`mergedRows`): a merge that would
 * bring more is refused.
 */
export const MAX_MERGED_ROWS = 1000;

/** Times of the day of an occurrence changed by an exception (by index; null: those of its rule). */
export const routineMoveTimesSchema = z
  .array(z.object({ fromTime: timeOfDay, dueTime: timeOfDay }).nullable())
  .max(10)
  .nullable()
  .default(null);
export type RoutineMoveTimes = z.infer<typeof routineMoveTimesSchema>;

/**
 * Exception to the rule of a routine for one occurrence: moved to another day (postponed or brought forward), its
 * times of the day changed, or deleted (no new day). Moved onto a day that has its own occurrence, both may be kept
 * apart (`apart`): the moved one then keeps the day of its rule as its identity (its ticks, comments, checklist and
 * links with events), shown on its new day; or merged (`merged`): it is no longer an occurrence of its own, its rows
 * went to the occurrence identified by its new day, which keeps its own days and times (`mergedRows`: the rows it
 * brought, those that go back to its day when the merge is undone). Cancelled or merged, it keeps the exception the
 * occurrence had before (`previous`: moved, kept apart, other times), given back when that is undone.
 */
export const routineMoveSchema = z
  .object({
    from: daySchema(),
    to: daySchema().nullable(),
    times: routineMoveTimesSchema,
    apart: z.boolean().optional(),
    merged: z.boolean().optional(),
    mergedRows: z.array(z.string()).max(MAX_MERGED_ROWS).optional(),
    previous: z.object({ to: daySchema().nullable(), times: routineMoveTimesSchema, apart: z.boolean().optional() }).optional(),
  })
  .refine((move) => move.from !== move.to || move.times !== null, 'Choisissez un autre jour ou d’autres horaires.');
export type RoutineMove = z.infer<typeof routineMoveSchema>;

/**
 * Exception a cancel or a merge keeps to give back when it is undone (`previous`): the one the occurrence had before
 * (a cancel or a merge again: the one kept before the first; none, merged before: none).
 * @param {RoutineMove | undefined} prior Exception of the occurrence before the change.
 * @param {RoutineMove} move Exception after it.
 * @returns {RoutineMove['previous']} Exception kept (undefined: none, or the change is neither a cancel nor a merge).
 */
export function previousMove(prior: RoutineMove | undefined, move: RoutineMove): RoutineMove['previous'] {
  const cancel = move.to === null;
  if (!prior || !(cancel || move.merged)) return undefined;
  if (cancel ? prior.to === null : prior.merged) return prior.previous;
  if (prior.merged) return undefined;
  return { to: prior.to, times: prior.times, ...(prior.apart && { apart: true }) };
}

/** How an occurrence moved onto a day is identified there: by that day (`OWN`), kept apart by the day of its rule (`APART`), or merged into the occurrence of that day (`MERGED`). */
export type RoutineMoveJoin = 'OWN' | 'APART' | 'MERGED';

/** Moves kept on a routine at most. */
export const MAX_ROUTINE_MOVES = 500;

/** Routine fields, as saved. */
export const routineSchema = z
  .object({
    label: requiredText(),
    description: markdownSchema,
    /** Categories it is shown in. */
    categoryIds: z.array(z.string()).max(100),
    /** Priority and type, from the lists of the tasks; null: none. */
    priorityId: z.string().nullable().default(null),
    typeId: z.string().nullable().default(null),
    parentId: z.string().nullable(),
    startDate: startDaySchema,
    recurrence: recurrenceSchema,
    /** Minutes. */
    estimate: z
      .number()
      .int()
      .min(1, 'Au moins 1 minute.')
      .max(24 * 60, '24 heures maximum.')
      .nullable(),
    /** Time window to do it in (HH:MM): from fromTime, by dueTime at the latest; null: no limit on that side. */
    fromTime: timeOfDay,
    dueTime: timeOfDay,
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
    /** Reminders: minutes before each time of the day from its first day (« Ouverture », « dès »), or a time of that day. */
    reminders: remindersSchema.default([]),
    /** « Temps morts »: waits a timer is launched for, from an occurrence; not time spent. Required, as `links`: an omitted field never wipes them. */
    deadTimes: deadTimesSchema,
    /** Where it is done: free text, and its point when chosen from the map or a search. */
    location: optionalText().default(null),
    /** Point of the place, and travel time to it and back from it, in minutes. */
    ...locatedFields,
    /** Links, as those of the events; required, as `relatedIds`: an omitted field never wipes them. */
    links: itemLinksSchema,
    /** Documents linked to it: of the library, and of its project tree (not inherited). */
    ...linkedDocumentsFields,
    projectId: z.string().nullable(),
    assigneeIds: z.array(z.string()).max(100),
    /** « Bénéficiaires »: whom the routine is for (contributors, relations). */
    beneficiaryIds: z.array(z.string()).max(100).default([]),
    beneficiaryRelationIds: z.array(z.string()).max(100).default([]),
    /** Routines to do before this one. */
    requiredIds: z.array(z.string()).max(100),
    /** « Relative à »: routines related to this one (both ways), in its project tree. */
    relatedIds: z.array(z.string()).max(100),
    /** « Ouverture » of the occurrences of its rule (its cases have theirs); null: from their first day. */
    opensOn: routineOpensSchema.nullable().default(null),
    /**
     * Fields it takes from its parent, live; omitted: none for a new routine, unchanged for an update.
     * Ignored without parent.
     */
    inheritedFields: z.array(z.enum(ROUTINE_INHERITABLE_FIELDS)).max(ROUTINE_INHERITABLE_FIELDS.length).optional(),
    /**
     * Its exceptions (occurrences moved, changed or cancelled), given back by an undo; omitted: kept. Not taken by a new
     * routine (a copy has none of its own).
     */
    moves: z.array(routineMoveSchema).max(MAX_ROUTINE_MOVES, `${MAX_ROUTINE_MOVES} exceptions au plus.`).optional(),
  })
  .refine(...endAfter('fromTime', 'dueTime', true))
  .refine((routine) => !routine.moments.length || routine.moments.some((moment) => !moment.optional), { path: ['moments'], message: 'Au moins un moment doit être obligatoire.' })
  .refine((routine) => (routine.parentId && routine.inheritedFields?.some((field) => OPENS_CHECKED_WITH.includes(field))) || !opensMisfits({ ...routine, opensOn: routine.opensOn ?? null }), {
    path: ['opensOn'],
    message: OPENS_MISFIT,
  });
export type RoutineInput = z.input<typeof routineSchema>;

/**
 * Day of a month an « Ouverture » points to (its month for a yearly one).
 * @param {Extract<RoutineOpens, { mode: 'DAY' | 'WEEKDAY' | 'WEEK' }>} opens « Ouverture ».
 * @param {number} year Year.
 * @param {number} month Month (1-12).
 * @returns {string} YYYY-MM-DD.
 */
function opensInMonth(opens: Extract<RoutineOpens, { mode: 'DAY' | 'WEEKDAY' | 'WEEK' }>, year: number, month: number): string {
  const first = dayInMonth(year, month, 1);
  // The last day of the month: the 31st, kept within the month.
  if (opens.mode === 'DAY') return dayInMonth(year, month, opens.day === LAST_DAY ? 31 : opens.day);
  if (opens.mode === 'WEEKDAY') {
    const firstOne = 1 + ((opens.weekday - weekdayOfDate(first) + 7) % 7);
    if (opens.position > 0) return dayInMonth(year, month, firstOne + 7 * (opens.position - 1));
    const last = daysInMonth(year, month);
    return dayInMonth(year, month, last - ((weekdayOfDate(dayInMonth(year, month, last)) - opens.weekday + 7) % 7));
  }
  // Weeks from Monday, the first one that of the 1st; kept within the month on the same weekday (that weekday of the
  // week of the 1st before the 1st: the first one of the month; of a week past its end: the last one).
  let day = 2 - weekdayOfDate(first) + 7 * (opens.week - 1) + opens.weekday - 1;
  while (day < 1) day += 7;
  while (day > daysInMonth(year, month)) day -= 7;
  return dayInMonth(year, month, day);
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
  return addDays(january4, 1 - weekdayOfDate(january4) + 7 * (week - 1) + weekday - 1);
}

/**
 * Day an occurrence can be done from: its « Ouverture » in its period (its month, its year; the one before when
 * that day comes after its due day), or some days before its due day; its due day without « Ouverture ». Monthly on
 * the last day of the month (`LAST_DAY`): always the last day of the month before the due day's (« le dernier jour du
 * mois précédent »), even when the due day is a last day itself.
 * @param {string} due Due day (YYYY-MM-DD).
 * @param {RoutineOpens | null} opens « Ouverture ».
 * @param {Recurrence['frequency']} frequency Frequency of its rule.
 * @returns {string} YYYY-MM-DD.
 */
export function routineOpenDate(due: string, opens: RoutineOpens | null, frequency: Recurrence['frequency']): string {
  if (!opens || !opensFits(opens, frequency)) return due;
  if (opens.mode === 'BEFORE') return opensBeforeDay(due, opens.days, opens.unit);
  const year = yearOfDay(due);
  const month = monthOfYear(due);
  let open: string;
  if (frequency === 'MONTHLY' && opens.mode === 'DAY' && opens.day === LAST_DAY) {
    open = month === 1 ? dayInMonth(year - 1, 12, 31) : dayInMonth(year, month - 1, 31);
  } else if (frequency === 'MONTHLY') {
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
 * Day some days, weeks or months before a due day: N months before is the same day number (the last day of a shorter
 * month: 3 months before the 31st of May is the 28th or 29th of February).
 * @param {string} due Due day.
 * @param {number} count How many.
 * @param {OpensUnit} [unit='DAYS'] Unit. Optional. Default = 'DAYS'.
 * @returns {string} Day.
 */
export function opensBeforeDay(due: string, count: number, unit: OpensUnit = 'DAYS'): string {
  if (unit === 'DAYS') return addDays(due, -count);
  if (unit === 'WEEKS') return addDays(due, -7 * count);
  const month = monthOfYear(due) - 1 - count;
  const year = yearOfDay(due) + Math.floor(month / 12);
  const monthNumber = ((month % 12) + 12) % 12 + 1;
  return dayInMonth(year, monthNumber, Math.min(dayOfMonthOf(due), daysInMonth(year, monthNumber)));
}

/**
 * Days at most between the day an occurrence can be done from and its due day.
 * @param {RoutineOpens | null} opens « Ouverture ».
 * @returns {number} Days.
 */
export const opensReach = (opens: RoutineOpens | null): number =>
  !opens ? 0 : opens.mode === 'BEFORE' ? (opens.unit === 'WEEKS' ? 7 * opens.days : opens.unit === 'MONTHS' ? 31 * opens.days : opens.days) : 400;

/**
 * Limits of the repetition of a rule by its « Ouverture » some time before the due day: the next occurrence opens
 * strictly after the due day of the previous one (3 days before: from « Tous les 4 jours »; 2 weeks before: from
 * « Toutes les 3 semaines »). Another « Ouverture » (a day of the period): none.
 * @param {RoutineOpens | null} opens « Ouverture ».
 * @returns {RepetitionLimits | null} Limits.
 */
export function opensLimits(opens: RoutineOpens | null): RepetitionLimits | null {
  if (opens?.mode !== 'BEFORE') return null;
  const unit = opens.unit ?? 'DAYS';
  const limits = lengthLimits(unit, opens.days, false);
  const word = unit === 'MONTHS' ? 'mois' : plural(opens.days, unit === 'WEEKS' ? 'semaine' : 'jour');
  return limits && { ...limits, kind: 'opening', words: `ouverte ${opens.days} ${word} avant` };
}

/**
 * Error of the rule of a routine (or of one of its cases) out of the limits of the duration of its occurrences and of
 * its « Ouverture » before the due day (the error of the one it breaks, the duration first); none when it keeps them.
 * @param {Recurrence | null} rule Rule.
 * @param {RoutineOpens | null} opens Its « Ouverture ».
 * @returns {RepetitionLimitError | null} Error.
 */
export const routineRuleLimitError = (rule: Recurrence | null, opens: RoutineOpens | null): RepetitionLimitError | null =>
  limitsError(rule, repetitionLimits(rule?.duration)) ?? limitsError(rule, opensLimits(opens));

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
 * @param {RoutineOpens | null} [opensOn] Day an occurrence can be done from (« Ouverture »): the next one is the current one
 * from then. Optional. Default = null.
 * @returns {{ current: string | null, next: string | null }} Dates (null: none, before the start or once the rule has ended).
 */
export function routineOccurrences(rule: Recurrence, start: string, today: string, opensOn: RoutineOpens | null = null): { current: string | null; next: string | null } {
  if (opensOn) {
    // The next occurrence is the current one as soon as it can be done (from its « Ouverture »).
    const found = routineOccurrences(rule, start, today);
    if (found.next && today >= routineOpenDate(found.next, opensOn, rule.frequency)) return { current: found.next, next: routineOccurrences(rule, start, found.next).next };
    return found;
  }
  // A period of the rule plus a year, for its exceptions.
  const span = PERIOD_DAYS[rule.frequency] * rhythmInterval(rule) + 366;
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
  return minutesToTime((((timeToMinutes(time) + minutes) % 1440) + 1440) % 1440);
}

/**
 * Minutes a moment of a routine lasts without time to spend on it (`estimate` null or 0), the same for its display (agenda
 * of the day, agenda), its departure and return and its reminders.
 */
export const ROUTINE_DEFAULT_MINUTES = 30;

/**
 * Time to spend on a routine, in minutes: its `estimate`, else `ROUTINE_DEFAULT_MINUTES`.
 * @param {number | null | undefined} estimate Time to spend on it (null or 0: none).
 * @returns {number} Minutes.
 */
export const routineMinutes = (estimate: number | null | undefined): number => (estimate && estimate > 0 ? estimate : ROUTINE_DEFAULT_MINUTES);

/**
 * Schedule of a routine done in a time window: when to leave (to be there by its latest time with its time to spend on
 * it, or at its start time) and when back; without time to spend on it, `ROUTINE_DEFAULT_MINUTES`.
 * @param {{ fromTime: string | null, dueTime: string | null, estimate: number | null, travelBefore: number, travelAfter: number }} routine Routine.
 * @returns {{ leaveAt: string | null, backAt: string | null }} Times (null: nothing to say).
 */
export function routineSchedule(routine: { fromTime: string | null; dueTime: string | null; estimate: number | null; travelBefore: number; travelAfter: number }): {
  leaveAt: string | null;
  backAt: string | null;
} {
  const estimate = routineMinutes(routine.estimate);
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

/** Start and end of a time of the day of a routine (HH:MM; end null: the midnight after the day). */
export interface RoutineSlotSpan {
  start: string;
  end: string | null;
}

/**
 * Start and end of a time of the day of a routine, the same for its display (agenda of the day) and its reminders
 * (`routineSlotAnchors`, in the app and on the server): its « dès » and its « jusqu'à »; without « jusqu'à »,
 * « dès » + the time to spend on it; without « dès », « jusqu'à » − that time (00:00 at the earliest). Without that
 * time (or 0): `ROUTINE_DEFAULT_MINUTES` (`routineMinutes`). Without any hour: none (no reminder « avant »).
 * @param {{ fromTime: string | null, dueTime: string | null }} slot Time of the day.
 * @param {number | null} minutes Time to spend on it (`estimate`), in minutes.
 * @returns {RoutineSlotSpan | null} Start and end, null without any hour.
 */
export function routineSlotSpan(slot: { fromTime: string | null; dueTime: string | null }, minutes: number | null): RoutineSlotSpan | null {
  if (!slot.fromTime && !slot.dueTime) return null;
  const length = routineMinutes(minutes);
  const start = slot.fromTime ?? minutesToTime(Math.max(0, timeToMinutes(slot.dueTime!) - length));
  if (slot.dueTime) return { start, end: slot.dueTime };
  const end = timeToMinutes(slot.fromTime!) + length;
  return { start, end: end < 1440 ? minutesToTime(end) : null };
}

/**
 * Whether a routine has hours (« dès » or « jusqu'à » of one of its moments, or a condition on calendar schedules, whose
 * slots give them): without any, it has no reminder « N min / h avant », only « Le jour J à HH:MM » and « N jours
 * avant » (its editor offers only those, the API refuses the others).
 * @param {object} routine Routine: its window, moments, condition and cases.
 * @param {string | null} [routine.fromTime] Former window: from. Optional.
 * @param {string | null} [routine.dueTime] Former window: by. Optional.
 * @param {readonly { fromTime: string | null, dueTime: string | null }[]} routine.moments Moments of its rule.
 * @param {SlotCondition | null} routine.slotCondition Condition of its rule.
 * @param {readonly { slots: readonly { fromTime: string | null, dueTime: string | null }[], condition: SlotCondition | null }[]} routine.cases Cases (with them, theirs only).
 * @returns {boolean} It has some.
 */
export function routineHasHours(routine: {
  fromTime?: string | null;
  dueTime?: string | null;
  moments: readonly { fromTime: string | null; dueTime: string | null }[];
  slotCondition: SlotCondition | null;
  cases: readonly { slots: readonly { fromTime: string | null; dueTime: string | null }[]; condition: SlotCondition | null }[];
}): boolean {
  /**
   * Whether a moment has an hour.
   * @param {{ fromTime?: string | null, dueTime?: string | null }} moment Moment.
   * @returns {boolean} It has one.
   */
  const timed = (moment: { fromTime?: string | null; dueTime?: string | null }) => Boolean(moment.fromTime || moment.dueTime);
  if (routine.cases.length) return routine.cases.some((item) => conditionConstrains(item.condition) || item.slots.some(timed));
  return conditionConstrains(routine.slotCondition) || timed(routine) || routine.moments.some(timed);
}

/**
 * Case of a routine an occurrence comes from: the first of its cases with an occurrence due on that day (its last
 * day).
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
  return caseSpans({ start: caseStart(item, start), rule: item.recurrence, times: null }, start, from, to);
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
 * Cases of a routine once « Toutes » moved some of them (`moved`, the new pieces) earlier than its first time: its first
 * time becomes the earliest day they count from, and every other case (the moved ones without a day of their own too)
 * keeps the day it counted from (`caseStart`, written on it), so that its occurrences stay. Nothing before its first
 * time: unchanged.
 * @param {readonly T[]} cases Cases, in order (the moved ones among them).
 * @param {ReadonlySet<T>} moved Cases moved.
 * @param {string} start First time of the routine.
 * @returns {{ startDate: string, cases: T[] }} First time and cases.
 */
export function earlierCases<T extends { from: string | null }>(cases: readonly T[], moved: ReadonlySet<T>, start: string): { startDate: string; cases: T[] } {
  const earlier = (item: T) => moved.has(item) && item.from !== null && item.from < start;
  const startDate = cases.filter(earlier).reduce((day, item) => (item.from! < day ? item.from! : day), start);
  if (startDate === start) return { startDate, cases: [...cases] };
  return { startDate, cases: cases.map((item) => (earlier(item) ? item : { ...item, from: caseStart(item, start) })) };
}

/**
 * Whether an exception takes the occurrence away from its day (moved elsewhere, merged into another or deleted).
 * @param {RoutineMove} move Exception.
 * @returns {boolean} Away.
 */
const movesAway = (move: RoutineMove) => move.to !== move.from;

/**
 * Whether an exception brings its occurrence onto another day, as an occurrence of its own there (not merged).
 * @param {RoutineMove} move Exception.
 * @returns {boolean} Moved in.
 */
const movesIn = (move: RoutineMove): move is RoutineMove & { to: string } => move.to !== null && movesAway(move) && !move.merged;

/**
 * Times of the day of an occurrence, with those its exception changes.
 * @param {readonly T[]} slots Times of its rule.
 * @param {RoutineMoveTimes} times Changed times.
 * @returns {T[]} Times.
 */
export function withMovedTimes<T extends { fromTime: string | null; dueTime: string | null }>(slots: readonly T[], times: RoutineMoveTimes): T[] {
  return slots.map((slot, index) => (times?.[index] ? { ...slot, ...times[index] } : slot));
}

/** Occurrences scanned at most to skip the moved ones in a row. */
const MOVED_SCAN = 60;

/**
 * Day an exception identifies its occurrence by (the day of its ticks, comments, checklist and links with events): the
 * day it was moved to (merged: the occurrence it went into), or the day of its rule when kept apart from the occurrence
 * of the day it went to, or cancelled.
 * @param {RoutineMove} move Exception.
 * @returns {string} Day.
 */
export const moveKey = (move: RoutineMove): string => (move.apart || !move.to ? move.from : move.to);

/**
 * Due day of an occurrence, from the day that identifies it: the day it was moved to when kept apart, else itself.
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} date Occurrence (the day that identifies it).
 * @returns {string} Due day.
 */
export function occurrenceDueDay(moves: readonly RoutineMove[], date: string): string {
  return moves.find((move) => move.apart && move.from === date)?.to ?? date;
}

/**
 * Link of an event with an occurrence of a routine, moved with the event by some days from the day the occurrence
 * shows on: an occurrence shown on the day that identifies it is asked on its new day (`date`: that day), one kept
 * apart (identified by the day of its rule) keeps its day, so that `relinkedOccurrence` takes the one of the same kind.
 * @param {{ routineId: string, date: string }} link Link (`date`: the day that identifies its occurrence).
 * @param {string} shown Day its occurrence shows on.
 * @param {number} shift Days moved.
 * @returns {{ routineId: string, date: string, shownDate: string }} Link moved (`shownDate`: its new day).
 */
export function shiftedRoutineLink(link: { routineId: string; date: string }, shown: string, shift: number): { routineId: string; date: string; shownDate: string } {
  const moved = addDays(shown, shift);
  return { routineId: link.routineId, date: shown === link.date ? moved : link.date, shownDate: moved };
}

/**
 * Occurrence of a routine a link of an event goes to once the event changes day: the one of that routine shown on the
 * day the link now shows on (`shownDate`), by the day that identifies it; two shown that day (one kept apart), the one
 * it was linked to if still there, else the one of the same kind (kept apart or not). None that day: null (the link
 * is dropped).
 * @param {{ routineId: string, date: string, shownDate?: string | null }} link Link (`date`: the day that identified its occurrence).
 * @param {readonly { routineId: string, date: string, shownDate: string, cancelled?: boolean }[]} occurrences Occurrences of the routines on those days (`date`: the day that identifies each).
 * @returns {string | null} Day that identifies the occurrence linked.
 */
export function relinkedOccurrence(
  link: { routineId: string; date: string; shownDate?: string | null },
  occurrences: readonly { routineId: string; date: string; shownDate: string; cancelled?: boolean }[],
): string | null {
  const shown = link.shownDate ?? link.date;
  const candidates = occurrences.filter((item) => item.routineId === link.routineId && item.shownDate === shown && !item.cancelled);
  if (candidates.some((item) => item.date === link.date)) return link.date;
  const apart = link.date !== shown;
  return (candidates.find((item) => (item.date !== item.shownDate) === apart) ?? candidates[0])?.date ?? null;
}

/** A tick of an occurrence: the day that identifies the occurrence, and when it was done (ms; none: unknown). */
export interface OccurrenceTick {
  date: string;
  doneAt?: number;
}

/**
 * Occurrence last ticked among several due the same day (the one a tick was just given to, to take it away): the one
 * whose latest tick was done last (`doneAt`); at the same time, or without times, the last in the order given.
 * @param {readonly string[]} dates Occurrences (the days that identify them, in order).
 * @param {readonly OccurrenceTick[]} ticks Ticks of the routine.
 * @returns {string | undefined} Occurrence (none ticked: undefined).
 */
export function lastTicked(dates: readonly string[], ticks: readonly OccurrenceTick[]): string | undefined {
  let found: { date: string; at: number } | undefined;
  for (const date of dates) {
    const times = ticks.filter((tick) => tick.date === date).map((tick) => tick.doneAt ?? -Infinity);
    if (!times.length) continue;
    const at = Math.max(...times);
    if (!found || at >= found.at) found = { date, at };
  }
  return found?.date;
}

/**
 * Current and next occurrences of a routine with its exceptions: a moved occurrence no longer occurs on its day but on
 * the day it was moved to. When the latest occurrence of the rule is moved away, nothing is due until the day it went
 * to (the occurrences before it do not come back). Each is given by the day that identifies it (`moveKey`); two due the
 * same day (one kept apart), the first of them in the order of their days (`pick` chooses the current one).
 * @param {(today: string) => { current: string | null, next: string | null }} compute Occurrences of the rule alone, on a day.
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} today Today.
 * @param {(dates: string[]) => string} [pick] Current occurrence among several due the same day (in order). Optional. Default = the first.
 * @returns {{ current: string | null, next: string | null }} Dates.
 */
export function movedOccurrences(
  compute: (today: string) => { current: string | null; next: string | null },
  moves: readonly RoutineMove[],
  today: string,
  pick: (dates: string[]) => string = (dates) => dates[0],
): { current: string | null; next: string | null } {
  const base = compute(today);
  if (!moves.length) return base;
  const movedAway = new Set(moves.filter(movesAway).map((move) => move.from));
  const latest = base.current;
  const kept = latest && !movedAway.has(latest) ? latest : null;
  let current = kept;
  for (const move of moves) {
    if (!movesIn(move) || move.to > today) continue;
    // After the latest occurrence of the rule, or the latest one itself brought forward / postponed to today at most.
    const counts = latest === null || (kept ? move.to > kept : move.from >= latest);
    if (counts && (!current || move.to > current)) current = move.to;
  }
  let next = base.next;
  for (let scanned = 0; next && movedAway.has(next) && scanned < MOVED_SCAN; scanned += 1) next = compute(next).next;
  if (next && movedAway.has(next)) next = null;
  const ruledNext = next;
  for (const move of moves) if (movesIn(move) && move.to > today && (!next || move.to < next)) next = move.to;
  /**
   * Occurrences due on a day, by the days that identify them: the one of its rule there (unless moved away), those
   * moved there.
   * @param {string} due Due day.
   * @param {boolean} ruled The rule has its occurrence there.
   * @returns {string[]} Days, in order.
   */
  const dueOn = (due: string, ruled: boolean) =>
    [...new Set([...(ruled && !movedAway.has(due) ? [due] : []), ...moves.filter((move) => movesIn(move) && move.to === due).map(moveKey)])].sort();
  const at = (due: string | null, ruled: boolean, choose: (dates: string[]) => string) => {
    if (!due) return null;
    const dates = dueOn(due, ruled);
    return dates.length ? choose(dates) : due;
  };
  return { current: at(current, current === kept, pick), next: at(next, next === ruledNext, (dates) => dates[0]) };
}

/**
 * Day of the rule an occurrence comes from: the day it was moved from, or itself (an occurrence others were merged
 * into stays the one of its own day).
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} date Occurrence (the day that identifies it).
 * @returns {string} Day of the rule (its times of the day are those of that day).
 */
export function movedFrom(moves: readonly RoutineMove[], date: string): string {
  if (moves.some((move) => move.apart && move.from === date)) return date;
  return moves.find((move) => !move.apart && !move.merged && move.to === date)?.from ?? date;
}

/**
 * What the exceptions of a routine tell of the occurrence a day designates (the day that identifies it, as a write
 * gives it): true when an exception keeps it there (moved there, kept apart or cancelled from there, its times
 * changed); false when its exception took it away (merged into another occurrence, moved to another day: the day is
 * no longer its own, e.g. from a stale tab); null when no exception is about it (an occurrence when its rule has that
 * day).
 * @param {readonly RoutineMove[]} moves Exceptions that apply.
 * @param {string} date Day given.
 * @returns {boolean | null} Designated, gone, or up to the rule.
 */
export function occurrenceByMoves(moves: readonly RoutineMove[], date: string): boolean | null {
  const from = movedFrom(moves, date);
  const current = moves.find((move) => move.from === from);
  if (!current) return null;
  return !current.merged && moveKey(current) === date;
}

/**
 * Whether a day given for a write on an occurrence (move, change, cancel) designates one: as its exceptions tell
 * (`occurrenceByMoves`), else when it is a day of its rule (its doability aside).
 * @param {readonly RoutineMove[]} moves Exceptions that apply.
 * @param {string} date Day given.
 * @param {(day: string) => boolean} ruleDay Whether a day is a day of its rule (asked only without an exception about it).
 * @returns {boolean} Designated.
 */
export const designatesOccurrence = (moves: readonly RoutineMove[], date: string, ruleDay: (day: string) => boolean): boolean => occurrenceByMoves(moves, date) ?? ruleDay(date);

/** What becomes of the occurrence of a sub-routine going by a routine whose occurrence moves: it follows it, it would disappear, or it stays as it is. */
export type FollowedOccurrence = 'FOLLOWS' | 'STRANDED' | 'STAYS';

/**
 * What becomes of the occurrence of a sub-routine (not changed itself) when an occurrence of the routine it goes by is
 * moved, cancelled or merged: it stays when it is not there, or still there after the change (cancelled: kept on the
 * day of its rule); else it follows when it is identified by the new day after the change, and would disappear
 * otherwise (merged into an occurrence of that day it does not have).
 * @param {{ before: () => boolean, afterOnDay: () => boolean, afterOnNewDay: () => boolean }} held Whether the
 * sub-routine has the occurrence identified by the day before the change, by that day after it, by the new day after it.
 * @param {string | null} newDay New day (null: cancelled).
 * @returns {FollowedOccurrence} What becomes of it.
 */
export function followedOccurrence(held: { before: () => boolean; afterOnDay: () => boolean; afterOnNewDay: () => boolean }, newDay: string | null): FollowedOccurrence {
  if (newDay === null || !held.before() || held.afterOnDay()) return 'STAYS';
  return held.afterOnNewDay() ? 'FOLLOWS' : 'STRANDED';
}

/**
 * Why a merge of an occurrence into the occurrence of its new day is refused, if it is: a sub-routine taking its
 * exceptions has no occurrence that day (it would lose its own and its rows), or it brings more rows than a merge
 * notes (`MAX_MERGED_ROWS`).
 * @param {number} stranded Sub-routines whose occurrence would disappear (`followedOccurrence`).
 * @param {number} [rows] Rows it brings (its own and those of the sub-routines following it). Optional. Default = not counted yet.
 * @returns {string | null} Message, null when accepted.
 */
export function mergeRefusal(stranded: number, rows = 0): string | null {
  if (stranded > 0) return 'Une sous-routine qui suit ses exceptions n’a pas d’occurrence ce jour-là : gardez les deux.';
  if (rows > MAX_MERGED_ROWS) return `Cette occurrence a trop de commentaires, listes et liens pour être fusionnée (${formatNumber(MAX_MERGED_ROWS)} au plus) : gardez les deux.`;
  return null;
}

/**
 * Whether a day is the day of the rule of an occurrence merged into another one: it keeps it until the merge is
 * undone (rows of its own may have stayed there), no other occurrence takes it as its identity.
 * @param {readonly RoutineMove[]} moves Exceptions that apply.
 * @param {string} day Day.
 * @returns {boolean} Merged away from it.
 */
export const mergedAway = (moves: readonly RoutineMove[], day: string): boolean => moves.some((move) => move.merged && move.from === day);

/**
 * What the exceptions of a routine tell of whether a day identifies another occurrence than the one coming from a day
 * of its rule: true when another one is identified by it (moved there, kept apart or cancelled from it), or when it is
 * the day of the rule of one merged into another occurrence (its checklist and links with events the day it went into
 * already had stay there until the merge is undone: the day stays its own, `mergedAway`); false when it is that day of
 * its rule, or the occurrence of the rule there moved elsewhere; null when no exception is about it (the occurrence of
 * the rule there, if it has one).
 * @param {readonly RoutineMove[]} moves Exceptions that apply.
 * @param {string} from Day of the rule of the occurrence looked at.
 * @param {string} day Day.
 * @returns {boolean | null} Taken, free, or up to the rule.
 */
export function dayTakenByMoves(moves: readonly RoutineMove[], from: string, day: string): boolean | null {
  if (moves.some((move) => move.from !== from && !move.merged && moveKey(move) === day)) return true;
  if (day !== from && mergedAway(moves, day)) return true;
  if (day === from || moves.some((move) => move.from === day)) return false;
  return null;
}

/**
 * Exceptions once an occurrence is moved, deleted (no new day), merged into the occurrence of its new day or its times
 * changed: changing a moved one again changes its exception (back to its own day with its own times: no exception).
 * @param {readonly RoutineMove[]} moves Exceptions.
 * @param {string} date Occurrence (the day that identifies it).
 * @param {string | null} to New day (null: deleted).
 * @param {RoutineMoveTimes} [times] Changed times. Optional. Default = those already changed.
 * @param {RoutineMoveJoin} [join] How it is identified on its new day (`RoutineMoveJoin`). Optional. Default = as it was.
 * @returns {RoutineMove[]} Exceptions.
 */
export function withMove(moves: readonly RoutineMove[], date: string, to: string | null, times?: RoutineMoveTimes, join?: RoutineMoveJoin): RoutineMove[] {
  const from = movedFrom(moves, date);
  const current = moves.find((move) => move.from === from);
  const others = moves.filter((move) => move.from !== from);
  const elsewhere = to !== null && to !== from;
  const merged = elsewhere && (join ? join === 'MERGED' : (current?.merged ?? false));
  const kept = to === null || merged ? null : times === undefined ? (current?.times ?? null) : times && times.some(Boolean) ? times : null;
  if (from === to && !kept) return others;
  const keptApart = elsewhere && !merged && (join ? join === 'APART' : (current?.apart ?? false));
  return [...others, { from, to, times: kept, ...(keptApart && { apart: true }), ...(merged && { merged: true }) }].sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Whether every occurrence of a rule moves with one of them moved (« Celle-ci et les suivantes », « Toutes »): all
 * rules but a weekly one with other listed weekdays, which stay where they are.
 * @param {Recurrence} rule Rule.
 * @returns {boolean} All of them move.
 */
export const shiftMovesAll = (rule: Recurrence): boolean => !(rule.frequency === 'WEEKLY' && rule.weekdays.length > 1);

/**
 * Rule of a routine going on from an occurrence moved to another day (« Celle-ci et les suivantes », « Toutes »): weekly
 * on the new weekday instead of the former one; monthly and yearly on the values of the new day (its day of the month,
 * weekday and position, month, week: `ruleMovedTo`, as an event series), so that the occurrence moved is a day of the
 * new rule; the occurrences left (when counted) and the dates left out after it. Its end and exceptions
 * move with the occurrences by as many days (`shiftedDates`, as an event series), when they all move
 * (`shiftMovesAll`); weekly with other listed weekdays, only the excluded dates of the weekday moved do, unless it
 * joins another of its weekdays (its occurrences then merge into those of that weekday); its end
 * is put off as far as the last occurrence of the weekday moved goes (never brought forward), so that none is lost.
 * On the last day of the month and moved to another day: the new rule chosen, as it is; none chosen, refused with the
 * rule proposed (`RuleChoiceRequired`: this computation on `lastDayStandIn`, on the values of the new day,
 * `proposedMovedRule`).
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence (the day of its rule).
 * @param {string} to New day.
 * @param {boolean} split The rule goes on from the occurrence (the former one ends before it).
 * @param {Recurrence | null} [chosen] New rule chosen for a rule on the last day of the month. Optional. Default = none.
 * @returns {Recurrence} Rule.
 */
export function shiftedRoutineRule(rule: Recurrence, start: string, date: string, to: string, split: boolean, chosen: Recurrence | null = null): Recurrence {
  if (to !== date && isLastDayRule(rule)) {
    if (chosen) return chosen;
    throw new RuleChoiceRequired(proposedMovedRule(shiftedRoutineRule(lastDayStandIn(rule), start, date, to, split), to), to);
  }
  const moved = to !== date && (rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') ? ruleMovedTo(rule, to) : rule;
  const weekday = weekdayOfDate(date);
  const weekdays =
    rule.frequency === 'WEEKLY' && rule.weekdays.length && to !== date ? [...new Set(rule.weekdays.map((day) => (day === weekday ? weekdayOfDate(to) : day)))].sort() : rule.weekdays;
  const count = split && rule.count !== null ? Math.max(1, rule.count - occurrencesBefore(rule, start, date)) : rule.count;
  const kept: Recurrence = { ...moved, weekdays, count, exceptions: split ? rule.exceptions.filter((day) => day >= date) : rule.exceptions };
  const days = daysBetween(date, to);
  if (shiftMovesAll(rule)) return shiftedDates(kept, days);
  // Its other weekdays stay: their end too; the weekday moved onto another one of them merges into it.
  if (weekdays.length < rule.weekdays.length) return kept;
  const exceptions = kept.exceptions.map((day) => (weekdayOfDate(day) === weekday ? addDays(day, days) : day));
  if (!kept.until) return { ...kept, exceptions };
  // The last occurrence of the weekday moved past the end: the end goes as far (`exactMovedRule` keeps the
  // other weekdays to their occurrences).
  return { ...kept, exceptions, until: weekdayMovedEnd(rule, start, date, to, kept.until) };
}

/**
 * Weekly pattern of a rule on some of its weekdays: no end, no number of occurrences, no exceptions.
 * @param {Recurrence} rule Rule.
 * @param {readonly number[]} weekdays Weekdays.
 * @returns {Recurrence} Pattern.
 */
const weekdayPattern = (rule: Recurrence, weekdays: readonly number[]): Recurrence => ({ ...rulePattern(rule), weekdays: [...weekdays] });

/**
 * Other listed weekdays of a weekly rule than the one of a day, or null when the day's weekday, moved to another day,
 * does not move alone (not weekly on listed days, moved onto another of its weekdays: merged there, or not moved).
 * @param {Recurrence} rule Rule.
 * @param {string} date Occurrence moved.
 * @param {string} to New day.
 * @returns {number[] | null} Other weekdays (empty: it is the only one).
 */
function otherWeekdays(rule: Recurrence, date: string, to: string): number[] | null {
  if (rule.frequency !== 'WEEKLY' || !rule.weekdays.length || to === date) return null;
  const others = rule.weekdays.filter((day) => day !== weekdayOfDate(date));
  return others.includes(weekdayOfDate(to)) ? null : others;
}

/**
 * End of a weekly rule on several listed weekdays once one weekday moved (its other weekdays stay):
 * put off as far as the last occurrence of that weekday, moved, goes (never brought forward), so that none is lost
 * (the days its other weekdays would gain are excluded by `exactMovedRule`).
 * @param {Recurrence} rule Rule (before the move).
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence moved (the day of its rule).
 * @param {string} to New day.
 * @param {string} until End of the rule.
 * @returns {string} End.
 */
export function weekdayMovedEnd(rule: Recurrence, start: string, date: string, to: string, until: string): string {
  if (!otherWeekdays(rule, date, to)?.length) return until;
  // Its last occurrence: within a few periods of its rhythm before the end.
  const back = addDays(until, -7 * (Math.max(rhythmInterval(rule), 2) + 1));
  const last = occurrenceDates(weekdayPattern(rule, [weekdayOfDate(date)]), start, back > start ? back : start, until).at(-1);
  const reached = last ? addDays(last, daysBetween(date, to)) : until;
  return reached > until ? reached : until;
}

/**
 * First day a weekly rule on listed weekdays counts from once one weekday moved by a number of days (« Toutes »): as
 * before, or, when the first occurrence of that weekday, moved, falls before it, that day (every occurrence of that
 * weekday moves, none is lost: the routine starts as much earlier; the days its other weekdays would gain are excluded
 * by `exactMovedRule`). Its weeks are counted as before (the weekday stays in its week, or moves by whole
 * periods of its rhythm).
 * @param {Recurrence} rule Rule (before the move).
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence moved (the day of its rule).
 * @param {string} to New day.
 * @returns {string} First day.
 */
export function listedWeeklyStart(rule: Recurrence, start: string, date: string, to: string): string {
  if (!otherWeekdays(rule, date, to)) return start;
  const first = occurrenceDates(weekdayPattern(rule, [weekdayOfDate(date)]), start, start, addDays(start, 7 * Math.max(rhythmInterval(rule), 2) + 6))[0];
  const moved = first ? addDays(first, daysBetween(date, to)) : start;
  return moved < start ? moved : start;
}

/**
 * Earliest of two optional days (none: no limit).
 * @param {string | null} a Day.
 * @param {string | null} b Day.
 * @returns {string | null} Earliest.
 */
const earliestDay = (a: string | null, b: string | null): string | null => (a && b ? (a < b ? a : b) : (a ?? b));

/** Longest a rule is followed day by day to find its occurrences one by one (about a hundred years). */
const SCAN_DAYS = 36_600;

/**
 * Refusal of a move of one weekday of several alone (« Celle-ci et les suivantes », « Toutes ») that no rule can make
 * exact (`exactMovedRule`: too many excluded dates, counted too far, a day its pattern does not have).
 */
export const INEXACT_MOVE_REFUSAL = 'Ce déplacement ne peut pas garder exactement les occurrences de la routine (trop d’exceptions, ou trop d’occurrences) : choisissez « Cette occurrence » pour la déplacer seule, ou simplifiez sa répétition.';

/**
 * Days of a rule, between two days, its number of occurrences aside (its end then given by `until`).
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {string | null} until Last day it can have (none: its own end).
 * @returns {string[]} Days.
 */
const daysOf = (rule: Recurrence, start: string, from: string, to: string, until: string | null): string[] =>
  from > to ? [] : occurrenceDates({ ...rule, count: null, until: until ?? rule.until }, start, from, to);

/**
 * Rule made to have exactly the occurrences expected from a former one (`expect`: where each former occurrence goes in
 * it, or nowhere): from the new rule (its weekdays, rhythm, first day), the days it would have more get an exception and an
 * expected day that has one gets it back; counted, it counts the expected occurrences
 * (excluded days are not counted), else it ends at the latest of its end and its last expected day (`trim`: at its last
 * expected day). Followed day by day over its whole span when it ends within about a hundred years; else (no end, or a
 * far one) from its first days to past its exceptions, and near its end: elsewhere both repeat alike.
 * @param {Recurrence} before Former rule.
 * @param {string} beforeStart First day it counted from.
 * @param {Recurrence} after New rule.
 * @param {string} afterStart First day it counts from.
 * @param {string} since First day it may have (none before).
 * @param {(day: string) => string | null} expect Day of a former occurrence in the new rule (null: not in it).
 * @param {number} gap Most days a former occurrence moves by.
 * @param {boolean} trim It ends at its last expected occurrence (a rule ended before a cut).
 * @returns {Recurrence | null} Rule; null when it cannot be made exact (a day its pattern does not have, too many days
 * to exclude, counted too far, no occurrence left).
 */
export function exactMovedRule(
  before: Recurrence,
  beforeStart: string,
  after: Recurrence,
  afterStart: string,
  since: string,
  expect: (day: string) => string | null,
  gap: number,
  trim: boolean,
): Recurrence | null {
  const period = 7 * Math.max(rhythmInterval(before), rhythmInterval(after), 1);
  const margin = 2 * period + 2 * gap + 7;
  const limit = addDays(beforeStart, SCAN_DAYS);
  const expected = (from: string, to: string) =>
    [...new Set(occurrenceDates(before, beforeStart, addDays(from, -gap), addDays(to, gap)).map(expect))].filter((day): day is string => day !== null && day >= from && day <= to && day >= since).sort();
  // Its whole span when it ends within the scan, else where the two can differ.
  const near = before.until === null ? before.count !== null : before.until <= limit;
  const lastOld = near ? (occurrenceDates(before, beforeStart, beforeStart, before.until ?? limit).at(-1) ?? null) : null;
  // Counted too far to be followed: given up.
  if (before.count !== null && before.until === null && occurrenceDates(before, beforeStart, beforeStart, limit).length < before.count) return null;
  const whole = lastOld !== null;
  const marks = [beforeStart, afterStart, since, ...before.exceptions, ...after.exceptions].sort();
  const firstZone: [string, string] = [since, addDays(marks.at(-1)!, margin)];
  let zones: [string, string][];
  // Up to the former last occurrence moved, or to the new rule's end when later (the days it has past the former).
  const latest = (day: string) => (after.until && after.until > day ? after.until : day);
  if (whole) zones = [[since, latest(addDays(lastOld, gap))]];
  else if (before.until !== null) {
    const end: [string, string] = [addDays(before.until, -margin), latest(addDays(before.until, gap))];
    zones = end[0] <= firstZone[1] ? [[since, end[1]]] : [firstZone, end];
  } else zones = [firstZone];
  const wanted = zones.map(([from, to]) => expected(from, to));
  const lastWanted = wanted.flat().at(-1) ?? null;
  const finite = before.until !== null || before.count !== null;
  if (finite && lastWanted === null) return null;
  let rule: Recurrence = { ...after, exceptions: [...after.exceptions] };
  if (rule.count !== null) rule = { ...rule, count: wanted.flat().length, until: null };
  else if (finite) rule = { ...rule, until: trim || rule.until === null || rule.until < lastWanted! ? lastWanted : rule.until };
  const end = rule.count !== null ? lastWanted : rule.until;
  for (let pass = 0; pass <= 2; pass += 1) {
    let changed = false;
    for (const [index, [from, to]] of zones.entries()) {
      const want = new Set(wanted[index]);
      const have = daysOf(rule, afterStart, from, to, end);
      const extra = have.filter((day) => day >= since && !want.has(day));
      const has = new Set(have);
      const missing = wanted[index].filter((day) => !has.has(day));
      // An expected day with an exception gets it back; a day its pattern does not have: it cannot be made exact.
      if (missing.some((day) => !rule.exceptions.includes(day))) return null;
      if (missing.length) rule = { ...rule, exceptions: rule.exceptions.filter((day) => !missing.includes(day)) };
      if (extra.length) rule = { ...rule, exceptions: [...rule.exceptions, ...extra] };
      changed ||= extra.length > 0 || missing.length > 0;
    }
    if (!changed) {
      const exceptions = [...new Set(rule.exceptions)].sort();
      return exceptions.length > MAX_RULE_EXCEPTIONS ? null : { ...rule, exceptions };
    }
  }
  return null;
}

/**
 * Where a former occurrence of a weekly rule goes once one of its weekdays moved alone (`date` to `to`), for the rule
 * going on (`piece`: all of them, or from the cut on: those of the weekday moved from the cut, the others from the new
 * day on) or for the rule ended before the cut (`before`: those before it, and the other weekdays' up to the new day).
 * @param {string} date Occurrence moved.
 * @param {string} to New day.
 * @param {'all' | 'piece' | 'before'} part Rule wanted.
 * @returns {(day: string) => string | null} Day in that rule (null: not in it).
 */
function movedWeekdayPlace(date: string, to: string, part: 'all' | 'piece' | 'before'): (day: string) => string | null {
  const weekday = weekdayOfDate(date);
  const days = daysBetween(date, to);
  return (day) => {
    const moved = weekdayOfDate(day) === weekday;
    if (part === 'before') return day < date || (!moved && day < to) ? day : null;
    if (part === 'piece' && day < date) return null;
    if (moved) return addDays(day, days);
    return part === 'all' || day >= to ? day : null;
  };
}

/**
 * Rule of a routine going on from an occurrence moved, in one piece (`shiftedRoutineRule`), with the first day it
 * counts from: on listed weekdays, as much earlier when the first occurrence of the weekday moved falls before it
 * (`listedWeeklyStart`; cut, from the new day); one weekday of several moved alone, made exact (`exactMovedRule`: the
 * former occurrences, those of that weekday moved; cut, those from the cut on, the other weekdays' from the new day),
 * or, when it cannot be, refused (`INEXACT_MOVE_REFUSAL`); its only listed weekday moved (« Toutes »), made exact as
 * well (no day gained between its first day and its first occurrence moved, the same number of occurrences), else as
 * `shiftedRoutineRule` gives it.
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence moved (the day of its rule).
 * @param {string} to New day.
 * @param {boolean} split The rule goes on from the occurrence (the former one ends before it: `cutRoutineBefore`).
 * @param {Recurrence | null} [chosen] New rule chosen for a rule on the last day of the month (`shiftedRoutineRule`).
 * Optional. Default = none.
 * @returns {{ recurrence: Recurrence, start: string }} Rule and the first day it counts from.
 * @throws {UserError} One weekday of several moved alone that cannot be made exact.
 */
export function shiftedRoutinePiece(rule: Recurrence, start: string, date: string, to: string, split: boolean, chosen: Recurrence | null = null): { recurrence: Recurrence; start: string } {
  const recurrence = shiftedRoutineRule(rule, start, date, to, split, chosen);
  const first = split ? to : listedWeeklyStart(rule, start, date, to);
  const others = otherWeekdays(rule, date, to);
  // Its only listed weekday moved: made exact too when it goes on from its first day (« Toutes »: no day gained
  // between that day and its first occurrence moved); cut, it starts on the new day.
  if (!others || (split && !others.length)) return { recurrence, start: first };
  // Compared from the new day (cut), else from the earlier of its first days.
  let since = first < start ? first : start;
  if (split) since = to;
  const exact = exactMovedRule(rule, start, recurrence, first, since, movedWeekdayPlace(date, to, split ? 'piece' : 'all'), Math.abs(daysBetween(date, to)), false);
  if (exact || !others.length) return { recurrence: exact ?? recurrence, start: first };
  throw new UserError(INEXACT_MOVE_REFUSAL);
}

/**
 * Rule ended before a cut (« Celle-ci et les suivantes ») when one weekday of a weekly rule on several listed weekdays
 * moves alone later: its occurrences before the cut, and those of its other weekdays up to the new day (the rule going
 * on starts there); null otherwise (the rule simply ends before the cut).
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence the cut starts at (the day of its rule).
 * @param {string} to New day of that occurrence.
 * @returns {Recurrence | null} Rule ended before the cut, or null.
 * @throws {UserError} It cannot be made exact (`INEXACT_MOVE_REFUSAL`).
 */
export function cutRoutineBefore(rule: Recurrence, start: string, date: string, to: string): Recurrence | null {
  if (to <= date || !otherWeekdays(rule, date, to)?.length) return null;
  // Nothing of it from the new day on.
  const ended = { ...rule, until: earliestDay(rule.until, addDays(to, -1)) };
  const exact = exactMovedRule(ended, start, rule, start, start, movedWeekdayPlace(date, to, 'before'), 0, true);
  if (!exact) throw new UserError(INEXACT_MOVE_REFUSAL);
  return exact;
}

/** Same changes for several routines: values set (null: none, undefined: unchanged), or ids added to and removed from their lists. */
export interface RoutineBulkChanges {
  addCategoryIds?: string[];
  removeCategoryIds?: string[];
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addRequiredIds?: string[];
  removeRequiredIds?: string[];
  /** « Relative à »: routines added to and removed from the relations of each (never itself). */
  addRelatedIds?: string[];
  removeRelatedIds?: string[];
  /** Minutes. */
  estimate?: number | null;
  projectId?: string | null;
  /** Parent routine of each (« Sous-routines » of a routine); null: top-level. */
  parentId?: string | null;
  /** Priority and type (the lists of the tasks); null: none. */
  priorityId?: string | null;
  typeId?: string | null;
  /** Null: no limit. */
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: Recurrence;
  /** Whole repetition (with recurrence): its cases (empty: its rule), moments, condition and « Ouverture ». */
  cases?: RoutineCaseInput[];
  moments?: RoutineSlot[];
  slotCondition?: SlotCondition | null;
  opensOn?: RoutineOpens | null;
  /** Fields made inherited again (« Rétablir l'héritage »); a sub-routine only. */
  inheritFields?: RoutineInheritableField[];
  /** Fields emptied on purpose (« Vider »): no value, not inherited (never its first time nor its repetition). */
  clearFields?: RoutineInheritableField[];
}

/** Values of the changes of several routines that each routine takes as given (null: none). */
const ROUTINE_BULK_VALUES = ['estimate', 'projectId', 'priorityId', 'typeId'] as const;
type RoutineBulkValues = Pick<RoutineBulkChanges, (typeof ROUTINE_BULK_VALUES)[number]>;

/**
 * Values the changes of several routines give each of them as they are (time to spend, project, priority, type): those
 * given (null included), as the API saves them and the app shows them at once.
 * @param {RoutineBulkValues} changes Changes.
 * @returns {RoutineBulkValues} Values given.
 */
export function routineBulkValues(changes: RoutineBulkValues): RoutineBulkValues {
  return Object.fromEntries(ROUTINE_BULK_VALUES.filter((key) => changes[key] !== undefined).map((key) => [key, changes[key]]));
}

/**
 * Window as words: "8:20–8:30", "avant 8:30", "dès 16:30", "7:00–9:00 ou 17:00–20:00", or empty.
 * @param {{ fromTime: string | null, dueTime: string | null, windows?: unknown }} window Window, and the windows it can be done in.
 * @returns {string} Text.
 */
export function windowText({ fromTime, dueTime, windows }: { fromTime: string | null; dueTime: string | null; windows?: unknown }): string {
  // Several windows (free time cut by slots): each one, « or ».
  const parts = Array.isArray(windows) ? (windows as { fromTime: string | null; dueTime: string | null }[]) : [];
  if (parts.length > 1) return parts.map((part) => windowText(part)).join(' ou ');
  if (fromTime && dueTime) return `${fromTime}–${dueTime}`;
  if (dueTime) return `avant ${dueTime}`;
  return fromTime ? `dès ${fromTime}` : '';
}
