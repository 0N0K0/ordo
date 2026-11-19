import { monthOfYear, yearOfDay } from './days';

/** Names of the months, January first: « janvier », « février »… */
export const MONTH_LABELS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const;

/** Options of a choice of a month, January (« 1 ») first, the same everywhere (repetitions, durations, routines). */
export const monthOptions: { value: string; label: string }[] = MONTH_LABELS.map((label, index) => ({ value: String(index + 1), label }));

/**
 * Month after a day of it: « d’avril », « de mai ».
 * @param {number} month 1 to 12.
 * @returns {string} Words.
 */
export function ofMonth(month: number): string {
  const name = MONTH_LABELS[month - 1];
  return /^[aeiou]/.test(name) ? `d’${name}` : `de ${name}`;
}

/**
 * Ordinal of a number in French, the same everywhere (decision V): « 1er », « 2e », « 3e ».
 * @param {number} value Number (1 or more).
 * @returns {string} Ordinal.
 */
export function ordinal(value: number): string {
  return value === 1 ? '1er' : `${value}e`;
}

/**
 * Day of a month as told in French (decision V): « 1er » for the first, the number otherwise (« le 1er », « le 15 »).
 * @param {number} day Day of the month (1 to 31).
 * @returns {string} Text.
 */
export function dayOfMonthText(day: number): string {
  return day === 1 ? ordinal(1) : String(day);
}

/** Names of the positions of a weekday in its month (decision V): « 1er » to « 4e », and « dernier » (-1). */
export const POSITION_LABELS: Record<number, string> = { 1: ordinal(1), 2: ordinal(2), 3: ordinal(3), 4: ordinal(4), [-1]: 'dernier' };

/** Options of a choice of the position of a weekday in its month (« le 2e mardi »), the last one at the end. */
export const positionOptions: { value: string; label: string }[] = [1, 2, 3, 4, -1].map((position) => ({ value: String(position), label: POSITION_LABELS[position] }));
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
  const month = monthOfYear(date);
  return dayInMonth(year, month, 31);
}

/**
 * Month number of a date counted from year 0 (to count or shift months).
 * @param {string} date YYYY-MM-DD or YYYY-MM.
 * @returns {number} Months.
 */
export function monthIndex(date: string): number {
  return yearOfDay(date) * 12 + monthOfYear(date) - 1;
}

/**
 * Month of a month number (see monthIndex).
 * @param {number} index Months from year 0.
 * @returns {string} YYYY-MM.
 */
export function monthFromIndex(index: number): string {
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * First day of a month shifted from the month of a date.
 * @param {string} date YYYY-MM-DD (or YYYY-MM).
 * @param {number} months Months added.
 * @returns {string} YYYY-MM-01.
 */
export function shiftMonth(date: string, months: number): string {
  return `${monthFromIndex(monthIndex(date) + months)}-01`;
}
