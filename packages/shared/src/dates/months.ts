import { yearOfDay } from './days';
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
  const year = yearOfDay(date);
  const month = Number(date.slice(5, 7));
  return dayInMonth(year, month, 31);
}

/**
 * Month number of a date counted from year 0 (to count or shift months).
 * @param {string} date YYYY-MM-DD or YYYY-MM.
 * @returns {number} Months.
 */
export function monthIndex(date: string): number {
  return yearOfDay(date) * 12 + Number(date.slice(5, 7)) - 1;
}

/**
 * Month of a month number (see monthIndex).
 * @param {number} index Months from year 0.
 * @returns {string} YYYY-MM.
 */
export function monthFromIndex(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}
