import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { CopyIcon } from '@phosphor-icons/react';
import { Checkbox, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { TasksDialogProps } from '../lib/open-tasks-dialog';
import { useSearchParams } from 'react-router';

import { outermost } from '../../../components/data-table/selection/selection-actions';
import { CascadeChoice, DestructiveActions, DestructiveRisks } from '../../../components/dialogs/DestructiveActions';
import { FormActions } from '../../../components/dialogs/FormActions';
import { notifySuccess, notifyWithUndo, onMutationError } from '../../../lib/notify';
import { formCallbacks } from '../../../lib/form';
import { plural, countWith } from '../../../lib/text';
import { useBulkTaskMutations, useCloneTask } from '../api';
import { countSubtasks } from '../lib/task-links';
import { ProjectSelect } from './task-ui';
import { taskName, taskRef } from '../hooks/use-task-context';
import { TASK_PARAM, useTaskLink } from '../hooks/use-task-link';
import { useBulkUndo } from '../lib/bulk-undo';
import { removedLinksNote, tasksLabel } from '../lib/bulk-label';
import { useAsyncAction } from '../../../lib/use-async-action';

/**
 * Deletion of tasks, confirmed; with sub-tasks not deleted with them, asks whether to keep them (moved up a level) or
 * delete them too. The task open in the side panel closes when deleted.
 * @param {TasksDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteTasksDialog({ tasks, context, onDone }: TasksDialogProps) {
  const { remove } = useBulkTaskMutations();
  const link = useTaskLink();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  const single = tasks.length === 1 ? tasks[0] : null;
  const selected = new Set(tasks.map((task) => task.id));
  const subtasks = single ? countSubtasks(context, single.id) : tasks.filter((task) => context.childrenOf(task.id).some((child) => !selected.has(child.id))).length;

  /**
   * Deletes the tasks with the chosen mode.
   * @returns {void}
   */
  const handleConfirm = () =>
    remove.mutate(
      { ids: [...selected], deleteSubtasks: mode === 'delete' },
      formCallbacks(null, single ? `Tâche ${taskName(single)} supprimée.` : `${tasksLabel(tasks.length)} ${plural(tasks.length, 'supprimée')}.`, () => {
        onDone(true);
        if (selected.has(params.get(TASK_PARAM) ?? '')) link.close();
      }),
    );

  return (
    <Stack gap="md">
      <DestructiveRisks>
        {single ? (
          <>
            La tâche <strong>{`${taskRef(single).trim()} ${single.label}`}</strong> et ses commentaires seront supprimés définitivement. Pour la retirer des listes sans perdre ses données, archivez-la
            plutôt.
          </>
        ) : (
          `${tasksLabel(tasks.length)} et leurs commentaires seront supprimées définitivement. Pour les retirer des listes sans perdre leurs données, archivez-les plutôt.`
        )}
      </DestructiveRisks>
      {subtasks > 0 && (
        <CascadeChoice
          label={single ? `Que faire de ${countWith(subtasks, 'sous-tâche', ['sa', 'ses'])} ?` : 'Que faire de leurs sous-tâches non sélectionnées ?'}
          keepLabel="Les conserver (elles remontent d’un niveau)"
          value={mode}
          onChange={setMode}
        />
      )}
      <DestructiveActions onConfirm={handleConfirm} onCancel={() => onDone(false)} loading={remove.isPending} />
    </Stack>
  );
}

