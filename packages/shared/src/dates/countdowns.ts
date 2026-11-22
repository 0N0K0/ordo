import { z } from 'zod';
import { optionalText, readStoredList, requiredText, shortTextSchema } from '../core/rules';
import { labelFormSchema } from '../core/workspace';
import { durationSchema, durationTextSchema, formatDuration } from '../tasks/time';
import { daySchema } from './times';
import { isRingtone, RING_KEY_MAX, type RingtoneId } from './ringing';

/**
 * Timers (« minuteurs », countdowns) and dead times (« temps morts ») of the tasks and routines:
 * a timer counts down a duration and rings at its end (`startRinging`, the ringtone of the timer, else the one of the
 * settings); several run at once, for the user, in every workspace, kept by the API (a reload, another tab or device,
 * the push notifications follow it). A dead time is a wait of an item (« Lave-linge, 1 h 30 ») a timer is
 * launched for: it is not time spent. A saved timer (« minuteur enregistré », a settings list of the workspace: « Œufs
 * durs », « Lessive ») is started again in one click, alone or from a task, a routine, an event or a sheet it is linked to.
 */

/** Durations offered to start a timer at once, in minutes. */
export const COUNTDOWN_PRESETS = [1, 3, 5, 10, 15, 30, 60] as const;

/** Minutes a running timer can be given more at once (« +1 min », « +5 min »). */
export const COUNTDOWN_EXTENSIONS = [1, 5] as const;

/** Longest time left on a timer, in seconds (24 hours). */
export const COUNTDOWN_MAX_SECONDS = 24 * 3600;

/** Most dead times of a task or a routine. */
export const DEAD_TIMES_MAX = 20;

/** Tag of the key of the ring of a timer (`countdown:<id>`). */
export const COUNTDOWN_RING_TAG = 'countdown';

/**
 * Key of the ring of a timer, the same in every tab and device (and for the push notifications).
 * @param {string} id Timer.
 * @returns {string} Key, without the `ordo.alarm.` prefix.
 */
export const countdownRingKey = (id: string): string => `${COUNTDOWN_RING_TAG}:${id}`;

/** A ringtone of the bank, or none (the one of the settings); a ringtone no longer in the bank reads as none. */
const optionalRingtone = z
  .string()
  .nullish()
  .transform((ringtone) => (isRingtone(ringtone) ? ringtone : null));

/** Minutes of a dead time or a saved timer: 1 to 1 440. */
const minutesSchema = z
  .number({ error: 'Durée attendue.' })
  .int()
  .min(1, 'Au moins 1 minute.')
  .max(24 * 60, '24 heures maximum.');

/** A dead time of a task or a routine: what is waited for, how long (minutes), the ringtone at its end (none: the settings). */
export const deadTimeSchema = z.object({
  label: requiredText(),
  minutes: minutesSchema,
  ringtone: optionalRingtone,
});

/** A dead time as stored and read: its ringtone only when one was chosen. */
export interface DeadTime {
  label: string;
  minutes: number;
  ringtone?: RingtoneId | null;
}

/** A dead time as sent (a ringtone no longer in the bank reads as none). */
export type DeadTimeInput = z.input<typeof deadTimeSchema>;

/** Dead times of a task or a routine, as sent. */
export const deadTimesSchema = z.array(deadTimeSchema).max(DEAD_TIMES_MAX, `${DEAD_TIMES_MAX} temps morts au plus.`);

/**
 * Dead times read from a stored value (invalid ones left out; a ringtone kept only when given).
 * @param {unknown} value Stored JSON.
 * @returns {DeadTime[]} Dead times.
 */
export function readDeadTimes(value: unknown): DeadTime[] {
  return storedDeadTimes(readStoredList(deadTimeSchema, value));
}

/**
 * Dead times as stored: a ringtone kept only when one was chosen.
 * @param {readonly DeadTime[]} deadTimes Dead times checked (`deadTimesSchema`).
 * @returns {DeadTime[]} Dead times.
 */
export function storedDeadTimes(deadTimes: readonly DeadTime[]): DeadTime[] {
  return deadTimes.map(({ ringtone, ...deadTime }) => (ringtone ? { ...deadTime, ringtone } : deadTime));
}

