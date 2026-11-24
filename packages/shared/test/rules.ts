import { DEFAULT_RECURRENCE, occurrenceDates, type Recurrence } from '../src/dates/recurrence';

/**
 * Recurrence rule for a test: every week on the weekday of its first date, with some fields changed.
 * @param {Partial<Recurrence>} fields Fields changed.
 * @returns {Recurrence} Rule.
 */
export const rule = (fields: Partial<Recurrence>): Recurrence => ({ ...DEFAULT_RECURRENCE, ...fields });

/**
 * Every occurrence of a rule from its first date, over about two years (enough for the series of the tests).
 * @param {Recurrence} recurrence Rule.
 * @param {string} start First date.
 * @returns {string[]} Dates.
 */
export const allDates = (recurrence: Recurrence, start: string): string[] => occurrenceDates(recurrence, start, start, '2028-12-31');
