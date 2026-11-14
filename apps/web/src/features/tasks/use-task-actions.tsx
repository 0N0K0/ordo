import { modals } from '@mantine/modals';
import { openFormPanel } from '../../components/panels/panels';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import type { RowMenuEntry } from '../../components/data-table/RowActions';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { useSetTaskArchived, type Task } from './api';
import { TaskCreateForm } from './TaskCreateForm';
import { CloneTaskDialog, DeleteTaskDialog, TransferTaskDialog } from './TaskDialogs';
import type { TaskContext } from './use-task-context';

let modalCount = 0;

/**
 * Opens a dialog (a confirmation: the forms open in the side panel) whose content receives a close callback.
 * @param {string} title Dialog title.
 * @param {(close: () => void) => React.ReactNode} render Dialog content.
 * @returns {void}
 */
function openDialog(title: string, render: (close: () => void) => React.ReactNode): void {
  const modalId = `task-dialog-${++modalCount}`;
  modals.open({ modalId, title, children: render(() => modals.close(modalId)) });
}

/**
 * Actions available on tasks (table, detail panel).
 * @param {TaskContext | null} context Task context, once loaded.
 * @returns {object} Actions.
 */
export function useTaskActions(context: TaskContext | null) {
  const setArchived = useSetTaskArchived();

  /**
   * Archives or restores a task, with an undo toast.
   * @param {Task} task Task.
   * @param {boolean} archived Target state.
   * @param {boolean} [notify=true] Whether to show the toast. Optional. Default = true.
   * @returns {void}
   */
  const archive = (task: Task, archived: boolean, notify = true): void => {
    setArchived.mutate(
      { id: task.id, archived },
      {
        onSuccess: () => {
          if (!notify) return;
          const message = `Tâche #${task.number} ${archived ? 'archivée' : 'désarchivée'}.`;
          notifyWithUndo(message, () => archive(task, !archived, false));
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  /**
   * Opens the clone dialog.
   * @param {Task} task Task.
   * @returns {void}
   */
  const clone = (task: Task) => context && openFormPanel('Cloner la tâche', (close) => <CloneTaskDialog task={task} context={context} onDone={close} />);

  /**
   * Opens the transfer dialog.
   * @param {Task} task Task.
   * @returns {void}
   */
  const transfer = (task: Task) => context && openFormPanel('Transférer la tâche', (close) => <TransferTaskDialog task={task} context={context} onDone={close} />);

  /**
   * Asks for confirmation, then deletes.
   * @param {Task} task Task.
   * @returns {void}
   */
  const remove = (task: Task) => context && openDialog('Supprimer la tâche', (close) => <DeleteTaskDialog task={task} context={context} onDone={close} />);

  return {
    archive,
    clone,
    transfer,
    remove,

    /**
     * Actions of a task in its menu (the menu of every row: table, detail panel): clone, transfer, archive, delete.
     * @param {Task} task Task.
     * @returns {RowMenuEntry[]} Actions.
     */
    menu: (task: Task): RowMenuEntry[] => [
      { label: 'Cloner', icon: <CopyIcon aria-hidden />, onClick: () => clone(task) },
      { label: 'Transférer', icon: <ArrowsLeftRightIcon aria-hidden />, onClick: () => transfer(task) },
      {
        label: task.archived ? 'Désarchiver' : 'Archiver',
        icon: task.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
        onClick: () => archive(task, !task.archived),
      },
      { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => remove(task) },
    ],

    /**
     * Opens the new task form.
     * @param {{ projectId?: string, parentId?: string }} [defaults] Preselected project or parent. Optional.
     * @returns {void}
     */
    create: (defaults?: { projectId?: string; parentId?: string }) => {
      if (!context) return;
      openFormPanel(defaults?.parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche', (close) => <TaskCreateForm context={context} defaults={defaults} onDone={close} />, 'lg');
    },
  };
}
