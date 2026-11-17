import type { ReactNode } from 'react';
import { openModal } from '../../../components/panels/open-modal';
import { openFormPanel } from '../../../components/panels/panels';
import type { Task } from '../api';
import type { TaskContext } from '../hooks/use-task-context';

/** Props of a dialog on tasks: one task is a list of one. */
export interface TasksDialogProps {
  tasks: Task[];
  context: TaskContext;
  /** Closes it; success: the action was done. */
  onDone: (success: boolean) => void;
}

/**
 * Opens a dialog on tasks (a form in the side panel, a confirmation in a modal).
 * @param {string} title Title.
 * @param {(props: TasksDialogProps) => ReactNode} Dialog Dialog.
 * @param {{ tasks: Task[], context: TaskContext, asForm?: boolean, onSuccess?: () => void }} options Tasks, their context, in the side panel, after a success (the selection cleared…).
 * @returns {void}
 */
export function openTasksDialog(
  title: string,
  Dialog: (props: TasksDialogProps) => ReactNode,
  { tasks, context, asForm = false, onSuccess }: { tasks: Task[]; context: TaskContext; asForm?: boolean; onSuccess?: () => void },
): void {
  /**
   * Content of the dialog, given its closing.
   * @param {() => void} close Closes it.
   * @returns {ReactNode} Content.
   */
  const render = (close: () => void) => (
    <Dialog
      tasks={tasks}
      context={context}
      onDone={(success) => {
        close();
        if (success) onSuccess?.();
      }}
    />
  );
  if (asForm) openFormPanel(title, render);
  else openModal(title, render);
}
