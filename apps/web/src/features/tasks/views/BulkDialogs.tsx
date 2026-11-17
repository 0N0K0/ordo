import { Button, Group, Radio, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { notifyError, notifySuccess, notifyWithUndo } from '../../../lib/notify';
import { useBulkUndo } from './bulk-undo';
import { tasksLabel } from './bulk-label';
import { DestructiveActions } from '../../../components/dialogs/DestructiveActions';
import { useBulkTaskMutations, useCloneTask, type Task } from '../api';
import { ProjectSelect } from '../task-ui';
import type { TaskContext } from '../use-task-context';

export interface DialogProps {
  tasks: Task[];
  context: TaskContext;
  onDone: (success: boolean) => void;
}

/**
 * Bulk transfer to another project.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function BulkTransferDialog({ tasks, context, onDone }: DialogProps) {
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
 * Bulk clone confirmation: each task cloned in turn with its sub-tasks (one under another checked task comes with it).
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function BulkCloneDialog({ tasks, context, onDone }: DialogProps) {
  const cloneTask = useCloneTask();
  const [pending, setPending] = useState(false);
  const withSubtasks = tasks.some((task) => context.childrenOf(task.id).length > 0);
  return (
    <Stack gap="md">
      <Text size="sm">{tasksLabel(tasks.length)} seront clonées : tous les champs, les assignés et les liens sont copiés ; les commentaires ne le sont pas.</Text>
      {withSubtasks && <Text size="sm">Leurs sous-tâches sont clonées avec elles, sous leur clone.</Text>}
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
              // A task already cloned with its parent is not cloned again.
              const ids = new Set(tasks.map((task) => task.id));
              const under = (task: Task) => {
                for (let parent = task.parentId ? context.taskById.get(task.parentId) : undefined; parent; parent = parent.parentId ? context.taskById.get(parent.parentId) : undefined)
                  if (ids.has(parent.id)) return true;
                return false;
              };
              const roots = tasks.filter((task) => !under(task));
              for (const task of roots) await cloneTask.mutateAsync({ id: task.id, includeSubtasks: true });
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
export function BulkDeleteDialog({ tasks, context, onDone }: DialogProps) {
  const { remove } = useBulkTaskMutations();
  const selected = new Set(tasks.map((task) => task.id));
  const hasOtherSubtasks = tasks.some((task) => context.childrenOf(task.id).some((child) => !selected.has(child.id)));
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  return (
    <Stack gap="md">
      <Text size="sm">
        {tasksLabel(tasks.length)} et leurs commentaires seront supprimées définitivement. Cette action est irréversible ; pour les retirer des listes sans perdre leurs données, archivez-les plutôt.
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
