import { z } from 'zod';
import { END_AFTER_START, endsAfter, markdownSchema, markdownTextSchema, optionalPlainText, requiredText } from '../core/rules';
import { DEFAULT_RECURRENCE, occurrenceDates, recurrenceSchema, storedRecurrence, zonedInstant, type Recurrence } from '../dates/recurrence';
import { dateSchema } from '../core/workspace';
import { daySchema, timeOfDaySchema } from '../dates/times';
import { addDays, dayIn } from '../dates/days';
import { PARIS_ZONE } from '../dates/reminders';
import { twoDigits } from '../core/numbers';

/** What was done during a tracked time: markdown (its editor). Blank becomes null. */
export const timeDescriptionSchema = markdownSchema;

/** Longest time entry, in seconds (24 hours): typed, or of a timer, stopped on its own once reached. */
export const DURATION_MAX_SECONDS = 24 * 3600;

/** Duration of a time entry, in seconds: up to 24 hours. */
export const durationSchema = z
  .number({ error: 'Durée attendue.' })
  .int()
  .min(60, 'Au moins 1 minute.')
  .max(DURATION_MAX_SECONDS, '24 heures maximum.');

/** A time has at least a project, a task, a routine or an event. */
export const TIME_SUBJECT_REQUIRED = 'Choisissez un projet, une tâche, une routine ou un évènement.';

/** Message of a typed duration not understood (or out of 1 minute to 24 hours). */
export const DURATION_TEXT_INVALID = 'Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h.';

/** A duration typed in a field (« 1:30 », « 1h30 », « 90 », « 1,5 h »: see `parseDuration`), 1 minute to 24 hours. */
export const durationTextSchema = z.string().refine((value) => parseDuration(value) !== null, DURATION_TEXT_INVALID);

/**
 * Manual time entry form: day, start time, duration ("1:30", "1h30", "90" minutes or "1,5" hours). The project may be
 * left empty when the time has a task, a routine or an event; several of each.
 */
export const timeEntryFormSchema = z
  .object({
    projectId: z.string(),
    routineIds: z.array(z.string()),
    taskIds: z.array(z.string()),
    /** Events (occurrence keys) the time was spent on. */
    events: z.array(z.string()),
    description: markdownTextSchema,
    date: daySchema('La date est requise.'),
    start: timeOfDaySchema,
    duration: durationTextSchema,
  })
  .refine((values) => values.projectId !== '' || values.routineIds.length > 0 || values.taskIds.length > 0 || values.events.length > 0, {
    path: ['projectId'],
    message: TIME_SUBJECT_REQUIRED,
  });
export type TimeEntryFormValues = z.infer<typeof timeEntryFormSchema>;

/**
 * Parses a typed duration: "1:30", "1h30", "1 h", "45 min", "90" (minutes) or "1,5h" (hours).
 * @param {string} text Typed duration.
 * @returns {number | null} Seconds, or null when invalid or out of range (1 min to 24 h).
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(',', '.');
  let minutes: number | null = null;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,2}):([0-5]\d)$/.exec(value))) minutes = Number(match[1]) * 60 + Number(match[2]);
  else if ((match = /^(\d{1,2})\s*h\s*(\d{1,2})?\s*(min)?$/.exec(value))) minutes = Number(match[1]) * 60 + Number(match[2] ?? 0);
  else if ((match = /^(\d+(?:\.\d+)?)\s*h$/.exec(value))) minutes = Math.round(Number(match[1]) * 60);
  else if ((match = /^(\d+)\s*(min|mn|m)?$/.exec(value))) minutes = Number(match[1]);
  if (minutes === null || minutes < 1 || minutes > 24 * 60) return null;
  return minutes * 60;
}

/**
 * Formats a duration: "2 h 05", "45 min", "0 min".
 * @param {number} seconds Duration in seconds.
 * @returns {string} Readable duration.
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${twoDigits(minutes % 60)}`;
}

/**
 * A duration as typed in a field (read back by `parseDuration`): « 1:30 », « 0:05 ».
 * @param {number} minutes Minutes.
 * @returns {string} Text.
 */
