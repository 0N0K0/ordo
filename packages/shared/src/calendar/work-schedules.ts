import { groupBy, sumOf } from '../core/collections';
import { timeToMinutes } from '../dates/times';
import { z } from 'zod';
import { END_AFTER_START, endAfter, endsAfter, requiredText, shortTextSchema } from '../core/rules';
import { addDays, daysBetween, isoWeek, monthOfDay, monthOfYear, weekdayOfDate, yearOfDay } from '../dates/days';
import { DEFAULT_RECURRENCE, ONE_DAY, type Duration, type Recurrence } from '../dates/recurrence';
import { caseSpanOn, caseSpans, repetitionCaseSchema, type RepetitionCase } from '../dates/repetition';
import { colorSchema } from '../core/workspace';
import { timeOfDaySchema, daySchema } from '../dates/times';
import { dayOfMonthOf, daysInMonth, monthIndex, shiftMonth } from '../dates/months';

/** Hours of a day of a case, in local time. */
const timeRangeSchema = z.object({ start: timeOfDaySchema, end: timeOfDaySchema }).refine(...endAfter('start', 'end', true));
type TimeRange = z.infer<typeof timeRangeSchema>;

/** Which days a case is on: every day of its period, weekdays (every n weeks), every n days, a day of the month
 * (every n months) or of a month of the year (every n years). */
const SCHEDULE_PATTERNS = ['DAILY', 'WEEKLY', 'EVERY_N_DAYS', 'MONTHLY', 'YEARLY'] as const;
export type SchedulePattern = (typeof SCHEDULE_PATTERNS)[number];

/**
 * Checks the hours of a schedule case: some time ranges unless the whole day, none overlapping another.
 * @param {{ allDay: boolean, ranges: { start: string, end: string }[] }} times Hours of the case.
 * @param {z.RefinementCtx} context Refinement context.
 * @param {string[]} path Path of the hours in the case.
 * @returns {void}
 */
function refineScheduleTimes(times: { allDay: boolean; ranges: { start: string; end: string }[] }, context: z.RefinementCtx, path: string[]): void {
  if (!times.allDay && !times.ranges.length) context.addIssue({ code: 'custom', path: [...path, 'ranges'], message: 'Ajoutez des horaires, ou « Journée entière ».' });
  const sorted = [...times.ranges].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((range, index) => {
    if (index && sorted[index - 1].end > range.start) context.addIssue({ code: 'custom', path: [...path, 'ranges'], message: 'Des horaires se chevauchent.' });
  });
}

/**
 * A case of a schedule: on which days (every day, weekdays every n weeks, every n days) and with which hours (time
 * ranges, or the whole day). The same hours on all its days.
 */
const scheduleCaseSchema = z
  .object({
    pattern: z.enum(SCHEDULE_PATTERNS),
    /** WEEKLY: 1 (Monday) to 7 (Sunday). */
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    /** WEEKLY: every n weeks; EVERY_N_DAYS: every n days; MONTHLY: every n months; YEARLY: every n years. */
    every: z.number().int().min(1, 'Au moins 1.').max(366, '366 au plus.').default(1),
    /**
     * MONTHLY, YEARLY: a day number (the 15th, the last day when the month has fewer), or the nth weekday; YEARLY
     * only: a week of the year (ISO number), or a whole month.
     */
    monthlyMode: z.enum(['DAY', 'WEEKDAY', 'WEEK', 'MONTH']).default('DAY'),
    monthDay: z.number().int().min(1).max(31).default(1),
    /** WEEKDAY mode: 1 to 4, or -1 for the last one of the month… */
    position: z.union([z.literal(-1), z.number().int().min(1).max(4)]).default(1),
    /** …of this weekday, 1 (Monday) to 7. */
    weekday: z.number().int().min(1).max(7).default(1),
    /** YEARLY: month, 1 to 12. */
    month: z.number().int().min(1).max(12).default(1),
    /** YEARLY, WEEK mode: ISO week number, 1 to 53 (a year without a 53rd week has none). */
    week: z.number().int().min(1).max(53).default(1),
    /** Last day of each occurrence (DAY mode: day number, and month for YEARLY), week (WEEK mode) or month (MONTH mode); none: its first one only. An end before the start ends in the next month or year. */
    toDay: z.number().int().min(1).max(31).nullable().default(null),
    toMonth: z.number().int().min(1).max(12).nullable().default(null),
    toWeek: z.number().int().min(1).max(53).nullable().default(null),
    /** Days each occurrence lasts, from its first day (weekdays, every n days, nth weekday…); 1: that day only. */
    days: z.number().int().min(1, 'Au moins 1 jour.').max(366, '366 jours au plus.').default(1),
    /** First day of the rhythm (its week for WEEKLY); none: the start of the period. */
    from: daySchema().nullable().default(null),
    allDay: z.boolean().default(false),
    ranges: z.array(timeRangeSchema).max(12, '12 tranches au plus.').default([]),
    /** First and last days it applies (none: the whole period), dates included. */
    since: daySchema().nullable().default(null),
    until: daySchema().nullable().default(null),
  })
  .superRefine((item, context) => {
    if (!endsAfter(item.since, item.until)) context.addIssue({ code: 'custom', path: ['until'], message: END_AFTER_START });
    if (item.pattern !== 'YEARLY' && (item.monthlyMode === 'WEEK' || item.monthlyMode === 'MONTH'))
      context.addIssue({ code: 'custom', path: ['monthlyMode'], message: 'Semaine ou mois : chaque année seulement.' });
    if (item.pattern === 'WEEKLY' && !item.weekdays.length) context.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choisissez au moins un jour.' });
    refineScheduleTimes(item, context, []);
  });
