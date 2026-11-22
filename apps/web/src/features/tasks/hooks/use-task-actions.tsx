import { openFormPanel } from '../../../components/panels/panels';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import type { Task } from '../api';
import { TaskCreateForm } from '../components/TaskCreateForm';
import type { TaskContext } from './use-task-context';
import { useTaskRowsActions } from '../components/BulkBar';
import { useConvertActivity } from '../../routines/hooks/use-convert-activity';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { taskCountdownItem } from '../lib/task-countdowns';

/**
 * Actions available on tasks (table, detail panel).
 * @param {TaskContext | null} context Task context, once loaded.
 * @returns {object} Actions.
 */
export function useTaskActions(context: TaskContext | null) {
  const actionsOf = useTaskRowsActions(context);
  const convert = useConvertActivity();
  const countdownEntries = useCountdownMenuEntries();
  return {
    /**
     * Actions of a task in its menu (the menu of every row: table, detail panel), those of the selection bar on that
     * task alone: « Annuler » (not for a cancelled task), duplicate, transfer, « Héritage… » (a sub-task), archive, delete (an archived task, read only: restore, delete); then « Transformer
     * en routine » (refused with sub-tasks); then « Lancer » each of its dead times and saved timers.
     * @param {Task} task Task.
     * @returns {RowMenuEntry[]} Actions.
     */
    menu: (task: Task): RowMenuEntry[] => {
      const { cancel, duplicate, transfer, inheritance, archive, remove } = actionsOf([task]);
      if (task.archived) return [archive, remove].map(rowMenuEntry);
      return [
        ...(task.cancelled ? [] : [rowMenuEntry(cancel)]),
        rowMenuEntry(duplicate),
        rowMenuEntry(transfer),
        // A sub-task: its fields inherited again or emptied on purpose.
        ...(task.parentId ? [rowMenuEntry(inheritance)] : []),
        convert.toRoutine(task, Boolean(context?.childrenOf(task.id).length)),
        rowMenuEntry(archive),
        rowMenuEntry(remove),
        ...countdownEntries(task, taskCountdownItem(task, context)),
      ];
    },

    /**
     * « Fermer » / « Rouvrir » of a task alone, as the selection does: the toast tells it, with « Annuler » (a task
     * reopened is closed again as it was, done or cancelled, `useBulkUndo().closed`).
     * @param {Task} task Task.
     * @returns {SelectionAction} Action (its click and its loading).
     */
    close: (task: Task): SelectionAction => actionsOf([task]).close,

    /**
     * « Annuler » of a task alone (closed as cancelled), as the selection and the menu do, told in a toast with
     * « Annuler ».
     * @param {Task} task Task.
     * @returns {SelectionAction} Action (its click and its loading).
     */
    cancel: (task: Task): SelectionAction => actionsOf([task]).cancel,

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
