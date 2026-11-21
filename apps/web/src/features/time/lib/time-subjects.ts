import type { TimeEntry, TimeEntryValues } from '../api';
import { entryEventKeys, parseEventKeys } from './time-events';

/** What a time is spent on besides its project: several routines, tasks and events. */
export type TimeSubjectKind = 'routines' | 'tasks' | 'events';

/** How each kind of subject is read from a time and written back to the API. */
interface TimeSubject {
  /** Ids of the time (event occurrence keys for the events). */
  ids: (entry: Pick<TimeEntry, 'routines' | 'taskIds' | 'events'>) => string[];
  /** Change of the time for new ids. */
  change: (ids: string[]) => Partial<TimeEntryValues>;
}

/** The three kinds of subjects of a time, the one place that tells how each is stored. */
export const TIME_SUBJECTS: Record<TimeSubjectKind, TimeSubject> = {
  routines: { ids: (entry) => entry.routines.map((routine) => routine.id), change: (ids) => ({ routineIds: ids }) },
  tasks: { ids: (entry) => entry.taskIds, change: (ids) => ({ taskIds: ids }) },
  events: { ids: entryEventKeys, change: (keys) => ({ events: parseEventKeys(keys) }) },
};

/**
 * Whether a time keeps something besides its project: a routine, a task or an event (a time has at least a project,
 * a task, a routine or an event).
 * @param {Pick<TimeEntry, 'routines' | 'taskIds' | 'events'>} entry Time.
 * @returns {boolean} It has one.
 */
// eslint-disable-next-line no-restricted-syntax -- hasSubject itself.
export const hasSubject = (entry: Pick<TimeEntry, 'routines' | 'taskIds' | 'events'>): boolean => entry.routines.length > 0 || entry.taskIds.length > 0 || entry.events.length > 0;
