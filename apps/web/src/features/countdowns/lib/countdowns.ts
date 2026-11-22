import { COUNTDOWN_DEFAULT_NAME, countdownName, formatDuration, type CountdownInput, type DeadTime } from '@ordo/shared';
import type { Countdown } from '../api';

/**
 * Words and links of the timers (« minuteurs »), the dead times (« temps morts ») and the saved timers (« minuteurs
 * enregistrés »).
 */

/** Name of a timer (« Minuteur » without one): the shared bricks. */
export { COUNTDOWN_DEFAULT_NAME, countdownName };

/**
 * Item a timer is launched for (a dead time, a saved timer), as the timer keeps it (the timer is the user's: ids and
 * names only): a task, a routine and its occurrence, an event (and its occurrence when recurring), a sheet.
 */
export interface CountdownItem {
  taskId?: string;
  routineId?: string;
  eventId?: string;
  sheetId?: string;
  /** Occurrence of the routine, or of the recurring event. */
  occurrenceDate?: string | null;
  /** Name of the item (« Lessive »). */
  subject: string;
  /** Page of the app the ring links to, and its label. */
  path: string;
  linkLabel: string;
  /** Its workspace. */
  workspaceId?: string | null;
}

/**
 * Label of a dead time or a saved timer: « Lave-linge (1 h 30) ».
 * @param {Pick<DeadTime, 'label' | 'minutes'>} timer Dead time or saved timer.
 * @returns {string} Label.
 */
export const timerLabel = (timer: Pick<DeadTime, 'label' | 'minutes'>): string => `${timer.label} (${formatDuration(timer.minutes * 60)})`;

/**
 * Toast of a timer started: « Minuteur lancé : 10 min. ».
 * @param {number} seconds Its duration.
 * @returns {string} Message.
 */
export const countdownStartedMessage = (seconds: number): string => `Minuteur lancé : ${formatDuration(seconds)}.`;

/**
 * What a timer started for an item keeps of it (its ids, name, link, workspace).
 * @param {CountdownItem} item Item.
 * @param {string | null | undefined} workspaceId Workspace open (when the item does not tell its own).
 * @returns {Partial<CountdownInput>} Fields of the timer.
 */
export const countdownItemInput = (item: CountdownItem, workspaceId: string | null | undefined): Partial<CountdownInput> => ({
  taskId: item.taskId,
  routineId: item.routineId,
  eventId: item.eventId,
  sheetId: item.sheetId,
  occurrenceDate: item.occurrenceDate,
  subject: item.subject,
  path: item.path,
  linkLabel: item.linkLabel,
  workspaceId: item.workspaceId ?? workspaceId,
});

/**
 * Whether a timer was launched for an item (a task, a sheet; a routine or an event and its occurrence when given).
 * @param {Countdown} countdown Timer.
 * @param {Pick<CountdownItem, 'taskId' | 'routineId' | 'eventId' | 'sheetId' | 'occurrenceDate'>} item Item.
 * @returns {boolean} Launched for it.
 */
export function countdownOf(countdown: Countdown, item: Pick<CountdownItem, 'taskId' | 'routineId' | 'eventId' | 'sheetId' | 'occurrenceDate'>): boolean {
  if (item.taskId) return countdown.taskId === item.taskId;
  if (item.sheetId) return countdown.sheetId === item.sheetId;
  const sameItem = item.routineId ? countdown.routineId === item.routineId : Boolean(item.eventId) && countdown.eventId === item.eventId;
  return sameItem && (!item.occurrenceDate || countdown.occurrenceDate === item.occurrenceDate);
}
