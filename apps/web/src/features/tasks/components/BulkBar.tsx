import { unarchived } from '../../../lib/archive';
import { plural } from '../../../lib/text';
import { ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CheckCircleIcon, TrashIcon } from '@phosphor-icons/react';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { archiveRowsAction, duplicateRowsAction, outermost, switchRowsAction } from '../../../components/data-table/selection/selection-actions';
import { useBulkTaskMutations, useDuplicateTask, useSetTasksClosed, type Task } from '../api';
import { DeleteTasksDialog, TransferTasksDialog } from './TaskDialogs';
import { useTaskLink } from '../hooks/use-task-link';
import { openTasksDialog } from '../lib/open-tasks-dialog';
import type { TaskContext } from '../hooks/use-task-context';
import { useBulkUndo } from '../lib/bulk-undo';
import { tasksLabel } from '../lib/bulk-label';
import { inheritanceRowsAction } from '../../../components/inheritance/inheritance-action';
import { notifyWithUndo } from '../../../lib/notify';
import { TASK_INHERITANCE_OPTIONS } from '../lib/task-inheritance';

/** Actions on tasks that their columns cannot do. */
interface TaskRowsActions {
  close: SelectionAction;
  duplicate: SelectionAction;
  transfer: SelectionAction;
  inheritance: SelectionAction;
  archive: SelectionAction;
  remove: SelectionAction;
}

/**
 * Actions on tasks, the same on the tasks checked (bar of the table) and on one task (its menu): close (or reopen),
 * duplicate, transfer, inheritance (« Héritage… », sub-tasks), archive, delete; each one undone from its toast when it can be. Archived tasks are read only: left
 * out of all but archive/restore and delete.
 * @param {TaskContext | null} context Task context.
 * @returns {(tasks: Task[], onClear?: () => void) => TaskRowsActions} Actions of tasks, given how to clear the selection.
 */
export function useTaskRowsActions(context: TaskContext | null) {
  const { archive, update } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();
  const undo = useBulkUndo();
  const duplicateTask = useDuplicateTask();
  const link = useTaskLink();
  return (tasks: Task[], onClear?: () => void): TaskRowsActions => {
    const ids = tasks.map((task) => task.id);
    const label = tasksLabel(ids.length);
    const active = unarchived(tasks);
    const activeIds = active.map((task) => task.id);
    const several = active.length > 1;
    /**
     * Opens a dialog on the tasks not archived; a success clears the selection.
     * @param {string} title Title.
     * @param {Parameters<typeof openTasksDialog>[1]} Dialog Dialog.
     * @param {boolean} [asForm] In the side panel. Optional. Default = false.
     * @returns {void}
     */
    const open = (title: string, Dialog: Parameters<typeof openTasksDialog>[1], asForm = false) => context && openTasksDialog(title, Dialog, { tasks: active, context, asForm, onSuccess: onClear });
    return {
      close: {
        ...switchRowsAction({
          on: active.every((task) => task.closed),
          labels: ['Fermer', 'Rouvrir'],
          icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
          loading: setClosed.isPending,
          apply: (closed) => setClosed.mutateAsync({ ids: activeIds, closed }),
          done: (closed) => `${tasksLabel(activeIds.length)} ${plural(activeIds.length, closed ? 'fermée' : 'rouverte')}.`,
          undo: (closed) => undo.closed(active, closed),
        }),
        disabled: activeIds.length === 0,
      },
      // Each task at the top of the selection with its sub-tasks (a task under another one checked comes with it), at once.
      duplicate: duplicateRowsAction(
        outermost(
          active,
          (task) => task.id,
          (id) => context?.taskById.get(id)?.parentId,
        ),
        {
          duplicate: (task) => duplicateTask.mutateAsync({ id: task.id, includeSubtasks: true }),
          done: several ? `${tasksLabel(active.length)} ${plural(active.length, 'dupliquée')}.` : 'Tâche dupliquée.',
          open: (copy) => link.open(copy.id),
          loading: duplicateTask.isPending,
          disabled: activeIds.length === 0,
        },
      ),
      transfer: {
        label: 'Transférer',
        icon: <ArrowsLeftRightIcon aria-hidden />,
        disabled: activeIds.length === 0,
        onClick: () => open(several ? 'Transférer les tâches' : 'Transférer la tâche', TransferTasksDialog, true),
      },
      // Fields inherited again or emptied on purpose, on the sub-tasks among them, undone from its toast.
      inheritance: inheritanceRowsAction({
        fields: TASK_INHERITANCE_OPTIONS,
        about: tasksLabel(activeIds.length),
        withParent: active.filter((task) => task.parentId).length,
        onApply: async (change) => {
          await update.mutateAsync({ ids: activeIds, changes: change });
          notifyWithUndo(`Héritage changé pour ${tasksLabel(activeIds.length)}.`, undo.inheritance(active, [...change.inheritFields, ...change.clearFields]));
        },
        onDone: onClear,
      }),
      archive: archiveRowsAction({
        archived: tasks.every((task) => task.archived),
        loading: archive.isPending,
        apply: (archived) => archive.mutateAsync({ ids, archived }),
        label,
        count: ids.length,
        feminine: true,
        undo: (archived) => undo.archived(tasks, archived),
        clear: onClear,
      }),
      remove: { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => open(several ? 'Supprimer les tâches' : 'Supprimer la tâche', DeleteTasksDialog) },
    };
  };
}

/**
 * Actions on the checked tasks, for the bar of the table. Their fields are changed in their cells (a change in one
 * applies to all the tasks checked).
 * @param {TaskContext | null} context Task context.
 * @returns {(tasks: Task[], onClear: () => void) => SelectionAction[]} Actions of the tasks checked.
 */
export function useTaskSelectionActions(context: TaskContext | null) {
  const actionsOf = useTaskRowsActions(context);
  return (tasks: Task[], onClear: () => void): SelectionAction[] => Object.values(actionsOf(tasks, onClear));
}
