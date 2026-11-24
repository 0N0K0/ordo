/** Milliseconds in a day (calendar arithmetic, UTC). */
// eslint-disable-next-line no-restricted-syntax -- the constant itself.
export const DAY_MS = 86_400_000;

/** Time zone of Ordo: every day and every time of the app and of the API is read in Paris, whatever the zone of the browser or of the server. */
export const PARIS_ZONE = 'Europe/Paris';

/** A calendar day (YYYY-MM-DD) or month (YYYY-MM): read as it is, whatever the time zone. */
export const CALENDAR_DAY = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * Date of a YYYY-MM-DD string, at midnight UTC (calendar arithmetic, no time zone).
 * @param {string} date Calendar date.
 * @returns {Date} Date.
 */
export function parseDay(date: string): Date {
  // eslint-disable-next-line no-restricted-syntax -- parseDay itself.
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Day of an instant in a time zone, YYYY-MM-DD.
 * @param {Date} instant Instant.
 * @param {string} [timeZone] IANA time zone. Optional. Default = Paris (`PARIS_ZONE`).
 * @returns {string} Day.
 */
export function dayIn(instant: Date, timeZone: string = PARIS_ZONE): string {
  // eslint-disable-next-line no-restricted-syntax -- the day in a time zone, as YYYY-MM-DD.
  return instant.toLocaleDateString('sv-SE', { timeZone });
}

/**
 * Time of the day of an instant in a time zone, HH:MM (the inverse of `zonedInstant` with `dayIn`).
 * @param {Date} instant Instant.
 * @param {string} timeZone IANA time zone.
 * @returns {string} HH:MM.
 */
export function timeIn(instant: Date, timeZone: string): string {
  // eslint-disable-next-line no-restricted-syntax -- the time of the day in a time zone, as HH:MM.
  return instant.toLocaleTimeString('sv-SE', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/**
 * Day and time of an instant in Paris, the time every day and hour of the app and of the API is read in, whatever the
 * zone of the browser or of the server.
 * @param {Date} instant Instant.
 * @returns {{ date: string, time: string }} Day (YYYY-MM-DD) and time (HH:MM) in Paris.
 */
export function parisParts(instant: Date): { date: string; time: string } {
  return { date: dayIn(instant, PARIS_ZONE), time: timeIn(instant, PARIS_ZONE) };
}

/**
 * Date at midnight UTC of a YYYY-MM-DD day that may be missing: null and undefined are kept (a field cleared, or left
 * unchanged).
 * @param {string | null | undefined} date Day.
 * @returns {Date | null | undefined} Date.
 */
export function parseOptionalDay<T extends string | null | undefined>(date: T): Date | Exclude<T, string> {
  return (date === null || date === undefined ? date : parseDay(date)) as Date | Exclude<T, string>;
}

/**
 * YYYY-MM-DD of a UTC date.
 * @param {Date} date Date at midnight UTC.
 * @returns {string} Calendar date.
 */
export function formatDay(date: Date): string {
  // eslint-disable-next-line no-restricted-syntax -- formatDay itself.
  return date.toISOString().slice(0, 10);
}

/**
 * YYYY-MM-DD of a UTC date that may be missing: null and undefined are kept (the mirror of `parseOptionalDay`).
 * @param {Date | null | undefined} date Date at midnight UTC.
 * @returns {string | null | undefined} Calendar date.
 */
export function formatOptionalDay<T extends Date | null | undefined>(date: T): string | Exclude<T, Date> {
  return (date === null || date === undefined ? date : formatDay(date)) as string | Exclude<T, Date>;
}

/**
 * Month of a calendar day.
 * @param {string} day Day, YYYY-MM-DD (or longer: an ISO date-time read as it is).
 * @returns {string} Month, YYYY-MM.
 */
export function monthOfDay(day: string): string {
  // eslint-disable-next-line no-restricted-syntax -- monthOfDay itself.
  return day.slice(0, 7);
}

/**
 * Day of an ISO date-time read as it is written (its own offset), or of a day; null stays null.
 * @param {T} value YYYY-MM-DD, or YYYY-MM-DDTHH:MM…, or null / undefined.
 * @returns {string | Exclude<T, string>} Day, YYYY-MM-DD.
 */
export function dayPart<T extends string | null | undefined>(value: T): string | Exclude<T, string> {
  // eslint-disable-next-line no-restricted-syntax -- dayPart itself.
  return (typeof value === 'string' ? value.slice(0, 10) : value) as string | Exclude<T, string>;
}

/**
 * Month of a date at midnight UTC (a Date scalar).
 * @param {Date} date Date.
 * @returns {string} Month, YYYY-MM.
 */
// eslint-disable-next-line no-restricted-syntax -- monthOfDate itself.
export const monthOfDate = (date: Date): string => monthOfDay(formatDay(date));

/**
 * Month number of a calendar day (or month).
 * @param {string} day Day, YYYY-MM-DD, or month, YYYY-MM.
 * @returns {number} Month, 1 to 12.
 */
export function monthOfYear(day: string): number {
  // eslint-disable-next-line no-restricted-syntax -- monthOfYear itself.
  return Number(day.slice(5, 7));
}

/**
 * Quarter of a calendar day (or month).
 * @param {string} day Day, YYYY-MM-DD, or month, YYYY-MM.
 * @returns {number} Quarter, 1 to 4.
 */
export function quarterOf(day: string): number {
  return Math.floor((monthOfYear(day) - 1) / 3) + 1;
}

/**
 * Year of a calendar day (or month).
 * @param {string} day Day, YYYY-MM-DD, or month, YYYY-MM.
 * @returns {number} Year.
 */
export function yearOfDay(day: string): number {
  // eslint-disable-next-line no-restricted-syntax -- yearOfDay itself.
  return Number(day.slice(0, 4));
}

/**
 * Day as printed in documents and mails: DD/MM/YYYY.
 * @param {string | Date} day YYYY-MM-DD, or a date at midnight UTC.
 * @returns {string} DD/MM/YYYY.
 */
export function printedDay(day: string | Date): string {
  const [year, month, date] = dayPart(typeof day === 'string' ? day : formatDay(day)).split('-');
  return `${date}/${month}/${year}`;
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
export function isoWeekday(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

/**
 * ISO week number of a date (1 to 53; the week of January 4th is the first one: its Thursday tells its year).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Week number.
 */
export function isoWeek(date: string): number {
  const thursday = addDays(date, 4 - weekdayOfDate(date));
  return Math.floor(daysBetween(`${yearOfDay(thursday)}-01-01`, thursday) / 7) + 1;
}

/**
 * Day of the week of a date, 1 (Monday) to 7 (Sunday).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Day.
 */
export const weekdayOfDate = (date: string): number => isoWeekday(parseDay(date));
