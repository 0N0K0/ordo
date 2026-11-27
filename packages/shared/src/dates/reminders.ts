import { z } from 'zod';
import { readStoredList } from '../core/rules';
import { addDays, dayIn, PARIS_ZONE } from './days';
import { zonedInstant } from './recurrence';
import { isRingtone, type RingtoneId } from './ringing';
import { timeOfDaySchema, timeToMinutes } from './times';

/**
 * Reminders (« rappels ») of tasks, routines, events, éphémérides and birthdays: one way of working for all,
 * 10 at most per item, mixed kinds, in Paris time. A reminder is either minutes before a moment
 * (`before`, 0 = « Au début », 24 hours at most: events, routines, éphémérides), a time of the day of the item's day
 * (`at`, « À HH:MM le jour J »: everywhere), or a time of the day some days before it (`at` with `days`, « N jours
 * avant, à HH:MM »: everywhere, 30 days at most). Events count a reminder from their start or from their
 * end (`anchor`); routines from the start or the end of the opening day or of the due day of an
 * occurrence; each reminder may name its ringtone (`ringtone`; none: the one of the settings of the user).
 */

/** Reminders of an item, at most. */
export const REMINDERS_MAX = 10;

/** Latest reminder before a moment, in minutes (24 hours). */
export const REMINDER_MINUTES_MAX = 24 * 60;

/** Most days of a reminder « N jours avant, à HH:MM ». */
export const REMINDER_DAYS_MAX = 30;

/**
 * Kinds of reminders: minutes before a moment, a time of the day of the item's day, a time of the day some days before
 * it.
 */
export const REMINDER_KINDS = ['before', 'at', 'days'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
/** Kinds of reminders of an item without hours (a task, a birthday, a routine without any): at a time of the day only. */
export const DAY_REMINDER_KINDS = ['at', 'days'] as const satisfies readonly ReminderKind[];

/**
 * What a reminder counts from: `start` (default, nothing stored) the start of its item, `end` its end;
 * for a routine, `start` is the start of the opening day (« Ouverture ») of an occurrence, `end` the end of its due day
 * (« Échéance »), and two more: `openEnd` the end of the opening day, `dueStart` the start of the due day. A reminder at
 * a time of the day only tells the day: `openEnd` is stored as `start`, `dueStart` as `end`.
 */
export const REMINDER_ANCHORS = ['start', 'end', 'openEnd', 'dueStart'] as const;
export type ReminderAnchor = (typeof REMINDER_ANCHORS)[number];

/** What the reminders of an event count from: its start, its end. */
export const EVENT_REMINDER_ANCHORS = ['start', 'end'] as const satisfies readonly ReminderAnchor[];

/**
 * What the reminders of a routine count from, in the order they come in an occurrence: the start of the
 * opening day (`start`), its end (`openEnd`), the start of the due day (`dueStart`), its end (`end`).
 */
export const ROUTINE_REMINDER_ANCHORS = ['start', 'openEnd', 'dueStart', 'end'] as const satisfies readonly ReminderAnchor[];

/** Anchors of the routines only (an event refuses them). */
const ROUTINE_ONLY_ANCHORS: readonly string[] = ['openEnd', 'dueStart'];

/**
 * Anchor of a reminder as stored: none for the start; a time of the day keeps only its day (`openEnd` → start,
 * `dueStart` → `end`).
 * @param {string | null | undefined} anchor Anchor given.
 * @param {boolean} atTime The reminder is at a time of the day.
 * @returns {Exclude<ReminderAnchor, 'start'> | undefined} Anchor stored.
 */
function storedAnchor(anchor: string | null | undefined, atTime: boolean): Exclude<ReminderAnchor, 'start'> | undefined {
  if (anchor === 'end' || (atTime && anchor === 'dueStart')) return 'end';
  if (!atTime && (anchor === 'openEnd' || anchor === 'dueStart')) return anchor;
  return undefined;
}

/** Options of a reminder, stored only when set: what it counts from, its ringtone. */
export interface ReminderOptions {
  /** Counted from the end of the item (`end`), or for a routine from another edge of an occurrence; missing: from its start. */
  anchor?: Exclude<ReminderAnchor, 'start'>;
  /** Ringtone of the bank; missing: the one of the settings of the user. */
  ringtone?: RingtoneId;
}

/**
 * A reminder: minutes before a moment, or a time of the day (HH:MM) of the item's day or `days` days before it; always
 * `before` and `at`, one of them null, and `days` (null on the item's day); from the start or the end, with its
 * ringtone or not.
 */
export type Reminder = ({ before: number; at: null; days: null } | { before: null; at: string; days: number | null }) & ReminderOptions;

/** A reminder as GraphQL gives it (`before` and `at`, one of them null; `days` with `at`): what the helpers read. */
export interface ReminderValue {
  before: number | null;
  at: string | null;
  /** Days before the item's day of a time of the day (« N jours avant, à HH:MM »); missing or null: its day. */
  days?: number | null;
  /** `end`, `openEnd`, `dueStart` (`REMINDER_ANCHORS`); `start`, missing or null: from the start. */
  anchor?: string | null;
  /** Ringtone; missing or null: the one of the settings. */
  ringtone?: string | null;
}

/** A reminder as GraphQL takes it (any key may be missing). */
export interface ReminderFields {
  before?: number | null;
  at?: string | null;
  days?: number | null;
  anchor?: string | null;
  ringtone?: string | null;
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
    anchor: z
      .string()
      .nullish()
      .refine((anchor) => anchor == null || (REMINDER_ANCHORS as readonly string[]).includes(anchor), 'Un rappel compte depuis un début ou une fin.'),
    // A ringtone no longer in the bank: the one of the settings.
    ringtone: z.string().nullish(),
  })
  .refine((reminder) => (reminder.before == null) !== (reminder.at == null), 'Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ».')
  .refine((reminder) => reminder.days == null || reminder.at != null, 'Un rappel « N jours avant » a une heure (HH:MM).')
  .transform((reminder): Reminder => ({
    ...(reminder.before != null ? { before: reminder.before, at: null, days: null } : { before: null, at: reminder.at!, days: reminder.days ?? null }),
    ...(storedAnchor(reminder.anchor, reminder.at != null) && { anchor: storedAnchor(reminder.anchor, reminder.at != null) }),
    ...(isRingtone(reminder.ringtone) && { ringtone: reminder.ringtone }),
  }));

