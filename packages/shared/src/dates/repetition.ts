import { z } from 'zod';
import { addDays, maxSpanDays, occurrenceDates, ONE_DAY, recurrenceSchema, spanEnd, type Recurrence, type Span } from './recurrence';
import { daySchema } from './times';

/** Fields common to the cases of every repetition: its period and its rule (with how long each occurrence lasts). */
const repetitionCaseFields = {
  /** First and last days it applies (none: those of what repeats), dates included. */
  since: daySchema().nullable().default(null),
  until: daySchema().nullable().default(null),
  /** First day its rhythm counts from, when not its first day (cases converted from an older form). */
  anchor: daySchema().nullable().default(null),
  /** None: a single occurrence, on its first day. */
  rule: recurrenceSchema.nullable(),
};

/**
 * Schema of a case of a repetition with its times (those of an event, the slots of a schedule, the moments of a
 * routine, the time of an alarm).
 * @template T
 * @param {T} times Schema of its times.
 * @returns {z.ZodObject} Schema.
 */
export function repetitionCaseSchema<T extends z.ZodType>(times: T) {
  return z.object({ ...repetitionCaseFields, times }).refine((item) => !item.since || !item.until || item.until >= item.since, { path: ['until'], message: 'La fin doit suivre le début.' });
}

/** Case of a repetition, its times apart. */
export interface RepetitionCase<T = unknown> {
  since: string | null;
  until: string | null;
  anchor: string | null;
  /** None: a single occurrence, on its first day. */
  rule: Recurrence | null;
  times: T;
}

/**
 * Occurrences of a case overlapping a period (both days included), each kept within the case's period.
 * @param {RepetitionCase} item Case.
 * @param {string} start First day of what repeats (its rhythm starts there, unless the case has a period or anchor).
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {Span[]} Occurrences, in order.
 */
export function caseSpans(item: RepetitionCase, start: string, from: string, to: string): Span[] {
  const first = item.since && item.since > from ? item.since : from;
  const last = item.until && item.until < to ? item.until : to;
  if (first > last) return [];
  const anchor = item.anchor ?? item.since ?? start;
  // An occurrence covering the first day may have started before it.
  const duration = item.rule?.duration ?? ONE_DAY;
  const scanFrom = addDays(first, 1 - maxSpanDays(duration));
  const spans: Span[] = [];
  const starts = item.rule ? occurrenceDates(item.rule, anchor, scanFrom < anchor ? anchor : scanFrom, last) : anchor <= last ? [anchor] : [];
  for (const day of starts) {
    const end = spanEnd(duration, day);
    if (end < first) continue;
    spans.push({ start: day < first && item.since && day < item.since ? item.since : day, end: end > last && item.until && end > item.until ? item.until : end });
  }
  return spans;
}

/**
 * Whether a day is covered by an occurrence of a case.
 * @param {RepetitionCase} item Case.
 * @param {string} start First day of what repeats.
 * @param {string} date YYYY-MM-DD.
 * @returns {Span | null} The occurrence, or null.
 */
export function caseSpanOn(item: RepetitionCase, start: string, date: string): Span | null {
  return caseSpans(item, start, date, date).find((span) => span.start <= date && date <= span.end) ?? null;
}

/**
 * Days the occurrences of cases start on between two dates (both included), once each: what repeats occurs on
 * them (a task copied, a reminder…).
 * @param {readonly RepetitionCase[]} cases Cases.
 * @param {string} start First day of what repeats.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Days, in order.
 */
function casesStartDates(cases: readonly RepetitionCase[], start: string, from: string, to: string): string[] {
  const days = new Set<string>();
  for (const item of cases) for (const span of caseSpans(item, start, from, to)) if (span.start >= from && span.start <= to) days.add(span.start);
  return [...days].sort();
}

/** Cases of a task series: each with its period and its rule, without times; and the occurrences deleted one by one. */
const taskCasesSchema = z.object({
  cases: z
    .array(repetitionCaseSchema(z.null().default(null)))
    .min(1, 'Ajoutez au moins un cas.')
    .max(20, '20 cas au plus.'),
  exceptions: z.array(daySchema()).max(5000).default([]),
});
type TaskCases = z.infer<typeof taskCasesSchema>;

/** Repetition of a task series: a single rule (as saved before cases), or cases. */
export const taskRepetitionSchema = z.union([taskCasesSchema, recurrenceSchema]);
export type TaskRepetition = Recurrence | TaskCases;

/**
 * Whether a task repetition is made of cases.
 * @param {TaskRepetition} repetition Repetition.
 * @returns {boolean} Cases.
 */
export const isTaskCases = (repetition: TaskRepetition): repetition is TaskCases => 'cases' in repetition;

/**
 * Days a task series occurs on between two dates (both included): those of its rule, or of its cases but the deleted
 * ones.
 * @param {TaskRepetition} repetition Repetition.
 * @param {string} start First day of the series.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Days, in order.
 */
export function taskRepetitionDates(repetition: TaskRepetition, start: string, from: string, to: string): string[] {
  if (!isTaskCases(repetition)) return occurrenceDates(repetition, start, from, to);
  const deleted = new Set(repetition.exceptions);
  return casesStartDates(repetition.cases, start, from, to).filter((day) => !deleted.has(day));
}

/**
 * Task repetition with occurrences deleted one by one (they are not created again).
 * @param {TaskRepetition} repetition Repetition.
 * @param {readonly string[]} dates Deleted days.
 * @returns {TaskRepetition} Repetition.
 */
export function withDeletedDates(repetition: TaskRepetition, dates: readonly string[]): TaskRepetition {
  return { ...repetition, exceptions: [...new Set([...repetition.exceptions, ...dates])].sort() };
}
