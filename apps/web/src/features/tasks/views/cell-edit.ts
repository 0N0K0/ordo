import type { TaskColumn } from '@ordo/shared';
import { useEntityCellEdit } from '../../../components/data-table/bulk-edit';
import { notifyWithUndo, onMutationError } from '../../../lib/notify';
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
  const updateTask = useUpdateTask();
  const { update } = useBulkTaskMutations();
  const undo = useBulkUndo();
  const { data } = useTasksData();
  return useEntityCellEdit<Task, TaskChange, BulkChanges>(task, column, {
    rows: data?.tasks ?? [],
    save: (item, change) => updateTask.mutate({ id: item.id, input: change }, { onError: onMutationError }),
    // Snapshot taken before the change, for the undo.
    saveMany: (rows, changes) =>
      update.mutate(
        { ids: rows.map((item) => item.id), changes },
        { onSuccess: () => notifyWithUndo(`Modification appliquée à ${tasksLabel(rows.length)}.`, undo.changes(rows, changes)), onError: onMutationError },
      ),
    label: tasksLabel,
  });
}
