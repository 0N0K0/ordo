import type { TaskColumn } from '@ordo/shared';
import { createContext, useContext } from 'react';
import { notifyError, notifyWithUndo } from '../../../lib/notify';
import { useBulkTaskMutations, useTasksData, useUpdateTask, type BulkChanges, type Task, type TaskInputValues } from '../api';
import { useBulkUndo } from './bulk-undo';

/** Cells selected in one column, by row id (only rows shown by the view can be selected). */
export interface CellSelection {
  column: TaskColumn;
  rowIds: string[];
  /** Tasks of the selected rows (a task can appear on several rows when grouped by assignee). */
  taskIds: string[];
}

export const CellSelectionContext = createContext<CellSelection | null>(null);

/**
 * Saves a cell edit: on a cell of the column selection, the change applies to every selected task of the
 * column; otherwise to the edited task only.
 * @param {Task} task Edited task.
 * @param {TaskColumn} column Edited column.
 * @returns {{ apply: (single: Omit<TaskInputValues, 'projectId'>, bulk?: BulkChanges) => void, count: number }}
 *   Saver, and the number of tasks an edit would change.
 */
export function useCellEdit(task: Task, column: TaskColumn) {
  const selection = useContext(CellSelectionContext);
  const updateTask = useUpdateTask();
  const { update } = useBulkTaskMutations();
  const undo = useBulkUndo();
  const { data } = useTasksData();
  const targets =
    selection && selection.column === column && selection.taskIds.includes(task.id) ? selection.taskIds : [task.id];

  return {
    count: targets.length,
    /** Tasks the edit applies to. */
    targets,

    /**
     * Saves the edit.
     * @param {Omit<TaskInputValues, 'projectId'>} single Change for the edited task alone.
     * @param {BulkChanges} [bulk] Same change for several tasks; without it the edit stays single. Optional.
     * @returns {void}
     */
    apply: (single: Omit<TaskInputValues, 'projectId'>, bulk?: BulkChanges) => {
      if (bulk && targets.length > 1) {
        // Snapshot taken before the change, for the undo.
        const before = (data?.tasks ?? []).filter((item) => targets.includes(item.id));
        update.mutate(
          { ids: targets, changes: bulk },
          {
            onSuccess: () => notifyWithUndo(`Modification appliquée à ${targets.length} tâches.`, undo.changes(before, bulk)),
            onError: (error) => notifyError(error.message),
          },
        );
        return;
      }
      updateTask.mutate({ id: task.id, input: single }, { onError: (error) => notifyError(error.message) });
    },
  };
}