/** A timer started: its duration (1 minute to 24 hours), its name, its ringtone, and the item of a dead time. */
export const countdownInputSchema = z.object({
  label: optionalText().nullish().transform((label) => label ?? null),
  seconds: durationSchema,
  ringtone: optionalRingtone,
  /** Workspace of its item (its link opens it there); none: the one open. */
  workspaceId: z.string().nullish(),
  /** Item it is launched for: a task, a routine and its occurrence, an event (and its occurrence when recurring), a sheet. */
  taskId: z.string().nullish(),
  routineId: z.string().nullish(),
  eventId: z.string().nullish(),
  sheetId: z.string().nullish(),
  occurrenceDate: daySchema().nullish(),
  /** Name of its item, shown with it (the timer is the user's, in every workspace: no relation). */
  subject: shortTextSchema.nullish(),
  /** Page of the app its ring links to, and the label of the link. */
  path: z.string().max(RING_KEY_MAX).startsWith('/').nullish(),
  linkLabel: shortTextSchema.nullish(),
});
export type CountdownInput = z.input<typeof countdownInputSchema>;

/** A saved timer of the workspace (a settings list): its name (unique), color, duration (minutes), ringtone (none: the settings). */
export const savedCountdownSchema = labelFormSchema.extend({ minutes: minutesSchema, ringtone: optionalRingtone });
export type SavedCountdownInput = z.input<typeof savedCountdownSchema>;

/** Form of a saved timer: its name and color, its duration typed (« 9 », « 1:30 », `parseDuration`), its ringtone. */
export const savedCountdownFormSchema = labelFormSchema.extend({ duration: durationTextSchema, ringtone: z.string().nullable() });

/** Items a saved timer is linked to (each lists the saved timers it launches). */
export const SAVED_COUNTDOWN_TARGETS = ['TASK', 'ROUTINE', 'EVENT', 'SHEET'] as const;
export type SavedCountdownTarget = (typeof SAVED_COUNTDOWN_TARGETS)[number];

/** Most saved timers linked to an item. */
export const SAVED_COUNTDOWN_LINKS_MAX = 20;

/** Saved timers linked to an item, as sent (each once). */
export const savedCountdownLinksSchema = z
  .array(z.string())
  .max(SAVED_COUNTDOWN_LINKS_MAX, `${SAVED_COUNTDOWN_LINKS_MAX} minuteurs au plus.`)
  .transform((ids) => [...new Set(ids)]);

/** Form of a timer started: its name (optional), its duration typed (« 10 », « 1h30 »…, `parseDuration`), its ringtone. */
export const countdownFormSchema = z.object({
  label: shortTextSchema,
  duration: durationTextSchema,
  ringtone: z.string().nullable(),
});
export type CountdownFormValues = z.input<typeof countdownFormSchema>;

/** Minutes added to a running or paused timer: 1 to 60. */
export const countdownExtensionSchema = z.number().int().min(1, 'Au moins 1 minute.').max(60, '60 minutes maximum.');

/** What tells the time left on a timer. */
export interface CountdownTiming {
  /** End, while it runs (ISO or Date); null: paused. */
  endsAt: string | Date | null;
  /** Seconds left, while paused. */
  remainingSeconds: number | null;
}

/**
 * Seconds left on a timer (0 once over): until its end while it runs, those kept while paused.
 * @param {CountdownTiming} countdown Timer.
 * @param {number} [now] Now (ms). Optional. Default = Date.now().
 * @returns {number} Seconds left, rounded up.
 */
export function countdownRemaining(countdown: CountdownTiming, now: number = Date.now()): number {
  if (countdown.endsAt === null) return Math.max(0, countdown.remainingSeconds ?? 0);
  return Math.max(0, Math.ceil((new Date(countdown.endsAt).getTime() - now) / 1000));
}

/** Name of a timer without one. */
export const COUNTDOWN_DEFAULT_NAME = 'Minuteur';

/**
 * Name of a timer, the same everywhere: its own, else « Minuteur ».
 * @param {{ label: string | null }} countdown Timer.
 * @returns {string} Name.
 */
export const countdownName = (countdown: { label: string | null }): string => countdown.label || COUNTDOWN_DEFAULT_NAME;

/**
 * What the ring of the end of a timer shows, in the app and pushed by the server: its name, then its item and
 * « Minuteur de 1 h 30 terminé ».
 * @param {{ label: string | null, subject: string | null, durationSeconds: number }} countdown Timer.
 * @returns {{ title: string, lines: string[] }} Title and lines.
 */
export function countdownRingText(countdown: { label: string | null; subject: string | null; durationSeconds: number }): { title: string; lines: string[] } {
  return {
    title: countdownName(countdown),
    lines: [countdown.subject, `Minuteur de ${formatDuration(countdown.durationSeconds)} terminé`].filter((line): line is string => Boolean(line)),
  };
}
