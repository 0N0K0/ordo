import type { TimeEntry } from '../api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';

/**
 * What a time was spent on, the same everywhere (agenda, header timer, timer card): its project, else its routine, its
 * event or its first task (a time has at least one of them, decision D17).
 * @param {Pick<TimeEntry, 'projectId' | 'routineLabel' | 'calendarEventLabel' | 'taskIds'>} entry Time.
 * @param {Pick<TaskContext, 'projectById' | 'taskById'> | null | undefined} context Task context (still loading: none).
 * @returns {string} Project, routine, event or task label (« Projet » / « Temps » when unknown).
 */
export function entrySubject(
  entry: Pick<TimeEntry, 'projectId' | 'routineLabel' | 'calendarEventLabel' | 'taskIds'>,
  context: Pick<TaskContext, 'projectById' | 'taskById'> | null | undefined,
): string {
  if (entry.projectId) return context?.projectById.get(entry.projectId)?.label ?? 'Projet';
  const task = entry.taskIds[0] ? context?.taskById.get(entry.taskIds[0]) : undefined;
  return entry.routineLabel ?? entry.calendarEventLabel ?? task?.label ?? 'Temps';
}