/** Reminders of a routine: every kind, from the start or the end of the opening day or of the due day, 10 at most. */
export const remindersSchema = z.array(reminderSchema).max(REMINDERS_MAX, TOO_MANY);

/** Reminders of an event: every kind, from its start or its end, 10 at most. */
export const eventRemindersSchema = remindersSchema.refine(
  (reminders) => reminders.every((reminder) => !ROUTINE_ONLY_ANCHORS.includes(reminder.anchor ?? '')),
  'Seules les routines ont des rappels depuis la fin de l’ouverture ou le début de l’échéance.',
);

/** Message of a reminder from the end on an item without end to count from. */
const NO_END = 'Seuls les évènements et les routines ont des rappels avant la fin.';

/**
 * Whether reminders all count from the start.
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @returns {boolean} None from another anchor.
 */
const fromStart = (reminders: readonly ReminderValue[]) => reminders.every((reminder) => reminderAnchorOf(reminder) === 'start');

/** Reminders of an éphéméride: every kind, from its start only, 10 at most. */
export const startRemindersSchema = remindersSchema.refine(fromStart, NO_END);

/**
 * Reminders at times of the day only (on the item's day or some days before), 10 at most, for an item without hours to
 * count from.
 * @param {string} message Message of a reminder « avant ».
 * @returns {z.ZodType} Schema.
 */
const timeRemindersSchema = (message: string) => startRemindersSchema.refine((reminders) => reminders.every((reminder) => reminder.at !== null), message);

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
 * What a reminder counts from (a time of the day: its day only).
 * @param {ReminderValue} reminder Reminder.
 * @returns {ReminderAnchor} Anchor.
 */
export function reminderAnchorOf(reminder: ReminderValue): ReminderAnchor {
  return storedAnchor(reminder.anchor, reminder.at !== null) ?? 'start';
}

/**
 * Key of a reminder, the same for the same reminder whatever its ringtone: `before:15`, `at:08:00`, `days:3:08:00`,
 * prefixed by its anchor when not the start (`end:`, `openEnd:`, `dueStart:`; choice of the editor, ring keys).
 * @param {Reminder} reminder Reminder.
 * @returns {string} Key.
 */
export function reminderKey(reminder: ReminderValue): string {
  const anchor = reminderAnchorOf(reminder);
  const prefix = anchor === 'start' ? '' : `${anchor}:`;
  if (reminder.at === null) return `${prefix}before:${reminder.before ?? 0}`;
  return `${prefix}${reminder.days ? `days:${reminder.days}:${reminder.at}` : `at:${reminder.at}`}`;
}