export function durationText(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${twoDigits(minutes % 60)}`;
}

/**
 * Formats a running timer: "1:05:09".
 * @param {number} seconds Elapsed seconds.
 * @returns {string} Clock.
 */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}:${twoDigits(minutes)}:${twoDigits(total % 60)}`;
}

/**
 * Effective duration of a time entry (pauses excluded), live while it runs.
 * @param {object} entry Time entry.
 * @param {string} entry.startedAt Start, ISO.
 * @param {string | null} entry.endedAt End, ISO, null while running.
 * @param {string | null} entry.pausedAt Start of the current pause, ISO.
 * @param {number} entry.pausedSeconds Previous pauses, in seconds.
 * @param {number | null} entry.duration Stored duration once stopped.
 * @param {number} [now] Current time in ms. Optional. Default = Date.now().
 * @returns {number} Seconds.
 */
export function entrySeconds(entry: { startedAt: string; endedAt: string | null; pausedAt: string | null; pausedSeconds: number; duration: number | null }, now = Date.now()): number {
  if (entry.duration !== null) return entry.duration;
  const end = entry.pausedAt ? Date.parse(entry.pausedAt) : entry.endedAt ? Date.parse(entry.endedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(entry.startedAt)) / 1000) - entry.pausedSeconds);
}

/**
 * Seconds of a time within a period (a day, a week): the part of its duration between the two instants, for a time
 * that crosses one of them (a timer running past midnight, started the evening before the week). Its pauses, whose
 * moments are not kept, are shared out over the whole time.
 * @param {{ startedAt: string, endedAt: string | null, pausedAt: string | null, pausedSeconds: number, duration: number | null }} entry Time.
 * @param {number} from Start of the period (ms).
 * @param {number} to End of the period (ms, excluded).
 * @param {number} [now] Current time (ms). Optional. Default = Date.now().
 * @returns {number} Seconds.
 */
export function entrySecondsWithin(
  entry: { startedAt: string; endedAt: string | null; pausedAt: string | null; pausedSeconds: number; duration: number | null },
  from: number,
  to: number,
  now = Date.now(),
): number {
  const start = Date.parse(entry.startedAt);
  const end = entry.pausedAt ? Date.parse(entry.pausedAt) : entry.endedAt ? Date.parse(entry.endedAt) : now;
  const seconds = entrySeconds(entry, now);
  if (end <= start) return start >= from && start < to ? seconds : 0;
  const overlap = Math.max(0, Math.min(end, to) - Math.max(start, from));
  return Math.round((seconds * overlap) / (end - start));
}

// --- Alarms -----------------------------------------------------------------------------------------

export const ALARM_TYPES = ['REMINDER', 'NOT_TRACKING', 'TRACKING_DURATION'] as const;
export type AlarmType = (typeof ALARM_TYPES)[number];
export const ALARM_FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type AlarmFrequency = (typeof ALARM_FREQUENCIES)[number];

/** Alarm fields, as saved. */
export const alarmInputSchema = z
  .object({
    label: requiredText(),
    note: optionalPlainText(),
    type: z.enum(ALARM_TYPES),
    startDate: dateSchema,
    time: timeOfDaySchema.nullable(),
    frequency: z.enum(ALARM_FREQUENCIES),
    interval: z.number().int().min(1, 'Au moins 1.').max(365, '365 maximum.'),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    endDate: dateSchema,
    /** Repetition in the common form; none: the former fields above (ONCE: rings once). */
    recurrence: recurrenceSchema.nullable().optional(),
    minutes: z
      .number()
      .int()
      .min(1, 'Au moins 1 minute.')
      .max(24 * 60, '24 heures maximum.')
      .nullable(),
    projectId: z.string().nullable(),
    taskId: z.string().nullable(),
    enabled: z.boolean(),
  })
  .superRefine((alarm, context) => {
    if (alarm.type === 'TRACKING_DURATION') {
      if (alarm.minutes === null) context.addIssue({ code: 'custom', path: ['minutes'], message: 'La durée est requise.' });
      return;
    }
    if (!alarm.startDate) context.addIssue({ code: 'custom', path: ['startDate'], message: 'La date est requise.' });
    if (!alarm.time) context.addIssue({ code: 'custom', path: ['time'], message: 'L’heure est requise.' });
    if (!endsAfter(alarm.startDate, alarm.endDate)) context.addIssue({ code: 'custom', path: ['endDate'], message: END_AFTER_START });
  });
