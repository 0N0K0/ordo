import { useEntityCellEdit } from '../../../components/data-table/selection/bulk-edit';
import { notifyWithUndo, onMutationError } from '../../../lib/notify';
import { useRoutineMutations, useRoutinesData, type Routine, type RoutineBulkChanges, type RoutinePatchValues } from '../api';
import { countOf } from '../../../lib/text';
import { cellLabel } from '../../../components/data-table/cells/cell-field';

/** Columns of the routine table edited together on a cell selection. */
type RoutineColumn =
  | 'title'
  | 'categories'
  | 'repetition'
  | 'time'
  | 'fromTime'
  | 'dueTime'
  | 'opensOn'
  | 'slots'
  | 'location'
  | 'travelBefore'
  | 'travelAfter'
  | 'alarms'
  | 'assignees'
  | 'beneficiaries'
  | 'estimate'
  | 'requires'
  | 'blocks'
  | 'parent'
  | 'project';

/**
 * Columns of the table a cell edit answers for (the due date cell edits the repetition, the time cell both times): a
 * selection of cells in one of them applies the edit to all of it.
 */
const TABLE_COLUMNS: Partial<Record<RoutineColumn, readonly string[]>> = {
  repetition: ['currentDate', 'repetition'],
  time: ['fromTime', 'dueTime'],
};

/**
 * "3 routines" / "1 routine".
 * @param {number} count Count.
 * @returns {string} Label.
 */
export const routinesLabel = (count: number) => countOf(count, 'routine');

/**
 * Bulk changes of the selection, with a toast offering to undo them (the routines are put back as they were).
 * @returns {(ids: string[], changes: RoutineBulkChanges, message: string) => void} Applier.
 */
function useBulkRoutineChanges() {
  const { data } = useRoutinesData();
  const { bulkUpdate, restore } = useRoutineMutations();
  return (ids: string[], changes: RoutineBulkChanges, message: string) => {
    // Snapshot taken before the change, for the undo.
    const before: Routine[] = (data?.routines ?? []).filter((routine) => ids.includes(routine.id));
    bulkUpdate.mutate(
      { ids, changes },
      {
        onSuccess: () => notifyWithUndo(message, () => restore.mutate(before, { onError: onMutationError })),
        onError: onMutationError,
      },
    );
  };
}

/**
 * Saves a cell edit of a routine, on the selection of its table (bulkSaver): on a cell of the column selection (or of
 * the routines checked), the change applies to every routine of it — in one bulk request when given, with its undo —,
 * otherwise to the edited routine only (an empty change leaves a routine as it is).
 * @param {Routine} routine Edited routine.
 * @param {RoutineColumn} column Edited column.
 * @returns {{ apply: (single: RoutinePatchValues | ((routine: Routine) => RoutinePatchValues), bulk?: RoutineBulkChanges) => void, count: number, targets: string[] }}
 *   Saver, the number of routines an edit would change and their ids.
 */
export function useRoutineCellEdit(routine: Routine, column: RoutineColumn) {
  const { patch } = useRoutineMutations();
  const { data } = useRoutinesData();
  const applyBulk = useBulkRoutineChanges();
  return useEntityCellEdit<Routine, RoutinePatchValues, RoutineBulkChanges>(routine, TABLE_COLUMNS[column] ?? column, {
    // Archived routines are read only: left out of the changes made on a selection.
    rows: (data?.routines ?? []).filter((item) => !item.archived),
    save: (item, change) => patch.mutate({ id: item.id, input: change }, { onError: onMutationError }),
    saveMany: (rows, changes) =>
      applyBulk(
        rows.map((item) => item.id),
        changes,
        `Modification appliquée à ${routinesLabel(rows.length)}.`,
      ),
    label: routinesLabel,
  });
}

/**
 * Accessible label of a cell of the routine table, mentioning the bulk edit of a selection (cellLabel).
 * @param {string} field Field name.
 * @param {Routine} routine Routine.
 * @param {number} count Routines changed by an edit.
 * @returns {string} Label.
 */
export const routineCellLabel = (field: string, routine: Routine, count: number): string => cellLabel(field, `de ${routine.title}`, count);
