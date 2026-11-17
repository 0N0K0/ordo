import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import type { SelectionAction } from '../../../components/data-table/SelectionBar';
import { switchRowsAction } from '../../../components/data-table/selection-actions';
import { useBulkTaskMutations, useSetTasksClosed, type Task } from '../api';
import { CloneTasksDialog, DeleteTasksDialog, TransferTasksDialog } from '../TaskDialogs';
import { openTasksDialog } from '../open-tasks-dialog';
import type { TaskContext } from '../use-task-context';
import { useBulkUndo } from './bulk-undo';
import { tasksLabel } from './bulk-label';

/** Actions on tasks that their columns cannot do. */
export interface TaskRowsActions {
  close: SelectionAction;
  clone: SelectionAction;
  transfer: SelectionAction;
  archive: SelectionAction;
  remove: SelectionAction;
}

/**
 * Actions on tasks, the same on the tasks checked (bar of the table) and on one task (its menu): close (or reopen),
 * clone, transfer, archive, delete; each one undone from its toast when it can be.
 * @param {TaskContext | null} context Task context.
 * @returns {(tasks: Task[], onClear?: () => void) => TaskRowsActions} Actions of tasks, given how to clear the selection.
 */
export function useTaskRowsActions(context: TaskContext | null) {
  const { archive } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();
  const undo = useBulkUndo();
  return (tasks: Task[], onClear?: () => void): TaskRowsActions => {
    const ids = tasks.map((task) => task.id);
    const plural = tasks.length > 1;
    const label = tasksLabel(ids.length);
    /**
     * Opens a dialog on the tasks; a success clears the selection.
     * @param {string} title Title.
     * @param {Parameters<typeof openTasksDialog>[1]} Dialog Dialog.
     * @param {boolean} [asForm] In the side panel. Optional. Default = false.
     * @returns {void}
     */
    const open = (title: string, Dialog: Parameters<typeof openTasksDialog>[1], asForm = false) => context && openTasksDialog(title, Dialog, { tasks, context, asForm, onSuccess: onClear });
    return {
      close: switchRowsAction({
        on: tasks.every((task) => task.closed),
        labels: ['Fermer', 'Rouvrir'],
        icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: setClosed.isPending,
        apply: (closed) => setClosed.mutateAsync({ ids, closed }),
        done: (closed) => `${label} ${closed ? 'fermée' : 'rouverte'}${plural ? 's' : ''}.`,
        undo: (closed) => undo.closed(tasks, closed),
      }),
      clone: { label: 'Cloner', icon: <CopyIcon aria-hidden />, onClick: () => open(plural ? 'Cloner les tâches' : 'Cloner la tâche', CloneTasksDialog) },
      transfer: { label: 'Transférer', icon: <ArrowsLeftRightIcon aria-hidden />, onClick: () => open(plural ? 'Transférer les tâches' : 'Transférer la tâche', TransferTasksDialog, true) },
      archive: switchRowsAction({
        on: tasks.every((task) => task.archived),
        labels: ['Archiver', 'Désarchiver'],
        icons: [<ArchiveIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: archive.isPending,
        apply: (archived) => archive.mutateAsync({ ids, archived }),
        done: (archived) => `${label} ${archived ? 'archivée' : 'désarchivée'}${plural ? 's' : ''}.`,
        undo: (archived) => undo.archived(tasks, archived),
        clear: onClear,
      }),
      remove: { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => open(plural ? 'Supprimer les tâches' : 'Supprimer la tâche', DeleteTasksDialog) },
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
