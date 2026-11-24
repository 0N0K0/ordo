import { outermost } from '../../../components/data-table/selection/selection-actions';
import { notifyWithUndo, onMutationError } from '../../../lib/notify';
import { removedLinksNote } from '../../../lib/text';
import { useBulkTaskMutations, type Task } from '../api';
import { useBulkUndo } from '../lib/bulk-undo';
import type { TaskContext } from './use-task-context';

/**
 * Transfer of tasks with their sub-tasks to another project, or out of any: the one way tasks change project (the
 * « Transférer » dialog, the « Projet » cell, the task panel). Its toast tells the links removed and has « Annuler »
 * (`useBulkUndo().transfer`: tasks and links put back, all or nothing).
 * @param {TaskContext} context Task context (the parents of the tasks).
 * @returns {{ transfer: (tasks: readonly Task[], projectId: string | null, message: string, onDone?: () => void) => void, isPending: boolean }} Transfer and its state.
 */
export function useTransferTasks(context: TaskContext) {
  // eslint-disable-next-line no-restricted-syntax -- the one transfer of tasks, undone from its toast.
  const { transfer } = useBulkTaskMutations();
  const undo = useBulkUndo();
  return {
    /**
     * Transfers tasks (and their sub-tasks).
     * @param {readonly Task[]} tasks Tasks, as they are now.
     * @param {string | null} projectId Target project; null: none.
     * @param {string} message Toast once done (« Tâche déplacée. »), the links removed told after it.
     * @param {() => void} [onDone] Once done. Optional.
     * @returns {void}
     */
    transfer: (tasks: readonly Task[], projectId: string | null, message: string, onDone?: () => void) => {
      // Moved tasks: those no other one moved holds, as they are now (what « Annuler » puts back).
      const moved = outermost(
        tasks,
        (task) => task.id,
        (id) => context.taskById.get(id)?.parentId,
      );
      transfer.mutate(
        { ids: tasks.map((task) => task.id), projectId },
        {
          onSuccess: ({ removedLinks, lost }) => {
            notifyWithUndo(message + removedLinksNote(removedLinks), undo.transfer(moved, lost));
            onDone?.();
          },
          onError: onMutationError,
        },
      );
    },
    isPending: transfer.isPending,
  };
}
