import { Alert, Button, Checkbox, Group, Radio, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTaskLink } from './use-task-link';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useCloneTask, useDeleteTask, useTransferTask, type Task } from './api';
import { ProjectSelect } from './task-ui';
import type { TaskContext } from './use-task-context';

interface DialogProps {
  task: Task;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Number of sub-tasks of a task, at any depth.
 * @param {TaskContext} context Task context.
 * @param {string} taskId Task id.
 * @returns {number} Count.
 */
function countSubtasks(context: TaskContext, taskId: string): number {
  return context.childrenOf(taskId).reduce((sum, child) => sum + 1 + countSubtasks(context, child.id), 0);
}

/**
 * Task deletion confirmation; with sub-tasks, asks whether to keep them (moved up to the parent) or delete them.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteTaskDialog({ task, context, onDone }: DialogProps) {
  const deleteTask = useDeleteTask();
  const link = useTaskLink();
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  const subtasks = countSubtasks(context, task.id);

  /**
   * Deletes the task with the chosen mode.
   * @returns {void}
   */
  const handleConfirm = () => {
    deleteTask.mutate(
      { id: task.id, deleteSubtasks: mode === 'delete' },
      {
        onSuccess: () => {
          notifySuccess(`Tâche #${task.number} supprimée.`);
          onDone();
          link.close();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        La tâche <strong>#{task.number} {task.title}</strong> et ses commentaires seront supprimés définitivement. Cette
        action est irréversible ; pour la retirer des listes sans perdre ses données, archivez-la plutôt.
      </Text>
      {subtasks > 0 && (
        <Radio.Group
          label={`Que faire de ses ${subtasks} sous-tâche${subtasks > 1 ? 's' : ''} ?`}
          value={mode}
          onChange={(value) => setMode(value as 'detach' | 'delete')}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="detach" label="Les conserver (elles remontent d’un niveau)" />
            <Radio value="delete" label="Les supprimer aussi, définitivement" color="red" />
          </Stack>
        </Radio.Group>
      )}
      <DestructiveActions onConfirm={handleConfirm} onCancel={onDone} loading={deleteTask.isPending} />
    </Stack>
  );
}

/**
 * Transfer to another project; links leaving the project tree are removed, with a warning.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function TransferTaskDialog({ task, context, onDone }: DialogProps) {
  const transferTask = useTransferTask();
  const [projectId, setProjectId] = useState<string | null>(null);
  const subtasks = countSubtasks(context, task.id);
  const leavesTree = projectId !== null && context.rootOf(projectId) !== context.rootOf(task.projectId);

  /**
   * Transfers the task.
   * @returns {void}
   */
  const handleConfirm = () => {
    if (!projectId) return;
    transferTask.mutate(
      { id: task.id, projectId },
      {
        onSuccess: ({ removedLinks }) => {
          notifySuccess(
            `Tâche #${task.number} transférée.` +
              (removedLinks > 0 ? ` ${removedLinks} lien${removedLinks > 1 ? 's' : ''} retiré${removedLinks > 1 ? 's' : ''}.` : ''),
          );
          onDone();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        {subtasks > 0
          ? `La tâche et ses ${subtasks} sous-tâche${subtasks > 1 ? 's' : ''} seront déplacées.`
          : 'La tâche sera déplacée dans le projet choisi.'}
      </Text>
      <ProjectSelect
        context={context}
        label="Projet de destination"
        value={projectId}
        onChange={setProjectId}
        data-autofocus
      />
      {leavesTree && (
        <Alert color="yellow" icon={<ErrorIcon />}>
          Ce projet n’appartient pas à la même arborescence : la tâche parente, les blocages et les relations avec des
          tâches restées dans l’arborescence actuelle seront retirés.
        </Alert>
      )}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!projectId || projectId === task.projectId}
          loading={transferTask.isPending}
        >
          Transférer
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Clone confirmation, optionally with the sub-tasks. Opens the clone.
 * @param {DialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function CloneTaskDialog({ task, context, onDone }: DialogProps) {
  const cloneTask = useCloneTask();
  const link = useTaskLink();
  const subtasks = countSubtasks(context, task.id);
  const [includeSubtasks, setIncludeSubtasks] = useState(false);

  /**
   * Clones the task.
   * @returns {void}
   */
  const handleConfirm = () => {
    cloneTask.mutate(
      { id: task.id, includeSubtasks },
      {
        onSuccess: (clone) => {
          notifySuccess(`Tâche #${task.number} clonée en #${clone.number}.`);
          onDone();
          link.open(clone.number);
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        Tous les champs, les assignés et les liens sont copiés ; les commentaires ne le sont pas.
      </Text>
      {subtasks > 0 && (
        <Checkbox
          label={`Inclure les ${subtasks} sous-tâche${subtasks > 1 ? 's' : ''}`}
          checked={includeSubtasks}
          onChange={(event) => setIncludeSubtasks(event.currentTarget.checked)}
        />
      )}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={handleConfirm} loading={cloneTask.isPending} data-autofocus>
          Cloner
        </Button>
      </Group>
    </Stack>
  );
}
