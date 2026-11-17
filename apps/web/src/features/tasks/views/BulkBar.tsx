import { openFormPanel } from '../../../components/panels/panels';
import { openModal } from '../../../components/panels/open-modal';

import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { type ReactNode } from 'react';
import type { SelectionAction } from '../../../components/data-table/SelectionBar';
import { useBulkTaskMutations, useSetTasksClosed, type Task } from '../api';
import type { TaskContext } from '../use-task-context';
import { useBulkUndo } from './bulk-undo';
import { BulkDeleteDialog, BulkTransferDialog, CloneTasksDialog, type DialogProps } from './BulkDialogs';
import { switchRowsAction } from '../../../components/data-table/selection-actions';
import { tasksLabel } from './bulk-label';

/**
 * Actions on the checked tasks that their columns cannot do, for the bar of the table: close (or reopen), clone,
 * transfer, archive, delete. Their fields are changed in their cells (a change in one applies to all the tasks checked).
 * @param {TaskContext | null} context Task context.
 * @returns {(tasks: Task[], onClear: () => void) => SelectionAction[]} Actions of the tasks checked.
 */
export function useTaskSelectionActions(context: TaskContext | null) {
  const { archive } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();
  const undo = useBulkUndo();
  return (tasks: Task[], onClear: () => void): SelectionAction[] => {
  const allClosed = tasks.every((task) => task.closed);
  const allArchived = tasks.every((task) => task.archived);
  const ids = tasks.map((task) => task.id);

  /**
   * Opens a dialog on the selected tasks (a form in the side panel, a confirmation in a modal); a success clears the
   * selection.
   * @param {string} title Title.
   * @param {(props: DialogProps) => ReactNode} Dialog Dialog.
   * @param {boolean} [asForm] In the side panel. Optional. Default = false.
   * @returns {void}
   */
  const openDialog = (title: string, Dialog: (props: DialogProps) => ReactNode, asForm = false) => {
    /**
     * Content of the dialog, given its closing.
     * @param {() => void} close Closes it.
     * @returns {ReactNode} Content.
     */
    const render = (close: () => void) => (
      <Dialog
        tasks={tasks}
        context={context!}
        onDone={(success) => {
          close();
          if (success) onClear();
        }}
      />
    );
    if (asForm) openFormPanel(title, render);
    else openModal(title, render);
  };

  return [
        switchRowsAction({
          on: allClosed,
          labels: ['Fermer', 'Rouvrir'],
          icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
          loading: setClosed.isPending,
          apply: (closed) => setClosed.mutateAsync({ ids, closed }),
          done: (closed) => `${tasksLabel(ids.length)} ${closed ? 'fermée' : 'rouverte'}${ids.length > 1 ? 's' : ''}.`,
          undo: (closed) => undo.closed(tasks, closed),
        }),
        { label: 'Cloner', icon: <CopyIcon aria-hidden />, onClick: () => openDialog(tasks.length > 1 ? 'Cloner les tâches' : 'Cloner la tâche', CloneTasksDialog) },
        { label: 'Transférer', icon: <ArrowsLeftRightIcon aria-hidden />, onClick: () => openDialog('Transférer les tâches', BulkTransferDialog, true) },
        switchRowsAction({
          on: allArchived,
          labels: ['Archiver', 'Désarchiver'],
          icons: [<ArchiveIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
          loading: archive.isPending,
          apply: (archived) => archive.mutateAsync({ ids, archived }),
          done: (archived) => `${tasksLabel(ids.length)} ${archived ? 'archivée' : 'désarchivée'}${ids.length > 1 ? 's' : ''}.`,
          undo: (archived) => undo.archived(tasks, archived),
          clear: onClear,
        }),
        { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => openDialog('Supprimer les tâches', BulkDeleteDialog) },
    ];
  };
}
