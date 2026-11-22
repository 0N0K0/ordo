import { dayInMonth, dayOfMonthOf, daysInMonth } from './months';
import { z } from 'zod';
import { addDays, DAY_MS, formatDay, isoWeek, isoWeekday, monthOfYear, parseDay, weekdayOfDate, yearOfDay } from './days';
import { daySchema } from './times';
import { endAfter } from '../core/rules';

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

/**
 * How long each occurrence of a repetition lasts, from its first day: days, weeks (to the end of the last one), months
 * (to the end of the last one), or up to a day of the month (and of a month of the year), a week of the year or a month
 * of the year (the next one when it comes before).
 */
export const DURATION_UNITS = ['DAYS', 'WEEKS', 'MONTHS', 'TO_DAY', 'TO_WEEK', 'TO_MONTH'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

const occurrenceDurationSchema = z.object({
  unit: z.enum(DURATION_UNITS).default('DAYS'),
  /** DAYS, WEEKS, MONTHS: how many. */
  count: z.number().int().min(1, 'Au moins 1.').max(366, '366 au plus.').default(1),
  /** TO_DAY: last day number (the last day of a shorter month). */
  day: z.number().int().min(1).max(31).nullable().default(null),
  /** TO_DAY: its month (none: the same month, or the next one); TO_MONTH: last month. */
  month: z.number().int().min(1).max(12).nullable().default(null),
  /** TO_WEEK: last ISO week. */
  week: z.number().int().min(1).max(53).nullable().default(null),
});
export type Duration = z.infer<typeof occurrenceDurationSchema>;

/** A single day. */
export const ONE_DAY: Duration = { unit: 'DAYS', count: 1, day: null, month: null, week: null };

/** Days of an occurrence, both included. */
export interface Span {
  start: string;
  end: string;
}

/**
 * Sunday ending the ISO week of a given number in the ISO year of a date, or of the next ISO year when that week
 * comes before the date's.
 * @param {string} date YYYY-MM-DD.
 * @param {number} week ISO week number.
 * @returns {string} Sunday.
 */
function endOfIsoWeek(date: string, week: number): string {
  const sunday = addDays(date, 7 - weekdayOfDate(date));
  for (let candidate = sunday, scanned = 0; scanned < 60; candidate = addDays(candidate, 7), scanned += 1) {
    if (isoWeek(candidate) === week) return candidate;
  }
  return sunday;
}

/**
 * Last day of an occurrence started on a date.
 * @param {Duration} duration Duration.
 * @param {string} start First day.
 * @returns {string} Last day, included.
 */
export function spanEnd(duration: Duration, start: string): string {
  const year = yearOfDay(start);
  const month = monthOfYear(start);
  switch (duration.unit) {
    case 'DAYS':
      return addDays(start, duration.count - 1);
    case 'WEEKS':
      return addDays(start, 7 - weekdayOfDate(start) + 7 * (duration.count - 1));
    case 'MONTHS': {
      const last = month - 1 + duration.count;
      return dayInMonth(year + Math.floor(last / 12), (last % 12) + 1, 31);
    }
    case 'TO_DAY': {
      const day = duration.day ?? dayOfMonthOf(start);
      if (duration.month !== null) {
        const end = dayInMonth(year, duration.month, day);
        return end >= start ? end : dayInMonth(year + 1, duration.month, day);
      }
      const end = dayInMonth(year, month, day);
      return end >= start ? end : dayInMonth(month === 12 ? year + 1 : year, (month % 12) + 1, day);
    }
    case 'TO_WEEK':
      return endOfIsoWeek(start, duration.week ?? 1);
    case 'TO_MONTH': {
      const to = duration.month ?? month;
      return dayInMonth(to >= month ? year : year + 1, to, 31);
    }
  }
}

/**
 * Longest an occurrence can last, in days (how far back an occurrence covering a day may have started).
 * @param {Duration} duration Duration.
 * @returns {number} Days.
 */
export function maxSpanDays(duration: Duration): number {
  switch (duration.unit) {
    case 'DAYS':
      return duration.count;
    case 'WEEKS':
      return 7 * duration.count;
    case 'MONTHS':
      return 31 * duration.count;
    default:
      return 372;
  }
}

/**
 * Repetition of an event or a task, computed on calendar dates (from its first date).
 * Paused periods and excluded dates do not occur, and do not count in `count`.
 */
export const recurrenceSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    /** Every n days / weeks / months / years. */
    interval: z.number().int().min(1, 'Au moins 1.').max(999, '999 maximum.'),
    /** Weekly: days, 1 (Monday) to 7 (Sunday); empty: the weekday of the first date. */
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    /** Weekly: only on even or odd ISO weeks (instead of every n weeks); null: every n weeks. */
    weekParity: z.enum(['EVEN', 'ODD']).nullable().default(null),
    /**
     * Monthly and yearly: same day number (the 14th), or same weekday of the month (the 2nd Tuesday, the first Saturday
     * of April); yearly only: same weekday of the same ISO week (the Monday of week 51).
     */
    monthlyMode: z.enum(['DAY', 'WEEKDAY', 'WEEK']),
    /**
     * Values of the monthly and yearly modes, chosen (prefilled from the first date); none: those of the first date
     * (rules saved before they could be chosen). DAY: the day number (the last day of a shorter month), and the month
     * (yearly); WEEKDAY: the nth (1 to 4, -1 the last) weekday, and the month (yearly); WEEK: the weekday of the ISO week.
     */
    monthDay: z.number().int().min(1).max(31).nullish(),
    position: z.union([z.literal(-1), z.number().int().min(1).max(4)]).nullish(),
    weekday: z.number().int().min(1).max(7).nullish(),
    month: z.number().int().min(1).max(12).nullish(),
    week: z.number().int().min(1).max(53).nullish(),
    /** Last date, included. */
    until: daySchema().nullable(),
    /** Number of occurrences. */
    count: z.number().int().min(1, 'Au moins 1.').max(9999, '9 999 maximum.').nullable(),
    /** Dates that do not occur (occurrences deleted one by one). */
    exceptions: z.array(daySchema()).max(5000),
    /** How long each occurrence lasts from its first day (none: a day, or the length of the event). */
    duration: occurrenceDurationSchema.nullish(),
    /** Paused periods, dates included. */
    pauses: z.array(z.object({ from: daySchema(), to: daySchema() }).refine(...endAfter('from', 'to'))).max(100),
  })
  .refine((rule) => rule.until === null || rule.count === null, 'Choisissez une date de fin ou un nombre d’occurrences.');