/** Case of a schedule in its former form (pattern, every…), read and converted (see `scheduleCaseRepetition`). */
type LegacyScheduleCase = z.infer<typeof scheduleCaseSchema>;

/** Hours of the days of a schedule case: time ranges, or the whole day. */
const scheduleTimesSchema = z.object({
  allDay: z.boolean().default(false),
  ranges: z.array(timeRangeSchema).max(12, '12 tranches au plus.').default([]),
});
export type ScheduleTimes = z.infer<typeof scheduleTimesSchema>;

/** A case of a schedule: its period, its rule (with how long each occurrence lasts) and its hours. */
const scheduleRepetitionCaseSchema = repetitionCaseSchema(scheduleTimesSchema).superRefine((item, context) => {
  if (item.rule?.frequency === 'WEEKLY' && !item.rule.weekdays.length) context.addIssue({ code: 'custom', path: ['rule', 'weekdays'], message: 'Choisissez au moins un jour.' });
  refineScheduleTimes(item.times, context, ['times']);
});
export type ScheduleCase = RepetitionCase<ScheduleTimes>;

const exceptionFields = {
  from: daySchema(),
  to: daySchema(),
  label: shortTextSchema.default(''),
};

/** Period with its own cases instead of the general ones (none: a pause, holidays…), dates included. */
const scheduleExceptionSchema = z.object({ ...exceptionFields, cases: z.array(scheduleRepetitionCaseSchema).max(20, '20 cas au plus.').default([]) }).refine(...endAfter('from', 'to'));
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;

/** Planned time slots: a label, a kind, a period, its cases, and exceptions (periods with cases of their own). */
export const workScheduleSchema = z
  .object({
    label: requiredText(),
    startDate: daySchema(),
    endDate: daySchema().nullable(),
    cases: z.array(scheduleRepetitionCaseSchema).min(1, 'Ajoutez au moins un cas.').max(20, '20 cas au plus.'),
    exceptions: z.array(scheduleExceptionSchema).max(200, '200 exceptions au plus.'),
    /** Kind of time it plans; none: working hours. */
    typeId: z.string().nullish(),
  })
  .superRefine((schedule, context) => {
    if (!endsAfter(schedule.startDate, schedule.endDate)) context.addIssue({ code: 'custom', path: ['endDate'], message: END_AFTER_START });
  });
export type WorkScheduleInput = z.input<typeof workScheduleSchema>;

/** Stored schedule, as the functions below read it. */
export interface WorkScheduleRule {
  id: string;
  label: string;
  startDate: string;
  endDate: string | null;
  cases: readonly ScheduleCase[];
  exceptions: readonly ScheduleException[];
  /** Kind of time it plans; none: working hours. */
  typeId?: string | null;
}

/** Planned time slot on a date. */
export interface PlannedSlot {
  date: string;
  start: string;
  end: string;
  /** The whole day ("00:00" to "24:00"). */
  allDay: boolean;
  scheduleId: string;
}

