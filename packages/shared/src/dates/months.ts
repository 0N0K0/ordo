/**
 * Number of days of a month.
 * @param {number} year Year.
 * @param {number} month 1 to 12.
 * @returns {number} Days.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Day of a month, kept within it (the 31st of a 30-day month is its 30th, 0 its 1st).
 * @param {number} year Year.
 * @param {number} month 1 to 12.
 * @param {number} day Day number.
 * @returns {string} YYYY-MM-DD.
 */
export function dayInMonth(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(Math.max(day, 1), daysInMonth(year, month))).padStart(2, '0')}`;
}

/**
 * Last day of the month of a day (or of a YYYY-MM month).
 * @param {string} date YYYY-MM-DD or YYYY-MM.
 * @returns {string} YYYY-MM-DD.
 */
export function lastDayOfMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return dayInMonth(year, month, 31);
}
