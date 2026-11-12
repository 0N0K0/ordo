import { notifications } from '@mantine/notifications';
import { routineAlertTime } from '@ordo/shared';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { localToday } from '../../lib/dates';
import type { Routine } from '../routines/api';
import { isDone } from '../routines/routine-format';
import { playChime } from './alarm-sound';
import { claim, MAX_DELAY_MS, systemNotification, toastBody, type RingLink } from './ring';

/**
 * Rings the alerts of the routines due today and not ticked yet, at their minutes before their moment (when to leave,
 * else the start of their window, else their latest time); missed ones, within a few hours, ring on opening. The toast
 * offers to tick the routine.
 * @param {Routine[]} routines Routines.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Routines page.
 * @param {(routine: Routine) => void} markDone Ticks a routine from its toast.
 * @returns {void}
 */
export function ringRoutineReminders(routines: Routine[], now: Date, links: RingLink[], markDone: (routine: Routine) => void): void {
  const today = localToday();
  for (const routine of routines) {
    if (routine.archived || routine.currentDate !== today || isDone(routine) || routine.reminders.length === 0) continue;
    const moment = routineAlertTime({ ...routine, fromTime: routine.windowFrom, dueTime: routine.windowTo });
    if (!moment) continue;
    const base = new Date(`${today}T${moment}:00`).getTime();
    for (const minutes of routine.reminders) {
      const at = base - minutes * 60_000;
      if (now.getTime() < at || now.getTime() - at > MAX_DELAY_MS) continue;
      const key = `ordo.alarm.routine:${routine.id}:${today}:${minutes}`;
      if (!claim(key, MAX_DELAY_MS + 3600_000)) continue;
      playChime();
      const when = [
        routine.windowFrom && routine.windowTo ? `${routine.windowFrom}–${routine.windowTo}` : routine.windowTo ? `avant ${routine.windowTo}` : routine.windowFrom && `dès ${routine.windowFrom}`,
        routine.location,
      ]
        .filter(Boolean)
        .join(' · ');
      const lines = [moment !== routine.windowFrom && moment !== routine.windowTo ? `Partir à ${moment}` : null, when];
      systemNotification(routine.title, lines.filter(Boolean).join(' · ') || undefined, key);
      notifications.show({
        id: key,
        color: 'teal',
        icon: <ArrowsClockwiseIcon />,
        title: routine.title,
        autoClose: false,
        message: toastBody(lines, [
          {
            label: 'Marquer comme faite',
            onClick: () => {
              notifications.hide(key);
              markDone(routine);
            },
          },
          ...links,
        ]),
      });
    }
  }
}
