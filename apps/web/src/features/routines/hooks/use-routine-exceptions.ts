import type { ExceptionEntry } from '../../../components/recurrence/ExceptionsList';
import { ON_ERROR } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';
import { movesOf, routineMoveLine } from '../lib/routine-format';

/** Moves restored in a draft (the repetition modal): applied with it, dropped with it. */
export interface DraftRestoredMoves {
  /** Days of the rule of the moves restored. */
  restored: readonly string[];
  /** Restores one in the draft. */
  onRestore: (from: string) => void;
}

/**
 * Exceptions of a routine that are moves (occurrences cancelled, moved or with other times, those it goes by), each
 * removed by « Rétablir » (`removeMove`: the occurrence goes back to its own day and times): at once, or in a draft
 * (`draft`: hidden there, removed once it is applied, `useApplyRestoredMoves`).
 * @param {Routine | undefined} routine Routine (none: a new one, without any).
 * @param {DraftRestoredMoves} [draft] Restored in a draft. Optional. Default = at once.
 * @returns {ExceptionEntry[]} Exceptions.
 */
export function useRoutineMoveEntries(routine: Routine | undefined, draft?: DraftRestoredMoves): ExceptionEntry[] {
  const { removeMove } = useRoutineMutations();
  if (!routine) return [];
  return movesOf(routine)
    .filter((move) => !draft?.restored.includes(move.from))
    .map((move) => ({
      ...routineMoveLine(move),
      restoring: removeMove.isPending && removeMove.variables?.from === move.from,
      onRestore: () => (draft ? draft.onRestore(move.from) : removeMove.mutate({ id: routine.id, from: move.from }, ON_ERROR)),
    }));
}

/**
 * Removes the moves restored in a draft once it is applied, one after the other (each changes the exceptions saved),
 * before the rest of the draft is saved; one refused: an error toast, the next ones not removed.
 * @returns {(id: string, froms: readonly string[]) => Promise<void>} Removal of the moves of a routine.
 */
export function useApplyRestoredMoves(): (id: string, froms: readonly string[]) => Promise<void> {
  const { removeMove } = useRoutineMutations();
  return async (id, froms) => {
    try {
      for (const from of froms) await removeMove.mutateAsync({ id, from });
    } catch (error) {
      ON_ERROR.onError(error as Error);
    }
  };
}
