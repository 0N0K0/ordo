// eslint-disable-next-line no-restricted-imports -- lib/dates itself.
import { CALENDAR_DAY, dayIn, localInstant, PARIS_ZONE } from '@ordo/shared';

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
 * Paris day of an instant, YYYY-MM-DD: the day of what the server computes too (the deferral of a reminder, decision FV).
 * @param {Date} instant Instant.
 * @returns {string} Day.
 */
export function parisDay(instant: Date): string {
  return dayIn(instant, PARIS_ZONE);
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
