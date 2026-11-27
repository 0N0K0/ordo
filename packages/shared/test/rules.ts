import { DEFAULT_RECURRENCE, occurrenceDates, recurrenceSchema, type Recurrence } from '../src/dates/recurrence';

/** Fields of a test rule, with the former paused periods a stored rule may still have. */
export type RuleFields = Partial<Recurrence> & { pauses?: { from: string; to: string }[] };

/**
 * Recurrence rule for a test: every week on the weekday of its first date, with some fields changed; former pauses
 * read as a stored rule is (turned into exceptions).
 * @param {RuleFields} fields Fields changed.
 * @returns {Recurrence} Rule.
 */
export const rule = (fields: RuleFields): Recurrence => (fields.pauses ? recurrenceSchema.parse({ ...DEFAULT_RECURRENCE, ...fields }) : { ...DEFAULT_RECURRENCE, ...fields });

/**
 * Every occurrence of a rule from its first date, over about two years (enough for the series of the tests).
 * @param {Recurrence} recurrence Rule.
 * @param {string} start First date.
 * @returns {string[]} Dates.
 */
export const allDates = (recurrence: Recurrence, start: string): string[] => occurrenceDates(recurrence, start, start, '2028-12-31');
