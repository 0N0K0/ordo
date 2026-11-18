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
  return localIso(typeof instant === 'string' ? new Date(instant) : instant).slice(0, 10);
}

/** A calendar day (YYYY-MM-DD) or month (YYYY-MM): read as it is, whatever the time zone. */
const CALENDAR_DAY = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * Day of a day or an instant: a calendar day (or month) as it is, an instant in the user's time zone (not UTC).
 * @param {string} value Day (YYYY-MM-DD), month (YYYY-MM) or instant (ISO date-time).
 * @returns {string} Day (the month for a month).
 */
export function dayOf(value: string): string {
  return CALENDAR_DAY.test(value) ? value : localDay(value);
}

/**
 * Month of a calendar day (or of a date picker's value).
 * @param {string} day Day, YYYY-MM-DD.
 * @returns {string} Month, YYYY-MM.
 */
export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

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

/**
 * Instant of a day and a time of the user (in their time zone): an alarm ringing, a time entry starting…
 * @param {string} day YYYY-MM-DD.
 * @param {string} [time] HH:MM. Optional. Default = 00:00 (the start of the day).
 * @returns {Date} Instant.
 */
export function localInstant(day: string, time = '00:00'): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hours, minutes);
}
