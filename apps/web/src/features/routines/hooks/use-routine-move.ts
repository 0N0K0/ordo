import { addDays, movedFrom, type RoutineMoveTimes } from '@ordo/shared';
import { notifyWithUndo, ON_ERROR, onMutationError } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';
import { dueDayOf, movableOccurrence, movesOf } from '../lib/routine-format';
import * as fmt from '../../../lib/format';

/** Times of the day of an occurrence moved: those chosen, and those it had (to undo). */
interface MovedTimes {
  times: RoutineMoveTimes;
  previous: RoutineMoveTimes;
}

/**
 * Moves an occurrence of a routine to another day and / or other times (an exception to its rule), with a toast
 * offering to undo it.
 * @returns {(routine: Routine, to: string, date?: string | null, onDone?: () => void, times?: MovedTimes) => void} Mover:
 *   the occurrence moved is the one given, by default the current one (the next one once ticked).
 */
export function useRoutineMove() {
  const { moveOccurrence, removeMove } = useRoutineMutations();
  return (routine: Routine, to: string, date: string | null = movableOccurrence(routine), onDone?: () => void, times?: MovedTimes) => {
    if (!date) return;
    // The day it is on now (its identity stays the day of its rule when it was kept apart on another one's day).
    const due = dueDayOf(routine, date);
    const what = to === due ? 'à d’autres horaires' : `${to > due ? 'reportée' : 'avancée'} au ${fmt.dayLong(to)}${times ? ', à d’autres horaires' : ''}`;
    moveOccurrence.mutate(
      { id: routine.id, date, to, times: times?.times },
      {
        onError: onMutationError,
        onSuccess: ({ key, merged }) => {
          onDone?.();
          // Back where it was: kept apart again when it was; merged, it comes back from the occurrence it went into
          // with what it brought there only, and the exception it had before (other times, another day).
          const from = movedFrom(movesOf(routine), date);
          notifyWithUndo(`« ${routine.label} » ${what}.`, () =>
            merged
              ? removeMove.mutate({ id: routine.id, from, undo: true }, ON_ERROR)
              : moveOccurrence.mutate({ id: routine.id, date: key, to: due, times: times?.previous, ...(due !== date && { sameDay: 'KEEP_BOTH' }) }, ON_ERROR),
          );
        },
      },
    );
  };
}

/**
 * Postpones an occurrence of a routine to the day after its due day: the one given, by default the current one (the
 * next one once ticked).
 * @returns {(routine: Routine, occurrence?: { date: string, dueDate: string }) => void} Postponer.
 */
export function usePostponeRoutine() {
  const move = useRoutineMove();
  return (routine: Routine, occurrence?: { date: string; dueDate: string }) => {
    if (occurrence) return move(routine, addDays(occurrence.dueDate, 1), occurrence.date);
    const date = movableOccurrence(routine);
    if (date) move(routine, addDays(dueDayOf(routine, date), 1), date);
  };
}