export type AlarmInput = z.input<typeof alarmInputSchema>;

/** Schedule of an alarm (REMINDER and NOT_TRACKING), in Paris time. */
interface AlarmSchedule {
  startDate: string | null;
  time: string | null;
  frequency: AlarmFrequency;
  interval: number;
  weekdays: number[];
  endDate: string | null;
  /** Repetition in the common form; none: the former fields. */
  recurrence?: unknown;
}

/**
 * Rule an alarm rings by: its repetition, else its former fields (once: none).
 * @param {AlarmSchedule} schedule Schedule.
 * @returns {Recurrence | null} Rule.
 */
export function alarmRule(schedule: AlarmSchedule): Recurrence | null {
  const stored = storedRecurrence(schedule.recurrence);
  if (stored) return stored;
  if (schedule.frequency === 'ONCE') return null;
  return {
    ...DEFAULT_RECURRENCE,
    frequency: schedule.frequency,
    interval: Math.max(1, schedule.interval),
    weekdays: schedule.frequency === 'WEEKLY' ? schedule.weekdays : [],
    until: schedule.endDate,
  };
}

/**
 * Whether the schedule rings on a calendar day (YYYY-MM-DD): a day of its rule from its first day (that day only
 * without a rule).
 * @param {AlarmSchedule} schedule Schedule.
 * @param {string} start First day.
 * @param {string} day Day.
 * @returns {boolean} True when it rings that day.
 */
function ringsOnDay(schedule: AlarmSchedule, start: string, day: string): boolean {
  if (day < start) return false;
  const rule = alarmRule(schedule);
  if (!rule) return day === start;
  return occurrenceDates(rule, start, day, day).length > 0;
}

/**
 * Last occurrence of a schedule at or before a moment, looking back a limited number of days, in Paris time: the open
 * app and the server ringing outside it find the same instant and key (every hour of Ordo is a Paris
 * hour).
 * @param {AlarmSchedule} schedule Schedule.
 * @param {Date} moment Moment.
 * @param {number} [lookBackDays] Days to look back. Optional. Default = 2.
 * @returns {Date | null} Occurrence, or null.
 */
export function previousOccurrence(schedule: AlarmSchedule, moment: Date, lookBackDays = 2): Date | null {
  if (!schedule.startDate || !schedule.time) return null;
  const today = dayIn(moment, PARIS_ZONE);
  for (let offset = 0; offset <= lookBackDays; offset += 1) {
    const day = addDays(today, -offset);
    if (!ringsOnDay(schedule, schedule.startDate, day)) continue;
    const occurrence = zonedInstant(day, schedule.time, PARIS_ZONE);
    if (occurrence <= moment) return occurrence;
  }
  return null;
}

/**
 * Next occurrence of a schedule after a moment, within about two years, in Paris time (as `previousOccurrence`).
 * @param {AlarmSchedule} schedule Schedule.
 * @param {Date} moment Moment.
 * @returns {Date | null} Occurrence, or null when the schedule is over.
 */
export function nextOccurrence(schedule: AlarmSchedule, moment: Date): Date | null {
  if (!schedule.startDate || !schedule.time) return null;
  const today = dayIn(moment, PARIS_ZONE);
  const first = schedule.startDate > today ? schedule.startDate : today;
  // Last day it may ring: the end of its rule, its first day without one.
  const rule = alarmRule(schedule);
  const end = rule ? rule.until : schedule.startDate;
  for (let offset = 0; offset < 800; offset += 1) {
    const day = addDays(first, offset);
    if (end && day > end) return null;
    if (!ringsOnDay(schedule, schedule.startDate, day)) continue;
    const occurrence = zonedInstant(day, schedule.time, PARIS_ZONE);
    if (occurrence > moment) return occurrence;
  }
  return null;
}
