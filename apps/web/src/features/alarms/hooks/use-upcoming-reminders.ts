import { useMemo } from 'react';
import { REMINDER_LOOKAHEAD_DAYS, reminderDayRange, UPCOMING_REMINDER_DAYS, upcomingReminders, type UpcomingReminder } from '@ordo/shared';
import { useCalendarEvents, type EventOccurrence } from '../../calendar/api';
import type { Routine } from '../../routines/api';
import type { Task } from '../../tasks/api';
import { useNow } from '../../../lib/use-now';
import { useRingSources } from './use-ring-sources';

/** A reminder to come of the workspace open: of an event occurrence, a task or a routine. */
export type UpcomingItemReminder = UpcomingReminder<EventOccurrence, Task, Routine>;

/**
 * What the reminders to come are read from: the event occurrences from yesterday to the 30 days plus the most days a
 * reminder rings before (the same query key all day long), the tasks and the routines of `useRingSources` with when a
 * reminder of a routine rings out of its slots (`deferRoutine`), and now (refreshed every minute).
 * @returns {object} Occurrences, tasks and routines data (undefined while loading), `deferRoutine`, `now`, and whether a query failed.
 */
export function useUpcomingSources() {
  const now = useNow(true, 60_000);
  const { tasksData, routinesData, deferRoutine } = useRingSources();
  const { from, to } = reminderDayRange(new Date(now), UPCOMING_REMINDER_DAYS + REMINDER_LOOKAHEAD_DAYS);
  const range = useMemo(() => ({ from, to }), [from, to]);
  const { data: occurrences, isError } = useCalendarEvents(range);
  return { occurrences, tasksData, routinesData, deferRoutine, now, isError };
}

/**
 * Reminders to come of the workspace open (`upcomingReminders`, the column « Rappels à venir »): for each event, task
 * and routine, those of its next occurrence that ring within 30 days, the soonest first; the routines moved to their
 * next free moment as they ring (`deferRoutine`).
 * @returns {{ reminders: UpcomingItemReminder[], isPending: boolean, isError: boolean }} Reminders, whether their data is loading, whether the occurrences failed to load.
 */
export function useUpcomingReminders(): { reminders: UpcomingItemReminder[]; isPending: boolean; isError: boolean } {
  const { occurrences, tasksData, routinesData, deferRoutine, now, isError } = useUpcomingSources();
  const reminders = useMemo(
    () =>
      occurrences && tasksData && routinesData
        ? upcomingReminders({ occurrences, tasks: tasksData.tasks, routines: routinesData.routines, deferRoutine }, new Date(now))
        : [],
    [occurrences, tasksData, routinesData, deferRoutine, now],
  );
  return { reminders, isPending: !occurrences || !tasksData || !routinesData, isError };
}
