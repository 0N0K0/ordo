import { occurrenceDates, type Recurrence, type RepetitionCase } from '@ordo/shared';
import * as fmt from '../../lib/format';
import type { ExceptionEntry, ExceptionsAdd } from './ExceptionsList';

/** Kind of a « rien » exception: the occurrence of that day does not take place. */
export const SKIPPED_KIND = 'rien';

/** One exception of a repetition in words, the same in every summary: its day (to sort them) and its text. */
export interface ExceptionLine {
  /** Unique among the exceptions shown. */
  key: string;
  /** Day it starts (YYYY-MM-DD), to sort them. */
  day: string;
  /** « 3 novembre 2026 : rien », « Du 3 au 5 novembre 2026 : autres horaires (Congés) ». */
  text: string;
}

/**
 * Text of an exception on one day: « 3 novembre 2026 : rien », « 4 novembre 2026 : déplacée au 6 novembre 2026 ».
 * @param {string} day Day of the occurrence (YYYY-MM-DD).
 * @param {string} kind What it is (« rien », « annulée », « autres horaires »…).
 * @returns {string} Text.
 */
export const exceptionText = (day: string, kind: string): string => `${fmt.capitalize(fmt.dayInWords(day))} : ${kind}`;

/**
 * Exceptions sorted by their day.
 * @template E
 * @param {readonly E[]} lines Exceptions.
 * @returns {E[]} Sorted.
 */
export const byExceptionDay = <E extends { day: string }>(lines: readonly E[]): E[] => [...lines].sort((a, b) => a.day.localeCompare(b.day));

/**
 * « Rien » exceptions of rules (a rule, or the rules of cases): one line per day without its occurrence.
 * @param {readonly (Recurrence | null | undefined)[]} rules Rules.
 * @param {string} [prefix] Start of their keys (several groups of rules in one list). Optional. Default = « rule ».
 * @returns {(ExceptionLine & { rule: number })[]} Lines, with the index of their rule.
 */
export function skippedLines(rules: readonly (Recurrence | null | undefined)[], prefix = 'rule'): (ExceptionLine & { rule: number })[] {
  return rules.flatMap((rule, index) => (rule?.exceptions ?? []).map((day) => ({ key: `${prefix}-${index}-${day}`, day, text: exceptionText(day, SKIPPED_KIND), rule: index })));
}

/**
 * Rule without one of its « rien » exceptions: the occurrence of that day takes place again.
 * @param {Recurrence} rule Rule.
 * @param {string} day Day restored.
 * @returns {Recurrence} Rule.
 */
export const withoutSkipped = (rule: Recurrence, day: string): Recurrence => ({ ...rule, exceptions: rule.exceptions.filter((other) => other !== day) });

/**
 * Rule with a « rien » exception more: the occurrence of that day does not take place.
 * @param {Recurrence} rule Rule.
 * @param {string} day Day without its occurrence.
 * @returns {Recurrence} Rule.
 */
export const withSkipped = (rule: Recurrence, day: string): Recurrence => (rule.exceptions.includes(day) ? rule : { ...rule, exceptions: [...rule.exceptions, day].sort() });

/**
 * « Rien » exceptions of the rules of cases, each restored in the cases given back (a schedule, the « Horaires » of a
 * task, an exception period of a schedule).
 * @template T
 * @param {readonly RepetitionCase<T>[]} cases Cases.
 * @param {(cases: RepetitionCase<T>[]) => void} onChange Change of the cases.
 * @param {string} [prefix] Start of their keys. Optional. Default = « case ».
 * @returns {ExceptionEntry[]} Exceptions.
 */
export function casesSkippedEntries<T>(cases: readonly RepetitionCase<T>[], onChange: (cases: RepetitionCase<T>[]) => void, prefix = 'case'): ExceptionEntry[] {
  return skippedLines(
    cases.map((item) => item.rule),
    prefix,
  ).map(({ rule, ...line }) => ({
    ...line,
    onRestore: () => onChange(cases.map((item, index) => (index === rule && item.rule ? { ...item, rule: withoutSkipped(item.rule, line.day) } : item))),
  }));
}