/** Paused period of a schedule (an exception without cases) overlapping a period. */
interface PlannedPause {
  from: string;
  to: string;
  label: string;
  scheduleId: string;
  scheduleLabel: string;
}

/**
 * ISO weekday of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {number} 1 (Monday) to 7 (Sunday).
 */
export function weekdayOf(date: string): number {
  return weekdayOfDate(date);
}

/**
 * Monday of the week of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Monday.
 */
function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/**
 * Year an ISO week belongs to (that of its Thursday).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Year.
 */
export function isoWeekYear(date: string): number {
  return yearOfDay(addDays(date, 4 - weekdayOf(date)));
}

/**
 * Rhythm start of a case as the common repetition counts it: early enough for every occurrence the case had (those
 * counted from the start of its month, year or ISO year, or a week of its rhythm before the period), on its rhythm.
 * @param {LegacyScheduleCase} item Case.
 * @param {string} periodStart First day of its period.
 * @returns {string} Anchor.
 */
function caseAnchor(item: LegacyScheduleCase, periodStart: string): string {
  const anchor = item.from ?? periodStart;
  if (item.pattern === 'EVERY_N_DAYS') return anchor;
  if (item.pattern === 'MONTHLY') return `${monthOfDay(anchor)}-01`;
  if (item.pattern === 'YEARLY' && item.monthlyMode === 'WEEK') {
    // Monday of the first ISO week of its ISO year.
    const year = isoWeekYear(anchor);
    return mondayOf(`${year}-01-04`);
  }
  if (item.pattern === 'YEARLY') return `${yearOfDay(anchor)}-01-01`;
  // Every day, weeks: the Monday of a week of its rhythm early enough for an occurrence started before the period to
  // cover its first days.
  const monday = mondayOf(anchor);
  const earliest = mondayOf(addDays(periodStart, 1 - item.days));
  const back = Math.max(0, Math.ceil(daysBetween(earliest, monday) / 7 / item.every));
  return addDays(monday, -7 * item.every * back);
}

/**
 * Schedule case of the former form as a case of the common repetition (its rule, how long each occurrence lasts, its
 * period and hours).
 * @param {LegacyScheduleCase} item Case.
 * @param {string} periodStart First day of its period (rhythm start without `from`).
 * @returns {ScheduleCase} Case.
 */
function scheduleCaseRepetition(item: LegacyScheduleCase, periodStart: string): ScheduleCase {
  const base = { ...DEFAULT_RECURRENCE, interval: item.every };
  const days: Duration = { ...ONE_DAY, count: item.days };
  const toDay = (month: number | null): Duration => ({ ...ONE_DAY, unit: 'TO_DAY', day: item.toDay, month });
  let rule: Recurrence;
  let duration = days;
  switch (item.pattern) {
    case 'DAILY':
      rule = { ...base, frequency: 'DAILY', interval: 1 };
      break;
    case 'EVERY_N_DAYS':
      rule = { ...base, frequency: 'DAILY' };
      break;
    case 'WEEKLY':
      rule = { ...base, frequency: 'WEEKLY', weekdays: item.weekdays };
      break;
    case 'MONTHLY':
      rule = { ...base, frequency: 'MONTHLY', monthlyMode: item.monthlyMode === 'WEEKDAY' ? 'WEEKDAY' : 'DAY', monthDay: item.monthDay, position: item.position, weekday: item.weekday };
      if (item.monthlyMode === 'DAY' && item.toDay !== null) duration = toDay(null);
      break;
    case 'YEARLY':
      if (item.monthlyMode === 'WEEK') {
        rule = { ...base, frequency: 'YEARLY', monthlyMode: 'WEEK', week: item.week, weekday: 1 };
        duration = { ...ONE_DAY, unit: 'TO_WEEK', week: item.toWeek ?? item.week };
      } else if (item.monthlyMode === 'MONTH') {
        rule = { ...base, frequency: 'YEARLY', monthlyMode: 'DAY', month: item.month, monthDay: 1 };
        duration = { ...ONE_DAY, unit: 'TO_MONTH', month: item.toMonth ?? item.month };
      } else {
        rule = { ...base, frequency: 'YEARLY', monthlyMode: item.monthlyMode, month: item.month, monthDay: item.monthDay, position: item.position, weekday: item.weekday };
        if (item.monthlyMode === 'DAY' && item.toDay !== null) duration = toDay(item.toMonth ?? item.month);
      }
      break;
  }
  return { since: item.since, until: item.until, anchor: caseAnchor(item, periodStart), rule: { ...rule, duration }, times: { allDay: item.allDay, ranges: item.ranges } };
}

