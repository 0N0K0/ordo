import { listDiff } from '../../../components/data-table/selection/bulk-edit';
import { ON_ERROR, onMutationError } from '../../../lib/notify';
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

/**
 * Change of the « Sous-routines » of a routine, as « Bloque »: the routines added are put under it, those removed are
 * taken out of any parent; written in the « Routine parente » of those other routines in one bulk change each way (the
 * API checks it as any parent: no loop, an archived parent refused; the occurrences lost asked once for those added,
 * once for those removed).
 * @returns {(parentId: string, children: readonly string[], next: readonly string[]) => void} Applier: the routine, its
 *   sub-routines shown, and those chosen.
 */
export function useSetSubRoutines() {
  const { bulkUpdate } = useRoutineMutations();
  return (parentId: string, children: readonly string[], next: readonly string[]) => {
    const { added, removed } = listDiff(children, next);
    // One request (one confirmation of the occurrences lost) for those added, then one for those removed, each on its
    // own: one refused or failed, the other is still sent.
    void (async () => {
      if (added.length) await bulkUpdate.mutateAsync({ ids: [...added], changes: { parentId } }).catch(onMutationError);
      if (removed.length) await bulkUpdate.mutateAsync({ ids: [...removed], changes: { parentId: null } }).catch(onMutationError);
    })();
  };
}
