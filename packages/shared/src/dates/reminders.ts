import { z } from 'zod';
import { addDays, dayIn } from './days';
import { zonedInstant } from './recurrence';
import { timeOfDaySchema, timeToMinutes } from './times';

/**
 * Reminders (« rappels ») of tasks, routines and events: one way of working for the three (decision D16), 10 at most
 * per item, mixed kinds, in Paris time. A reminder is either minutes before a moment (`before`, 0 = « Au début », 24
 * hours at most: events and routines) or a time of the day of the item's day (`at`, « À HH:MM le jour J »: events,
 * routines and tasks).
 */

/** Time zone of the reminders (every hour of Ordo is a Paris hour, decision D7). */
export const PARIS_ZONE = 'Europe/Paris';

/** Reminders of an item, at most. */
export const REMINDERS_MAX = 10;

/** Latest reminder before a moment, in minutes (24 hours). */
export const REMINDER_MINUTES_MAX = 24 * 60;

/** Kinds of reminders: minutes before a moment, a time of the day of the item's day. */
export const REMINDER_KINDS = ['before', 'at'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** A reminder: minutes before a moment, or a time of the day (HH:MM); always both keys, one of them null. */
export type Reminder = { before: number; at: null } | { before: null; at: string };

/** A reminder as GraphQL gives it (both keys, one of them null): what the helpers read. */
export interface ReminderValue {
  before: number | null;
  at: string | null;
}

/** A reminder as GraphQL takes it (either key may be missing). */
export interface ReminderFields {
  before?: number | null;
  at?: string | null;
}

/** Message of a list of reminders too long. */
const TOO_MANY = `${REMINDERS_MAX} rappels maximum.`;

/** One reminder: `{ before }` (0 to 24 hours) or `{ at }` (HH:MM), exactly one of them. */
export const reminderSchema = z
  .object({
    before: z.number().int().min(0, 'Au moins 0 minute.').max(REMINDER_MINUTES_MAX, '24 heures maximum.').nullish(),
    at: timeOfDaySchema.nullish(),
  })
  .refine((reminder) => (reminder.before == null) !== (reminder.at == null), 'Un rappel est « N min avant » ou « à HH:MM ».')
  .transform((reminder): Reminder => (reminder.before != null ? { before: reminder.before, at: null } : { before: null, at: reminder.at! }));

/** Reminders of an event or a routine: both kinds, 10 at most. */
export const remindersSchema = z.array(reminderSchema).max(REMINDERS_MAX, TOO_MANY);

/** Reminders of a task: times of the day only (it has no hours to count from), 10 at most, no 24 hours limit. */
export const taskRemindersSchema = remindersSchema.refine((reminders) => reminders.every((reminder) => reminder.at !== null), 'Une tâche n’a que des rappels à une heure précise.');

/**
 * Key of a reminder, the same for the same reminder: `before:15`, `at:08:00` (choice of the editor, ring keys).
 * @param {Reminder} reminder Reminder.
 * @returns {string} Key.
 */
export function reminderKey(reminder: ReminderValue): string {
  return reminder.at !== null ? `at:${reminder.at}` : `before:${reminder.before ?? 0}`;
}

/**
 * Reminder of a key (`reminderKey`), null when it is none.
 * @param {string} key Key.
 * @returns {Reminder | null} Reminder.
 */
export function reminderOfKey(key: string): Reminder | null {
  const [kind, ...rest] = key.split(':');
  const value = rest.join(':');
  const parsed = reminderSchema.safeParse(kind === 'at' ? { at: value } : kind === 'before' ? { before: Number(value) } : {});
  return parsed.success ? parsed.data : null;
}

/**
 * Reminders as stored: without duplicates, minutes before first (the latest first: 1 h before rings before 5 min
 * before), then the times of the day in order.
 * @template {ReminderValue} R
 * @param {readonly R[]} reminders Reminders.
 * @returns {R[]} Reminders sorted.
 */
export function normalizedReminders<R extends ReminderValue>(reminders: readonly R[]): R[] {
  const unique = new Map(reminders.map((reminder) => [reminderKey(reminder), reminder]));
  return [...unique.values()].sort((a, b) => {
    if (a.at !== null || b.at !== null) return a.at === null ? -1 : b.at === null ? 1 : a.at.localeCompare(b.at);
    return (b.before ?? 0) - (a.before ?? 0);
  });
}

/**
 * Reminders read from a stored or received value (invalid ones left out).
 * @param {unknown} value JSON, or reminders as GraphQL gives them.
 * @returns {Reminder[]} Reminders.
 */
export function readReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = reminderSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/**
 * Instant of a Paris day and time (the moment a reminder counts from).
 * @param {string} day YYYY-MM-DD.
 * @param {string} [time] HH:MM. Optional. Default = 00:00 (midnight, the start of an all-day event).
 * @returns {Date} Instant.
 */
export function parisInstant(day: string, time = '00:00'): Date {
  return zonedInstant(day, time, PARIS_ZONE);
}

/**
 * Minutes from a start (a time of the day) to a reminder of the same day, for a relative alarm (iCalendar): positive
 * before the start, negative after it.
 * @param {Reminder} reminder Reminder.
 * @param {string} startTime Time of the start (00:00 for an all-day event).
 * @returns {number} Minutes before the start.
 */
export function minutesBeforeStart(reminder: ReminderValue, startTime: string): number {
  return reminder.at === null ? (reminder.before ?? 0) : timeToMinutes(startTime) - timeToMinutes(reminder.at);
}

/** A reminder to ring: its key (one ring per key) and its instant. */
export interface PlannedReminder {
  key: string;
  at: Date;
}

/**
 * Reminders « N min avant » a moment (the others left out), key `<key>:before:<minutes>`.
 * @param {string} key Key of the moment.
 * @param {Date} moment Moment they count from.
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @returns {PlannedReminder[]} Reminders.
 */
export function remindersBefore(key: string, moment: Date, reminders: readonly ReminderValue[]): PlannedReminder[] {
  return reminders.flatMap((reminder) => (reminder.at === null ? [{ key: `${key}:${reminderKey(reminder)}`, at: new Date(moment.getTime() - (reminder.before ?? 0) * 60_000) }] : []));
}

/**
 * Reminders « À HH:MM le jour J » of a day (the others left out), key `<key>:at:<HH:MM>`.
 * @param {string} key Key of the item (and its occurrence).
 * @param {string} day Day (Paris).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @returns {PlannedReminder[]} Reminders.
 */
export function remindersAt(key: string, day: string, reminders: readonly ReminderValue[]): PlannedReminder[] {
  return reminders.flatMap((reminder) => (reminder.at !== null ? [{ key: `${key}:${reminderKey(reminder)}`, at: parisInstant(day, reminder.at) }] : []));
}

/** Days of a task its reminders ring on: « Ouverture » and « Échéance » (YYYY-MM-DD). */
export interface TaskReminderDays {
  minDate?: string | null;
  deadline?: string | null;
}

/**
 * Whether the reminders of a task ring on a day: every day from its « Ouverture » to its « Échéance », the « Échéance »
 * day only without « Ouverture », never without « Échéance ».
 * @param {TaskReminderDays} task Task.
 * @param {string} day Day.
 * @returns {boolean} Rings that day.
 */
export function taskRemindsOn(task: TaskReminderDays, day: string): boolean {
  if (!task.deadline) return false;
  const from = task.minDate && task.minDate < task.deadline ? task.minDate : task.deadline;
  return day >= from && day <= task.deadline;
}

/**
 * Reminders of a task around now: those of the day before and of today in Paris (a late one may still ring after
 * midnight), at its times of the day, on the days it reminds on.
 * @param {string} key Key of the task.
 * @param {TaskReminderDays & { reminders: readonly ReminderValue[] }} task Task.
 * @param {Date} now Now.
 * @returns {PlannedReminder[]} Reminders.
 */
export function taskReminders(key: string, task: TaskReminderDays & { reminders: readonly ReminderValue[] }, now: Date): PlannedReminder[] {
  const today = dayIn(now, PARIS_ZONE);
  return [addDays(today, -1), today].filter((day) => taskRemindsOn(task, day)).flatMap((day) => remindersAt(`${key}:${day}`, day, task.reminders));
}