/**
 * Whether a case is on a date (its period checked apart).
 * @param {ScheduleCase} item Case.
 * @param {string} periodStart First day of its period (rhythm start without `from`).
 * @param {string} date YYYY-MM-DD.
 * @returns {boolean} On that day.
 */
function caseOn(item: ScheduleCase, periodStart: string, date: string): boolean {
  return caseSpanOn(item, periodStart, date) !== null;
}

/**
 * Cases in force on a date: those of the exception covering it (the one started last, then the shorter, when several do), or else
 * the general ones; with the first day of their period.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} date YYYY-MM-DD.
 * @returns {{ cases: readonly ScheduleCase[], from: string, exception: ScheduleException | null }} Cases.
 */
function casesOn(schedule: WorkScheduleRule, date: string): { cases: readonly ScheduleCase[]; from: string; exception: ScheduleException | null } {
  // The one started last; on the same day, the shorter one (a day changed within a longer exception).
  const exception = schedule.exceptions.filter((item) => item.from <= date && date <= item.to).sort((a, b) => b.from.localeCompare(a.from) || a.to.localeCompare(b.to))[0];
  return exception ? { cases: exception.cases, from: exception.from, exception } : { cases: schedule.cases, from: schedule.startDate, exception: null };
}

/**
 * Planned time slots between two dates (included), by date and start.
 * @param {readonly WorkScheduleRule[]} schedules Schedules.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {PlannedSlot[]} Slots.
 */
export function plannedSlots(schedules: readonly WorkScheduleRule[], from: string, to: string): PlannedSlot[] {
  const result: PlannedSlot[] = [];
  for (const schedule of schedules) {
    /**
     * Days each case of a period covers between the two dates, with its hours.
     * @param {readonly ScheduleCase[]} cases Cases.
     * @param {string} periodStart First day of their period.
     * @returns {{ days: Set<string>, times: ScheduleTimes }[]} Cases.
     */
    const covered = (cases: readonly ScheduleCase[], periodStart: string) =>
      cases.map((item) => {
        const days = new Set<string>();
        for (const span of caseSpans(item, periodStart, from, to)) for (let day = span.start; day <= span.end; day = addDays(day, 1)) days.add(day);
        return { days, times: item.times };
      });
    const general = covered(schedule.cases, schedule.startDate);
    const exceptions = new Map(schedule.exceptions.map((exception) => [exception, covered(exception.cases, exception.from)]));
    for (let date = from < schedule.startDate ? schedule.startDate : from; date <= to; date = addDays(date, 1)) {
      if (schedule.endDate && date > schedule.endDate) break;
      const { exception } = casesOn(schedule, date);
      for (const { days, times } of exception ? (exceptions.get(exception) ?? []) : general) {
        if (!days.has(date)) continue;
        if (times.allDay) result.push({ date, start: '00:00', end: '24:00', allDay: true, scheduleId: schedule.id });
        else for (const range of times.ranges) result.push({ date, start: range.start, end: range.end, allDay: false, scheduleId: schedule.id });
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/**
 * Paused periods of the schedules (exceptions without cases) overlapping two dates (included).
 * @param {readonly WorkScheduleRule[]} schedules Schedules.
 * @param {string} from First date.
 * @param {string} to Last date.
 * @returns {PlannedPause[]} Pauses.
 */
export function plannedPauses(schedules: readonly WorkScheduleRule[], from: string, to: string): PlannedPause[] {
  return schedules.flatMap((schedule) =>
    schedule.exceptions
      .filter((exception) => !exception.cases.length && exception.from <= to && exception.to >= from)
      .map((exception) => ({ from: exception.from, to: exception.to, label: exception.label, scheduleId: schedule.id, scheduleLabel: schedule.label })),
  );
}

/**
 * Minutes of time slots (whole days are no planned working time: left out).
 * @param {readonly { start: string, end: string, allDay?: boolean }[]} slots Slots.
 * @returns {number} Minutes.
 */
export function slotMinutes(slots: readonly { start: string; end: string; allDay?: boolean }[]): number {
  return sumOf(
    slots.filter((slot) => !slot.allDay),
    (slot) => timeToMinutes(slot.end) - timeToMinutes(slot.start),
  );
}

/**
 * Whether a time range of a day fits within one of the planned slots of that day.
 * @param {readonly PlannedSlot[]} slots Planned slots.
 * @param {string} date YYYY-MM-DD.
 * @param {string} start HH:MM.
 * @param {string} end HH:MM.
 * @returns {boolean} Within working hours.
 */
export function withinSlots(slots: readonly PlannedSlot[], date: string, start: string, end: string): boolean {
  return slots.some((slot) => slot.date === date && slot.start <= start && end <= slot.end);
}

/**
 * Cases stored or received (JSON), validated (invalid ones left out); those of the former form converted.
 * @param {unknown} value Cases.
 * @param {string} periodStart First day of their period (the rhythms of the former form count from it).
 * @returns {ScheduleCase[]} Cases.
 */
export function readScheduleCases(value: unknown, periodStart: string): ScheduleCase[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (item && typeof item === 'object' && 'pattern' in item) {
      const legacy = scheduleCaseSchema.safeParse(item);
      return legacy.success ? [scheduleCaseRepetition(legacy.data, periodStart)] : [];
    }
    const parsed = scheduleRepetitionCaseSchema.safeParse(item);
    return parsed.success ? [parsed.data as ScheduleCase] : [];
  });
}

/**
 * Exceptions stored or received (JSON), validated (invalid ones left out); their cases of the former form converted.
 * @param {unknown} value Exceptions.
 * @returns {ScheduleException[]} Exceptions.
 */
export function readScheduleExceptions(value: unknown): ScheduleException[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    const parsed = z.object({ ...exceptionFields, cases: z.unknown() }).safeParse(item);
    if (!parsed.success || parsed.data.to < parsed.data.from) return [];
    return [{ from: parsed.data.from, to: parsed.data.to, label: parsed.data.label, cases: readScheduleCases(parsed.data.cases ?? [], parsed.data.from) }];
  });
}

