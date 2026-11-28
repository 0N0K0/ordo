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
 * (`draft`: hidden there, removed with the save of the repetition, all or nothing: `restoredMoves` of `update` / `patch`).
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
