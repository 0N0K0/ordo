import type { Task } from './api';
import type { TaskContext } from './use-task-context';

/**
 * Tasks that can be linked to a task (parent, blocks, related): same project tree, not itself.
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project of the task (none: the tasks of no project).
 * @param {string | null} taskId Task, or null for a new task.
 * @param {(candidate: Task) => boolean} [extra] Additional filter. Optional.
 * @returns {Task[]} Candidates.
 */
export function linkableTasks(
  context: TaskContext,
  projectId: string | null,
  taskId: string | null,
  extra?: (candidate: Task) => boolean,
): Task[] {
  const root = context.rootOf(projectId);
  return context.tasks.filter(
    (candidate) =>
      candidate.id !== taskId &&
      !candidate.archived &&
      context.rootOf(candidate.projectId) === root &&
      (!extra || extra(candidate)),
  );
}

/**
 * Ids of a task and all its sub-tasks (to exclude them from its parent candidates).
 * @param {TaskContext} context Task context.
 * @param {string} taskId Task id.
 * @returns {Set<string>} Ids.
 */
export function subtreeIds(context: TaskContext, taskId: string): Set<string> {
  const result = new Set([taskId]);
  const queue = [taskId];
  while (queue.length > 0) {
    for (const child of context.childrenOf(queue.shift()!)) {
      result.add(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

/**
 * Page of a task: the tasks tab of its project with the task open, or « Mes tâches » for a task of no project.
 * @param {{ id: string, projectId: string | null }} task Task.
 * @returns {string} Path.
 */
export const taskPath = (task: { id: string; projectId: string | null }) => (task.projectId ? `/projects/${task.projectId}?tab=tasks&task=${task.id}` : `/tasks?task=${task.id}`);