/** Former format of a schedule (slots per weekday every n weeks, pauses), read to convert it. */
const legacySlotSchema = z.object({ weekday: z.number().int().min(1).max(7), start: timeOfDaySchema, end: timeOfDaySchema, allDay: z.boolean().default(false) });
const legacyPauseSchema = z.object({ from: daySchema(), to: daySchema(), label: z.string().default('') });

/**
 * Cases and exceptions of a schedule stored in the former format: the weekdays with the same hours become one
 * case (every n weeks from the first week), the pauses exceptions without cases.
 * @param {{ startDate: string, intervalWeeks: number, slots: unknown, pauses: unknown }} legacy Former fields.
 * @returns {{ cases: ScheduleCase[], exceptions: ScheduleException[] }} Cases and exceptions.
 */
export function fromLegacySchedule(legacy: { startDate: string; intervalWeeks: number; slots: unknown; pauses: unknown }): { cases: ScheduleCase[]; exceptions: ScheduleException[] } {
  const slots = z.array(legacySlotSchema).safeParse(legacy.slots);
  const pauses = z.array(legacyPauseSchema).safeParse(legacy.pauses);
  const byWeekday = groupBy(slots.success ? slots.data : [], (slot) => slot.weekday);
  // Weekdays with the same hours (or both whole days) make one case.
  const byHours = new Map<string, { weekdays: number[]; allDay: boolean; ranges: TimeRange[] }>();
  for (const [weekday, daySlots] of [...byWeekday].sort(([a], [b]) => a - b)) {
    const allDay = daySlots.some((slot) => slot.allDay);
    const ranges = allDay ? [] : daySlots.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start.localeCompare(b.start));
    const key = allDay ? 'all' : ranges.map((range) => `${range.start}-${range.end}`).join(',');
    const group = byHours.get(key) ?? { weekdays: [], allDay, ranges };
    group.weekdays.push(weekday);
    byHours.set(key, group);
  }
  return {
    cases: [...byHours.values()].map((group): ScheduleCase =>
      scheduleCaseRepetition(
        {
          pattern: 'WEEKLY' as const,
          weekdays: group.weekdays,
          every: Math.max(1, legacy.intervalWeeks),
          from: null,
          monthlyMode: 'DAY' as const,
          monthDay: 1,
          position: 1,
          weekday: 1,
          month: 1,
          week: 1,
          toDay: null,
          toMonth: null,
          toWeek: null,
          days: 1,
          allDay: group.allDay,
          ranges: group.ranges,
          since: null,
          until: null,
        },
        legacy.startDate,
      ),
    ),
    exceptions: (pauses.success ? pauses.data : []).map((pause) => ({ from: pause.from, to: pause.to, label: pause.label, cases: [] })),
  };
}

