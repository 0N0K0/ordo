import { closePanel, openPanel } from '../../../components/panels/panels';
import { modals } from '@mantine/modals';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { type ReactNode } from 'react';
import { notifyError, notifyWithUndo } from '../../../lib/notify';
import type { SelectionAction } from '../../../components/data-table/SelectionBar';
import { useBulkTaskMutations, useSetTasksClosed, type Task } from '../api';
import type { TaskContext } from '../use-task-context';
import { useBulkUndo } from './bulk-undo';
import { BulkCloneDialog, BulkDeleteDialog, BulkTransferDialog, type DialogProps } from './BulkDialogs';
import { tasksLabel } from './bulk-label';


let modalCount = 0;

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
    const modalId = `bulk-${++modalCount}`;
    const close = () => (asForm ? closePanel(modalId) : modals.close(modalId));
    const children = (
      <Dialog
        tasks={tasks}
        context={context!}
        onDone={(success) => {
          close();
          if (success) onClear();
        }}
      />
    );
    if (asForm) openPanel({ panelId: modalId, title, children });
    else modals.open({ modalId, title, children });
  };

  return [
        {
          label: allClosed ? 'Rouvrir' : 'Fermer',
          icon: allClosed ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />,
          loading: setClosed.isPending,
          onClick: () =>
            setClosed.mutate(
              { ids, closed: !allClosed },
              {
                onSuccess: () => notifyWithUndo(`${tasksLabel(ids.length)} ${allClosed ? 'rouverte' : 'fermée'}${ids.length > 1 ? 's' : ''}.`, undo.closed(tasks, !allClosed)),
                onError: (error) => notifyError(error.message),
              },
            ),
        },
        { label: 'Cloner', icon: <CopyIcon aria-hidden />, onClick: () => openDialog('Cloner les tâches', BulkCloneDialog) },
        { label: 'Transférer', icon: <ArrowsLeftRightIcon aria-hidden />, onClick: () => openDialog('Transférer les tâches', BulkTransferDialog, true) },
        {
          label: allArchived ? 'Désarchiver' : 'Archiver',
          icon: allArchived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
          loading: archive.isPending,
          onClick: () =>
            archive.mutate(
              { ids, archived: !allArchived },
              {
                onSuccess: () => {
                  notifyWithUndo(`${tasksLabel(ids.length)} ${allArchived ? 'désarchivée' : 'archivée'}${ids.length > 1 ? 's' : ''}.`, undo.archived(tasks, !allArchived));
                  onClear();
                },
                onError: (error) => notifyError(error.message),
              },
            ),
        },
        { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => openDialog('Supprimer les tâches', BulkDeleteDialog) },
    ];
  };
}
