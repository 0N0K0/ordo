import type { TaskColumn } from '@ordo/shared';
import { bulkSaver, bulkTargets, useBulkTable, type BulkTable } from '../../../components/data-table/bulk-edit';
import { notifyError, notifyWithUndo } from '../../../lib/notify';
import { useBulkTaskMutations, useTasksData, useUpdateTask, type BulkChanges, type Task, type TaskInputValues } from '../api';
import { useBulkUndo } from './bulk-undo';
import { tasksLabel } from './bulk-label';

/** Change of a task made in one of its cells. */
type TaskChange = Omit<TaskInputValues, 'projectId'>;

/**
 * Saves a cell edit of a task, on the selection of its table (bulkSaver): on a cell of the column selection (or of the
 * tasks checked), the change applies to every task of it — in one bulk request when given, with its undo —, otherwise
 * to the edited task only.
 * @param {Task} task Edited task.
 * @param {TaskColumn} column Edited column.
 * @returns {{ apply: (single: TaskChange | ((task: Task) => TaskChange), bulk?: BulkChanges) => void, count: number, targets: string[] }}
 *   Saver, the number of tasks an edit would change and their ids.
 */
export function useCellEdit(task: Task, column: TaskColumn) {
  const table = useBulkTable();
  const updateTask = useUpdateTask();
  const { update } = useBulkTaskMutations();
  const undo = useBulkUndo();
  const { data } = useTasksData();
  // The tasks of the table, by the keys of its rows (a task's row key is its id; the events have their own).
  const view: BulkTable<Task> = { selection: table?.selection ?? null, keyOf: (item) => item.id, rows: data?.tasks ?? [] };
  const targets = bulkTargets(view, column, task).map((item) => item.id);
  const onError = (error: Error) => notifyError(error.message);

  return {
    count: targets.length,
    /** Tasks the edit applies to. */
    targets,

    /**
     * Saves the edit: on several tasks, in one bulk change when given (with its undo), else task by task (the change
     * made for each).
     * @param {TaskChange | ((task: Task) => TaskChange)} single Change of the edited task (or of each).
     * @param {BulkChanges} [bulk] Same change for several tasks at once. Optional.
     * @returns {void}
     */
    apply: (single: TaskChange | ((task: Task) => TaskChange), bulk?: BulkChanges) =>
      bulkSaver<Task, TaskChange>(
        view,
        (item, change) => Object.keys(change).length > 0 && updateTask.mutate({ id: item.id, input: change }, { onError }),
        bulk
          ? (rows) => {
              // Snapshot taken before the change, for the undo.
              const ids = rows.map((item) => item.id);
              update.mutate({ ids, changes: bulk }, { onSuccess: () => notifyWithUndo(`Modification appliquée à ${tasksLabel(ids.length)}.`, undo.changes(rows, bulk)), onError });
            }
          : undefined,
        { label: tasksLabel, notify: !bulk },
      )(column)(task, single),
  };
}
