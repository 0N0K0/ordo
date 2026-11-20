import { z } from 'zod';
import { addDays, dayIn } from './days';
import { zonedInstant } from './recurrence';
import { timeOfDaySchema, timeToMinutes } from './times';

/**
 * Reminders (« rappels ») of tasks, routines, events, éphémérides and birthdays: one way of working for all (decision
 * D16, lot 16), 10 at most per item, mixed kinds, in Paris time. A reminder is either minutes before a moment
 * (`before`, 0 = « Au début », 24 hours at most: events, routines, éphémérides), a time of the day of the item's day
 * (`at`, « À HH:MM le jour J »: everywhere), or a time of the day some days before it (`at` with `days`, « N jours
 * avant, à HH:MM »: everywhere, 30 days at most, decision FO).
 */

/** Time zone of the reminders (every hour of Ordo is a Paris hour, decision D7). */
export const PARIS_ZONE = 'Europe/Paris';

/** Reminders of an item, at most. */
export const REMINDERS_MAX = 10;

/** Latest reminder before a moment, in minutes (24 hours). */
export const REMINDER_MINUTES_MAX = 24 * 60;

/** Most days of a reminder « N jours avant, à HH:MM » (decision FO). */
export const REMINDER_DAYS_MAX = 30;

/**
 * Kinds of reminders: minutes before a moment, a time of the day of the item's day, a time of the day some days before
 * it.
 */
