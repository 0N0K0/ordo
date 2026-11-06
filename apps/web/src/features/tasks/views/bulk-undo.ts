import { notifyError, notifySuccess } from '../../../lib/notify';
import { useBulkTaskMutations, useSetTasksClosed, type BulkChanges, type Task } from '../api';

const SCALAR_FIELDS = ['statusId', 'priorityId', 'typeId', 'milestoneId', 'effort', 'startDate', 'endDate', 'deadline'] as const;

/**
 * Changes restoring tasks as they were before a bulk change, grouped by identical restoring changes.
 * @param {Task[]} tasks Tasks as they were before the change.
 * @param {BulkChanges} changes Applied change.
 * @returns {{ ids: string[], changes: BulkChanges }[]} Restoring changes.
 */
export function revertChanges(tasks: Task[], changes: BulkChanges): { ids: string[]; changes: BulkChanges }[] {
  const groups = new Map<string, { ids: string[]; changes: BulkChanges }>();
  for (const task of tasks) {
    const previous: BulkChanges = {};
    for (const field of SCALAR_FIELDS) {
      if (changes[field] !== undefined) Object.assign(previous, { [field]: task[field] });
    }
    // Only the assignees the change really added or removed are given back.
    const added = (changes.addAssigneeIds ?? []).filter((id) => !task.assigneeIds.includes(id));
    const removed = (changes.removeAssigneeIds ?? []).filter((id) => task.assigneeIds.includes(id));
    if (added.length) previous.removeAssigneeIds = added;
    if (removed.length) previous.addAssigneeIds = removed;
    const addedTags = (changes.addTagIds ?? []).filter((id) => !task.tagIds.includes(id));
    const removedTags = (changes.removeTagIds ?? []).filter((id) => task.tagIds.includes(id));
    if (addedTags.length) previous.removeTagIds = addedTags;
    if (removedTags.length) previous.addTagIds = removedTags;
    const addedSprints = (changes.addSprintIds ?? []).filter((id) => !task.sprintIds.includes(id));
    const removedSprints = (changes.removeSprintIds ?? []).filter((id) => task.sprintIds.includes(id));
    if (addedSprints.length) previous.removeSprintIds = addedSprints;
    if (removedSprints.length) previous.addSprintIds = removedSprints;
    if (Object.keys(previous).length === 0) continue;
    const key = JSON.stringify(previous);
    const group = groups.get(key) ?? { ids: [], changes: previous };
    group.ids.push(task.id);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/**
 * Groups task ids by a key.
 * @param {Task[]} tasks Tasks.
 * @param {(task: Task) => string} keyOf Key of a task.
 * @returns {[string, string[]][]} Ids by key.
 */
function groupBy(tasks: Task[], keyOf: (task: Task) => string): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const task of tasks) groups.set(keyOf(task), [...(groups.get(keyOf(task)) ?? []), task.id]);
  return [...groups.entries()];
}

/**
 * Reverts bulk actions from the snapshot of the tasks taken before them ("Annuler" of the toasts).
 * Each method returns the undo callback of one action.
 * @returns {object} Undo builders.
 */
export function useBulkUndo() {
  const { update, archive, transfer } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();

  /**
   * Runs the restoring steps one after the other.
   * @param {(() => Promise<unknown>)[]} steps Steps.
   * @returns {Promise<void>}
   */
  const run = async (steps: (() => Promise<unknown>)[]) => {
    try {
      for (const step of steps) await step();
      notifySuccess('Action annulée.');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'L’action n’a pas pu être annulée.');
    }
  };

  return {
    /**
     * Undo of a field change.
     * @param {Task[]} tasks Tasks before the change.
     * @param {BulkChanges} changes Applied change.
     * @returns {() => void} Undo.
     */
    changes: (tasks: Task[], changes: BulkChanges) => () =>
      run(revertChanges(tasks, changes).map((step) => () => update.mutateAsync(step))),

    /**
     * Undo of a close / reopen: only the tasks whose state changed go back.
     * @param {Task[]} tasks Tasks before the change.
     * @param {boolean} closed Applied state.
     * @returns {() => void} Undo.
     */
    closed: (tasks: Task[], closed: boolean) => () => {
      const ids = tasks.filter((task) => task.closed !== closed).map((task) => task.id);
      return run(ids.length ? [() => setClosed.mutateAsync({ ids, closed: !closed })] : []);
    },

    /**
     * Undo of an archive / restore: only the tasks whose state changed go back (with the usual cascade).
     * @param {Task[]} tasks Tasks before the change.
     * @param {boolean} archived Applied state.
     * @returns {() => void} Undo.
     */
    archived: (tasks: Task[], archived: boolean) => () => {
      const ids = tasks.filter((task) => task.archived !== archived).map((task) => task.id);
      return run(ids.length ? [() => archive.mutateAsync({ ids, archived: !archived })] : []);
    },

    /**
     * Undo of a transfer: tasks go back to their project level by level (a transfer moves the sub-tasks
     * along, deeper ones are then put back in their own project).
     * @param {Task[][]} levels Moved tasks, then their sub-tasks level by level, before the transfer.
     * @returns {() => void} Undo.
     */
    transfer: (levels: Task[][]) => () =>
      run(
        levels.flatMap((level) =>
          groupBy(level, (task) => task.projectId).map(([projectId, ids]) => () => transfer.mutateAsync({ ids, projectId })),
        ),
      ),
  };
}
