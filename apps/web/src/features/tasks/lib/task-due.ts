import { hoursAllowDay, readTaskHours } from '@ordo/shared';

/** Why the real « Échéance » of a task differs from its own (the tooltip of `RealDueDate`). */
export const TASK_DUE_SHIFT_REASON = 'hors horaires';

/** Name of the warning of a task whose « Horaires » allow no day within a year before its « Échéance ». */
export const NO_TASK_DUE_DAY = 'Aucun jour possible selon ses horaires';

/**
 * Days the « Horaires » of a task exclude, greyed in its date pickers (still choosable); none without hours.
 * @param {{ hours?: unknown }} task Task (its hours as it goes by them).
 * @returns {((day: string) => boolean) | undefined} Whether a day is excluded.
 */
export function taskExcludedDay(task: { hours?: unknown }): ((day: string) => boolean) | undefined {
  const hours = readTaskHours(task.hours);
  return hours.length ? (day) => !hoursAllowDay(hours, day) : undefined;
}
