import type { TaskContext } from '../../tasks/hooks/use-task-context';
import type { TimeEntry, TimerStartValues } from '../../time/api';
import { timeTasks } from '../../time/lib/time-tasks';

/** Occurrence of an event a timer is on. */
export interface EventTimerTarget {
  eventId: string;
  /** Occurrence in its series (null: a single event). */
  occurrenceDate: string | null;
}

/**
 * Timer started on an occurrence of an event: on its project and those of its tasks a time on that project takes (the
 * API's rule: the project, its sub-projects, tasks without project; without project, only those), named after it.
 * @param {TaskContext} context Task context.
 * @param {{ projectId?: string | null, taskIds?: string[] | null, label: string }} fields Fields of the event.
 * @param {EventTimerTarget} target Occurrence.
 * @returns {TimerStartValues} Timer input.
 */
export function eventTimerInput(context: TaskContext, fields: { projectId?: string | null; taskIds?: string[] | null; label: string }, target: EventTimerTarget): TimerStartValues {
  const projectId = fields.projectId ?? null;
  const timerTasks = new Set(timeTasks(context, projectId).map((task) => task.id));
  return { projectId, taskIds: (fields.taskIds ?? []).filter((id) => timerTasks.has(id)), description: fields.label, events: [{ eventId: target.eventId, occurrenceDate: target.occurrenceDate }] };
}

/**
 * Whether a time is on an occurrence of an event (its timer running there).
 * @param {EventTimerTarget} target Occurrence.
 * @returns {(entry: TimeEntry) => boolean} Predicate.
 */
export const onEventOccurrence =
  (target: EventTimerTarget) =>
  (entry: TimeEntry): boolean =>
    (entry.events ?? []).some((event) => event.eventId === target.eventId && event.occurrenceDate === target.occurrenceDate);
