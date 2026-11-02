import { modals } from '@mantine/modals';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { useSetTaskArchived, type Task } from './api';
import { TaskCreateForm } from './TaskCreateForm';
import { CloneTaskDialog, DeleteTaskDialog, TransferTaskDialog } from './TaskDialogs';
import type { TaskContext } from './use-task-context';

let modalCount = 0;

/**
 * Opens a modal whose content receives a close callback.
 * @param {string} title Modal title.
 * @param {(close: () => void) => React.ReactNode} render Modal content.
 * @param {string} [size] Modal size. Optional.
 * @returns {void}
 */
function openModal(title: string, render: (close: () => void) => React.ReactNode, size?: string): void {
  const modalId = `task-modal-${++modalCount}`;
  modals.open({ modalId, title, size, children: render(() => modals.close(modalId)) });
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

  return {
    archive,

    /**
     * Opens the new task form.
     * @param {{ projectId?: string, parentId?: string }} [defaults] Preselected project or parent. Optional.
     * @returns {void}
     */
    create: (defaults?: { projectId?: string; parentId?: string }) => {
      if (!context) return;
      openModal(
        defaults?.parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche',
        (close) => <TaskCreateForm context={context} defaults={defaults} onDone={close} />,
        'xl',
      );
    },

    /**
     * Asks for confirmation, then deletes.
     * @param {Task} task Task.
     * @returns {void}
     */
    remove: (task: Task) =>
      context &&
      openModal('Supprimer la tâche', (close) => <DeleteTaskDialog task={task} context={context} onDone={close} />),

    /**
     * Opens the transfer dialog.
     * @param {Task} task Task.
     * @returns {void}
     */
    transfer: (task: Task) =>
      context &&
      openModal('Transférer la tâche', (close) => <TransferTaskDialog task={task} context={context} onDone={close} />),

    /**
     * Opens the clone dialog.
     * @param {Task} task Task.
     * @returns {void}
     */
    clone: (task: Task) =>
      context && openModal('Cloner la tâche', (close) => <CloneTaskDialog task={task} context={context} onDone={close} />),
  };
}