export const REMINDER_KINDS = ['before', 'at', 'days'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/**
 * A reminder: minutes before a moment, or a time of the day (HH:MM) of the item's day or `days` days before it; always
 * `before` and `at`, one of them null, and `days` (null on the item's day).
 */
export type Reminder = { before: number; at: null; days: null } | { before: null; at: string; days: number | null };

/** A reminder as GraphQL gives it (`before` and `at`, one of them null; `days` with `at`): what the helpers read. */
export interface ReminderValue {
  before: number | null;
  at: string | null;
  /** Days before the item's day of a time of the day (« N jours avant, à HH:MM »); missing or null: its day. */
  days?: number | null;
}

/** A reminder as GraphQL takes it (any key may be missing). */
export interface ReminderFields {
  before?: number | null;
  at?: string | null;
  days?: number | null;
}

/** Message of a list of reminders too long. */
const TOO_MANY = `${REMINDERS_MAX} rappels maximum.`;

/**
 * One reminder: `{ before }` (0 to 24 hours), `{ at }` (HH:MM) or `{ at, days }` (1 to 30 days before, at HH:MM):
 * exactly one of `before` and `at`, `days` only with `at`.
 */
export const reminderSchema = z
  .object({
    before: z.number().int().min(0, 'Au moins 0 minute.').max(REMINDER_MINUTES_MAX, '24 heures maximum.').nullish(),
    at: timeOfDaySchema.nullish(),
    days: z.number().int().min(1, 'Au moins 1 jour.').max(REMINDER_DAYS_MAX, `${REMINDER_DAYS_MAX} jours maximum.`).nullish(),
  })
  .refine((reminder) => (reminder.before == null) !== (reminder.at == null), 'Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ».')
  .refine((reminder) => reminder.days == null || reminder.at != null, 'Un rappel « N jours avant » a une heure (HH:MM).')
  .transform((reminder): Reminder => (reminder.before != null ? { before: reminder.before, at: null, days: null } : { before: null, at: reminder.at!, days: reminder.days ?? null }));

/** Reminders of an event, a routine or an éphéméride: every kind, 10 at most. */
export const remindersSchema = z.array(reminderSchema).max(REMINDERS_MAX, TOO_MANY);

/**
 * Reminders at times of the day only (on the item's day or some days before), 10 at most, for an item without hours to
 * count from.
 * @param {string} message Message of a reminder « avant ».
 * @returns {z.ZodType} Schema.
 */
const timeRemindersSchema = (message: string) => remindersSchema.refine((reminders) => reminders.every((reminder) => reminder.at !== null), message);

/** Reminders of a task: times of the day only (it has no hours to count from), 10 at most, no 24 hours limit. */
export const taskRemindersSchema = timeRemindersSchema('Une tâche n’a que des rappels à une heure précise.');

/** Reminders of a birthday (a whole day): times of the day only, on the day or some days before, 10 at most. */
export const birthdayRemindersSchema = timeRemindersSchema('Un anniversaire n’a que des rappels à une heure précise.');

/**
 * Kind of a reminder: minutes before, a time of its day, a time some days before.
 * @param {ReminderValue} reminder Reminder.
 * @returns {ReminderKind} Kind.
 */
export function reminderKindOf(reminder: ReminderValue): ReminderKind {
  return reminder.at === null ? 'before' : reminder.days ? 'days' : 'at';
}

/**
 * Key of a reminder, the same for the same reminder: `before:15`, `at:08:00`, `days:3:08:00` (choice of the editor,
 * ring keys).
 * @param {Reminder} reminder Reminder.
 * @returns {string} Key.
 */
export function reminderKey(reminder: ReminderValue): string {
  if (reminder.at === null) return `before:${reminder.before ?? 0}`;
  return reminder.days ? `days:${reminder.days}:${reminder.at}` : `at:${reminder.at}`;
}

/**
 * Reminder of a key (`reminderKey`), null when it is none.
 * @param {string} key Key.
 * @returns {Reminder | null} Reminder.
 */
export function reminderOfKey(key: string): Reminder | null {
  const [kind, ...rest] = key.split(':');
  const value = rest.join(':');
  const fields = kind === 'at' ? { at: value } : kind === 'before' ? { before: Number(value) } : kind === 'days' ? { days: Number(rest[0]), at: rest.slice(1).join(':') } : {};
  const parsed = reminderSchema.safeParse(fields);
  return parsed.success ? parsed.data : null;
}

/** Order of the kinds of reminders as stored: as they ring. */
const REMINDER_ORDER: Record<ReminderKind, number> = { days: 0, before: 1, at: 2 };

/**
 * Reminders as stored: without duplicates, in the order they ring: the days before first (the most days first, then by
 * time), then the minutes before (the latest first: 1 h before rings before 5 min before), then the times of the day.
 * @template {ReminderValue} R
 * @param {readonly R[]} reminders Reminders.
 * @returns {R[]} Reminders sorted.
 */
export function normalizedReminders<R extends ReminderValue>(reminders: readonly R[]): R[] {
  const unique = new Map(reminders.map((reminder) => [reminderKey(reminder), reminder]));
  /**
   * Rank of the kind of a reminder: days before, minutes before, time of the day.
   * @param {ReminderValue} reminder Reminder.
   * @returns {number} Rank.
   */
  const rank = (reminder: ReminderValue) => REMINDER_ORDER[reminderKindOf(reminder)];
  return [...unique.values()].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.at === null || b.at === null) return (b.before ?? 0) - (a.before ?? 0);
    return (b.days ?? 0) - (a.days ?? 0) || a.at.localeCompare(b.at);
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
 * Minutes from a start (a time of the day) to a reminder of the same day or some days before, for a relative alarm
 * (iCalendar): positive before the start, negative after it.
 * @param {Reminder} reminder Reminder.
 * @param {string} startTime Time of the start (00:00 for an all-day event).
 * @returns {number} Minutes before the start.
 */
export function minutesBeforeStart(reminder: ReminderValue, startTime: string): number {
  return reminder.at === null ? (reminder.before ?? 0) : timeToMinutes(startTime) - timeToMinutes(reminder.at) + (reminder.days ?? 0) * 24 * 60;
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
 * Reminders « À HH:MM le jour J » and « N jours avant, à HH:MM » of a day (the others left out), key
 * `<key>:at:<HH:MM>` or `<key>:days:<N>:<HH:MM>`.
 * @param {string} key Key of the item (and its occurrence).
 * @param {string} day Day (Paris).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @param {boolean} [onDay] Those of the day itself (`at` without `days`). Optional. Default = true.
 * @returns {PlannedReminder[]} Reminders.
 */
export function remindersAt(key: string, day: string, reminders: readonly ReminderValue[], onDay = true): PlannedReminder[] {
  return reminders.flatMap((reminder) =>
    reminder.at !== null && (onDay || reminder.days) ? [{ key: `${key}:${reminderKey(reminder)}`, at: parisInstant(addDays(day, -(reminder.days ?? 0)), reminder.at) }] : [],
  );
}

/**
 * Reminders of an occurrence of an item: « N min avant » its start, « À HH:MM » its first day, « N jours avant, à
 * HH:MM » that day (events, éphémérides).
 * @param {string} key Key of the occurrence.
 * @param {string} day Its first day (Paris).
 * @param {Date} start Its start (Paris midnight of its first day when all day).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @returns {PlannedReminder[]} Reminders.
 */
export function occurrenceReminders(key: string, day: string, start: Date, reminders: readonly ReminderValue[]): PlannedReminder[] {
  return [...remindersBefore(key, start, reminders), ...remindersAt(key, day, reminders)];
}

/** Most days ahead a reminder can ring before its item's day, plus one (the occurrences to load ahead). */
export const REMINDER_LOOKAHEAD_DAYS = REMINDER_DAYS_MAX + 1;

/**
 * Days whose items' reminders may ring around now (Paris): from yesterday (a late one may still ring) to the most days a
 * reminder rings before (the occurrences, éphémérides and birthdays to look at).
 * @param {Date} now Now.
 * @param {number} [ahead] Days ahead. Optional. Default = `REMINDER_LOOKAHEAD_DAYS`.
 * @returns {{ from: string, to: string }} Days.
 */
export function reminderDayRange(now: Date, ahead = REMINDER_LOOKAHEAD_DAYS): { from: string; to: string } {
  const today = dayIn(now, PARIS_ZONE);
  return { from: addDays(today, -1), to: addDays(today, ahead) };
}

/**
 * Most days before among reminders (0 without « N jours avant »).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @returns {number} Days.
 */
export function reminderDaysAhead(reminders: readonly ReminderValue[]): number {
  return Math.max(0, ...reminders.map((reminder) => (reminder.at !== null ? (reminder.days ?? 0) : 0)));
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
 * Reminders of a task around now: those « À HH:MM » of the day before and of today in Paris (a late one may still ring
 * after midnight), on the days it reminds on; those « N jours avant, à HH:MM » once, counted from its « Échéance ».
 * @param {string} key Key of the task.
 * @param {TaskReminderDays & { reminders: readonly ReminderValue[] }} task Task.
 * @param {Date} now Now.
 * @returns {PlannedReminder[]} Reminders.
 */
export function taskReminders(key: string, task: TaskReminderDays & { reminders: readonly ReminderValue[] }, now: Date): PlannedReminder[] {
  const today = dayIn(now, PARIS_ZONE);
  const onDays = task.reminders.filter((reminder) => !reminder.days);
  return [
    ...(task.deadline ? remindersAt(`${key}:${task.deadline}`, task.deadline, task.reminders, false) : []),
    ...[addDays(today, -1), today].filter((day) => taskRemindsOn(task, day)).flatMap((day) => remindersAt(`${key}:${day}`, day, onDays)),
  ];
}
