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
  /** The length in its unit (days for weekdays apart). */
  length: number;
  /** What gives them: the duration of each occurrence, or an « Ouverture » before the due day (for the words). Optional. Default = the duration. */
  kind?: 'duration' | 'opening';
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
 * Smallest whole number of a unit worth `size` that is strictly more than an amount (N × size > amount).
 * @param {number} amount Amount (days, weeks or months; a fraction for hours).
 * @param {number} size Size of one unit in that amount.
 * @returns {number} N, 1 at least.
 */
const beyond = (amount: number, size = 1) => Math.max(1, Math.floor(amount / size) + 1);

/**
 * Limits of a rule by how long each occurrence lasts, always strictly beyond it (the next one after the end of the
 * previous one, never on its last day): in days (more than one: N days, or hours over a day), « Tous les N jours » with
 * N strictly more (5 days: from « Tous les 6 jours »; as many weeks, months or years as needed; weekdays more days
 * apart); in weeks, « Toutes les N semaines » with N strictly more, without a choice of weekdays, or every month, every
 * year as far; in months, « Tous les N mois » with N strictly more, or every year as far.
 * @param {'DAYS' | 'WEEKS' | 'MONTHS'} unit Unit of the length.
 * @param {number} amount Length in that unit (a fraction for hours: 26 h is 1.08 day).
 * @param {boolean} [oneDayFree=true] A single day or less has no limit (a one-day duration repeats every day; not an « Ouverture » a day before). Optional. Default = true.
 * @returns {RepetitionLimits | null} Limits, null for a single day or less.
 */
export function lengthLimits(unit: 'DAYS' | 'WEEKS' | 'MONTHS', amount: number, oneDayFree = true): RepetitionLimits | null {
  if (unit === 'DAYS') {
    if (oneDayFree ? amount <= 1 : amount <= 0) return null;
    const days = Math.round(amount * 100) / 100;
    return {
      frequencies: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
      minInterval: { DAILY: beyond(amount), WEEKLY: beyond(amount, 7), MONTHLY: beyond(amount, 28), YEARLY: beyond(amount, 365) },
      weekdays: true,
      words: Number.isInteger(days) ? counted(days, 'jour', 'jours') : `plus de ${counted(Math.floor(days), 'jour', 'jours')}`,
      length: amount,
    };
  }
  if (unit === 'WEEKS')
    return { frequencies: ['WEEKLY', 'MONTHLY', 'YEARLY'], minInterval: { DAILY: 1, WEEKLY: beyond(amount), MONTHLY: beyond(amount, 4), YEARLY: beyond(amount, 52) }, weekdays: false, words: counted(amount, 'semaine', 'semaines'), length: amount };
  return { frequencies: ['MONTHLY', 'YEARLY'], minInterval: { DAILY: 1, WEEKLY: 1, MONTHLY: beyond(amount), YEARLY: beyond(amount, 12) }, weekdays: false, words: `${amount} mois`, length: amount };
}

/**
 * Limits of a rule by the duration of each occurrence (`lengthLimits`): a single day, or up to a given day, week or
 * month, none.
 * @param {Duration | null | undefined} duration Duration of each occurrence.
 * @returns {RepetitionLimits | null} Limits, null without any.
 */