export type Recurrence = z.infer<typeof recurrenceSchema>;

/**
 * Whether the occurrences of a rule depend on the day it counts from: every n days / weeks / months / years (n > 1,
 * not the even or odd weeks), or a number of occurrences.
 * @param {Recurrence | null} rule Rule (none: a single occurrence).
 * @returns {boolean} It counts from a day.
 */
export const ruleCountsFromDay = (rule: Recurrence | null): boolean =>
  Boolean(rule && ((rule.interval > 1 && !(rule.frequency === 'WEEKLY' && rule.weekParity)) || rule.count !== null));

/** Default rule for a first date: every week on its weekday. */
export const DEFAULT_RECURRENCE: Recurrence = {
  frequency: 'WEEKLY',
  interval: 1,
  weekdays: [],
  weekParity: null,
  monthlyMode: 'DAY',
  until: null,
  count: null,
  exceptions: [],
  pauses: [],
};

/** Every day: the rule of a new routine (and of a task turned into a routine). */
export const DAILY_RECURRENCE: Recurrence = { ...DEFAULT_RECURRENCE, frequency: 'DAILY' };

/**
 * ISO week number of a date (1 to 53; the week of January 4th is the first one).
 * @param {Date} date UTC date.
 * @returns {number} Week number.
 */
function weekOfYear(date: Date): number {
  return isoWeek(formatDay(date));
}

