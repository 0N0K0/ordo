import { dayInMonth, dayOfMonthOf, daysInMonth } from './months';
import { z } from 'zod';
import { addDays, DAY_MS, formatDay, isoWeek, isoWeekday, monthOfYear, parseDay, weekdayOfDate, yearOfDay } from './days';
import { daySchema } from './times';
import { endAfter } from '../core/rules';
import { groupBy } from '../core/collections';

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
      // 1 month: to the end of the first day's month (as 1 week: to the end of its week).
      const last = month - 1 + duration.count - 1;
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
 * Validated recurrence rule stored in JSON, or null (none, or invalid).
 * @param {unknown} value JSON value.
 * @returns {Recurrence | null} Rule.
 */
export function storedRecurrence(value: unknown): Recurrence | null {
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

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
 * Rule whose monthly and yearly values are those of a new day (its day of the month, weekday, position, month, week).
 * @param {Recurrence} rule Rule.
 * @param {string} to New day.
 * @returns {Recurrence} Rule.
 */
export function ruleMovedTo(rule: Recurrence, to: string): Recurrence {
  const day = dayOfMonthOf(to);
  const lastDay = daysInMonth(yearOfDay(to), monthOfYear(to));
  const position = day + 7 > lastDay && (rule.position === -1 || day > 28) ? -1 : (Math.ceil(day / 7) as 1 | 2 | 3 | 4);
  return { ...rule, monthDay: day, weekday: weekdayOfDate(to), position, month: monthOfYear(to), week: isoWeek(to) };
}

/**
 * Weeks a weekday moves by when moved by a number of days (past Sunday: the next week; before Monday: the previous one).
 * @param {number} weekday 1 (Monday) to 7 (Sunday).
 * @param {number} days Days moved (negative: earlier).
 * @returns {number} Weeks (negative: earlier).
 */
export const crossedWeeks = (weekday: number, days: number): number => Math.floor((weekday - 1 + days) / 7);

/**
 * Whether a weekly rule moved into another week by a number of weeks counts its weeks otherwise: an odd number of
 * weeks for the even or odd weeks, a number that is not a multiple of n for every n weeks.
 * @param {Recurrence} rule Rule.
 * @param {number} weeks Weeks moved.
 * @returns {boolean} Its weeks change.
 */
export const weeksChange = (rule: Recurrence, weeks: number): boolean =>
  rule.frequency === 'WEEKLY' && (rule.weekParity ? Math.abs(weeks) % 2 === 1 : rule.interval > 1 && weeks % rule.interval !== 0);

/** Rule of a piece of a repetition, with the day its rhythm counts from (none: that of the repetition, moved as much). */
export interface RulePiece {
  rule: Recurrence;
  anchor: string | null;
}

/**
 * Rule with its end, excluded dates and pauses moved by a number of days.
 * @param {Recurrence} rule Rule.
 * @param {number} days Days moved (negative: earlier).
 * @returns {Recurrence} Rule.
 */
export const shiftedDates = (rule: Recurrence, days: number): Recurrence => ({
  ...rule,
  until: rule.until && addDays(rule.until, days),
  exceptions: rule.exceptions.map((day) => addDays(day, days)),
  pauses: rule.pauses.map((pause) => ({ from: addDays(pause.from, days), to: addDays(pause.to, days) })),
});

/**
 * Weekly rule kept to some of its weekdays, all moving into the same week, moved by a number of days: those weekdays
 * turned, even or odd weeks swapped when they change week an odd number of times, and the day its rhythm counts from
 * (every n weeks) moved with them: the first of those weekdays on its rhythm from the anchor, moved (its week goes with
 * them). Its end, excluded dates and pauses are left as given.
 * @param {Recurrence} rule Rule (its weeks before the move).
 * @param {string | null} anchor Day its rhythm counts from before the move; null: not wanted (no anchor returned).
 * @param {readonly number[]} weekdays Its weekdays that move (all of them, or the weekday of a rule without weekdays).
 * @param {number} days Days moved (negative: earlier).
 * @returns {RulePiece} Rule and the day its rhythm counts from after the move.
 */
export function movedWeekdays(rule: Recurrence, anchor: string | null, weekdays: readonly number[], days: number): RulePiece {
  const crossed = weekdays.length ? crossedWeeks(weekdays[0], days) : Math.floor(days / 7);
  const weekParity = rule.weekParity && Math.abs(crossed) % 2 === 1 ? (rule.weekParity === 'EVEN' ? 'ODD' : 'EVEN') : rule.weekParity;
  const turned: Recurrence = {
    ...rule,
    weekParity,
    weekdays: rule.weekdays.length ? weekdays.map((weekday) => ((((weekday - 1 + days) % 7) + 7) % 7) + 1).sort((a, b) => a - b) : [],
  };
  if (anchor === null) return { rule: turned, anchor: null };
  const pattern: Recurrence = { ...rule, weekdays: weekdays.length ? [...weekdays] : rule.weekdays, until: null, count: null, exceptions: [], pauses: [] };
  const first = occurrenceDates(pattern, anchor, anchor, addDays(anchor, 7 * rule.interval + 13))[0] ?? anchor;
  return { rule: turned, anchor: addDays(first, days) };
}

/**
 * Rule moved with its whole series by a number of days, so that it still falls on its days: its end, excluded dates
 * and pauses, its weekdays, and its monthly and yearly values (those of its first occurrence, moved). Weekly, its days
 * all change week together, or its weeks are not counted (every week): `shiftedRulePieces` splits the others.
 * @param {Recurrence} rule Rule.
 * @param {string | null} first First occurrence before the move (its monthly and yearly values, and the weekday of a
 * weekly rule without weekdays); null: not looked for (daily rules and weekly ones with weekdays do not need it).
 * @param {number} days Days moved (negative: earlier).
 * @returns {Recurrence} Rule.
 */
function shiftedRecurrence(rule: Recurrence, first: string | null, days: number): Recurrence {
  if (days === 0) return rule;
  const moved = shiftedDates(rule, days);
  if (rule.frequency === 'DAILY') return moved;
  if (rule.frequency === 'WEEKLY') return movedWeekdays(moved, null, rule.weekdays.length ? rule.weekdays : first ? [weekdayOfDate(first)] : [], days).rule;
  return first ? ruleMovedTo(moved, addDays(first, days)) : moved;
}

/**
 * Rule of a repetition moved with its whole series by a number of days (`shiftedRecurrence`), as one piece or several:
 * weekly with its weeks counted (every n weeks, even or odd weeks), the weekdays changing week apart from those that do
 * not, each piece on its own weeks (`movedWeekdays`: its own even or odd weeks, its own day its rhythm counts from).
 * Split, a number of occurrences becomes the day of the last one, moved, so that the pieces keep the same occurrences
 * together.
 * @param {Recurrence} rule Rule.
 * @param {string | null} first First occurrence before the move (see `shiftedRecurrence`).
 * @param {number} days Days moved (negative: earlier).
 * @param {string} anchor Day its rhythm counts from before the move.
 * @returns {RulePiece[]} Pieces (one or two); an anchor only when the rhythm needs one other than the former one moved.
 */
export function shiftedRulePieces(rule: Recurrence, first: string | null, days: number, anchor: string): RulePiece[] {
  if (days === 0 || rule.frequency !== 'WEEKLY' || (rule.interval === 1 && !rule.weekParity)) return [{ rule: shiftedRecurrence(rule, first, days), anchor: null }];
  const own = rule.weekdays.length ? rule.weekdays : [weekdayOfDate(first ?? anchor)];
  const groups = [...groupBy(own, (weekday) => crossedWeeks(weekday, days)).values()];
  let moved = shiftedDates(rule, days);
  if (groups.length > 1 && rule.count !== null) {
    const last = occurrenceDates(rule, anchor, anchor, addDays(anchor, 36_600)).at(-1);
    if (last) moved = { ...moved, count: null, until: addDays(last, days) };
  }
  return groups.map((group) => movedWeekdays(moved, anchor, group, days));
}

/** A series of events once moved: its rule and its first day. */
export interface MovedSeries {
  rule: Recurrence;
  start: string;
}

/**
 * Whether a series has a day of its rule at all: one without end always has; one with an end date, a day of its rule
 * from its first day to that date. Its excluded dates and pauses do not count: they can be given back later.
 * @param {MovedSeries} series Series.
 * @returns {boolean} It has one.
 */
const hasOccurrence = (series: MovedSeries): boolean =>
  series.rule.until === null || occurrenceDates({ ...series.rule, exceptions: [], pauses: [] }, series.start, series.start, series.rule.until).length > 0;

/**
 * Series of events a series becomes once moved (`shiftedRulePieces`): one (from its first day, moved), or, weekly with its weeks counted and only
 * some of its weekdays changing week, one per group of weekdays, each from its own first day; a group left with no
 * occurrence (its first day after the end of the series) makes none.
 * @param {Recurrence} rule Rule.
 * @param {string} start Day its rhythm counts from before the move (an occurrence).
 * @param {string | null} first First occurrence before the move (see `shiftedRecurrence`).
 * @param {number} days Days moved (negative: earlier).
 * @returns {MovedSeries[]} Series, in order of their first day (one at least).
 */
function movedSeries(rule: Recurrence, start: string, first: string | null, days: number): MovedSeries[] {
  const pieces = shiftedRulePieces(rule, first, days, start);
  if (pieces.length === 1) return [{ rule: pieces[0].rule, start: addDays(start, days) }];
  const series = pieces.map((piece) => ({ rule: piece.rule, start: piece.anchor ?? addDays(start, days) })).sort((a, b) => (a.start < b.start ? -1 : 1));
  const kept = series.filter(hasOccurrence);
  return kept.length ? kept : series.slice(0, 1);
}

/**
 * Series of the new part of a cut (« Celle-ci et les suivantes »): the rule given, moved from the occurrence by the
 * days it moved (`movedSeries`, one series per group of weekdays changing week apart); its number of occurrences, when
 * left as the series had it, reduced by those before the cut (one at least).
 * @param {Recurrence} rule Rule given.
 * @param {Recurrence} before Rule of the series before the cut.
 * @param {string} seriesStart First day of the series.
 * @param {string} date Occurrence the cut starts at.
 * @param {number} days Days the occurrence moved.
 * @returns {MovedSeries[]} New series.
 */
export function cutSeries(rule: Recurrence, before: Recurrence, seriesStart: string, date: string, days: number): MovedSeries[] {
  const counted = rule.count === null || rule.count !== before.count ? rule : { ...rule, count: Math.max(1, rule.count - occurrencesBefore(before, seriesStart, date)) };
  return movedSeries(counted, date, date, days);
}

/**
 * Series a series moved by a number of days from its first date becomes (`movedSeries`, its first occurrence looked for
 * over a year and a month).
 * @param {Recurrence} rule Rule.
 * @param {string} start First date of the series before the move.
 * @param {number} days Days moved (negative: earlier).
 * @returns {MovedSeries[]} Series.
 */
export function shiftedSeries(rule: Recurrence, start: string, days: number): MovedSeries[] {
  return movedSeries(rule, start, occurrenceDates(rule, start, start, addDays(start, 400))[0] ?? start, days);
}

/**
 * The series, among those a series became, that holds a day: the one of its weekday (the first one when none holds it).
 * @param {readonly MovedSeries[]} series Series (one at least).
 * @param {string} day Day.
 * @returns {MovedSeries} Series.
 */
export function seriesOn(series: readonly MovedSeries[], day: string): MovedSeries {
  const weekday = weekdayOfDate(day);
  return series.find((item) => item.rule.frequency === 'WEEKLY' && item.rule.weekdays.includes(weekday)) ?? series[0];
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
