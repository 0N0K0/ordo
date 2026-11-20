import { subtreeOf } from '@ordo/shared';

import type { Task } from '../../tasks/api';
import type { Routine } from '../../routines/api';
import { closedMark, type TaskContext } from '../../tasks/hooks/use-task-context';
import type { TreeOption } from '../../../components/tree/tree-select';
import { unarchived } from '../../../lib/archive';
import { routineTreeOptions } from '../../routines/lib/routine-format';

/**
 * Whether an item (task, routine) goes with the project of a time: of the project, of one of its sub-projects, or of
 * no project; without project, only those of no project (the API's rule). The `keep` ones, already linked, always do.
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project, or null for a time without project.
 * @param {readonly string[]} keep Items kept even if elsewhere.
 * @returns {(item: { id: string, projectId?: string | null }) => boolean} Predicate.
 */
function inTimeProject(context: TaskContext, projectId: string | null, keep: readonly string[]): (item: { id: string; projectId?: string | null }) => boolean {
  const subtree = projectId ? subtreeOf(context.projects, projectId) : new Set<string>();
  return (item) => keep.includes(item.id) || !item.projectId || subtree.has(item.projectId);
}

/**
 * Tasks time can be spent on in a project: those of the project, its sub-projects and of no project, not archived
 * (plus the `keep` ones, already linked), open tasks first. Without project: the tasks of no project (the API's rule).
 * @param {TaskContext} context Task context.
 * @param {string | null} projectId Project, or null for a time without project.
 * @param {string[]} [keep] Tasks to keep even if archived or elsewhere. Optional.
 * @returns {Task[]} Tasks.
 */
export function timeTasks(context: TaskContext, projectId: string | null, keep: string[] = []): Task[] {
  return unarchived(context.tasks, keep)
    .filter(inTimeProject(context, projectId, keep))
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

/**
 * Options of the routines time can be spent on, as their tree, with the rule of the tasks: of the project, its
 * sub-projects and of no project, not archived (plus the `keep` ones, already linked); without project, those of no
 * project (decision D18).
 * @param {TaskContext} context Task context.
 * @param {readonly Routine[]} routines Every routine.
 * @param {string | null} projectId Project, or null for a time without project.
 * @param {string[]} [keep] Routines to keep even if archived or elsewhere. Optional.
 * @returns {TreeOption[]} Options (for `treeSelectProps`).
 */
export function timeRoutineOptions(context: TaskContext, routines: readonly Routine[], projectId: string | null, keep: string[] = []): TreeOption[] {
  const offered = new Set(
    unarchived(routines, keep)
      .filter(inTimeProject(context, projectId, keep))
      .map((routine) => routine.id),
  );
  return routineTreeOptions(routines, (routine) => offered.has(routine.id));
}
