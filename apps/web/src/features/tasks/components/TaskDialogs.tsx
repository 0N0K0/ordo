import { useSearchParam } from '../../../lib/search-params';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { Checkbox, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { TasksDialogProps } from '../lib/open-tasks-dialog';
import type { Task } from '../api';

import { CascadeChoice, DestructiveActions, DestructiveRisks } from '../../../components/dialogs/DestructiveActions';
import { FormActions } from '../../../components/dialogs/FormActions';
import { formCallbacks } from '../../../lib/form';
import { plural, countWith, countOf } from '../../../lib/text';
import { useBulkTaskMutations } from '../api';
import { countSubtasks, inProjectTree, subtasksOf } from '../lib/task-links';
import { ProjectSelect } from './task-ui';
import { taskName, taskNumbered } from '../hooks/use-task-context';
import { TASK_PARAM, useTaskLink } from '../hooks/use-task-link';
import { useTransferTasks } from '../hooks/use-transfer-tasks';
import { tasksLabel } from '../lib/bulk-label';
import { LostOnDeleteRisk } from '../../time/components/LostOnDeleteRisk';

/**
 * What deleting tasks does on GitHub: the issues of those linked to a board closed as not planned (those of closed
 * tasks as they were closed), their drafts deleted; nothing without any.
 * @param {readonly Task[]} gone Tasks deleted (sub-tasks deleted with them included).
 * @returns {string | null} Sentence, or null.
 */
function githubDeleteRisk(gone: readonly Task[]): string | null {
  const linked = gone.filter((task) => task.githubLinked);
  const issues = linked.filter((task) => task.githubNumber !== null).length;
  const drafts = linked.length - issues;
  const parts = [
    ...(issues ? [`${countOf(issues, 'issue GitHub', 'issues GitHub')} ${plural(issues, 'sera fermée', 'seront fermées')} comme « non prévue » si ${plural(issues, 'elle est encore ouverte et son tableau synchronisé', 'elles sont encore ouvertes et leur tableau synchronisé')} (${plural(issues, 'elle reste dans son dépôt', 'elles restent dans leur dépôt')} ; celle d’une tâche fermée l’est comme elle)`] : []),
    ...(drafts ? [`${countOf(drafts, 'brouillon GitHub', 'brouillons GitHub')} ${plural(drafts, 'sera supprimé', 'seront supprimés')}`] : []),
  ];
  return parts.length ? ` ${parts.join(' et ')}.` : null;
}

/**
 * Deletion of tasks, confirmed; with sub-tasks not deleted with them, asks whether to keep them (moved up a level) or
 * delete them too; tells the times without project deleted with them. The task open in the
 * side panel closes when deleted.
 * @param {TasksDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteTasksDialog({ tasks, context, onDone }: TasksDialogProps) {
  const { remove } = useBulkTaskMutations();
  const link = useTaskLink();
  const [openTaskId] = useSearchParam(TASK_PARAM);
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  const single = tasks.length === 1 ? tasks[0] : null;
  const selected = new Set(tasks.map((task) => task.id));
  const gone = mode === 'delete' ? [...new Map([...tasks, ...tasks.flatMap((task) => subtasksOf(context, task.id))].map((task) => [task.id, task])).values()] : tasks;
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
        if (selected.has(openTaskId ?? '')) link.close();
      }),
    );

  return (
    <Stack gap="md">
      <DestructiveRisks>
        {single ? (
          <>La tâche « {taskNumbered(single)} » et ses commentaires seront supprimés définitivement. Pour la retirer des listes sans perdre ses données, archivez-la plutôt.</>
        ) : (
          `${tasksLabel(tasks.length)} et leurs commentaires seront supprimés définitivement. Pour les retirer des listes sans perdre leurs données, archivez-les plutôt.`
        )}
        {githubDeleteRisk(gone)}
        <LostOnDeleteRisk query={{ taskIds: [...selected], withSubtree: mode === 'delete' }} />
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
 * item then); links leaving the project tree are removed, with a warning. Undone from its toast (tasks and links put
 * back, all or nothing).
 * @param {TasksDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function TransferTasksDialog({ tasks, context, onDone }: TasksDialogProps) {
  const transfer = useTransferTasks(context);
  const [projectId, setProjectId] = useState<string | null>(null);
  // Out of any project.
  const [none, setNone] = useState(false);
  const target = none ? null : projectId;
  const chosen = none || projectId !== null;
  const single = tasks.length === 1 ? tasks[0] : null;
  const subtasks = single ? countSubtasks(context, single.id) : 0;
  const leavesTree = chosen && tasks.some((task) => !inProjectTree(context, target)(task.projectId));

  /**
   * Transfers the tasks; « Annuler » of its toast puts them back with the links, milestones, sprints and documents
   * removed.
   * @returns {void}
   */
  const handleConfirm = () => {
    if (!chosen) return;
    const message = single ? `Tâche ${taskName(single)} transférée.` : `${tasksLabel(tasks.length)} ${plural(tasks.length, 'transférée')}.`;
    transfer.transfer(tasks, target, message, () => onDone(true));
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
          Ce projet n’appartient pas à la même arborescence : la tâche parente, les blocages et les relations avec des tâches restées dans l’arborescence actuelle, ainsi que les documents de projet de l’arborescence actuelle, seront retirés.
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

