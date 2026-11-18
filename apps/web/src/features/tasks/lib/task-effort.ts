import type { TaskContext } from '../hooks/use-task-context';

/**
 * Effort a task counts for in a sum: its own without sub-tasks, none for a parent (its effort is its sub-tasks').
 * @param {{ id: string, effort?: number | null }} task Task.
 * @param {Pick<TaskContext, 'childrenOf'>} context Task context.
 * @returns {number} Effort.
 */
export function leafEffort(task: { id: string; effort?: number | null }, context: Pick<TaskContext, 'childrenOf'>): number {
  return context.childrenOf(task.id).length === 0 ? (task.effort ?? 0) : 0;
}
