import { closePanel, openPanel } from '../../../components/panels/panels';
import { Button, Checkbox, Group, Radio, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowsLeftRightIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { notifyError, notifySuccess, notifyWithUndo } from '../../../lib/notify';
import { DestructiveActions } from '../../../components/dialogs/DestructiveActions';
import { SelectionBar } from '../../../components/data-table/SelectionBar';
import { useBulkTaskMutations, useCloneTask, useSetTasksClosed, type Task } from '../api';
import { ProjectSelect } from '../task-ui';
import type { TaskContext } from '../use-task-context';
import { useBulkUndo } from './bulk-undo';


/**
 * "3 tâches" / "1 tâche".
 * @param {number} count Count.
 * @returns {string} Label.
 */
function tasksLabel(count: number): string {
  return `${count} tâche${count > 1 ? 's' : ''}`;
}

interface DialogProps {
  tasks: Task[];
  context: TaskContext;
  onDone: (success: boolean) => void;
}

/**
 * Bulk transfer to another project.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
function BulkTransferDialog({ tasks, context, onDone }: DialogProps) {
  const { transfer } = useBulkTaskMutations();
  const undo = useBulkUndo();

  /**
   * Moved tasks (the topmost of the selection), then their sub-tasks level by level, as they are now.
   * @returns {Task[][]} Levels.
   */
  const movedLevels = () => {
    const selected = new Set(tasks.map((task) => task.id));
    const hasSelectedAncestor = (task: Task) => {
      for (let parentId = task.parentId; parentId; parentId = context.taskById.get(parentId)?.parentId ?? null) {
        if (selected.has(parentId)) return true;
      }
      return false;
    };
    const levels = [tasks.filter((task) => !hasSelectedAncestor(task))];
    while (levels[levels.length - 1].length > 0) {
      levels.push(levels[levels.length - 1].flatMap((task) => context.childrenOf(task.id)));
    }
    return levels.slice(0, -1);
  };
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <Stack gap="md">
      <Text size="sm">{tasksLabel(tasks.length)} et leurs sous-tâches seront déplacées. Les liens qui sortent de l’arborescence du projet choisi seront retirés.</Text>
      <ProjectSelect context={context} label="Projet de destination" value={projectId} onChange={setProjectId} data-autofocus />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={() => onDone(false)}>
          Annuler
        </Button>
        <Button
          disabled={!projectId}
          loading={transfer.isPending}
          onClick={() => {
            if (!projectId) return;
            const levels = movedLevels();
            transfer.mutate(
              { ids: tasks.map((task) => task.id), projectId },
              {
                onSuccess: ({ removedLinks }) => {
                  const message = `${tasksLabel(tasks.length)} transférée${tasks.length > 1 ? 's' : ''}.`;
                  // Removed links, milestones and sprints cannot come back: no undo then.
                  if (removedLinks > 0) notifySuccess(`${message} ${removedLinks} lien(s) retiré(s).`);
                  else notifyWithUndo(message, undo.transfer(levels));
                  onDone(true);
                },
                onError: (error) => notifyError(error.message),
              },
            );
          }}
        >
          Transférer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Bulk clone confirmation, optionally with the sub-tasks: each task cloned in turn.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
function BulkCloneDialog({ tasks, context, onDone }: DialogProps) {
  const cloneTask = useCloneTask();
  const [includeSubtasks, setIncludeSubtasks] = useState(false);
  const [pending, setPending] = useState(false);
  const withSubtasks = tasks.some((task) => context.childrenOf(task.id).length > 0);
  return (
    <Stack gap="md">
      <Text size="sm">
        {tasksLabel(tasks.length)} seront clonées : tous les champs, les assignés et les liens sont copiés ; les commentaires ne le sont pas.
      </Text>
      {withSubtasks && <Checkbox label="Inclure leurs sous-tâches" checked={includeSubtasks} onChange={(event) => setIncludeSubtasks(event.currentTarget.checked)} />}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={() => onDone(false)}>
          Annuler
        </Button>
        <Button
          loading={pending}
          data-autofocus
          onClick={async () => {
            setPending(true);
            try {
              for (const task of tasks) await cloneTask.mutateAsync({ id: task.id, includeSubtasks });
              notifySuccess(`${tasksLabel(tasks.length)} clonée${tasks.length > 1 ? 's' : ''}.`);
              onDone(true);
            } catch (error) {
              notifyError((error as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          Cloner
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Bulk deletion confirmation.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
function BulkDeleteDialog({ tasks, context, onDone }: DialogProps) {
  const { remove } = useBulkTaskMutations();
  const selected = new Set(tasks.map((task) => task.id));
  const hasOtherSubtasks = tasks.some((task) => context.childrenOf(task.id).some((child) => !selected.has(child.id)));
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  return (
    <Stack gap="md">
      <Text size="sm">
        {tasksLabel(tasks.length)} et leurs commentaires seront supprimées définitivement. Cette action est irréversible ;
        pour les retirer des listes sans perdre leurs données, archivez-les plutôt.
      </Text>
      {hasOtherSubtasks && (
        <Radio.Group label="Que faire de leurs sous-tâches non sélectionnées ?" value={mode} onChange={(value) => setMode(value as 'detach' | 'delete')}>
          <Stack gap="xs" mt="xs">
            <Radio value="detach" label="Les conserver (elles remontent d’un niveau)" />
            <Radio value="delete" label="Les supprimer aussi, définitivement" color="red" />
          </Stack>
        </Radio.Group>
      )}
      <DestructiveActions
        loading={remove.isPending}
        onCancel={() => onDone(false)}
        onConfirm={() =>
          remove.mutate(
            { ids: tasks.map((task) => task.id), deleteSubtasks: mode === 'delete' },
            {
              onSuccess: () => {
                notifySuccess(`${tasksLabel(tasks.length)} supprimée${tasks.length > 1 ? 's' : ''}.`);
                onDone(true);
              },
              onError: (error) => notifyError(error.message),
            },
          )
        }
      />
    </Stack>
  );
}

let modalCount = 0;

interface BulkBarProps {
  tasks: Task[];
  context: TaskContext;
  onClear: () => void;
}

/**
 * Actions on the selected tasks that their columns cannot do: close (or reopen), clone, transfer, archive, delete.
 * Their fields are changed in their cells (a change in one applies to all the tasks checked).
 * @param {BulkBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function BulkBar({ tasks, context, onClear }: BulkBarProps) {
  const { archive } = useBulkTaskMutations();
  const setClosed = useSetTasksClosed();
  const undo = useBulkUndo();
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
        context={context}
        onDone={(success) => {
          close();
          if (success) onClear();
        }}
      />
    );
    if (asForm) openPanel({ panelId: modalId, title, children });
    else modals.open({ modalId, title, children });
  };

  return (
    <SelectionBar
      label={`${tasksLabel(ids.length)} sélectionnée${ids.length > 1 ? 's' : ''}`}
      onClear={onClear}
      actions={[
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
      ]}
    />
  );
}
