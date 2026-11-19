import type { TimeEntry } from '../api';
import type { TaskContext } from '../../tasks/hooks/use-task-context';

/**
 * What a time was spent on, the same everywhere (agenda, header timer, timer card): its project, or its routine.
 * @param {Pick<TimeEntry, 'projectId' | 'routineLabel'>} entry Time.
 * @param {Pick<TaskContext, 'projectById'> | null | undefined} context Task context (still loading: none).
 * @returns {string} Project or routine label (« Projet » / « Routine » when unknown).
 */
export function entrySubject(entry: Pick<TimeEntry, 'projectId' | 'routineLabel'>, context: Pick<TaskContext, 'projectById'> | null | undefined): string {
  if (entry.projectId) return context?.projectById.get(entry.projectId)?.label ?? 'Projet';
  // eslint-disable-next-line no-restricted-syntax -- entrySubject itself.
  return entry.routineLabel ?? 'Routine';
}
