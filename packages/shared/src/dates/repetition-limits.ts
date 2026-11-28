import type { Duration, Recurrence, RecurrenceFrequency } from './recurrence';

/** What a rule may be once each occurrence lasts a while: the next occurrence starts after the last day of the previous one. */
export interface RepetitionLimits {
  /** Frequencies offered. */
  frequencies: readonly RecurrenceFrequency[];
  /** Smallest « Tous les N » of each frequency offered. */
  minInterval: Readonly<Record<RecurrenceFrequency, number>>;
  /** Several weekdays may be chosen (weekly), as many days apart as each occurrence lasts. */
  weekdays: boolean;
  /** The duration in words, for the errors (« 3 jours », « 2 semaines »). */
  words: string;
}

/**
 * Plural of a unit for the words of a duration.
 * @param {number} count Count.
 * @param {string} one Singular.
 * @param {string} many Plural.
 * @returns {string} « 3 jours ».
 */
const counted = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`;

/**
 * Limits of a rule by the duration of each occurrence, the next one always after the end of the previous one: in days
 * (N days, N ≥ 2), « Tous les N jours » from N on (and as many weeks, months or years as needed); in weeks, « Toutes
 * les N semaines » from N on without a choice of weekdays, every month or every year; in months, « Tous les N mois »
 * from N on, or every year. A single day, or up to a given day, week or month: none.
 * @param {Duration | null | undefined} duration Duration of each occurrence.
 * @returns {RepetitionLimits | null} Limits, null without any.
 */
export function repetitionLimits(duration: Duration | null | undefined): RepetitionLimits | null {
  if (!duration) return null;
  const { unit, count } = duration;
  if (unit === 'DAYS' && count > 1)
    return {
      frequencies: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
      minInterval: { DAILY: count, WEEKLY: Math.ceil(count / 7), MONTHLY: Math.ceil(count / 28), YEARLY: Math.ceil(count / 365) },
      weekdays: true,
      words: counted(count, 'jour', 'jours'),
    };
  if (unit === 'WEEKS')
    return { frequencies: ['WEEKLY', 'MONTHLY', 'YEARLY'], minInterval: { DAILY: 1, WEEKLY: count, MONTHLY: Math.ceil(count / 4), YEARLY: Math.ceil(count / 52) }, weekdays: false, words: counted(count, 'semaine', 'semaines') };
  if (unit === 'MONTHS') return { frequencies: ['MONTHLY', 'YEARLY'], minInterval: { DAILY: 1, WEEKLY: 1, MONTHLY: count, YEARLY: Math.ceil(count / 12) }, weekdays: false, words: `${count} mois` };
  return null;
}

/**
 * Whether each occurrence lasts weeks or months (N weeks, N months, up to a week of the year or the end of a month): no
 * hours then, the whole day.
 * @param {Duration | null | undefined} duration Duration of each occurrence.
 * @returns {boolean} In weeks or months.
 */
export const lastsWeeksOrMonths = (duration: Duration | null | undefined): boolean => !!duration && ['WEEKS', 'MONTHS', 'TO_WEEK', 'TO_MONTH'].includes(duration.unit);

/** Field of a rule an error of its limits goes under. */
export type RepetitionLimitField = 'frequency' | 'interval' | 'weekdays';

/**
 * Error of a rule that breaks the limits of the duration of each occurrence (a rule saved before them is never changed
 * silently: its error shows under its field).
 * @param {Recurrence | null | undefined} rule Rule.
 * @param {Duration | null | undefined} duration Duration of each occurrence.
 * @returns {{ field: RepetitionLimitField, message: string } | null} Error, none when it keeps them.
 */
export function repetitionLimitError(rule: Recurrence | null | undefined, duration: Duration | null | undefined): { field: RepetitionLimitField; message: string } | null {
  const limits = repetitionLimits(duration);
  if (!rule || !limits) return null;
  if (!limits.frequencies.includes(rule.frequency)) {
    const offered = duration?.unit === 'MONTHS' ? '« Tous les N mois » ou « Tous les ans »' : '« Toutes les N semaines », « Tous les mois » ou « Tous les ans »';
    return { field: 'frequency', message: `Chaque occurrence dure ${limits.words} : ${offered}.` };
  }
  const min = limits.minInterval[rule.frequency];
  // Even or odd weeks: one out of n of them, n weeks of that parity apart at least.
  const interval = rule.frequency === 'WEEKLY' && rule.weekParity ? (rule.parityInterval ?? 1) * 2 : rule.interval;
  if (interval < min) return { field: 'interval', message: `Chaque occurrence dure ${limits.words} : au moins ${min}, la suivante après sa fin.` };
  if (rule.frequency === 'WEEKLY' && rule.weekdays.length > 1) {
    if (!limits.weekdays) return { field: 'weekdays', message: `Chaque occurrence dure ${limits.words} : un seul jour de semaine, celui de son début.` };
    if (smallestWeekdayGap(rule.weekdays, interval) < (duration?.count ?? 1)) return { field: 'weekdays', message: `Chaque occurrence dure ${limits.words} : des jours de semaine écartés d’autant.` };
  }
  return null;
}

/**
 * Whether every rule of some cases keeps the limits of the duration of its occurrences (`repetitionLimitError`).
 * @param {readonly { rule: Recurrence | null }[]} cases Cases.
 * @returns {boolean} All kept.
 */
export const casesKeepLimits = (cases: readonly { rule: Recurrence | null }[]): boolean => cases.every((item) => !repetitionLimitError(item.rule, item.rule?.duration));

/**
 * Fewest days between two weekdays of a weekly rule, the last one of a week to the first one of its next week counted.
 * @param {readonly number[]} weekdays Weekdays, 1 (Monday) to 7.
 * @param {number} weeks Weeks between two weeks of the rule.
 * @returns {number} Days.
 */
function smallestWeekdayGap(weekdays: readonly number[], weeks: number): number {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((day, index) => day - sorted[index]);
  return Math.min(...gaps, sorted[0] + weeks * 7 - sorted[sorted.length - 1]);
}
