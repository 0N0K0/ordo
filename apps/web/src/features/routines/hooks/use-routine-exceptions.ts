import type { ExceptionEntry } from '../../../components/recurrence/ExceptionsList';
import { ON_ERROR } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';
import { movesOf, routineMoveLine } from '../lib/routine-format';

/**
 * Exceptions of a routine that are moves (occurrences cancelled, moved or with other times, those it goes by), each
 * removed at once by « Rétablir » (`removeMove`: the occurrence goes back to its own day and times).
 * @param {Routine | undefined} routine Routine (none: a new one, without any).
 * @returns {ExceptionEntry[]} Exceptions.
 */
export function useRoutineMoveEntries(routine: Routine | undefined): ExceptionEntry[] {
  const { removeMove } = useRoutineMutations();
  if (!routine) return [];
  return movesOf(routine).map((move) => ({
    ...routineMoveLine(move),
    restoring: removeMove.isPending && removeMove.variables?.from === move.from,
    onRestore: () => removeMove.mutate({ id: routine.id, from: move.from }, ON_ERROR),
  }));
}
