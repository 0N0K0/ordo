/**
 * User's day of an instant, YYYY-MM-DD.
 * @param {Date} date Instant.
 * @returns {string} Day.
 */
export function localDay(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/**
 * User's current day, YYYY-MM-DD.
 * @returns {string} Day.
 */
export function localToday(): string {
  return localDay(new Date());
}