export function repetitionLimits(duration: Duration | null | undefined): RepetitionLimits | null {
  if (!duration) return null;
  if (duration.unit === 'DAYS' || duration.unit === 'WEEKS' || duration.unit === 'MONTHS') return lengthLimits(duration.unit, duration.count);
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
 * @returns {RepetitionLimitError | null} Error, none when it keeps them.
 */
export function repetitionLimitError(rule: Recurrence | null | undefined, duration: Duration | null | undefined): RepetitionLimitError | null {
  return limitsError(rule, repetitionLimits(duration));
}

/** Error of a rule out of its limits: the field it goes under, and its message. */
export interface RepetitionLimitError {
  field: RepetitionLimitField;
  message: string;
}

/**
 * Start of the error of some limits: « Chaque occurrence dure 3 jours », « Chaque occurrence est ouverte 3 jours avant ».
 * @param {RepetitionLimits} limits Limits.
 * @returns {string} Text.
 */
const limitsLead = (limits: RepetitionLimits) => (limits.kind === 'opening' ? `Chaque occurrence est ${limits.words}` : `Chaque occurrence dure ${limits.words}`);

/**
 * Error of a rule that breaks some limits (`lengthLimits`: of a duration, of the hours of a slot, of an opening).
 * @param {Recurrence | null | undefined} rule Rule.
 * @param {RepetitionLimits | null} limits Limits.
 * @returns {RepetitionLimitError | null} Error, none when it keeps them.
 */
export function limitsError(rule: Recurrence | null | undefined, limits: RepetitionLimits | null): RepetitionLimitError | null {
  if (!rule || !limits) return null;
  if (!limits.frequencies.includes(rule.frequency)) {
    const offered = limits.frequencies[0] === 'MONTHLY' ? '« Tous les N mois » ou « Tous les ans »' : '« Toutes les N semaines », « Tous les mois » ou « Tous les ans »';
    return { field: 'frequency', message: `${limitsLead(limits)} : ${offered}.` };
  }
  const min = limits.minInterval[rule.frequency];
  // Even or odd weeks: one out of n of them, n weeks of that parity apart at least.
  const interval = rule.frequency === 'WEEKLY' && rule.weekParity ? (rule.parityInterval ?? 1) * 2 : rule.interval;
  if (interval < min) return { field: 'interval', message: `${limitsLead(limits)} : au moins ${min}, la suivante ${limits.kind === 'opening' ? 'ouverte après son échéance' : 'après sa fin'}.` };
  if (rule.frequency === 'WEEKLY' && rule.weekdays.length > 1) {
    if (!limits.weekdays) return { field: 'weekdays', message: `${limitsLead(limits)} : un seul jour de semaine, celui de son début.` };
    if (smallestWeekdayGap(rule.weekdays, interval) <= limits.length) return { field: 'weekdays', message: `${limitsLead(limits)} : des jours de semaine écartés de plus.` };
  }
  return null;
}

/**
 * Stricter of two limits (an occurrence lasting days and opening before), for the choices offered: the frequencies both
 * offer, the larger minimum of each, weekdays only if both allow them (an error is told by the limits it breaks:
 * `limitsError` on each).
 * @param {RepetitionLimits | null} a Limits.
 * @param {RepetitionLimits | null} b Other limits.
 * @returns {RepetitionLimits | null} Limits.
 */
export function stricterLimits(a: RepetitionLimits | null, b: RepetitionLimits | null): RepetitionLimits | null {
  if (!a || !b) return a ?? b;
  const more = a.minInterval.DAILY >= b.minInterval.DAILY ? a : b;
  return {
    frequencies: a.frequencies.filter((frequency) => b.frequencies.includes(frequency)),
    minInterval: { DAILY: Math.max(a.minInterval.DAILY, b.minInterval.DAILY), WEEKLY: Math.max(a.minInterval.WEEKLY, b.minInterval.WEEKLY), MONTHLY: Math.max(a.minInterval.MONTHLY, b.minInterval.MONTHLY), YEARLY: Math.max(a.minInterval.YEARLY, b.minInterval.YEARLY) },
    weekdays: a.weekdays && b.weekdays,
    words: more.words,
    length: Math.max(a.length, b.length),
  };
}

/**
 * Whether every rule of some cases keeps the limits of the duration of its occurrences (`repetitionLimitError`).
 * @param {readonly { rule: Recurrence | null }[]} cases Cases.
 * @returns {boolean} All kept.
 */
export const casesKeepLimits = (cases: readonly { rule: Recurrence | null }[]): boolean => cases.every((item) => !repetitionLimitError(item.rule, item.rule?.duration));

/**
 * What of a rule its limits read (its rhythm and duration, not its end nor its exceptions: a series cut or moved keeps
 * them), to know a rule saved before.
 * @param {Recurrence | null} rule Rule.
 * @returns {string} Key.
 */
const limitKey = (rule: Recurrence | null) =>
  rule
    ? JSON.stringify([rule.frequency, rule.interval, [...rule.weekdays].sort(), rule.weekParity ?? null, rule.parityInterval ?? null, rule.duration?.unit ?? 'DAYS', rule.duration?.count ?? 1])
    : '';

/**
 * First rule of some cases newly out of the limits of its duration: one saved before that breaks them (the same rhythm
 * and duration among `before`, its end or exceptions changed or not) stays, never refused nor changed while it is kept.
 * @param {readonly { rule: Recurrence | null }[]} next Cases saved.
 * @param {readonly { rule: Recurrence | null }[]} [before] Cases they replace. Optional. Default = none.
 * @returns {RepetitionLimitError | null} Error of the first one, none when all keep them.
 */
export function newLimitBreak(next: readonly { rule: Recurrence | null }[], before: readonly { rule: Recurrence | null }[] = []): RepetitionLimitError | null {
  const kept = new Set(before.filter((item) => repetitionLimitError(item.rule, item.rule?.duration)).map((item) => limitKey(item.rule)));
  for (const item of next) {
    const error = repetitionLimitError(item.rule, item.rule?.duration);
    if (error && !kept.has(limitKey(item.rule))) return error;
  }
  return null;
}

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
