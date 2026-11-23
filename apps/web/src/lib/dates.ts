// eslint-disable-next-line no-restricted-imports -- lib/dates itself.
import { CALENDAR_DAY, dayIn, localInstant, PARIS_ZONE, timeIn } from '@ordo/shared';

/**
 * Local date-time of an instant, as ISO text without zone (YYYY-MM-DDTHH:MM:SS.sss).
 * @param {Date} date Instant.
 * @returns {string} Local date-time.
 */
function localIso(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 23);
}

/**
 * User's day of an instant, YYYY-MM-DD.
 * @param {Date | string} instant Instant (a date, or its ISO text).
 * @returns {string} Day.
 */
export function localDay(instant: Date | string): string {
  return dayIn(typeof instant === 'string' ? new Date(instant) : instant);
}

/**
 * Day of a day or an instant: a calendar day (or month) as it is, an instant in the user's time zone (not UTC).
 * @param {string} value Day (YYYY-MM-DD), month (YYYY-MM) or instant (ISO date-time).
 * @returns {string} Day (the month for a month).
 */
export function dayOf(value: string): string {
  return CALENDAR_DAY.test(value) ? value : localDay(value);
}

// eslint-disable-next-line no-restricted-imports -- the one path of monthOfDay and yearOfDay in the app.
export { monthOfDay, yearOfDay } from '@ordo/shared';

/**
 * User's current day, YYYY-MM-DD.
 * @returns {string} Day.
 */
export function localToday(): string {
  return localDay(new Date());
}

/**
 * Local "YYYY-MM-DD" and "HH:MM" of an instant.
 * @param {Date | string} instant Instant (a date, or its ISO text).
 * @returns {{ date: string, time: string }} Local parts.
 */
export function localParts(instant: Date | string): { date: string; time: string } {
  const local = localIso(typeof instant === 'string' ? new Date(instant) : instant);
  // eslint-disable-next-line no-restricted-syntax -- the local day and time of an instant.
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/**
 * Local midnight of a day, as an ISO date-time (the start of the day for the user).
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Date-time.
 */
export function localMidnight(day: string): string {
  return localInstant(day).toISOString();
}

/** Instant of a day and a time of the user (`localInstant` of @ordo/shared, shared with the alarms). */
export { localInstant };

/**
 * Day and time of an instant in Paris, the time of the days and hours of the app's items (routines, events), whatever
 * the zone of the browser.
 * @param {Date} instant Instant.
 * @returns {{ date: string, time: string }} Day (YYYY-MM-DD) and time (HH:MM) in Paris.
 */
export function parisParts(instant: Date): { date: string; time: string } {
  return { date: dayIn(instant, PARIS_ZONE), time: timeIn(instant, PARIS_ZONE) };
}

/**
 * Day of an instant in Paris, the day of the app's items (a time and the events of its day, as the API reads it); a
 * calendar day as it is.
 * @param {Date | string | number} value Instant (a date, its ISO text or timestamp), or a day (YYYY-MM-DD).
 * @returns {string} Day (YYYY-MM-DD) in Paris.
 */
export function parisDay(value: Date | string | number): string {
  return typeof value === 'string' && CALENDAR_DAY.test(value) ? value : dayIn(value instanceof Date ? value : new Date(value), PARIS_ZONE);
}
