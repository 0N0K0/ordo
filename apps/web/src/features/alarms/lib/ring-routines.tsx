import { routineRings, type RemindedRoutine as SharedRemindedRoutine } from '@ordo/shared';
import { CheckCircleIcon } from '@phosphor-icons/react';
import type { Routine } from '../../routines/api';
import { ringPlannedReminders, type RingLink, type RingWorkspace } from '../components/ring';

/** What the reminders of a routine are rung from (a routine of the open workspace or of another one). */
export type RemindedRoutine = Pick<Routine, 'id' | 'label' | 'archived' | 'location' | 'currentDate' | 'reminders' | 'reminderOccurrences' | 'slots'> & SharedRemindedRoutine;

/**
 * Rings the reminders of the routines (decision D16; `routineRings`), for the occurrences the API gives: each « N min
 * avant » before each time of the day not ticked (from its start or its end, decision FS), each « À HH:MM » once per
 * occurrence. Missed ones, within a few hours, ring on opening. An archived routine has none. The toast offers to tick
 * the routine (its current occurrence). Out of the slots of the routine (its slot rule), a reminder waits for the next
 * moment they allow.
 * @template {RemindedRoutine} R
 * @param {R[]} routines Routines.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Routines page.
 * @param {(routine: R, slot: number) => void} [markDone] Ticks a routine (its time of the day) from its toast. Optional. Default = no action.
 * @param {(routine: R, at: Date) => Date | null} [defer] First moment from a reminder on its slots allow, null: none soon. Optional.
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringRoutineReminders<R extends RemindedRoutine>(
  routines: R[],
  now: Date,
  links: RingLink[],
  markDone?: (routine: R, slot: number) => void,
  defer?: (routine: R, at: Date) => Date | null,
  workspace?: RingWorkspace,
): void {
  ringPlannedReminders(
    routineRings(routines, defer),
    now,
    // Only the current occurrence can be ticked (the next one has not started).
    ({ routine, slot, current }) => [...(current && markDone ? [{ label: 'Marquer comme faite', icon: <CheckCircleIcon aria-hidden />, onClick: () => markDone(routine, slot) }] : []), ...links],
    workspace,
  );
}
