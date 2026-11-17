import { addDays, type RoutineMoveTimes } from '@ordo/shared';
import { notifyWithUndo, onMutationError } from '../../lib/notify';
import { useRoutineMutations, type Routine } from './api';
import { movableOccurrence } from './routine-format';
import * as fmt from '../../lib/format';

/**
 * Long date of a calendar date: "jeudi 13 novembre".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
export const longDay = (date: string) => fmt.dayLong(date);

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
  const { moveOccurrence } = useRoutineMutations();
  const onError = onMutationError;
  return (routine: Routine, to: string, date: string | null = movableOccurrence(routine), onDone?: () => void, times?: MovedTimes) => {
    if (!date) return;
    const what = to === date ? 'à d’autres horaires' : `${to > date ? 'reportée' : 'avancée'} au ${longDay(to)}${times ? ', à d’autres horaires' : ''}`;
    moveOccurrence.mutate(
      { id: routine.id, date, to, times: times?.times },
      {
        onError,
        onSuccess: () => {
          onDone?.();
          notifyWithUndo(`« ${routine.title} » ${what}.`, () => moveOccurrence.mutate({ id: routine.id, date: to, to: date, times: times?.previous }, { onError }));
        },
      },
    );
  };
}

/**
 * Postpones the occurrence of a routine to the next day (the current one, the next one once ticked).
 * @returns {(routine: Routine) => void} Postponer.
 */
export function usePostponeRoutine() {
  const move = useRoutineMove();
  return (routine: Routine) => {
    const date = movableOccurrence(routine);
    if (date) move(routine, addDays(date, 1), date);
  };
}
