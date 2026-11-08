import { z } from 'zod';
import { addDays, daysBetween, parseDay } from './recurrence';
import { colorSchema } from './workspace';

const isoDate = z.iso.date({ error: 'Date invalide.' });
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).');

/** Hours of a day of a case, in local time. */
export const timeRangeSchema = z.object({ start: timeSchema, end: timeSchema }).refine((range) => range.end > range.start, { path: ['end'], message: 'La fin doit suivre le début.' });
export type TimeRange = z.infer<typeof timeRangeSchema>;

/** Which days a case is on: every day of its period, weekdays (every n weeks), every n days, a day of the month
 * (every n months) or of a month of the year (every n years). */
export const SCHEDULE_PATTERNS = ['DAILY', 'WEEKLY', 'EVERY_N_DAYS', 'MONTHLY', 'YEARLY'] as const;
export type SchedulePattern = (typeof SCHEDULE_PATTERNS)[number];

/**
 * A case of a schedule: on which days (every day, weekdays every n weeks, every n days) and with which hours (time
 * ranges, or the whole day). The same hours on all its days.
 */
export const scheduleCaseSchema = z
  .object({
    pattern: z.enum(SCHEDULE_PATTERNS),
    /** WEEKLY: 1 (Monday) to 7 (Sunday). */
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    /** WEEKLY: every n weeks; EVERY_N_DAYS: every n days; MONTHLY: every n months; YEARLY: every n years. */
    every: z.number().int().min(1, 'Au moins 1.').max(366, '366 au plus.').default(1),
    /** MONTHLY, YEARLY: a day number (the 15th, the last day when the month has fewer), or the nth weekday. */
    monthlyMode: z.enum(['DAY', 'WEEKDAY']).default('DAY'),
    monthDay: z.number().int().min(1).max(31).default(1),
    /** WEEKDAY mode: 1 to 4, or -1 for the last one of the month… */
    position: z.union([z.literal(-1), z.number().int().min(1).max(4)]).default(1),
    /** …of this weekday, 1 (Monday) to 7. */
    weekday: z.number().int().min(1).max(7).default(1),
    /** YEARLY: month, 1 to 12. */
    month: z.number().int().min(1).max(12).default(1),
    /** First day of the rhythm (its week for WEEKLY); none: the start of the period. */
    from: isoDate.nullable().default(null),
    allDay: z.boolean().default(false),
    ranges: z.array(timeRangeSchema).max(12, '12 tranches au plus.').default([]),
  })
  .superRefine((item, context) => {
    if (item.pattern === 'WEEKLY' && !item.weekdays.length) context.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choisissez au moins un jour.' });
    if (!item.allDay && !item.ranges.length) context.addIssue({ code: 'custom', path: ['ranges'], message: 'Ajoutez des horaires, ou « toute la journée ».' });
    // Ranges of a case must not overlap.
    const sorted = [...item.ranges].sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((range, index) => {
      if (index && sorted[index - 1].end > range.start) context.addIssue({ code: 'custom', path: ['ranges'], message: 'Des horaires se chevauchent.' });
    });
  });
export type ScheduleCase = z.infer<typeof scheduleCaseSchema>;
export type ScheduleCaseInput = z.input<typeof scheduleCaseSchema>;

/** Period with its own cases instead of the general ones (none: a pause, holidays…), dates included. */
export const scheduleExceptionSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    label: z.string().trim().max(100, '100 caractères maximum.').default(''),
    cases: z.array(scheduleCaseSchema).max(20, '20 cas au plus.').default([]),
  })
  .refine((exception) => exception.to >= exception.from, { path: ['to'], message: 'La fin doit suivre le début.' });
export type ScheduleException = z.infer<typeof scheduleExceptionSchema>;

/** Planned time slots: a name, a kind, a period, its cases, and exceptions (periods with cases of their own). */
export const workScheduleSchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.'),
    startDate: isoDate,
    endDate: isoDate.nullable(),
    cases: z.array(scheduleCaseSchema).min(1, 'Ajoutez au moins un cas.').max(20, '20 cas au plus.'),
    exceptions: z.array(scheduleExceptionSchema).max(200, '200 exceptions au plus.'),
    /** Kind of time it plans; none: working hours. */
    typeId: z.string().nullish(),
  })
  .superRefine((schedule, context) => {
    if (schedule.endDate && schedule.endDate < schedule.startDate) context.addIssue({ code: 'custom', path: ['endDate'], message: 'La fin doit suivre le début.' });
  });
