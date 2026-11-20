import { Stack } from '@mantine/core';
import { subtreeOf } from '@ordo/shared';
import { useState } from 'react';

import { CascadeChoice, DestructiveActions, DestructiveRisks } from '../../../components/dialogs/DestructiveActions';
import { formCallbacks } from '../../../lib/form';
import { countWith, plural } from '../../../lib/text';
import { useRoutineMutations, type Routine } from '../api';
import { routinesLabel } from '../lib/routine-cell-edit';
import { LostOnDeleteRisk } from '../../time/components/LostOnDeleteRisk';

interface DeleteRoutinesDialogProps {
  /** Routines deleted. */
  routines: Routine[];
  /** Every routine (their sub-routines). */
  all: readonly Routine[];
  /** Closes it; success: they were deleted. */
  onDone: (success: boolean) => void;
}

/**
 * Deletion of routines, confirmed, as that of tasks: with sub-routines not deleted with them, asks whether to keep them
 * (moved up a level) or delete them too; tells the times without project deleted with them (extra A of decision D17).
 * @param {DeleteRoutinesDialogProps} props Component props.
 * @returns {JSX.Element} Dialog content.
 */
export function DeleteRoutinesDialog({ routines, all, onDone }: DeleteRoutinesDialogProps) {
  const { bulkRemove } = useRoutineMutations();
  const [mode, setMode] = useState<'detach' | 'delete'>('detach');
  const single = routines.length === 1 ? routines[0] : null;
  const selected = new Set(routines.map((routine) => routine.id));
  const label = routinesLabel(routines.length);
  const subRoutines = single
    ? subtreeOf(all, single.id, false).size
    : routines.filter((routine) => all.some((other) => other.parentId === routine.id && !selected.has(other.id))).length;

  /**
   * Deletes the routines with the chosen mode.
   * @returns {void}
   */
  const handleConfirm = () =>
    bulkRemove.mutate(
      { ids: [...selected], deleteSubRoutines: mode === 'delete' },
      formCallbacks(null, single ? `Routine « ${single.label} » supprimée.` : `${label} ${plural(routines.length, 'supprimée')}.`, () => onDone(true)),
    );

  return (
    <Stack gap="md">
      <DestructiveRisks>
        {single
          ? `« ${single.label} » sera supprimée définitivement avec l’historique de ses coches ; le temps chronométré reste, sans elle. Pour la retirer sans perdre ses données, archivez-la plutôt.`
          : `${label} seront supprimées définitivement avec l’historique de leurs coches ; le temps chronométré reste, sans elles. Pour les retirer sans perdre leurs données, archivez-les plutôt.`}
        <LostOnDeleteRisk query={{ routineIds: [...selected], withSubtree: mode === 'delete' }} />
      </DestructiveRisks>
      {subRoutines > 0 && (
        <CascadeChoice
          label={single ? `Que faire de ${countWith(subRoutines, 'sous-routine', ['sa', 'ses'])} ?` : 'Que faire de leurs sous-routines non sélectionnées ?'}
          keepLabel="Les conserver (elles remontent d’un niveau)"
          value={mode}
          onChange={setMode}
        />
      )}
      <DestructiveActions onConfirm={handleConfirm} onCancel={() => onDone(false)} loading={bulkRemove.isPending} />
    </Stack>
  );
}
