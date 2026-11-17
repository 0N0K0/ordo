import { ArchiveIcon, ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react';

import type { SelectionAction } from '../../components/data-table/SelectionBar';
import { deleteRowsAction, duplicateRowsAction, outermost, switchRowsAction } from '../../components/data-table/selection-actions';
import { routineInputOf, useRoutineMutations, useRoutinesData, type Routine } from './api';
import { routinesLabel } from './routine-cell-edit';
import { isDone, movableOccurrence } from './routine-format';
import { usePostponeRoutine } from './use-routine-move';

/**
 * Actions on the checked routines that their columns cannot do, for the bar of the table: ticked or unticked,
 * postponed to the next day, duplicated, archived or restored, deleted. Their fields are changed in their cells (a
 * change in one applies to all the routines checked).
 * @returns {(routines: Routine[], onClear: () => void) => SelectionAction[]} Actions of the routines checked.
 */
export function useRoutineSelectionActions() {
  const { bulkArchive, bulkDone, bulkRemove, create, copySubRoutines } = useRoutineMutations();
  const { data } = useRoutinesData();
  const postpone = usePostponeRoutine();
  return (routines: Routine[], onClear: () => void): SelectionAction[] => {
    const ids = routines.map((routine) => routine.id);
    const label = routinesLabel(ids.length);
    const allArchived = routines.every((routine) => routine.archived);
    const allDone = routines.every((routine) => routine.currentDate === null || isDone(routine));
    const movable = routines.filter((routine) => !routine.archived && movableOccurrence(routine));
    const byId = new Map((data?.routines ?? []).map((routine) => [routine.id, routine]));

    return [
      switchRowsAction({
        on: allDone,
        labels: ['Cocher', 'Décocher'],
        icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: bulkDone.isPending,
        apply: (done) => bulkDone.mutateAsync({ ids, done }),
        done: (done) => `${label} ${done ? 'cochée' : 'décochée'}${ids.length > 1 ? 's' : ''}.`,
      }),
      {
        label: 'Reporter au lendemain',
        icon: <ArrowBendUpRightIcon aria-hidden />,
        disabled: movable.length === 0,
        onClick: () => {
          for (const routine of movable) postpone(routine);
        },
      },
      // Each with its sub-routines (one under another checked routine comes with it).
      duplicateRowsAction(
        outermost(
          routines,
          (routine) => routine.id,
          (id) => byId.get(id)?.parentId,
        ),
        {
          duplicate: async (routine) => {
            const copyId = await create.mutateAsync({ ...routineInputOf(routine), title: `${routine.title} (copie)` });
            if ((data?.routines ?? []).some((item) => item.parentId === routine.id)) await copySubRoutines.mutateAsync({ fromId: routine.id, toId: copyId });
          },
          done: `${label} dupliquée${ids.length > 1 ? 's' : ''}.`,
          loading: create.isPending || copySubRoutines.isPending,
        },
      ),
      switchRowsAction({
        on: allArchived,
        labels: ['Archiver', 'Restaurer'],
        icons: [<ArchiveIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: bulkArchive.isPending,
        apply: (archived) => bulkArchive.mutateAsync({ ids, archived }),
        done: (archived) => `${label} ${archived ? 'archivée' : 'restaurée'}${ids.length > 1 ? 's' : ''}.`,
        clear: onClear,
      }),
      deleteRowsAction(routines, {
        title: 'Supprimer les routines',
        risks: `${label} seront supprimées définitivement avec l’historique de leurs coches. Leurs sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible ; pour les retirer sans perdre leurs données, archivez-les plutôt.`,
        removeAll: () => bulkRemove.mutateAsync(ids),
        done: `${label} supprimée${ids.length > 1 ? 's' : ''}.`,
        clear: onClear,
        loading: bulkRemove.isPending,
      }),
    ];
  };
}
