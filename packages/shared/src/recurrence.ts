import { z } from 'zod';

const isoDate = z.iso.date({ error: 'Date invalide.' });

export const RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

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
    /** Monthly and yearly: same day number (the 14th), or same weekday of the month (the 2nd Tuesday, the first Saturday of April). */
    monthlyMode: z.enum(['DAY', 'WEEKDAY']),
    /** Last date, included. */
    until: isoDate.nullable(),
    /** Number of occurrences. */
    count: z.number().int().min(1, 'Au moins 1.').max(9999, '9 999 maximum.').nullable(),
    /** Dates that do not occur (occurrences deleted one by one). */
    exceptions: z.array(isoDate).max(5000),
    /** Paused periods, dates included. */
    pauses: z
      .array(z.object({ from: isoDate, to: isoDate }).refine((pause) => pause.to >= pause.from, 'La fin de la pause doit suivre son début.'))
      .max(100),
  })
  .refine((rule) => rule.until === null || rule.count === null, 'Choisissez une date de fin ou un nombre d’occurrences.');
export type Recurrence = z.infer<typeof recurrenceSchema>;

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

const DAY_MS = 86_400_000;

/**
 * Date of a YYYY-MM-DD string, at midnight UTC (calendar arithmetic, no time zone).
 * @param {string} date Calendar date.
 * @returns {Date} Date.
 */
export function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * YYYY-MM-DD of a UTC date.
 * @param {Date} date Date at midnight UTC.
 * @returns {string} Calendar date.
 */
export function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds days to a calendar date.
 * @param {string} date Calendar date.
 * @param {number} days Days, possibly negative.
 * @returns {string} Calendar date.
 */
export function addDays(date: string, days: number): string {
  return formatDay(new Date(parseDay(date).getTime() + days * DAY_MS));
}

/**
 * Days from one calendar date to another.
 * @param {string} from First date.
 * @param {string} to Second date.
 * @returns {number} Days (negative when `to` is before).
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}

/**
 * ISO weekday, 1 (Monday) to 7 (Sunday).
 * @param {Date} date UTC date.
 * @returns {number} Weekday.
 */
function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * ISO week number of a date (1 to 53; the week of January 4th is the first one).
 * @param {Date} date UTC date.
 * @returns {number} Week number.
 */
function weekOfYear(date: Date): number {
  // The Thursday of the week tells its year.
  const thursday = new Date(date.getTime() + (4 - isoWeekday(date)) * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

/**
 * Weekday of the month of a date: 1 to 4, or -1 when it is the last one of the month.
 * @param {Date} date UTC date.
 * @returns {number} Position.
 */
function weekdayPosition(date: Date): number {
  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  if (date.getUTCDate() + 7 > daysInMonth) return -1;
  return Math.ceil(date.getUTCDate() / 7);
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
      if (rule.monthlyMode === 'WEEKDAY') {
        return isoWeekday(day) === isoWeekday(start) && weekdayPosition(day) === weekdayPosition(start);
      }
      // A day missing from a month (the 31st…) occurs on its last day.
      const lastDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
      return day.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
    }
    case 'YEARLY': {
      const years = day.getUTCFullYear() - start.getUTCFullYear();
      if (years % rule.interval !== 0 || day.getUTCMonth() !== start.getUTCMonth()) return false;
      if (rule.monthlyMode === 'WEEKDAY') {
        return isoWeekday(day) === isoWeekday(start) && weekdayPosition(day) === weekdayPosition(start);
      }
      const lastDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
      return day.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
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

/**
 * Local calendar date of an instant in a time zone.
 * @param {Date} instant Instant.
 * @param {string} timeZone IANA time zone.
 * @returns {string} Calendar date.
 */
export function zonedDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}
