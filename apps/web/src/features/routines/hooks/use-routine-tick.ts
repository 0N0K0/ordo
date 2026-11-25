import { notifyWithUndo, onMutationError } from '../../../lib/notify';
import { useRoutineMutations } from '../api';

/** A time of the day of an occurrence of a routine, as it is ticked. */
export interface RoutineTickRef {
  /** Routine. */
  id: string;
  /** Day that identifies the occurrence; null: its current one (as the API reads it). */
  date: string | null;
  /** Index of the time of the day. */
  slot: number;
}

/**
 * Ticks and unticks a time of the day of an occurrence of a routine, the same everywhere: ticked at a given time (or
 * its time changed), unticked in one click, each with a toast and its « Annuler » (back to how it was: not ticked, or
 * ticked at its former time).
 * @returns {{ tick: (ref: RoutineTickRef, doneAt: string, previous: string | null, onDone?: () => void) => void, untick: (ref: RoutineTickRef, previous: string | null, onDone?: () => void) => void, pending: boolean }} Writes.
 */
export function useRoutineTick() {
  const { setDone } = useRoutineMutations();

  /**
   * Writes the tick, then shows its toast, whose « Annuler » puts back the former state of the same occurrence.
   * @param {RoutineTickRef} ref Time of the day.
   * @param {string | null} doneAt When it was done; null: unticked.
   * @param {{ done: boolean, doneAt: string | null }} undo State « Annuler » puts back (ticked at `doneAt`, now when null).
   * @param {string} message Toast.
   * @param {() => void} [onDone] After the write. Optional.
   * @returns {void}
   */
  const write = (ref: RoutineTickRef, doneAt: string | null, undo: { done: boolean; doneAt: string | null }, message: string, onDone?: () => void) =>
    // Followed by its promise, not by callbacks of the call: they would be lost once the button is gone (a row the
    // tick takes out of a view, a popover or a panel closed).
    // eslint-disable-next-line no-restricted-syntax -- useRoutineTick itself.
    void setDone.mutateAsync({ id: ref.id, done: doneAt !== null, date: ref.date, slot: ref.slot, doneAt }).then((date) => {
      onDone?.();
      notifyWithUndo(message, () => {
        // eslint-disable-next-line no-restricted-syntax -- useRoutineTick itself.
        setDone.mutateAsync({ id: ref.id, done: undo.done, date: ref.date ?? date, slot: ref.slot, doneAt: undo.done ? undo.doneAt : null }).catch(onMutationError);
      });
    }, onMutationError);

  return {
    /**
     * Ticks it as done at a time, or changes the time it was done at.
     * @param {RoutineTickRef} ref Time of the day.
     * @param {string} doneAt When it was done (ISO).
     * @param {string | null} previous When it was done before (ISO); null: not ticked yet.
     * @param {() => void} [onDone] After the write. Optional.
     * @returns {void}
     */
    tick: (ref: RoutineTickRef, doneAt: string, previous: string | null, onDone?: () => void) =>
      write(ref, doneAt, { done: previous !== null, doneAt: previous }, previous ? 'Heure de réalisation changée.' : 'Routine cochée.', onDone),
    /**
     * Unticks it.
     * @param {RoutineTickRef} ref Time of the day.
     * @param {string | null} previous When it was done (ISO), given back by « Annuler »; null: unknown (now then).
     * @param {() => void} [onDone] After the write. Optional.
     * @returns {void}
     */
    untick: (ref: RoutineTickRef, previous: string | null, onDone?: () => void) => write(ref, null, { done: true, doneAt: previous }, 'Routine décochée.', onDone),
    pending: setDone.isPending,
  };
}
