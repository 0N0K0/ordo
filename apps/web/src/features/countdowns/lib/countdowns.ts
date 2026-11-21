import { COUNTDOWN_DEFAULT_NAME, countdownName, formatDuration, type DeadTime } from '@ordo/shared';
import type { Countdown } from '../api';

/**
 * Words and links of the timers (« minuteurs ») and dead times (« temps morts »).
 */

/** Name of a timer (« Minuteur » without one): the shared bricks. */
export { COUNTDOWN_DEFAULT_NAME, countdownName };

/** Item a dead time belongs to, as a timer launched for it keeps it (the timer is the user's: ids and names only). */
export interface DeadTimeItem {
  taskId?: string;
  routineId?: string;
  /** Occurrence of the routine. */
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
 * Label of a dead time: « Lave-linge (1 h 30) ».
 * @param {Pick<DeadTime, 'label' | 'minutes'>} deadTime Dead time.
 * @returns {string} Label.
 */
export const deadTimeLabel = (deadTime: Pick<DeadTime, 'label' | 'minutes'>): string => `${deadTime.label} (${formatDuration(deadTime.minutes * 60)})`;

/**
 * Whether a timer was launched for an item (a task, or a routine and its occurrence when given).
 * @param {Countdown} countdown Timer.
 * @param {Pick<DeadTimeItem, 'taskId' | 'routineId' | 'occurrenceDate'>} item Item.
 * @returns {boolean} Launched for it.
 */
export function countdownOf(countdown: Countdown, item: Pick<DeadTimeItem, 'taskId' | 'routineId' | 'occurrenceDate'>): boolean {
  if (item.taskId) return countdown.taskId === item.taskId;
  if (!item.routineId || countdown.routineId !== item.routineId) return false;
  return !item.occurrenceDate || countdown.occurrenceDate === item.occurrenceDate;
}
