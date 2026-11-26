import type { UpcomingDue, UpcomingReminderKind } from '@ordo/shared';
import * as fmt from '../../../lib/format';

/** Name of each kind of item a reminder to come belongs to (the accessible name of its icon, `ringIcon`). */
export const UPCOMING_KIND_LABELS: Record<UpcomingReminderKind, string> = { event: 'Évènement', task: 'Tâche', routine: 'Routine' };

/**
 * Due day of the occurrence of a reminder to come (the start of an event): « Échéance : ven. 13 nov., 14:05 ».
 * @param {UpcomingDue | null} due Due day and time.
 * @returns {string | null} Text, null without one.
 */
export const upcomingDueText = (due: UpcomingDue | null): string | null => (due ? `Échéance : ${fmt.weekday(due.day)}${due.time ? `, ${due.time}` : ''}` : null);
