import { bulkSaver, bulkTargets, useBulkTable, type BulkTable } from '../../components/data-table/bulk-edit';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { useRoutineMutations, useRoutinesData, type Routine, type RoutineBulkChanges, type RoutinePatchValues } from './api';

/** Columns of the routine table edited together on a cell selection. */
export type RoutineColumn =
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
export const routinesLabel = (count: number) => `${count} routine${count > 1 ? 's' : ''}`;

/**
 * Bulk changes of the selection, with a toast offering to undo them (the routines are put back as they were).
 * @returns {(ids: string[], changes: RoutineBulkChanges, message: string) => void} Applier.
 */
export function useBulkRoutineChanges() {
  const { data } = useRoutinesData();
  const { bulkUpdate, restore } = useRoutineMutations();
  return (ids: string[], changes: RoutineBulkChanges, message: string) => {
    // Snapshot taken before the change, for the undo.
    const before: Routine[] = (data?.routines ?? []).filter((routine) => ids.includes(routine.id));
    bulkUpdate.mutate(
      { ids, changes },
      {
        onSuccess: () => notifyWithUndo(message, () => restore.mutate(before, { onError: (error) => notifyError(error.message) })),
        onError: (error) => notifyError(error.message),
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
  const table = useBulkTable();
  const { patch } = useRoutineMutations();
  const { data } = useRoutinesData();
  const applyBulk = useBulkRoutineChanges();
  // The routines of the table, by the keys of its rows (a routine's row key is its id).
  const view: BulkTable<Routine> = { selection: table?.selection ?? null, keyOf: (item) => item.id, rows: data?.routines ?? [] };
  const columns = TABLE_COLUMNS[column] ?? column;
  const targets = bulkTargets(view, columns, routine).map((item) => item.id);
  const onError = (error: Error) => notifyError(error.message);
  return {
    count: targets.length,
    /** Routines the edit applies to. */
    targets,
    /**
     * Saves the edit: on several routines, in one bulk change when given (with its undo), else routine by routine (the
     * change made for each).
     * @param {RoutinePatchValues | ((routine: Routine) => RoutinePatchValues)} single Change of the edited routine (or of each).
     * @param {RoutineBulkChanges} [bulk] Same change for several routines at once. Optional.
     * @returns {void}
     */
    apply: (single: RoutinePatchValues | ((routine: Routine) => RoutinePatchValues), bulk?: RoutineBulkChanges) =>
      bulkSaver<Routine, RoutinePatchValues>(
        view,
        (item, change) => Object.keys(change).length > 0 && patch.mutate({ id: item.id, input: change }, { onError }),
        bulk
          ? (rows) =>
              applyBulk(
                rows.map((item) => item.id),
                bulk,
                `Modification appliquée à ${routinesLabel(rows.length)}.`,
              )
          : undefined,
        { label: routinesLabel, notify: !bulk },
      )(columns)(routine, single),
  };
}
