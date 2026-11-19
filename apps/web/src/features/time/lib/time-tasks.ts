import { subtreeOf } from '@ordo/shared';

import type { Task } from '../../tasks/api';
import { closedMark, type TaskContext } from '../../tasks/hooks/use-task-context';
import type { TreeOption } from '../../../components/tree/tree-select';
import { unarchived } from '../../../lib/archive';

/**
 * Tasks time can be spent on in a project: those of the project, its sub-projects and of no project, not archived
 * (plus the `keep` ones, already linked), open tasks first. Without project: the tasks of no project (the API's rule).
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project, or null for a time without project.
 * @param {string[]} [keep] Tasks to keep even if archived or elsewhere. Optional.
 * @returns {Task[]} Tasks.
 */
export function timeTasks(context: TaskContext, projectId: string | null, keep: string[] = []): Task[] {
  const subtree = projectId ? subtreeOf(context.projects, projectId) : new Set<string>();
  return unarchived(context.tasks, keep)
    .filter((task) => keep.includes(task.id) || task.projectId === null || subtree.has(task.projectId))
    .sort((a, b) => Number(a.closed) - Number(b.closed));
}

/**
 * Options of the tasks of a time, the same in its form, its cell, its timer and an event: as their tree (sub-tasks
 * under their parent, under their project), the closed ones told.
 * @param {TaskContext} context Task context.
 * @param {Task[]} tasks Tasks offered (`timeTasks`).
 * @returns {TreeOption[]} Options (for `treeSelectProps`).
 */
export function timeTaskOptions(context: TaskContext, tasks: Task[]): TreeOption[] {
  return context.taskOptions(tasks).map((option) => {
    const task = context.taskById.get(option.value);
    return task?.closed ? { ...option, label: `${option.label}${closedMark(task)}` } : option;
  });
}