/**
 * Weekday of the month of a date: 1 to 4, or -1 when it is the last one of the month.
 * @param {Date} date UTC date.
 * @returns {number} Position.
 */
function weekdayPosition(date: Date): number {
  if (date.getUTCDate() + 7 > daysInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1)) return -1;
  return Math.ceil(date.getUTCDate() / 7);
}

/**
 * Whether a date is the day of its month a monthly or yearly rule asks for: its day number (the last day of a shorter
 * month), or its nth (or last) weekday; chosen, or else those of the first date.
 * @param {Recurrence} rule Rule.
 * @param {Date} start First date.
 * @param {Date} day Candidate date.
 * @returns {boolean} That day.
 */
function dayOfMonthMatches(rule: Recurrence, start: Date, day: Date): boolean {
  const lastDay = daysInMonth(day.getUTCFullYear(), day.getUTCMonth() + 1);
  if (rule.monthlyMode === 'WEEKDAY') {
    if (isoWeekday(day) !== (rule.weekday ?? isoWeekday(start))) return false;
    // Not chosen: the position of the first date (-1 when it was the last one of its month).
    if (rule.position === null || rule.position === undefined) return weekdayPosition(day) === weekdayPosition(start);
    return rule.position === -1 ? day.getUTCDate() + 7 > lastDay : Math.ceil(day.getUTCDate() / 7) === rule.position;
  }
  // A day missing from a month (the 31st…) occurs on its last day.
  return day.getUTCDate() === Math.min(rule.monthDay ?? start.getUTCDate(), lastDay);
}

/**
 * Whether the rule would occur on a date, before the end conditions, exceptions and pauses.
 * @param {Recurrence} rule Rule.
 * @param {Date} start First date.
 * @param {Date} day Candidate date.
 * @returns {boolean} True when it matches the pattern.
 */
function matches(rule: Recurrence, start: Date, day: Date): boolean {
  const days = Math.round((day.getTime() - start.getTime()) / DAY_MS);
  if (days < 0) return false;
  switch (rule.frequency) {
    case 'DAILY':
      return days % rule.interval === 0;
    case 'WEEKLY': {
      const weekdays = rule.weekdays.length ? rule.weekdays : [isoWeekday(start)];
      const startMonday = start.getTime() - (isoWeekday(start) - 1) * DAY_MS;
      if (!weekdays.includes(isoWeekday(day))) return false;
      // Even or odd weeks of the year, whatever the interval.
      if (rule.weekParity) return weekOfYear(day) % 2 === (rule.weekParity === 'EVEN' ? 0 : 1);
      const weeks = Math.floor(Math.round((day.getTime() - startMonday) / DAY_MS) / 7);
      return weeks % rule.interval === 0;
    }
    case 'MONTHLY': {
      const months = (day.getUTCFullYear() - start.getUTCFullYear()) * 12 + day.getUTCMonth() - start.getUTCMonth();
      if (months % rule.interval !== 0) return false;
      return dayOfMonthMatches(rule, start, day);
    }
    case 'YEARLY': {
      if (rule.monthlyMode === 'WEEK') {
        // A weekday of an ISO week, counted in ISO years (those of their Thursday).
        const isoYear = (date: Date) => new Date(date.getTime() + (4 - isoWeekday(date)) * DAY_MS).getUTCFullYear();
        const years = isoYear(day) - isoYear(start);
        return years >= 0 && years % rule.interval === 0 && isoWeekday(day) === (rule.weekday ?? isoWeekday(start)) && weekOfYear(day) === (rule.week ?? weekOfYear(start));
      }
      const years = day.getUTCFullYear() - start.getUTCFullYear();
      if (years % rule.interval !== 0 || day.getUTCMonth() + 1 !== (rule.month ?? start.getUTCMonth() + 1)) return false;
      return dayOfMonthMatches(rule, start, day);
    }
  }
}

