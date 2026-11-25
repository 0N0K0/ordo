import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';
import { unarchived } from '../../../lib/archive';

/**
 * Whether an element (task, routine) of a project is in the project tree of another one: tasks and routines are only
 * linked inside the same tree (those without project with those without project).
 * @param {Pick<TaskContext, 'rootOf'>} context Task context (its project trees).
 * @param {string | null} projectId Project of the element linked from (none: the elements of no project).
 * @returns {(otherProjectId: string | null) => boolean} Whether an element of a project is in its tree.
 */
export function inProjectTree(context: Pick<TaskContext, 'rootOf'>, projectId: string | null): (otherProjectId: string | null) => boolean {
  const root = context.rootOf(projectId);
  return (otherProjectId) => context.rootOf(otherProjectId) === root;
}

/**
 * Whether a task has links that a move to another project tree removes: its parent, its blocks and relations, its
 * milestone, its sprints, its documents of projects.
 * @param {Task} task Task.
 * @returns {boolean} It has some.
 */
export const hasTreeLinks = (task: Task): boolean =>
  task.parentId !== null ||
  task.blockingIds.length + task.blockedByIds.length + task.relatedIds.length > 0 ||
  task.milestoneId !== null ||
  task.sprintIds.length > 0 ||
  task.projectResourceIds.length > 0;

/**
 * Tasks that can be linked to a task (parent, blocks, related): same project tree, not itself.
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project of the task (none: the tasks of no project).
 * @param {string | null} taskId Task, or null for a new task.
 * @param {(candidate: Task) => boolean} [extra] Additional filter. Optional.
 * @returns {Task[]} Candidates.
 */
export function linkableTasks(context: TaskContext, projectId: string | null, taskId: string | null, extra?: (candidate: Task) => boolean): Task[] {
  const inTree = inProjectTree(context, projectId);
  return unarchived(context.tasks).filter((candidate) => candidate.id !== taskId && inTree(candidate.projectId) && (!extra || extra(candidate)));
}

/**
 * Sub-tasks of a task, at any depth.
 * @param {TaskContext} context Task context.
 * @param {string} taskId Task id.
 * @returns {Task[]} Sub-tasks.
 */
export function subtasksOf(context: TaskContext, taskId: string): Task[] {
  return context.childrenOf(taskId).flatMap((child) => [child, ...subtasksOf(context, child.id)]);
}

/**
 * Number of sub-tasks of a task, at any depth.
 * @param {TaskContext} context Task context.
 * @param {string} taskId Task id.
 * @returns {number} Count.
 */
export function countSubtasks(context: TaskContext, taskId: string): number {
  return subtasksOf(context, taskId).length;
}
