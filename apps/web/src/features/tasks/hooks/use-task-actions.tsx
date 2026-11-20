import { openFormPanel } from '../../../components/panels/panels';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import type { Task } from '../api';
import { TaskCreateForm } from '../components/TaskCreateForm';
import type { TaskContext } from './use-task-context';
import { useTaskRowsActions } from '../components/BulkBar';

/**
 * Actions available on tasks (table, detail panel).
 * @param {TaskContext | null} context Task context, once loaded.
 * @returns {object} Actions.
 */
export function useTaskActions(context: TaskContext | null) {
  const actionsOf = useTaskRowsActions(context);
  return {
    /**
     * Actions of a task in its menu (the menu of every row: table, detail panel), those of the selection bar on that
     * task alone: duplicate, transfer, archive, delete (an archived task, read only: restore, delete).
     * @param {Task} task Task.
     * @returns {RowMenuEntry[]} Actions.
     */
    menu: (task: Task): RowMenuEntry[] => {
      const { duplicate, transfer, archive, remove } = actionsOf([task]);
      return (task.archived ? [archive, remove] : [duplicate, transfer, archive, remove]).map(rowMenuEntry);
    },

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