/**
 * Dates on which a rule occurs between two dates (included), from its first date.
 * @param {Recurrence} rule Rule.
 * @param {string} start First date (always an occurrence, unless excluded or paused).
 * @param {string} from Range start.
 * @param {string} to Range end, included.
 * @returns {string[]} Dates, in order.
 */
export function occurrenceDates(rule: Recurrence, start: string, from: string, to: string): string[] {
  const first = parseDay(start);
  const last = rule.until && rule.until < to ? rule.until : to;
  const exceptions = new Set(rule.exceptions);
  const skipped = (date: string) => exceptions.has(date) || rule.pauses.some((pause) => date >= pause.from && date <= pause.to);
  const result: string[] = [];
  let counted = 0;
  // Counted occurrences start at the first date, so the scan does too when a count is set.
  const scanFrom = rule.count !== null || from < start ? start : from;
  for (let time = parseDay(scanFrom).getTime(); time <= parseDay(last).getTime(); time += DAY_MS) {
    const day = new Date(time);
    if (!matches(rule, first, day)) continue;
    const date = formatDay(day);
    if (skipped(date)) continue;
    counted += 1;
    if (rule.count !== null && counted > rule.count) break;
    if (date >= from) result.push(date);
  }
  return result;
}

/**
 * Number of occurrences before a date (for the count of a series split at that date).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @param {string} date Split date (excluded).
 * @returns {number} Occurrences.
 */
export function occurrencesBefore(rule: Recurrence, start: string, date: string): number {
  if (date <= start) return 0;
  return occurrenceDates({ ...rule, count: null }, start, start, addDays(date, -1)).length;
}

/**
 * Offset of a time zone at an instant, in minutes (Paris in winter: 60).
 * @param {number} time Instant in ms.
 * @param {string} timeZone IANA time zone.
 * @returns {number} Offset.
 */
function zoneOffset(time: number, timeZone: string): number {
  // eslint-disable-next-line no-restricted-syntax -- the parts of a time zone, not a display format.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(time));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const local = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return Math.round((local - Math.floor(time / 1000) * 1000) / 60_000);
}

/**
 * Instant of a local date and time in a time zone.
 * @param {string} date Calendar date.
 * @param {string} time HH:MM.
 * @param {string} timeZone IANA time zone.
 * @returns {Date} Instant.
 */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const guess = parseDay(date).getTime() + (hours * 60 + minutes) * 60_000;
  const first = guess - zoneOffset(guess, timeZone) * 60_000;
  // Second pass: the offset may differ at the corrected instant (daylight saving change).
  return new Date(guess - zoneOffset(first, timeZone) * 60_000);
}

/** Values of the monthly and yearly modes of a rule, chosen or those of its first date. */
interface RuleValues {
  monthDay: number;
  position: -1 | 1 | 2 | 3 | 4;
  weekday: number;
  month: number;
  week: number;
}

/**
 * Values of the monthly and yearly modes a rule uses: those chosen, else those of its first date.
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @returns {RuleValues} Values.
 */
export function ruleValues(rule: Recurrence, start: string): RuleValues {
  const day = parseDay(start);
  const position = weekdayPosition(day) as RuleValues['position'];
  return {
    monthDay: rule.monthDay ?? day.getUTCDate(),
    position: (rule.position ?? position) as RuleValues['position'],
    weekday: rule.weekday ?? isoWeekday(day),
    month: rule.month ?? day.getUTCMonth() + 1,
    week: rule.week ?? weekOfYear(day),
  };
}

/**
 * Rule with its monthly and yearly values chosen (those of its first date when not yet).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date.
 * @returns {Recurrence} Rule.
 */
export function withRuleValues(rule: Recurrence, start: string): Recurrence {
  return { ...rule, ...ruleValues(rule, start) };
}
