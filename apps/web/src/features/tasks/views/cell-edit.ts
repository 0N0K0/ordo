import type { TaskColumn } from '@ordo/shared';
import { createContext, useContext } from 'react';
import type { EventOccurrence } from '../../calendar/api';
import { notifyError, notifySuccess, notifyWithUndo } from '../../../lib/notify';
import { useBulkTaskMutations, useTasksData, useUpdateTask, type BulkChanges, type Task, type TaskInputValues } from '../api';
import { useBulkUndo } from './bulk-undo';

/** Cells selected in one column, by row id (only rows shown by the view can be selected). */
export interface CellSelection {
  column: TaskColumn;
  rowIds: string[];
  /** Tasks of the selected rows (a task can appear on several rows when grouped by assignee). */
  taskIds: string[];
  /** Events of the selected rows (event rows of the views), by occurrence key. Optional. */
  eventKeys?: string[];
}

export const CellSelectionContext = createContext<CellSelection | null>(null);

/** Events shown in the rows of the table (for a change applied to the selected ones). */
export const EventRowsContext = createContext<EventOccurrence[]>([]);

/** Columns of the event rows edited in bulk (several selected events at once). */
export const EVENT_BULK_COLUMNS: readonly TaskColumn[] = ['assignees', 'beneficiaries', 'startDate', 'endDate'];

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
     * Saves the edit: on several tasks, in one bulk change when given, else task by task (the change made for each).
     * @param {Omit<TaskInputValues, 'projectId'> | ((task: Task) => Omit<TaskInputValues, 'projectId'>)} single Change of the edited task (or of each).
     * @param {BulkChanges} [bulk] Same change for several tasks at once. Optional.
     * @returns {void}
     */
    apply: (single: Omit<TaskInputValues, 'projectId'> | ((task: Task) => Omit<TaskInputValues, 'projectId'>), bulk?: BulkChanges) => {
      const changeFor = (item: Task) => (typeof single === 'function' ? single(item) : single);
      if (!bulk && targets.length > 1) {
        for (const item of (data?.tasks ?? []).filter((other) => targets.includes(other.id))) {
          const change = changeFor(item);
          if (Object.keys(change).length) updateTask.mutate({ id: item.id, input: change }, { onError: (error) => notifyError(error.message) });
        }
        notifySuccess(`Modification appliquée à ${targets.length} tâches.`);
        return;
      }
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
      updateTask.mutate({ id: task.id, input: changeFor(task) }, { onError: (error) => notifyError(error.message) });
    },
  };
}
