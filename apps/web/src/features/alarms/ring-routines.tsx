import { routineAlertTime } from '@ordo/shared';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { localToday } from '../../lib/dates';
import type { Routine } from '../routines/api';
import { isDone, windowText } from '../routines/routine-format';
import { playChime } from './alarm-sound';
import { notifyInfo } from '../../lib/notify';
import { claim, MAX_DELAY_MS, systemNotification, type RingLink } from './ring';

/**
 * Rings the alerts of the routines due today and not ticked yet, for each of their times of the day not ticked, at their
 * minutes before its moment (when to leave, else the start of its window, else its latest time); missed ones, within a few hours, ring on opening. The toast
 * offers to tick the routine. Out of the slots of the routine (its slot rule), an alert waits for the next moment they allow.
 * @param {Routine[]} routines Routines.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Routines page.
 * @param {(routine: Routine, slot: number) => void} markDone Ticks a routine (its time of the day) from its toast.
 * @param {(routine: Routine, at: Date) => Date | null} [defer] First moment from an alert on its slots allow, null: none soon. Optional.
 * @returns {void}
 */
export function ringRoutineReminders(routines: Routine[], now: Date, links: RingLink[], markDone: (routine: Routine, slot: number) => void, defer?: (routine: Routine, at: Date) => Date | null): void {
  const today = localToday();
  for (const routine of routines) {
    if (routine.archived || routine.currentDate !== today || isDone(routine) || routine.reminders.length === 0) continue;
    // Each time of the day not ticked yet (or the routine's single one) rings from its own moment.
    const slots = routine.slots.length ? routine.slots : [{ index: 0, fromTime: routine.windowFrom, dueTime: routine.windowTo, optional: false, done: false }];
    for (const slot of slots) {
      if (slot.done) continue;
      const moment = routineAlertTime({ ...routine, fromTime: slot.fromTime, dueTime: slot.dueTime });
      if (!moment) continue;
      const base = new Date(`${today}T${moment}:00`).getTime();
      for (const minutes of routine.reminders) {
        const planned = base - minutes * 60_000;
        const at = defer ? (defer(routine, new Date(planned))?.getTime() ?? null) : planned;
        if (at === null) continue;
        if (now.getTime() < at || now.getTime() - at > MAX_DELAY_MS) continue;
        const key = `ordo.alarm.routine:${routine.id}:${today}:${slot.index}:${minutes}`;
        if (!claim(key, MAX_DELAY_MS + 3600_000)) continue;
        playChime();
        const when = [windowText(slot), routine.location].filter(Boolean).join(' · ');
        const lines = [moment !== slot.fromTime && moment !== slot.dueTime ? `Partir à ${moment}` : null, when];
        systemNotification(routine.title, lines.filter(Boolean).join(' · ') || undefined, key);
        notifyInfo({ id: key, icon: <ArrowsClockwiseIcon />, title: routine.title, lines, actions: [{ label: 'Marquer comme faite', onClick: () => markDone(routine, slot.index) }, ...links] });
      }
    }
  }
}