/**
 * How slots show in the week and the day: their hours in the background, the whole day in the background, a thin
 * line on the left of their hours, or nothing (the bar at the top aside).
 */
const SCHEDULE_DAY_DISPLAYS = ['SLOT_BACKGROUND', 'DAY_BACKGROUND', 'SLOT_BORDER', 'NONE'] as const;
export type ScheduleDayDisplay = (typeof SCHEDULE_DAY_DISPLAYS)[number];
/** How a day with slots shows in the month: in the background, a thin line at the bottom, or nothing. */
const SCHEDULE_MONTH_DISPLAYS = ['BACKGROUND', 'BORDER', 'NONE'] as const;
export type ScheduleMonthDisplay = (typeof SCHEDULE_MONTH_DISPLAYS)[number];

/** Display of slots in the calendar. */
export interface ScheduleDisplay {
  dayDisplay: ScheduleDayDisplay;
  /** A bar at the top of the week and the day (all-day row) on each day with slots. */
  dayBar: boolean;
  monthDisplay: ScheduleMonthDisplay;
}
export const DEFAULT_SCHEDULE_DISPLAY: ScheduleDisplay = { dayDisplay: 'SLOT_BACKGROUND', dayBar: true, monthDisplay: 'BACKGROUND' };

const scheduleDisplayFields = {
  dayDisplay: z.enum(SCHEDULE_DAY_DISPLAYS),
  dayBar: z.boolean(),
  monthDisplay: z.enum(SCHEDULE_MONTH_DISPLAYS),
};

/** Kind of time slots ("Travail", "Garde des enfants"…), with its color and how its slots show. */
export const scheduleTypeSchema = z.object({
  label: requiredText(),
  color: colorSchema,
  ...scheduleDisplayFields,
});

/** Label of the schedules without kind, unless the workspace labels them. */
export const DEFAULT_SCHEDULE_KIND_LABEL = 'Travail';

/** Schedules without kind of a workspace: their label (empty: "Travail"), color (none: the green of working hours) and display. */
export const defaultScheduleKindSchema = z.object({
  label: shortTextSchema,
  color: colorSchema.nullable(),
  ...scheduleDisplayFields,
});
export type DefaultScheduleKindInput = z.input<typeof defaultScheduleKindSchema>;

/** Color and display of a kind of schedules subscribed to, in the subscribing workspace; none: those of the kind. */
export const scheduleSubscriptionLookSchema = z.object({
  color: colorSchema.nullable(),
  dayDisplay: scheduleDisplayFields.dayDisplay.nullable(),
  dayBar: z.boolean().nullable(),
  monthDisplay: scheduleDisplayFields.monthDisplay.nullable(),
});
export type ScheduleSubscriptionLook = z.infer<typeof scheduleSubscriptionLookSchema>;

/**
 * Display read from stored values: unknown ones fall back to the default.
 * @param {{ dayDisplay?: string | null, dayBar?: boolean | null, monthDisplay?: string | null } | null | undefined} value Stored display.
 * @returns {ScheduleDisplay} Display.
 */
export function readScheduleDisplay(value: { dayDisplay?: string | null; dayBar?: boolean | null; monthDisplay?: string | null } | null | undefined): ScheduleDisplay {
  return {
    dayDisplay: (SCHEDULE_DAY_DISPLAYS as readonly string[]).includes(value?.dayDisplay ?? '') ? (value!.dayDisplay as ScheduleDayDisplay) : DEFAULT_SCHEDULE_DISPLAY.dayDisplay,
    dayBar: value?.dayBar ?? DEFAULT_SCHEDULE_DISPLAY.dayBar,
    monthDisplay: (SCHEDULE_MONTH_DISPLAYS as readonly string[]).includes(value?.monthDisplay ?? '') ? (value!.monthDisplay as ScheduleMonthDisplay) : DEFAULT_SCHEDULE_DISPLAY.monthDisplay,
  };
}
export type ScheduleTypeInput = z.input<typeof scheduleTypeSchema>;

/** Time slot of a schedule on a day, as moved or stretched in the calendar. */
export interface ScheduleSlotTime {
  date: string;
  start: string;
  end: string;
  allDay: boolean;
}

