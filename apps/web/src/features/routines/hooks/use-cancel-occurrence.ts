import { notifyWithUndo, ON_ERROR, toastCallbacks } from '../../../lib/notify';
import * as fmt from '../../../lib/format';
import { useRoutineMutations } from '../api';
import { confirmCancelOccurrence } from '../lib/confirm-cancel';

/** Occurrence of a routine to cancel or give back: the day that identifies it, its due day, the day of its rule it was moved from. */
export interface CancelledOccurrence {
  routineId: string;
  date: string;
  dueDate: string;
  movedFrom?: string | null;
}

/**
 * « Annuler » and « Rétablir » of an occurrence of a routine, the same in the calendar, the table and « Ma journée »:
 * « Annuler » once confirmed (`confirmCancelOccurrence`: it stays shown, struck through, with its comments), its toast
 * with « Annuler » giving it back as it was (its day, kept apart, its times, its comments); « Rétablir » gives a
 * cancelled one back as it was before its cancel (`removeMove` with `undo`).
 * @returns {{ cancel: (occurrence: CancelledOccurrence) => void, restore: (occurrence: CancelledOccurrence) => void }} Actions.
 */
export function useCancelOccurrence() {
  const { deleteOccurrence, removeMove } = useRoutineMutations();
  return {
    cancel: ({ routineId, date, dueDate, movedFrom }: CancelledOccurrence) =>
      confirmCancelOccurrence(dueDate, () =>
        deleteOccurrence.mutateAsync({ id: routineId, date, scope: 'THIS' }).then(({ comments }) => {
          notifyWithUndo(`Occurrence du ${fmt.dayLong(dueDate)} annulée.`, () => removeMove.mutate({ id: routineId, from: movedFrom ?? date, comments, undo: true }, ON_ERROR));
        }),
      ),
    restore: ({ routineId, date }: CancelledOccurrence) => removeMove.mutate({ id: routineId, from: date, undo: true }, toastCallbacks(`Occurrence du ${fmt.dayLong(date)} rétablie.`)),
  };
}
