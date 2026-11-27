import { z } from 'zod';
import { addDays } from './days';
import { maxSpanDays, occurrenceDates, ONE_DAY, recurrenceSchema, ruleEndedBefore, ruleStartedFrom, spanEnd, type Recurrence, type Span } from './recurrence';
import { daySchema } from './times';

/** Fields common to the cases of every repetition: its start and its rule (with its end and how long each occurrence lasts). */
const repetitionCaseFields = {
  /** « Début »: first day its rhythm counts from (none: the first day of what repeats). */
  start: daySchema().nullable().default(null),
  /** None: a single occurrence, on its first day. */
  rule: recurrenceSchema.nullable(),
};

/** Fields of a case in its former form, only read (`periodCase`): its period and the day its rhythm counted from. */
const periodCaseFields = {
  since: daySchema().nullable().default(null),
  until: daySchema().nullable().default(null),
  anchor: daySchema().nullable().default(null),
};

/**
 * Schema of a case of a repetition with its times (those of an event, the slots of a schedule, the moments of a
 * routine, the time of an alarm).
 * @template T
 * @param {T} times Schema of its times.
 * @returns {z.ZodObject} Schema.
 */
export function repetitionCaseSchema<T extends z.ZodType>(times: T) {
  return z.object({ ...repetitionCaseFields, times });
}

/**
 * Schema of a case as stored, in its current or its former form (a period `since` / `until`, an `anchor`): what
 * `periodCase` reads.
 * @template T
 * @param {T} times Schema of its times.
 * @returns {z.ZodObject} Schema.
 */
export function storedRepetitionCaseSchema<T extends z.ZodType>(times: T) {
  return z.object({ ...repetitionCaseFields, ...periodCaseFields, times });
}

/** Case of a repetition, its times apart. */
export interface RepetitionCase<T = unknown> {
  /** « Début »: first day its rhythm counts from (none: the first day of what repeats). */
  start: string | null;
  /** None: a single occurrence, on its first day. */
  rule: Recurrence | null;
  times: T;
}

/** Case as stored, maybe in its former form (its period and the day its rhythm counted from). */
export type StoredRepetitionCase<T = unknown> = RepetitionCase<T> & { since?: string | null; until?: string | null; anchor?: string | null };

/**
 * Case as read: one stored in its former form (a period, a day its rhythm counted from) gets a single « Début » and
 * its period's end in its rule's end. « Début » is the day its rhythm counted from, else the start of its period; a
 * rhythm counted from before its period starts on its first occurrence reaching into it (`ruleStartedFrom`; one
 * lasting several days started before the period then shows from its own first day). The end of its
 * period ends its series (`ruleEndedBefore`: a count kept, reduced to the occurrences up to it; an earlier end date
 * kept).
 * @template T
 * @param {StoredRepetitionCase<T>} item Case.
 * @param {string} start First day of what repeats (its rhythm counts from it without a day of its own).
 * @returns {RepetitionCase<T> | null} Case, none when it has no occurrence left.
 */
export function periodCase<T>(item: StoredRepetitionCase<T>, start: string): RepetitionCase<T> | null {
  const { since = null, until = null, anchor = null, ...current } = item;
  if (!since && !until && !anchor) return current;
  const rhythm = anchor ?? since ?? current.start;
  let result: RepetitionCase<T> | null = { ...current, start: rhythm };
  if (since && rhythm && rhythm < since) result = caseFrom(result, since, start, true);
  return result && until ? caseUntil(result, until, start) : result;
}

/**
 * Case whose occurrences are kept from a day only (`ruleStartedFrom`): its « Début » that of its first occurrence
 * from that day.
 * @template T
 * @param {RepetitionCase<T>} item Case.
 * @param {string} since First day kept.
 * @param {string} start First day of what repeats.
 * @param {boolean} [covering] An occurrence started before that day and lasting up to it is kept. Optional. Default = false.
 * @returns {RepetitionCase<T> | null} Case, none without occurrence from that day.
 */
export function caseFrom<T>(item: RepetitionCase<T>, since: string, start: string, covering = false): RepetitionCase<T> | null {
  const first = item.start ?? start;
  if (since <= first) return item;
  if (!item.rule) return null;
  const started = ruleStartedFrom(item.rule, first, since, covering);
  return started && { ...item, start: started.start, rule: started.rule };
}

/**
 * Case whose series ends on a day (`ruleEndedBefore`).
 * @template T
 * @param {RepetitionCase<T>} item Case.
 * @param {string} until Last day kept.
 * @param {string} start First day of what repeats.
 * @returns {RepetitionCase<T> | null} Case, none without occurrence up to that day.
 */
export function caseUntil<T>(item: RepetitionCase<T>, until: string, start: string): RepetitionCase<T> | null {
  const first = item.start ?? start;
  if (first > until) return null;
  if (!item.rule) return item;
  const rule = ruleEndedBefore(item.rule, first, addDays(until, 1));
  return rule && { ...item, rule };
}

/**
 * Occurrences of a case overlapping a period (both days included); an occurrence covering its first day may have
 * started before it.
 * @param {RepetitionCase} item Case.
 * @param {string} start First day of what repeats (its rhythm starts there, unless the case has a « Début »).
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {Span[]} Occurrences, in order.
 */
export function caseSpans(item: RepetitionCase, start: string, from: string, to: string): Span[] {
  const first = item.start ?? start;
  const duration = item.rule?.duration ?? ONE_DAY;
  const scanFrom = addDays(from, 1 - maxSpanDays(duration));
  const starts = item.rule ? occurrenceDates(item.rule, first, scanFrom < first ? first : scanFrom, to) : first <= to ? [first] : [];
  return starts.map((day) => ({ start: day, end: spanEnd(duration, day) })).filter((span) => span.end >= from);
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
