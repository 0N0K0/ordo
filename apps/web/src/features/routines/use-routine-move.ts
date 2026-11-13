import { addDays } from '@ordo/shared';
import { notifyError, notifyWithUndo } from '../../lib/notify';
import { useRoutineMutations, type Routine } from './api';
import { movableOccurrence } from './routine-format';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * Long date of a calendar date: "jeudi 13 novembre".
 * @param {string} date YYYY-MM-DD.
 * @returns {string} Text.
 */
export const longDay = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));

/**
 * Moves an occurrence of a routine to another day (an exception to its rule), with a toast offering to undo it.
 * @returns {(routine: Routine, to: string, date?: string | null, onDone?: () => void) => void} Mover: the occurrence
 *   moved is the one given, by default the current one (the next one once ticked).
 */
export function useRoutineMove() {
  const { moveOccurrence } = useRoutineMutations();
  const onError = (error: Error) => notifyError(error.message);
  return (routine: Routine, to: string, date: string | null = movableOccurrence(routine), onDone?: () => void) => {
    if (!date) return;
    moveOccurrence.mutate(
      { id: routine.id, date, to },
      {
        onError,
        onSuccess: () => {
          onDone?.();
          notifyWithUndo(`« ${routine.title} » ${to > date ? 'reportée' : 'avancée'} au ${longDay(to)}.`, () => moveOccurrence.mutate({ id: routine.id, date: to, to: date }, { onError }));
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
