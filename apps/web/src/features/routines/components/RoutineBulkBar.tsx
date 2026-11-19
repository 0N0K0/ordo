import { unarchived } from '../../../lib/archive';
import { mapById } from '@ordo/shared';
import { ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon, TrashIcon } from '@phosphor-icons/react';

import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { duplicateRowsAction, archiveRowsAction, outermost, switchRowsAction } from '../../../components/data-table/selection/selection-actions';
import { openModal } from '../../../components/panels/open-modal';
import { DeleteRoutinesDialog } from './DeleteRoutinesDialog';
import { routineInputOf, useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { routinesLabel } from '../lib/routine-cell-edit';
import { isDone, movableOccurrence } from '../lib/routine-format';
import { usePostponeRoutine } from '../hooks/use-routine-move';
import { plural, copyName } from '../../../lib/text';

/** Actions on routines that their columns cannot do. */
interface RoutineRowsActions {
  done: SelectionAction;
  postpone: SelectionAction;
  duplicate: SelectionAction;
  archive: SelectionAction;
  remove: SelectionAction;
}

/**
 * Actions on routines, the same on the routines checked (bar of the table) and on one routine (its menu): ticked or
 * unticked, postponed to the next day, duplicated with their sub-routines, archived or restored with their sub-routines
 * (undone from the toast), deleted (their sub-routines kept or deleted along, as chosen). Archived routines are read
 * only: left out of all but archive/restore and delete.
 * @returns {(routines: Routine[], onClear?: () => void) => RoutineRowsActions} Actions of routines, given how to clear the selection.
 */
export function useRoutineRowsActions() {
  const { bulkArchive, bulkDone, create, copySubRoutines } = useRoutineMutations();
  const { data } = useRoutinesData();
  const postpone = usePostponeRoutine();
  return (routines: Routine[], onClear: () => void = () => undefined): RoutineRowsActions => {
    const ids = routines.map((routine) => routine.id);
    const label = routinesLabel(ids.length);
    const allArchived = routines.every((routine) => routine.archived);
    const active = unarchived(routines);
    const activeIds = active.map((routine) => routine.id);
    const activeLabel = routinesLabel(activeIds.length);
    const allDone = active.every((routine) => routine.currentDate === null || isDone(routine));
    const movable = active.filter((routine) => movableOccurrence(routine));
    const byId = mapById(data?.routines ?? []);

    const single = routines.length === 1 ? routines[0] : null;
    return {
      done: {
        ...switchRowsAction({
          on: allDone,
          labels: ['Cocher', 'Décocher'],
          icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
          loading: bulkDone.isPending,
          apply: (done) => bulkDone.mutateAsync({ ids: activeIds, done }),
          done: (done) => `${activeLabel} ${plural(activeIds.length, done ? 'cochée' : 'décochée')}.`,
        }),
        disabled: activeIds.length === 0,
      },
      postpone: {
        label: 'Reporter au lendemain',
        icon: <ArrowBendUpRightIcon aria-hidden />,
        disabled: movable.length === 0,
        onClick: () => {
          for (const routine of movable) postpone(routine);
        },
      },
      // Each with its sub-routines (one under another checked routine comes with it).
      duplicate: {
        ...duplicateRowsAction(
          outermost(
            active,
            (routine) => routine.id,
            (id) => byId.get(id)?.parentId,
          ),
          {
            duplicate: async (routine) => {
              // The API leaves out its former links out of its project tree.
              const copyId = await create.mutateAsync({ ...routineInputOf(routine), label: copyName(routine.label), copyOf: routine.id });
              if ((data?.routines ?? []).some((item) => item.parentId === routine.id)) await copySubRoutines.mutateAsync({ fromId: routine.id, toId: copyId });
            },
            done: `${activeLabel} ${plural(activeIds.length, 'dupliquée')}.`,
            loading: create.isPending || copySubRoutines.isPending,
          },
        ),
        disabled: activeIds.length === 0,
      },
      archive: archiveRowsAction({
        archived: allArchived,
        loading: bulkArchive.isPending,
        apply: (archived) => bulkArchive.mutateAsync({ ids, archived }),
        label,
        count: ids.length,
        feminine: true,
        clear: onClear,
      }),
      // Its own dialog: what to do with the sub-routines.
      remove: {
        label: 'Supprimer',
        icon: <TrashIcon aria-hidden />,
        danger: true,
        onClick: () =>
          openModal(single ? 'Supprimer la routine' : 'Supprimer les routines', (close) => (
            <DeleteRoutinesDialog
              routines={routines}
              all={data?.routines ?? []}
              onDone={(success) => {
                close();
                if (success) onClear();
              }}
            />
          )),
      },
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
