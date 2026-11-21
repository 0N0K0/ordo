import { openFormPanel } from '../../../components/panels/panels';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import type { Task } from '../api';
import { TaskCreateForm } from '../components/TaskCreateForm';
import type { TaskContext } from './use-task-context';
import { useTaskRowsActions } from '../components/BulkBar';
import { useConvertActivity } from '../../routines/hooks/use-convert-activity';
import { deadTimeMenuEntries } from '../../countdowns/lib/dead-time-menu';
import { taskDeadTimeItem } from '../lib/task-dead-times';

/**
 * Actions available on tasks (table, detail panel).
 * @param {TaskContext | null} context Task context, once loaded.
 * @returns {object} Actions.
 */
export function useTaskActions(context: TaskContext | null) {
  const actionsOf = useTaskRowsActions(context);
  const convert = useConvertActivity();
  return {
    /**
     * Actions of a task in its menu (the menu of every row: table, detail panel), those of the selection bar on that
     * task alone: duplicate, transfer, archive, delete (an archived task, read only: restore, delete); then « Transformer
     * en routine » (lot 15; refused with sub-tasks); then « Lancer » each of its dead times (decision FT).
     * @param {Task} task Task.
     * @returns {RowMenuEntry[]} Actions.
     */
    menu: (task: Task): RowMenuEntry[] => {
      const { duplicate, transfer, archive, remove } = actionsOf([task]);
      if (task.archived) return [archive, remove].map(rowMenuEntry);
      return [
        rowMenuEntry(duplicate),
        rowMenuEntry(transfer),
        convert.toRoutine(task, Boolean(context?.childrenOf(task.id).length)),
        rowMenuEntry(archive),
        rowMenuEntry(remove),
        ...deadTimeMenuEntries(task.deadTimes, taskDeadTimeItem(task, context)),
      ];
    },

    /**
     * « Fermer » / « Rouvrir » of a task alone, as the selection and the menu do: the toast tells it, with « Annuler »
     * (a cancelled task reopened gets its « Annulé » status back, `useBulkUndo().closed`).
     * @param {Task} task Task.
     * @returns {SelectionAction} Action (its click and its loading).
     */
    close: (task: Task): SelectionAction => actionsOf([task]).close,

    /**
     * Opens the new task form.
     * @param {{ projectId?: string, parentId?: string }} [defaults] Preselected project or parent. Optional.
     * @returns {void}
     */
    create: (defaults?: { projectId?: string; parentId?: string }) => {
      if (!context) return;
      openFormPanel(defaults?.parentId ? 'Nouvelle sous-tâche' : 'Nouvelle tâche', (close) => <TaskCreateForm context={context} defaults={defaults} onDone={close} />, 'lg');
    },
  };
}
