/**
 * Days and times of the app: every one is read in Paris (`PARIS_ZONE`), as the API and the agenda read them, whatever
 * the time zone of the browser. A calendar day (YYYY-MM-DD) has no zone and is kept as it is.
 */

// eslint-disable-next-line no-restricted-imports -- lib/dates itself.
import { addDays, CALENDAR_DAY, dayIn, parisInstant, parisParts as parisPartsOf } from '@ordo/shared';

/**
 * Day of an instant in Paris, the day of the app's items (a time and the events of its day, as the API reads it); a
 * calendar day (or month) as it is.
 * @param {Date | string | number} value Instant (a date, its ISO text or timestamp), or a day (YYYY-MM-DD) or month (YYYY-MM).
 * @returns {string} Day (YYYY-MM-DD) in Paris (the month for a month).
 */
export function parisDay(value: Date | string | number): string {
  return typeof value === 'string' && CALENDAR_DAY.test(value) ? value : dayIn(value instanceof Date ? value : new Date(value));
}

// eslint-disable-next-line no-restricted-imports -- the one path of monthOfDay and yearOfDay in the app.
export { monthOfDay, yearOfDay } from '@ordo/shared';

/**
 * Today in Paris, YYYY-MM-DD (the « today » of the API: `parisToday`).
 * @returns {string} Day.
 */
export function parisToday(): string {
  return parisDay(new Date());
}

/**
 * Day and time of an instant in Paris, whatever the zone of the browser.
 * @param {Date | string} instant Instant (a date, or its ISO text).
 * @returns {{ date: string, time: string }} Day (YYYY-MM-DD) and time (HH:MM) in Paris.
 */
export function parisParts(instant: Date | string): { date: string; time: string } {
  return parisPartsOf(typeof instant === 'string' ? new Date(instant) : instant);
}

/**
 * Midnight in Paris of a day, as an ISO date-time (the start of the day).
 * @param {string} day YYYY-MM-DD.
 * @returns {string} Date-time.
 */
export function parisMidnight(day: string): string {
  return parisInstant(day).toISOString();
}

/**
 * Time left until the next day starts in Paris, plus a second (a refresh then falls on the new day).
 * @returns {number} Milliseconds.
 */
export function untilNextParisDay(): number {
  return parisInstant(addDays(parisToday(), 1)).getTime() - Date.now() + 1000;
}

/** Instant of a Paris day and time (`parisInstant` of @ordo/shared, shared with the reminders). */
export { parisInstant };

/** `parisDay` under its former name, read by the documents library only (to be rewritten, left as it is). */
export const localDay = parisDay;