/**
 * Whether a day is one of a rule counted from its first day.
 * @param {Recurrence | null | undefined} rule Rule (none: never).
 * @param {string} start Its first day.
 * @param {string} day Day.
 * @returns {boolean} One of its days.
 */
const isRuleDay = (rule: Recurrence | null | undefined, start: string, day: string): boolean => Boolean(rule) && occurrenceDates(rule!, start, day, day).length > 0;

/**
 * Rules with a « rien » exception on a day, given to every rule that has that day (several cases on one day: nothing
 * that day for any of them); the others unchanged.
 * @param {readonly { rule: Recurrence | null | undefined, start: string }[]} rules Rules, each with its first day.
 * @param {string} day Day without its occurrence.
 * @returns {(Recurrence | null | undefined)[]} Rules, in the same order.
 */
export const withSkippedOn = (rules: readonly { rule: Recurrence | null | undefined; start: string }[], day: string): (Recurrence | null | undefined)[] =>
  rules.map((item) => (item.rule && isRuleDay(item.rule, item.start, day) ? withSkipped(item.rule, day) : item.rule));

/**
 * Adding a « rien » exception to rules in `ExceptionsList`: a day of any of them can be picked, and the exception goes
 * to every rule that has that day (several cases on one day: nothing that day for any of them).
 * @param {readonly { rule: Recurrence | null | undefined, start: string }[]} rules Rules, each with its first day.
 * @param {(rules: (Recurrence | null | undefined)[]) => void} onChange Rules with the exception, in the same order.
 * @param {string} minDate First day offered.
 * @returns {ExceptionsAdd} Adding.
 */
export const rulesDayAdding = (rules: readonly { rule: Recurrence | null | undefined; start: string }[], onChange: (rules: (Recurrence | null | undefined)[]) => void, minDate: string): ExceptionsAdd => ({
  isDay: (day) => rules.some((item) => isRuleDay(item.rule, item.start, day)),
  onAdd: (day) => onChange(withSkippedOn(rules, day)),
  minDate,
});

/**
 * Adding a « rien » exception to a single rule in `ExceptionsList`: only its days can be picked, from its first day.
 * @param {Recurrence} rule Rule.
 * @param {string} start Its first day.
 * @param {(rule: Recurrence) => void} onChange Rule with the exception.
 * @returns {ExceptionsAdd} Adding.
 */
export const ruleDayAdding = (rule: Recurrence, start: string, onChange: (rule: Recurrence) => void): ExceptionsAdd => rulesDayAdding([{ rule, start }], ([next]) => next && onChange(next), start);

/** Help of adding a « rien » exception to cases. */
const CASES_ADD_DESCRIPTION = 'Un jour d’un des cas : rien ce jour-là, pour tous les cas qui y tombent.';

/**
 * Adding a « rien » exception to cases in `ExceptionsList`: a day of any case, given to every case that has that day
 * (each counted from its « Début », else from the first day).
 * @template T
 * @param {readonly RepetitionCase<T>[]} cases Cases.
 * @param {string} start First day (of the item, or the day the hours of a task are read from).
 * @param {(cases: RepetitionCase<T>[]) => void} onChange Cases with the exception.
 * @param {string} [minDate] First day offered. Optional. Default = `start`.
 * @returns {ExceptionsAdd} Adding.
 */
export const casesDayAdding = <T>(cases: readonly RepetitionCase<T>[], start: string, onChange: (cases: RepetitionCase<T>[]) => void, minDate = start): ExceptionsAdd => ({
  ...rulesDayAdding(
    cases.map((item) => ({ rule: item.rule, start: item.start ?? start })),
    (rules) => onChange(cases.map((item, index) => ({ ...item, rule: rules[index] ?? item.rule }))),
    minDate,
  ),
  description: CASES_ADD_DESCRIPTION,
});
