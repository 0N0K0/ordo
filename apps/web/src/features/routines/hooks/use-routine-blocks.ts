import { listDiff } from '../../../components/data-table/selection/bulk-edit';
import { ON_ERROR } from '../../../lib/notify';
import { useRoutineMutations, type Routine } from '../api';

/**
 * Change of the « Bloque » of routines: the routines added to it now depend on each blocking routine, those removed no
 * longer; written in the « Dépend de » of those other routines (the API checks them as any « Dépend de »: same project
 * tree, no loop, an archived routine refused as a new link).
 * @param {readonly Routine[]} routines Routines.
 * @returns {(blocked: readonly string[], next: readonly string[], blockers: readonly string[]) => void} Applier: the
 *   routines blocked shown, those chosen, and the blocking routines (the one edited, or each one of a selection).
 */
export function useSetBlockedRoutines(routines: readonly Routine[]) {
  const { patch } = useRoutineMutations();
  return (blocked: readonly string[], next: readonly string[], blockers: readonly string[]) => {
    const { added, removed } = listDiff(blocked, next);
    for (const other of routines) {
      let required = other.requiredIds;
      if (added.includes(other.id)) required = [...new Set([...required, ...blockers.filter((id) => id !== other.id)])];
      if (removed.includes(other.id)) required = required.filter((id) => !blockers.includes(id));
      if (required.length !== other.requiredIds.length || required.some((id) => !other.requiredIds.includes(id))) {
        patch.mutate({ id: other.id, input: { requiredIds: required } }, ON_ERROR);
      }
    }
  };
}
