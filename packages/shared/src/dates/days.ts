/**
 * Date of a YYYY-MM-DD string, at midnight UTC (calendar arithmetic, no time zone).
 * @param {string} date Calendar date.
 * @returns {Date} Date.
 */
export function parseDay(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
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
 * Day of the week of a date, 1 (Monday) to 7 (Sunday).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Day.
 */
export const weekdayOfDate = (date: string): number => isoWeekday(parseDay(date));
