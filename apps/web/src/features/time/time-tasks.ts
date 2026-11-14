import { descendantIds } from '../workspace/api';
import type { Task } from '../tasks/api';
import type { TaskContext } from '../tasks/use-task-context';

/**
 * Tasks time can be spent on in a project: those of the project and its sub-projects, not archived
 * (plus the `keep` ones, already linked), open tasks first.
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project.
 * @param {string[]} [keep] Tasks to keep even if archived or elsewhere. Optional.
 * @returns {Task[]} Tasks.
 */
export function timeTasks(context: TaskContext, projectId: string | null, keep: string[] = []): Task[] {
  if (!projectId) return [];
  const subtree = descendantIds(context.projects, projectId);
  subtree.add(projectId);
  return context.tasks
    .filter((task) => keep.includes(task.id) || ((task.projectId === null || subtree.has(task.projectId)) && !task.archived))
    .sort((a, b) => Number(a.closed) - Number(b.closed));
}
