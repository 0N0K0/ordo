import type { TimeEntry } from '../api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';

/**
 * What a time was spent on, the same everywhere (agenda, header timer, timer card): its project, else its first
 * routine, its first event or its first task (a time has at least one of them, decision D17), « + N » telling the
 * other routines, events and tasks of a time without project (several of each, decision D18).
 * @param {Pick<TimeEntry, 'projectId' | 'routines' | 'events' | 'taskIds'>} entry Time.
 * @param {Pick<TaskContext, 'projectById' | 'taskById'> | null | undefined} context Task context (still loading: none).
 * @returns {string} Project, routine, event or task label (« Projet » / « Temps » when unknown).
 */
export function entrySubject(entry: Pick<TimeEntry, 'projectId' | 'routines' | 'events' | 'taskIds'>, context: Pick<TaskContext, 'projectById' | 'taskById'> | null | undefined): string {
  if (entry.projectId) return context?.projectById.get(entry.projectId)?.label ?? 'Projet';
  const task = entry.taskIds[0] ? context?.taskById.get(entry.taskIds[0]) : undefined;
  const first = entry.routines[0]?.label ?? entry.events[0]?.label ?? task?.label ?? 'Temps';
  const others = entry.routines.length + entry.events.length + entry.taskIds.length - 1;
  return others > 0 ? `${first} + ${others}` : first;
}