/** Day and hours of a slot changed from the calendar (its panel): the end after the start, but for the whole day. */
export const scheduleSlotTimeSchema = z
  .object({ date: daySchema(), start: z.string(), end: z.string(), allDay: z.boolean() })
  .refine((slot) => slot.allDay || endsAfter(slot.start, slot.end, true), { path: ['end'], message: END_AFTER_START });

/** Which slots a change of a slot applies to: that day only (an exception), it and the following ones, or all. */
type ScheduleSlotScope = 'THIS' | 'FOLLOWING' | 'ALL';

/**
 * Case holding a single slot on every day of its period (an exception of one day lists its slots so).
 * @param {ScheduleSlotTime} slot Slot.
 * @returns {ScheduleCase} Case.
 */
const singleSlotCase = (slot: ScheduleSlotTime): ScheduleCase => ({
  since: null,
  until: null,
  anchor: null,
  rule: { ...DEFAULT_RECURRENCE, frequency: 'DAILY' },
  times: { allDay: slot.allDay, ranges: slot.allDay ? [] : [{ start: slot.start, end: slot.end }] },
});

/**
 * Exceptions with one day given its own slots (each slot its own case: they may overlap); an exception of that day
 * alone is replaced (its label kept).
 * @param {readonly ScheduleException[]} exceptions Exceptions.
 * @param {string} date Day.
 * @param {readonly ScheduleSlotTime[]} slots Slots of the day.
 * @returns {ScheduleException[]} Exceptions.
 */
function withDaySlots(exceptions: readonly ScheduleException[], date: string, slots: readonly ScheduleSlotTime[]): ScheduleException[] {
  const own = exceptions.find((item) => item.from === date && item.to === date);
  return [...exceptions.filter((item) => item !== own), { from: date, to: date, label: own?.label ?? '', cases: slots.map(singleSlotCase) }];
}

/**
 * Slots of a schedule on a day.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} date Day.
 * @returns {ScheduleSlotTime[]} Slots.
 */
const daySlots = (schedule: WorkScheduleRule, date: string): ScheduleSlotTime[] =>
  plannedSlots([schedule], date, date).map((slot) => ({ date, start: slot.start, end: slot.end, allDay: slot.allDay }));

/**
 * Same slot (day apart).
 * @param {ScheduleSlotTime} a Slot.
 * @param {ScheduleSlotTime} b Slot.
 * @returns {boolean} Same hours.
 */
const sameHours = (a: ScheduleSlotTime, b: ScheduleSlotTime) => a.allDay === b.allDay && (a.allDay || (a.start === b.start && a.end === b.end));

/**
 * Case of a slot moved from a day to another (or its hours changed), keeping the rhythm of its case: weekly on the
 * new weekday, monthly and yearly on the new day of the month, every n days and weeks counted from the new day.
 * @param {ScheduleCase} item Case of the slot.
 * @param {string} periodStart Start of the period of the case.
 * @param {string} date Day of the slot.
 * @param {ScheduleSlotTime} change New day and hours.
 * @param {string | null} since First day the case applies.
 * @returns {ScheduleCase} Case.
 */
function movedCase(item: ScheduleCase, periodStart: string, date: string, change: ScheduleSlotTime, since: string | null): ScheduleCase {
  const to = change.date;
  const result: ScheduleCase = { ...item, times: { allDay: change.allDay, ranges: change.allDay ? [] : [{ start: change.start, end: change.end }] }, since };
  if (to === date || !item.rule) return result;
  const rule = item.rule;
  // The rhythm moves with the slot: by as many days (days, weeks), or months (months, years).
  const base = item.anchor ?? item.since ?? periodStart;
  const monthly = rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY';
  const anchor = monthly ? shiftMonth(base, monthIndex(to) - monthIndex(date)) : addDays(base, daysBetween(date, to));
  const day = dayOfMonthOf(to);
  const lastDay = daysInMonth(yearOfDay(to), monthOfYear(to));
  const position = day + 7 > lastDay && (rule.position === -1 || day > 28) ? -1 : (Math.ceil(day / 7) as 1 | 2 | 3 | 4);
  const values = { monthDay: day, weekday: weekdayOf(to), position, month: monthOfYear(to), week: isoWeek(to) };
  if (rule.frequency === 'WEEKLY') return { ...result, anchor, rule: { ...rule, weekdays: [weekdayOf(to)] } };
  if (rule.frequency === 'DAILY') return { ...result, anchor };
  return { ...result, anchor, rule: { ...rule, ...values } };
}

