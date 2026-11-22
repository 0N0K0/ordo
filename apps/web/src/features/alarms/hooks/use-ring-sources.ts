import { useCallback, useMemo } from 'react';
import { useBirthdays, useReminderOccurrences, useWorkSchedules } from '../../calendar/api';
import { routineDoable, useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { useCountdowns } from '../../countdowns/api';
import { useProjectTree } from '../../projects/api';
import { useRoutinesData, type Routine } from '../../routines/api';
import { useTasksData } from '../../tasks/api';
import { useRunningTimers } from '../../time/api';
import { useAlarms } from '../api';
import { nextRingAt } from '../lib/next-ring';
import { useNow } from '../../../lib/use-now';

/**
 * What the alarm center rings from (alarm center, navigation badge « Alarmes »): the alarms, the running timers, the
 * tasks, projects and routines, the reminders of the events of the next days, the éphémérides, the birthdays and the
 * timers of the user; with when a reminder of a routine may ring out of its slots.
 * @returns {object} Data of the queries (undefined while loading) and `deferRoutine`.
 */
export function useRingSources() {
  const { data: alarms } = useAlarms();
  const { data: running } = useRunningTimers();
  const { data: tasksData } = useTasksData();
  const { data: workspace } = useProjectTree();
  const { data: routinesData } = useRoutinesData();
  const slotRules = useSlotRules();
  const { data: schedules } = useWorkSchedules();
  const { data: birthdays } = useBirthdays();
  const { data: occurrences } = useReminderOccurrences();
  const { data: countdowns } = useCountdowns();
  const { nextAllowedAt } = slotRules;
  const deferRoutine = useCallback((routine: Pick<Routine, 'id' | 'assigneeIds'>, at: Date) => nextAllowedAt(routineDoable(routine), at), [nextAllowedAt]);
  return { alarms, running, tasksData, workspace, routinesData, schedules, birthdays, occurrences, countdowns, deferRoutine };
}

/**
 * Next ring after now of the workspace open (`nextRingAt` on `useRingSources`), refreshed every minute.
 * @returns {{ at: Date | null, now: number }} Instant (null: nothing planned) and the moment it was computed at.
 */
export function useNextRing(): { at: Date | null; now: number } {
  const { alarms, running, tasksData, workspace, routinesData, schedules, birthdays, occurrences, countdowns, deferRoutine } = useRingSources();
  const now = useNow(true, 60_000);
  const at = useMemo(
    () =>
      nextRingAt(
        {
          alarms,
          running,
          projects: workspace?.projects ?? [],
          tasks: tasksData?.tasks ?? [],
          routines: routinesData?.routines ?? [],
          deferRoutine,
          occurrences: occurrences ?? [],
          schedules: schedules ?? [],
          birthdays: birthdays ?? [],
          countdowns: countdowns ?? [],
        },
        new Date(now),
      ),
    [alarms, running, workspace, tasksData, routinesData, deferRoutine, occurrences, schedules, birthdays, countdowns, now],
  );
  return { at, now };
}
