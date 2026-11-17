import { ArchiveIcon, ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon } from '@phosphor-icons/react';

import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { deleteRowsAction, duplicateRowsAction, outermost, switchRowsAction } from '../../../components/data-table/selection/selection-actions';
import { routineInputOf, useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { routinesLabel } from '../lib/routine-cell-edit';
import { isDone, movableOccurrence } from '../lib/routine-format';
import { usePostponeRoutine } from '../hooks/use-routine-move';
import { plural } from '../../../lib/text';

/** Actions on routines that their columns cannot do. */
export interface RoutineRowsActions {
  done: SelectionAction;
  postpone: SelectionAction;
  duplicate: SelectionAction;
  archive: SelectionAction;
  remove: SelectionAction;
}

/**
 * Actions on routines, the same on the routines checked (bar of the table) and on one routine (its menu): ticked or
 * unticked, postponed to the next day, duplicated with their sub-routines, archived or restored (undone from the toast),
 * deleted.
 * @returns {(routines: Routine[], onClear?: () => void) => RoutineRowsActions} Actions of routines, given how to clear the selection.
 */
export function useRoutineRowsActions() {
  const { bulkArchive, bulkDone, bulkRemove, create, copySubRoutines } = useRoutineMutations();
  const { data } = useRoutinesData();
  const postpone = usePostponeRoutine();
  return (routines: Routine[], onClear: () => void = () => undefined): RoutineRowsActions => {
    const ids = routines.map((routine) => routine.id);
    const label = routinesLabel(ids.length);
    const allArchived = routines.every((routine) => routine.archived);
    const allDone = routines.every((routine) => routine.currentDate === null || isDone(routine));
    const movable = routines.filter((routine) => !routine.archived && movableOccurrence(routine));
    const byId = new Map((data?.routines ?? []).map((routine) => [routine.id, routine]));

    const single = routines.length === 1 ? routines[0] : null;
    return {
      done: switchRowsAction({
        on: allDone,
        labels: ['Cocher', 'Décocher'],
        icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: bulkDone.isPending,
        apply: (done) => bulkDone.mutateAsync({ ids, done }),
        done: (done) => `${label} ${done ? 'cochée' : 'décochée'}${ids.length > 1 ? 's' : ''}.`,
      }),
      postpone: {
        label: 'Reporter au lendemain',
        icon: <ArrowBendUpRightIcon aria-hidden />,
        disabled: movable.length === 0,
        onClick: () => {
          for (const routine of movable) postpone(routine);
        },
      },
      // Each with its sub-routines (one under another checked routine comes with it).
      duplicate: duplicateRowsAction(
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
          done: `${label} ${plural(ids.length, 'dupliquée')}.`,
          loading: create.isPending || copySubRoutines.isPending,
        },
      ),
      archive: switchRowsAction({
        on: allArchived,
        labels: ['Archiver', 'Restaurer'],
        icons: [<ArchiveIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: bulkArchive.isPending,
        apply: (archived) => bulkArchive.mutateAsync({ ids, archived }),
        done: (archived) => `${label} ${archived ? 'archivée' : 'restaurée'}${ids.length > 1 ? 's' : ''}.`,
        clear: onClear,
      }),
      remove: deleteRowsAction(routines, {
        title: single ? 'Supprimer la routine' : 'Supprimer les routines',
        risks: single
          ? `« ${single.title} » sera supprimée définitivement avec l’historique de ses coches. Ses sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible ; pour la retirer sans perdre ses données, archivez-la plutôt.`
          : `${label} seront supprimées définitivement avec l’historique de leurs coches. Leurs sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible ; pour les retirer sans perdre leurs données, archivez-les plutôt.`,
        removeAll: () => bulkRemove.mutateAsync(ids),
        done: `${label} ${plural(ids.length, 'supprimée')}.`,
        clear: onClear,
        loading: bulkRemove.isPending,
      }),
    };
  };
}

/**
 * Actions on the checked routines, for the bar of the table. Their fields are changed in their cells (a change in one
 * applies to all the routines checked).
 * @returns {(routines: Routine[], onClear: () => void) => SelectionAction[]} Actions of the routines checked.
 */
export function useRoutineSelectionActions() {
  const actionsOf = useRoutineRowsActions();
  return (routines: Routine[], onClear: () => void): SelectionAction[] => Object.values(actionsOf(routines, onClear));
}