/**
 * Cases and exceptions of a schedule once one of its slots is moved, stretched or deleted (no change) from the
 * calendar: that day only (an exception of the day with its own slots, and of the day it goes to), it and the
 * following ones (its case ends the day before, a new one follows with the change), or every day of its case.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {ScheduleSlotTime} slot Slot changed.
 * @param {ScheduleSlotTime | null} change New day and hours (null: deleted).
 * @param {ScheduleSlotScope} scope Days changed.
 * @returns {{ cases: ScheduleCase[], exceptions: ScheduleException[] }} New cases and exceptions.
 */
export function changedScheduleSlot(
  schedule: WorkScheduleRule,
  slot: ScheduleSlotTime,
  change: ScheduleSlotTime | null,
  scope: ScheduleSlotScope,
): { cases: ScheduleCase[]; exceptions: ScheduleException[] } {
  if (change && !change.allDay && change.end <= change.start) throw new Error(END_AFTER_START);
  if (change && (change.date < schedule.startDate || (schedule.endDate && change.date > schedule.endDate))) throw new Error('Ce jour est en dehors de la période du créneau.');
  if (scope === 'THIS') {
    const others = daySlots(schedule, slot.date);
    const index = others.findIndex((other) => sameHours(other, slot));
    if (index >= 0) others.splice(index, 1);
    if (change?.date === slot.date) return { cases: [...schedule.cases], exceptions: withDaySlots(schedule.exceptions, slot.date, [...others, change]) };
    let exceptions = withDaySlots(schedule.exceptions, slot.date, others);
    if (change) exceptions = withDaySlots(exceptions, change.date, [...daySlots({ ...schedule, exceptions }, change.date), change]);
    return { cases: [...schedule.cases], exceptions };
  }

  const { cases, from: periodStart, exception } = casesOn(schedule, slot.date);
  const caseIndex = cases.findIndex(
    (item) => caseOn(item, periodStart, slot.date) && (slot.allDay ? item.times.allDay : !item.times.allDay && item.times.ranges.some((range) => range.start === slot.start && range.end === slot.end)),
  );
  if (caseIndex < 0) throw new Error('Horaires introuvables ce jour-là.');
  const item = cases[caseIndex];
  const range = item.times.ranges.findIndex((other) => other.start === slot.start && other.end === slot.end);
  // Split only when the case had days before this one.
  let earlier = false;
  const scanStart = [item.since, periodStart, schedule.startDate].reduce<string>((latest, day) => (day && day > latest ? day : latest), periodStart);
  for (let day = scanStart; day < slot.date && !earlier; day = addDays(day, 1)) earlier = caseOn(item, periodStart, day);
  const split = scope === 'FOLLOWING' && earlier;
  const since = split ? slot.date : item.since;
  const pieces: ScheduleCase[] = [];
  if (split) pieces.push({ ...item, until: addDays(slot.date, -1) });
  // Its other hours, and this slot on its other weekdays, stay.
  if (!item.times.allDay && item.times.ranges.length > 1) pieces.push({ ...item, times: { ...item.times, ranges: item.times.ranges.filter((_, index) => index !== range) }, since });
  if (item.rule?.frequency === 'WEEKLY' && item.rule.weekdays.length > 1) {
    pieces.push({
      ...item,
      rule: { ...item.rule, weekdays: item.rule.weekdays.filter((weekday) => weekday !== weekdayOf(slot.date)) },
      times: { ...item.times, ranges: item.times.allDay ? [] : [item.times.ranges[range]] },
      since,
    });
  }
  if (change) pieces.push(movedCase(item, periodStart, slot.date, change, split && change.date < slot.date ? change.date : since));
  const nextCases = [...cases.slice(0, caseIndex), ...pieces, ...cases.slice(caseIndex + 1)];
  if (exception) {
    return { cases: [...schedule.cases], exceptions: schedule.exceptions.map((other) => (other === exception ? { ...other, cases: nextCases } : other)) };
  }
  if (!nextCases.length) throw new Error('Ce sont les derniers horaires du créneau : supprimez le créneau lui-même.');
  return { cases: nextCases, exceptions: [...schedule.exceptions] };
}