/**
 * Transfer of tasks with their sub-tasks to another project, or out of any (no number, milestone, sprint nor GitHub
 * item then); links leaving the project tree are removed, with a warning. Undone from its toast when no link was
 * removed.
 * @param {TasksDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function TransferTasksDialog({ tasks, context, onDone }: TasksDialogProps) {
  const { transfer } = useBulkTaskMutations();
  const undo = useBulkUndo();
  const [projectId, setProjectId] = useState<string | null>(null);
  // Out of any project.
  const [none, setNone] = useState(false);
  const target = none ? null : projectId;
  const chosen = none || projectId !== null;
  const single = tasks.length === 1 ? tasks[0] : null;
  const subtasks = single ? countSubtasks(context, single.id) : 0;
  const leavesTree = chosen && tasks.some((task) => context.rootOf(target) !== context.rootOf(task.projectId));

  /**
   * Moved tasks (those no other one moved holds), then their sub-tasks level by level, as they are now.
   * @returns {Task[][]} Levels.
   */
  const movedLevels = () => {
    const levels = [
      outermost(
        tasks,
        (task) => task.id,
        (id) => context.taskById.get(id)?.parentId,
      ),
    ];
    while (levels[levels.length - 1].length > 0) levels.push(levels[levels.length - 1].flatMap((task) => context.childrenOf(task.id)));
    return levels.slice(0, -1);
  };

  /**
   * Transfers the tasks.
   * @returns {void}
   */
  const handleConfirm = () => {
    if (!chosen) return;
    const levels = movedLevels();
    transfer.mutate(
      { ids: tasks.map((task) => task.id), projectId: target },
      {
        onSuccess: ({ removedLinks }) => {
          const message = single ? `Tâche ${taskName(single)} transférée.` : `${tasksLabel(tasks.length)} ${plural(tasks.length, 'transférée')}.`;
          // Removed links, milestones and sprints cannot come back: no undo then.
          if (removedLinks > 0) notifySuccess(message + removedLinksNote(removedLinks));
          else notifyWithUndo(message, undo.transfer(levels));
          onDone(true);
        },
        onError: onMutationError,
      },
    );
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        {!single
          ? `${tasksLabel(tasks.length)} et leurs sous-tâches seront déplacées dans le projet choisi.`
          : subtasks > 0
            ? `La tâche et ${countWith(subtasks, 'sous-tâche', ['sa', 'ses'])} seront déplacées.`
            : 'La tâche sera déplacée dans le projet choisi.'}
      </Text>
      <ProjectSelect context={context} label="Projet de destination" value={projectId} onChange={setProjectId} disabled={none} data-autofocus />
      <Checkbox
        label="Sans projet"
        description={`${single ? 'La tâche perd son numéro, son jalon, ses sprints et son lien GitHub' : 'Les tâches perdent leur numéro, leur jalon, leurs sprints et leur lien GitHub'}.`}
        checked={none}
        disabled={tasks.every((task) => task.projectId === null)}
        onChange={(event) => setNone(event.currentTarget.checked)}
      />
      {leavesTree && (
        <NoticeAlert kind="warning">
          Ce projet n’appartient pas à la même arborescence : la tâche parente, les blocages et les relations avec des tâches restées dans l’arborescence actuelle seront retirés.
        </NoticeAlert>
      )}
      <FormActions
        onCancel={() => onDone(false)}
        submitLabel="Transférer"
        onSubmit={handleConfirm}
        disabled={!chosen || tasks.every((task) => task.projectId === target)}
        loading={transfer.isPending}
      />
    </Stack>
  );
}

/**
 * Clone of one task or of several, confirmed: each one cloned in turn with its sub-tasks, under its clone (a task under
 * another one cloned comes with it); all the fields, the assignees and the links copied, not the comments. A single
 * clone opens.
 * @param {TasksDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function CloneTasksDialog({ tasks, context, onDone }: TasksDialogProps) {
  const cloneTask = useCloneTask();
  const link = useTaskLink();
  const single = tasks.length === 1 ? tasks[0] : null;
  const { run: clone, loading: pending } = useAsyncAction(
    async () => {
      // A task already cloned with its parent is not cloned again.
      const roots = outermost(
        tasks,
        (task) => task.id,
        (id) => context.taskById.get(id)?.parentId,
      );
      let last: { id: string; number: number | null } | null = null;
      for (const task of roots) last = await cloneTask.mutateAsync({ id: task.id, includeSubtasks: true });
      return last;
    },
    {
      onDone: (last) => {
        notifySuccess(single ? `Tâche ${taskName(single)} clonée${last?.number == null ? '' : ` en #${last.number}`}.` : `${tasksLabel(tasks.length)} ${plural(tasks.length, 'clonée')}.`);
        onDone(true);
        if (single && last) link.open(last.id);
      },
    },
  );
  const subtasks = tasks.reduce((count, task) => count + countSubtasks(context, task.id), 0);
  return (
    <Stack gap="md">
      <Text size="sm">
        {single ? 'La tâche sera clonée' : `${tasksLabel(tasks.length)} seront clonées`} : tous les champs, les assignés et les liens sont copiés ; les commentaires ne le sont pas.
      </Text>
      {subtasks > 0 && (
        <Text size="sm">
          {single
            ? (subtasks === 1 ? 'Sa sous-tâche est clonée' : `Ses ${subtasks} sous-tâches sont clonées`) + ' avec elle, sous le clone.'
            : 'Leurs sous-tâches sont clonées avec elles, sous leur clone.'}
        </Text>
      )}
      <FormActions onCancel={() => onDone(false)} submitLabel="Cloner" submitIcon={<CopyIcon aria-hidden />} loading={pending} autoFocus onSubmit={() => void clone()} />
    </Stack>
  );
}
