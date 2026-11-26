import type { UpcomingDue, UpcomingReminderKind } from '@ordo/shared';
import * as fmt from '../../../lib/format';

/** Name of each kind of item a reminder to come belongs to (the accessible name of its icon, `ringIcon`). */
export const UPCOMING_KIND_LABELS: Record<UpcomingReminderKind, string> = { event: 'Évènement', task: 'Tâche', routine: 'Routine' };

/**
 * Day of the occurrence of a reminder to come: « Début : ven. 13 nov., 14:05 » for an event (its start), « Échéance :
 * ven. 13 nov. » for a task or a routine.
 * @param {UpcomingDue | null} due Day and time.
 * @param {UpcomingReminderKind} kind Kind of the item.
 * @returns {string | null} Text, null without one.
 */
export const upcomingDueText = (due: UpcomingDue | null, kind: UpcomingReminderKind): string | null =>
  due ? `${kind === 'event' ? 'Début' : 'Échéance'} : ${fmt.weekday(due.day)}${due.time ? `, ${due.time}` : ''}` : null;
