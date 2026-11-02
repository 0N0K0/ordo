import { z } from 'zod';
import { dateSchema } from './workspace';

/** What was done during a tracked time: plain text, several lines. Empty becomes null. */
export const timeDescriptionSchema = z
  .string()
  .max(4000, '4 000 caractères maximum.')
  .transform((value) => (value.trim() ? value.trim() : null))
  .nullable();

/** Duration of a time entry, in seconds: up to 24 hours. */
export const durationSchema = z
  .number({ error: 'Durée attendue.' })
  .int()
  .min(60, 'Au moins 1 minute.')
  .max(24 * 3600, '24 heures maximum.');

/** Manual time entry form: day, start time, duration ("1:30", "1h30", "90" minutes or "1,5" hours). */
export const timeEntryFormSchema = z.object({
  projectId: z.string({ error: 'Le projet est requis.' }).min(1, 'Le projet est requis.'),
  taskIds: z.array(z.string()),
  description: z.string().max(4000, '4 000 caractères maximum.'),
  date: z.string({ error: 'La date est requise.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'La date est requise.'),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).'),
  duration: z.string().refine((value) => parseDuration(value) !== null, 'Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h.'),
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
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
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
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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
export function entrySeconds(
  entry: { startedAt: string; endedAt: string | null; pausedAt: string | null; pausedSeconds: number; duration: number | null },
  now = Date.now(),
): number {
  if (entry.duration !== null) return entry.duration;
  const end = entry.pausedAt ? Date.parse(entry.pausedAt) : entry.endedAt ? Date.parse(entry.endedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(entry.startedAt)) / 1000) - entry.pausedSeconds);
}

// --- Alarms -----------------------------------------------------------------------------------------

export const ALARM_TYPES = ['REMINDER', 'NOT_TRACKING', 'TRACKING_DURATION'] as const;
export type AlarmType = (typeof ALARM_TYPES)[number];
export const ALARM_FREQUENCIES = ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type AlarmFrequency = (typeof ALARM_FREQUENCIES)[number];

/** Alarm fields, as saved. */
export const alarmInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Le titre est requis.').max(200, '200 caractères maximum.'),
    note: z
      .string()
      .max(4000, '4 000 caractères maximum.')
      .transform((value) => (value.trim() ? value.trim() : null))
      .nullable(),
    type: z.enum(ALARM_TYPES),
    startDate: dateSchema,
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure attendue (HH:MM).')
      .nullable(),
    frequency: z.enum(ALARM_FREQUENCIES),
    interval: z.number().int().min(1, 'Au moins 1.').max(365, '365 maximum.'),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    endDate: dateSchema,
    minutes: z.number().int().min(1, 'Au moins 1 minute.').max(24 * 60, '24 heures maximum.').nullable(),
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
    if (alarm.startDate && alarm.endDate && alarm.endDate < alarm.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'La date de fin doit suivre la date de début.' });
    }
  });
export type AlarmInput = z.input<typeof alarmInputSchema>;

/** Schedule of an alarm (REMINDER and NOT_TRACKING), in the user's local time. */
export interface AlarmSchedule {
  startDate: string | null;
  time: string | null;
  frequency: AlarmFrequency;
  interval: number;
  weekdays: number[];
  endDate: string | null;
}

const DAY_MS = 86_400_000;

/**
 * Local midnight of a YYYY-MM-DD date.
 * @param {string} date Calendar date.
 * @returns {Date} Local date.
 */
function localDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whether the schedule rings on a given local day.
 * @param {AlarmSchedule} schedule Schedule.
 * @param {Date} start Local first day.
 * @param {Date} day Local day.
 * @returns {boolean} True when it rings that day.
 */
function ringsOn(schedule: AlarmSchedule, start: Date, day: Date): boolean {
  if (day < start) return false;
  if (schedule.endDate && day > localDay(schedule.endDate)) return false;
  // Rounded: days around a daylight saving change last 23 or 25 hours.
  const days = Math.round((day.getTime() - start.getTime()) / DAY_MS);
  const interval = Math.max(1, schedule.interval);
  switch (schedule.frequency) {
    case 'ONCE':
      return days === 0;
    case 'DAILY':
      return days % interval === 0;
    case 'WEEKLY': {
      const isoDay = ((day.getDay() + 6) % 7) + 1;
      const weekdays = schedule.weekdays.length ? schedule.weekdays : [((start.getDay() + 6) % 7) + 1];
      // Weeks counted from the Monday of the first week.
      const startMonday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7));
      const weeks = Math.floor(Math.round((day.getTime() - startMonday.getTime()) / DAY_MS) / 7);
      return weekdays.includes(isoDay) && weeks % interval === 0;
    }
    case 'MONTHLY': {
      const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
      // A day missing from a month (31st…) rings on its last day.
      const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
      return months % interval === 0 && day.getDate() === Math.min(start.getDate(), lastDay);
    }
  }
}

/**
 * Time of the schedule on a local day.
 * @param {Date} day Local day.
 * @param {string} time HH:MM.
 * @returns {Date} Local date and time.
 */
function at(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/**
 * Last occurrence of a schedule at or before a moment, looking back a limited number of days.
 * @param {AlarmSchedule} schedule Schedule.
 * @param {Date} moment Moment.
 * @param {number} [lookBackDays] Days to look back. Optional. Default = 2.
 * @returns {Date | null} Occurrence, or null.
 */
export function previousOccurrence(schedule: AlarmSchedule, moment: Date, lookBackDays = 2): Date | null {
  if (!schedule.startDate || !schedule.time) return null;
  const start = localDay(schedule.startDate);
  for (let offset = 0; offset <= lookBackDays; offset += 1) {
    const day = new Date(moment.getFullYear(), moment.getMonth(), moment.getDate() - offset);
    if (!ringsOn(schedule, start, day)) continue;
    const occurrence = at(day, schedule.time);
    if (occurrence <= moment) return occurrence;
  }
  return null;
}

/**
 * Next occurrence of a schedule after a moment, within about two years.
 * @param {AlarmSchedule} schedule Schedule.
 * @param {Date} moment Moment.
 * @returns {Date | null} Occurrence, or null when the schedule is over.
 */
export function nextOccurrence(schedule: AlarmSchedule, moment: Date): Date | null {
  if (!schedule.startDate || !schedule.time) return null;
  const start = localDay(schedule.startDate);
  const first = start > moment ? start : new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
  for (let offset = 0; offset < 800; offset += 1) {
    const day = new Date(first.getFullYear(), first.getMonth(), first.getDate() + offset);
    if (schedule.endDate && day > localDay(schedule.endDate)) return null;
    if (!ringsOn(schedule, start, day)) continue;
    const occurrence = at(day, schedule.time);
    if (occurrence > moment) return occurrence;
  }
  return null;
}