export type WorkScheduleInput = z.input<typeof workScheduleSchema>;

/** Stored schedule, as the functions below read it. */
export interface WorkScheduleRule {
  id: string;
  name: string;
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
export interface PlannedPause {
  from: string;
  to: string;
  label: string;
  scheduleId: string;
  scheduleName: string;
}

/**
 * ISO weekday of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {number} 1 (Monday) to 7 (Sunday).
 */
export function weekdayOf(date: string): number {
  return ((parseDay(date).getUTCDay() + 6) % 7) + 1;
}

/**
 * Monday of the week of a date.
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Monday.
 */
export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/**
 * ISO week number of a date (1 to 53).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Week number.
 */
export function isoWeek(date: string): number {
  const thursday = addDays(date, 4 - weekdayOf(date));
  return Math.floor(daysBetween(`${thursday.slice(0, 4)}-01-01`, thursday) / 7) + 1;
}

/**
 * Rhythms a period allows: one day, hours only; a week at most, weekdays without "every n weeks"; longer (or no
 * end), weekdays every n weeks or every n days.
 * @param {string} from First day.
 * @param {string | null} to Last day (none: no end).
 * @returns {'DAY' | 'WEEK' | 'ANY'} Rhythms allowed.
 */
export function periodRhythm(from: string, to: string | null): 'DAY' | 'WEEK' | 'ANY' {
  if (to === null) return 'ANY';
  const days = daysBetween(from, to) + 1;
  return days <= 1 ? 'DAY' : days <= 7 ? 'WEEK' : 'ANY';
}

/**
 * Whether a date is the day a monthly or yearly case asks for in its month: a day number (the last day when the
 * month is shorter), or the nth (or last) weekday.
 * @param {ScheduleCase} item Case.
 * @param {string} date YYYY-MM-DD.
 * @returns {boolean} That day.
 */
function dayOfMonthMatches(item: ScheduleCase, date: string): boolean {
  const day = Number(date.slice(8, 10));
  const lastDay = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();
  if (item.monthlyMode === 'DAY') return day === Math.min(item.monthDay, lastDay);
  if (weekdayOf(date) !== item.weekday) return false;
  return item.position === -1 ? day + 7 > lastDay : Math.ceil(day / 7) === item.position;
}

/**
 * Whether a case is on a date (its period checked apart).
 * @param {ScheduleCase} item Case.
 * @param {string} periodStart First day of its period (rhythm start without `from`).
 * @param {string} date YYYY-MM-DD.
 * @returns {boolean} On that day.
 */
function caseOn(item: ScheduleCase, periodStart: string, date: string): boolean {
  const anchor = item.from ?? periodStart;
  if (item.pattern === 'DAILY') return true;
  if (item.pattern === 'EVERY_N_DAYS') {
    const days = daysBetween(anchor, date);
    return days >= 0 && days % item.every === 0;
  }
  if (item.pattern === 'MONTHLY') {
    const months = (Number(date.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(anchor.slice(5, 7));
    return months >= 0 && months % item.every === 0 && dayOfMonthMatches(item, date);
  }
  if (item.pattern === 'YEARLY') {
    const years = Number(date.slice(0, 4)) - Number(anchor.slice(0, 4));
    return years >= 0 && years % item.every === 0 && Number(date.slice(5, 7)) === item.month && dayOfMonthMatches(item, date);
  }
  if (!item.weekdays.includes(weekdayOf(date))) return false;
  const weeks = daysBetween(mondayOf(anchor), mondayOf(date)) / 7;
  return ((weeks % item.every) + item.every) % item.every === 0;
}

/**
 * Cases in force on a date: those of the exception covering it (the one started last when several do), or else
 * the general ones; with the first day of their period.
 * @param {WorkScheduleRule} schedule Schedule.
 * @param {string} date YYYY-MM-DD.
 * @returns {{ cases: readonly ScheduleCase[], from: string, exception: ScheduleException | null }} Cases.
 */
export function casesOn(schedule: WorkScheduleRule, date: string): { cases: readonly ScheduleCase[]; from: string; exception: ScheduleException | null } {
  const exception = schedule.exceptions.filter((item) => item.from <= date && date <= item.to).sort((a, b) => b.from.localeCompare(a.from))[0];
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
  for (let date = from; date <= to; date = addDays(date, 1)) {
    for (const schedule of schedules) {
      if (date < schedule.startDate || (schedule.endDate && date > schedule.endDate)) continue;
      const { cases, from: periodStart } = casesOn(schedule, date);
      for (const item of cases) {
        if (!caseOn(item, periodStart, date)) continue;
        if (item.allDay) result.push({ date, start: '00:00', end: '24:00', allDay: true, scheduleId: schedule.id });
        else for (const range of item.ranges) result.push({ date, start: range.start, end: range.end, allDay: false, scheduleId: schedule.id });
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
      .map((exception) => ({ from: exception.from, to: exception.to, label: exception.label, scheduleId: schedule.id, scheduleName: schedule.name })),
  );
}

/**
 * Minutes of time slots (whole days are no planned working time: left out).
 * @param {readonly { start: string, end: string, allDay?: boolean }[]} slots Slots.
 * @returns {number} Minutes.
 */
export function slotMinutes(slots: readonly { start: string; end: string; allDay?: boolean }[]): number {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return slots.filter((slot) => !slot.allDay).reduce((sum, slot) => sum + minutes(slot.end) - minutes(slot.start), 0);
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
 * Cases stored or received (JSON), validated: none when invalid.
 * @param {unknown} value Cases.
 * @returns {ScheduleCase[]} Cases.
 */
export function readScheduleCases(value: unknown): ScheduleCase[] {
  const parsed = z.array(scheduleCaseSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Exceptions stored or received (JSON), validated: none when invalid.
 * @param {unknown} value Exceptions.
 * @returns {ScheduleException[]} Exceptions.
 */
export function readScheduleExceptions(value: unknown): ScheduleException[] {
  const parsed = z.array(scheduleExceptionSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Former format of a schedule (slots per weekday every n weeks, pauses), read to convert it. */
const legacySlotSchema = z.object({ weekday: z.number().int().min(1).max(7), start: timeSchema, end: timeSchema, allDay: z.boolean().default(false) });
const legacyPauseSchema = z.object({ from: isoDate, to: isoDate, label: z.string().default('') });

/**
 * Cases and exceptions of a schedule stored in the former format: the weekdays with the same hours become one
 * case (every n weeks from the first week), the pauses exceptions without cases.
 * @param {{ startDate: string, intervalWeeks: number, slots: unknown, pauses: unknown }} legacy Former fields.
 * @returns {{ cases: ScheduleCase[], exceptions: ScheduleException[] }} Cases and exceptions.
 */
export function fromLegacySchedule(legacy: { startDate: string; intervalWeeks: number; slots: unknown; pauses: unknown }): { cases: ScheduleCase[]; exceptions: ScheduleException[] } {
  const slots = z.array(legacySlotSchema).safeParse(legacy.slots);
  const pauses = z.array(legacyPauseSchema).safeParse(legacy.pauses);
  const byWeekday = new Map<number, z.infer<typeof legacySlotSchema>[]>();
  for (const slot of slots.success ? slots.data : []) byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot]);
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
    cases: [...byHours.values()].map((group) => ({
      pattern: 'WEEKLY' as const,
      weekdays: group.weekdays,
      every: Math.max(1, legacy.intervalWeeks),
      from: null,
      monthlyMode: 'DAY' as const,
      monthDay: 1,
      position: 1,
      weekday: 1,
      month: 1,
      allDay: group.allDay,
      ranges: group.ranges,
    })),
    exceptions: (pauses.success ? pauses.data : []).map((pause) => ({ from: pause.from, to: pause.to, label: pause.label, cases: [] })),
  };
}

/**
 * How slots show in the week and the day: their hours in the background, the whole day in the background, a thin
 * line on the left of their hours, or nothing (the bar at the top aside).
 */
export const SCHEDULE_DAY_DISPLAYS = ['SLOT_BACKGROUND', 'DAY_BACKGROUND', 'SLOT_BORDER', 'NONE'] as const;
export type ScheduleDayDisplay = (typeof SCHEDULE_DAY_DISPLAYS)[number];
/** How a day with slots shows in the month: in the background, a thin line at the bottom, or nothing. */
export const SCHEDULE_MONTH_DISPLAYS = ['BACKGROUND', 'BORDER', 'NONE'] as const;
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
  name: z.string().trim().min(1, 'Le nom est requis.').max(60, '60 caractères maximum.'),
  color: colorSchema,
  ...scheduleDisplayFields,
});

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