/**
 * Reminder of a key (`reminderKey`), null when it is none.
 * @param {string} key Key.
 * @returns {Reminder | null} Reminder.
 */
export function reminderOfKey(key: string): Reminder | null {
  const [first, ...others] = key.split(':');
  const anchor = (REMINDER_ANCHORS as readonly string[]).includes(first) ? first : null;
  const [kind, ...rest] = anchor ? others : [first, ...others];
  const value = rest.join(':');
  const fields = kind === 'at' ? { at: value } : kind === 'before' ? { before: Number(value) } : kind === 'days' ? { days: Number(rest[0]), at: rest.slice(1).join(':') } : {};
  const parsed = reminderSchema.safeParse(anchor ? { ...fields, anchor } : fields);
  return parsed.success ? parsed.data : null;
}

/** Order of the kinds of reminders as stored: as they ring. */
const REMINDER_ORDER: Record<ReminderKind, number> = { days: 0, before: 1, at: 2 };

/**
 * Reminders as stored: without duplicates (the last one kept, its ringtone with it), by anchor (`ROUTINE_REMINDER_ANCHORS`
 * order: the start, the end of the opening day, the start of the due day, the end), each in the order they ring: the days before first (the most days first, then by time), then the
 * minutes before (the latest first: 1 h before rings before 5 min before), then the times of the day.
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
  /**
   * Rank of what a reminder counts from: the start, the end of the opening day, the start of the due day, the end.
   * @param {ReminderValue} reminder Reminder.
   * @returns {number} Rank.
   */
  const side = (reminder: ReminderValue) => (ROUTINE_REMINDER_ANCHORS as readonly ReminderAnchor[]).indexOf(reminderAnchorOf(reminder));
  return [...unique.values()].sort((a, b) => {
    if (side(a) !== side(b)) return side(a) - side(b);
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
  return readStoredList(reminderSchema, value);
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
 * Minutes from a moment of a day (its start or its end) to a reminder of the same day or some days before, for a
 * relative alarm (iCalendar): positive before the moment, negative after it.
 * @param {Reminder} reminder Reminder.
 * @param {string | number} time Time of the moment (HH:MM, or minutes from midnight: 1 440 for the end of an all-day event).
 * @returns {number} Minutes before the moment.
 */
export function minutesBeforeMoment(reminder: ReminderValue, time: string | number): number {
  const minutes = typeof time === 'number' ? time : timeToMinutes(time);
  return reminder.at === null ? (reminder.before ?? 0) : minutes - timeToMinutes(reminder.at) + (reminder.days ?? 0) * 24 * 60;
}

/** A reminder to ring: its key (one ring per key), its instant and its ringtone (none: the one of the settings). */
export interface PlannedReminder {
  key: string;
  at: Date;
  ringtone?: RingtoneId;
}

/**
 * Ringtone of a reminder, when it names one of the bank.
 * @param {ReminderValue} reminder Reminder.
 * @returns {{ ringtone?: RingtoneId }} Its ringtone, or nothing.
 */
const ringtoneOf = (reminder: ReminderValue): { ringtone?: RingtoneId } => (isRingtone(reminder.ringtone) ? { ringtone: reminder.ringtone } : {});

/**
 * Reminders « N min avant » a moment (the others left out), key `<key>:before:<minutes>` (`<key>:end:before:<minutes>`
 * from the end, and so on).
 * @param {string} key Key of the moment.
 * @param {Date} moment Moment they count from.
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @param {ReminderAnchor} [anchor] Those counted from this anchor. Optional. Default = start.
 * @returns {PlannedReminder[]} Reminders.
 */
export function remindersBefore(key: string, moment: Date, reminders: readonly ReminderValue[], anchor: ReminderAnchor = 'start'): PlannedReminder[] {
  return reminders.flatMap((reminder) =>
    reminder.at === null && reminderAnchorOf(reminder) === anchor ? [{ key: `${key}:${reminderKey(reminder)}`, at: new Date(moment.getTime() - (reminder.before ?? 0) * 60_000), ...ringtoneOf(reminder) }] : [],
  );
}

/**
 * Reminders « À HH:MM le jour J » and « N jours avant, à HH:MM » of a day (the others left out), key
 * `<key>:at:<HH:MM>` or `<key>:days:<N>:<HH:MM>`.
 * @param {string} key Key of the item (and its occurrence).
 * @param {string} day Day (Paris).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @param {boolean} [onDay] Those of the day itself (`at` without `days`). Optional. Default = true.
 * @param {'start' | 'end'} [anchor] Those counted from the start (`day`: the first day, the opening day of a routine)
 *   or from the end (`day`: the last day, the due day of a routine). Optional. Default = start.
 * @returns {PlannedReminder[]} Reminders.
 */
export function remindersAt(key: string, day: string, reminders: readonly ReminderValue[], onDay = true, anchor: 'start' | 'end' = 'start'): PlannedReminder[] {
  return reminders.flatMap((reminder) =>
    reminder.at !== null && (onDay || reminder.days) && reminderAnchorOf(reminder) === anchor
      ? [{ key: `${key}:${reminderKey(reminder)}`, at: parisInstant(addDays(day, -(reminder.days ?? 0)), reminder.at), ...ringtoneOf(reminder) }]
      : [],
  );
}

/** End of an occurrence its reminders « avant la fin » count from: its last day and its end. */
export interface OccurrenceEnd {
  /** Its last day (Paris): the day of its reminders « À HH:MM » from the end. */
  day: string;
  /** Its end (Paris midnight after its last day when all day). */
  at: Date;
}

/**
 * Reminders of an occurrence of an item: « N min avant » its start, « À HH:MM » its first day, « N jours avant, à
 * HH:MM » that day (events, éphémérides); with its end, the same counted from its end and its last day
 * (events).
 * @param {string} key Key of the occurrence.
 * @param {string} day Its first day (Paris).
 * @param {Date} start Its start (Paris midnight of its first day when all day).
 * @param {readonly ReminderValue[]} reminders Reminders.
 * @param {OccurrenceEnd} [end] Its end. Optional. Default = none (those from the end left out).
 * @returns {PlannedReminder[]} Reminders.
 */
export function occurrenceReminders(key: string, day: string, start: Date, reminders: readonly ReminderValue[], end?: OccurrenceEnd): PlannedReminder[] {
  return [
    ...remindersBefore(key, start, reminders),
    ...remindersAt(key, day, reminders),
    ...(end ? [...remindersBefore(key, end.at, reminders, 'end'), ...remindersAt(key, end.day, reminders, true, 'end')] : []),
  ];
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
  /** Whether its « Horaires » allow a day: its « À HH:MM » ring only on those. Optional. Default = every day. */
  hoursAllow?: (day: string) => boolean;
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
 * after midnight), and of the next `ahead` days, on the days it reminds on that its « Horaires » allow (`hoursAllow`);
 * those « N jours avant, à HH:MM » once, counted from its « Échéance ».
 * @param {string} key Key of the task.
 * @param {TaskReminderDays & { reminders: readonly ReminderValue[] }} task Task.
 * @param {Date} now Now.
 * @param {number} [ahead] Days after today whose « À HH:MM » are given too. Optional. Default = 0 (yesterday and today).
 * @returns {PlannedReminder[]} Reminders.
 */
export function taskReminders(key: string, task: TaskReminderDays & { reminders: readonly ReminderValue[] }, now: Date, ahead = 0): PlannedReminder[] {
  const today = dayIn(now, PARIS_ZONE);
  const onDays = task.reminders.filter((reminder) => !reminder.days);
  const days = Array.from({ length: ahead + 2 }, (_, index) => addDays(today, index - 1));
  return [
    ...(task.deadline ? remindersAt(`${key}:${task.deadline}`, task.deadline, task.reminders, false) : []),
    ...days.filter((day) => taskRemindsOn(task, day) && (task.hoursAllow?.(day) ?? true)).flatMap((day) => remindersAt(`${key}:${day}`, day, onDays)),
  ];
}

/** A reminder as GraphQL gives it, every field set (an item drawn in the cache before the API answers). */
export interface ReminderOutput {
  before: number | null;
  at: string | null;
  days: number | null;
  anchor: ReminderAnchor;
  ringtone: string | null;
}

/**
 * Reminders read from a stored or received value, as GraphQL gives them (invalid ones left out).
 * @param {unknown} value JSON, or reminders as sent.
 * @returns {ReminderOutput[]} Reminders.
 */
export function readReminderOutputs(value: unknown): ReminderOutput[] {
  return readReminders(value).map((reminder) => ({ before: reminder.before, at: reminder.at, days: reminder.days, anchor: reminderAnchorOf(reminder), ringtone: reminder.ringtone ?? null }));
}
