import { occurrenceKey, remindersAt, remindersBefore } from '@ordo/shared';
import { ArrowsClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react';
import type { Routine } from '../../routines/api';
import { windowText } from '../../routines/lib/routine-format';
import { ringPlannedReminders, type RingLink } from '../components/ring';
import { taggedKey } from '../../../lib/tagged-key';

/** What the reminders of a routine are rung from (a routine of the open workspace or of another one). */
export type RemindedRoutine = Pick<Routine, 'id' | 'label' | 'archived' | 'location' | 'currentDate' | 'reminders' | 'reminderOccurrences' | 'slots'>;

/**
 * Rings the reminders of the routines (decision D16), for the occurrences the API gives (`reminderOccurrences`: the
 * current one while not done, and the next one): each « N min avant » before each time of the day not ticked (its first
 * day, « à partir du », at its « dès »), each « À HH:MM » once per occurrence, on its first day. Missed ones, within a
 * few hours, ring on opening. An archived routine has none. The toast offers to tick the routine (its current
 * occurrence). Out of the slots of the routine (its slot rule), a reminder waits for the next moment they allow.
 * @template {RemindedRoutine} R
 * @param {R[]} routines Routines.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Routines page.
 * @param {(routine: R, slot: number) => void} [markDone] Ticks a routine (its time of the day) from its toast. Optional. Default = no action.
 * @param {(routine: R, at: Date) => Date | null} [defer] First moment from a reminder on its slots allow, null: none soon. Optional.
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringRoutineReminders<R extends RemindedRoutine>(
  routines: R[],
  now: Date,
  links: RingLink[],
  markDone?: (routine: R, slot: number) => void,
  defer?: (routine: R, at: Date) => Date | null,
  workspaceLabel?: string,
): void {
  for (const routine of routines) {
    if (routine.archived || routine.reminders.length === 0) continue;
    for (const occurrence of routine.reminderOccurrences) {
      const key = taggedKey('routine', occurrenceKey(routine.id, occurrence.date));
      // « N min avant » for each time of the day not ticked, « À HH:MM » once for the occurrence.
      const planned = [
        ...occurrence.slots.flatMap((slot) => remindersBefore(`${key}:${slot.slot}`, new Date(slot.at), routine.reminders).map((reminder) => ({ ...reminder, slot: slot.slot }))),
        ...remindersAt(key, occurrence.day, routine.reminders).map((reminder) => ({ ...reminder, slot: occurrence.slots[0]?.slot ?? 0 })),
      ].flatMap((reminder) => {
        const at = defer ? defer(routine, reminder.at) : reminder.at;
        return at ? [{ ...reminder, at }] : [];
      });
      const current = routine.currentDate === occurrence.date;
      ringPlannedReminders(
        planned,
        now,
        ({ slot: index }) => {
          const slot = routine.slots.find((item) => item.index === index);
          return {
            icon: <ArrowsClockwiseIcon />,
            title: routine.label,
            lines: [[slot && windowText(slot), routine.location].filter(Boolean).join(' · ')],
            // Only the current occurrence can be ticked (the next one has not started).
            actions: [...(current && markDone ? [{ label: 'Marquer comme faite', icon: <CheckCircleIcon aria-hidden />, onClick: () => markDone(routine, index) }] : []), ...links],
          };
        },
        workspaceLabel,
      );
    }
  }
}
