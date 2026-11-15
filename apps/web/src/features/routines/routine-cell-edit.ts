import { createContext, useContext } from 'react';
import { notifyError, notifySuccess, notifyWithUndo } from '../../lib/notify';
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

/** Cells selected in one column, by row key (a routine can show on several rows, one per category). */
export interface RoutineCellSelection {
  column: RoutineColumn;
  rowKeys: string[];
  /** Routines of the selected rows. */
  routineIds: string[];
}

export const RoutineCellSelectionContext = createContext<RoutineCellSelection | null>(null);

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
 * Saves a cell edit: on a cell of the column selection, the change applies to every selected routine of the column;
 * otherwise to the edited routine only.
 * @param {Routine} routine Edited routine.
 * @param {RoutineColumn} column Edited column.
 * @returns {{ apply: (single: RoutinePatchValues, bulk?: RoutineBulkChanges) => void, count: number }} Saver, and the
 *   number of routines an edit would change.
 */
export function useRoutineCellEdit(routine: Routine, column: RoutineColumn) {
  const selection = useContext(RoutineCellSelectionContext);
  const { patch } = useRoutineMutations();
  const { data } = useRoutinesData();
  const applyBulk = useBulkRoutineChanges();
  const targets = selection && selection.column === column && selection.routineIds.includes(routine.id) ? selection.routineIds : [routine.id];
  return {
    count: targets.length,
    /** Routines the edit applies to. */
    targets,
    /**
     * Saves the edit: on several routines, in one bulk change when given, else routine by routine (the change made for
     * each; an empty one leaves it as it is).
     * @param {RoutinePatchValues | ((routine: Routine) => RoutinePatchValues)} single Change of the edited routine (or of each).
     * @param {RoutineBulkChanges} [bulk] Same change for several routines at once. Optional.
     * @returns {void}
     */
    apply: (single: RoutinePatchValues | ((routine: Routine) => RoutinePatchValues), bulk?: RoutineBulkChanges) => {
      const changeFor = (item: Routine) => (typeof single === 'function' ? single(item) : single);
      if (bulk && targets.length > 1) {
        applyBulk(targets, bulk, `Modification appliquée à ${routinesLabel(targets.length)}.`);
        return;
      }
      if (targets.length > 1) {
        for (const item of (data?.routines ?? []).filter((other) => targets.includes(other.id))) {
          const change = changeFor(item);
          if (Object.keys(change).length) patch.mutate({ id: item.id, input: change }, { onError: (error) => notifyError(error.message) });
        }
        notifySuccess(`Modification appliquée à ${routinesLabel(targets.length)}.`);
        return;
      }
      patch.mutate({ id: routine.id, input: changeFor(routine) }, { onError: (error) => notifyError(error.message) });
    },
  };
}
