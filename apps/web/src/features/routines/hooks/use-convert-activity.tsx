import { ArrowsClockwiseIcon, CheckSquareIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import type { RowAction } from '../../../components/actions/ActionsMenu';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useSearchParam } from '../../../lib/search-params';
import { tasksQueryKey } from '../../tasks/api';
import { TASK_PARAM, useTaskLink } from '../../tasks/hooks/use-task-link';
import { fetchRoutine, useRoutineMutations } from '../api';
import { closeRoutinePanels, openRoutineForm } from '../lib/open-routine-form';

/**
 * « Transformer en routine » / « Transformer en tâche », the entries of the « … » menus of a task and of a
 * routine (table row and panel): refused while the item has sub-items (the entry disabled, with why); asked with the
 * destructive confirmation listing what is lost (`conversionDialog`); once done, the panel still open on the item (from
 * its row or its panel) closes and the new item's opens (as « Dupliquer » opens the copy).
 * @returns {{ toRoutine: (task: { id: string }, hasChildren: boolean) => RowAction, toTask: (routine: { id: string }, hasChildren: boolean) => RowAction }} Entries.
 */
export function useConvertActivity() {
  const { convertTask, convertToTask } = useRoutineMutations();
  const queryClient = useQueryClient();
  const link = useTaskLink();
  const [openTaskId] = useSearchParam(TASK_PARAM);
  return {
    /**
     * Entry turning a task into a routine; the routine panel opens to choose its repetition.
     * @param {{ id: string }} task Task (not archived).
     * @param {boolean} hasChildren It has sub-tasks (refused).
     * @returns {RowAction} Entry.
     */
    toRoutine: (task: { id: string }, hasChildren: boolean): RowAction => ({
      label: 'Transformer en routine',
      icon: <ArrowsClockwiseIcon aria-hidden />,
      disabled: hasChildren || convertTask.isPending,
      hint: hasChildren ? 'Une tâche qui a des sous-tâches ne devient pas une routine.' : undefined,
      onClick: () =>
        void convertTask.mutateAsync(task.id).then(async (routineId) => {
          notifySuccess('Tâche transformée en routine : choisissez sa répétition.');
          if (openTaskId === task.id) link.close();
          const routine = await fetchRoutine(queryClient, routineId);
          if (routine) openRoutineForm({ routine });
        }, onMutationError),
    }),
    /**
     * Entry turning a routine into a task; the task panel opens.
     * @param {{ id: string }} routine Routine (not archived).
     * @param {boolean} hasChildren It has sub-routines (refused).
     * @returns {RowAction} Entry.
     */
    toTask: (routine: { id: string }, hasChildren: boolean): RowAction => ({
      label: 'Transformer en tâche',
      icon: <CheckSquareIcon aria-hidden />,
      disabled: hasChildren || convertToTask.isPending,
      hint: hasChildren ? 'Une routine qui a des sous-routines ne devient pas une tâche.' : undefined,
      onClick: () =>
        void convertToTask.mutateAsync(routine.id).then(async (taskId) => {
          notifySuccess('Routine transformée en tâche.');
          closeRoutinePanels([routine.id]);
          // The new task in the tasks first: its panel finds it.
          await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
          link.open(taskId);
        }, onMutationError),
    }),
  };
}
