import { unarchived } from '../../../lib/archive';
import { mapById } from '@ordo/shared';
import { ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon, TrashIcon } from '@phosphor-icons/react';

import type { SelectionAction } from '../../../components/data-table/selection/SelectionBar';
import { duplicateRowsAction, archiveRowsAction, outermost, switchRowsAction } from '../../../components/data-table/selection/selection-actions';
import { openModal } from '../../../components/panels/open-modal';
import { DeleteRoutinesDialog } from './DeleteRoutinesDialog';
import { BulkTickForm } from './RoutineTick';
import { openFormPanel } from '../../../components/panels/panels';
import { routineInputOf, routinesKey, useRoutineMutations, useRoutinesData, type Routine } from '../api';
import type { RoutinesDataQuery } from '../../../graphql/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { cachedItem } from '../../../lib/mutation';
import { closeRoutinePanels, openRoutineForm } from '../lib/open-routine-form';
import { routinesLabel } from '../lib/routine-cell-edit';
import { isDone, movableOccurrence } from '../lib/routine-format';
import { usePostponeRoutine } from '../hooks/use-routine-move';
import { plural, copyName } from '../../../lib/text';
import { inheritanceRowsAction } from '../../../components/inheritance/inheritance-action';
import { notifyWithUndo, ON_ERROR } from '../../../lib/notify';
import { ROUTINE_INHERITANCE_OPTIONS } from '../lib/routine-inheritance';

/** Actions on routines that their columns cannot do. */
interface RoutineRowsActions {
  done: SelectionAction;
  postpone: SelectionAction;
  duplicate: SelectionAction;
  inheritance: SelectionAction;
  archive: SelectionAction;
  remove: SelectionAction;
}

/**
 * Actions on routines, the same on the routines checked (bar of the table) and on one routine (its menu): ticked or
 * unticked, postponed to the next day, duplicated with their sub-routines, their inheritance changed (« Héritage… »,
 * sub-routines), archived or restored with their sub-routines
 * (undone from the toast), deleted (their sub-routines kept or deleted along, as chosen; their panels closed). Archived routines are read
 * only: left out of all but archive/restore and delete.
 * @returns {(routines: Routine[], onClear?: () => void) => RoutineRowsActions} Actions of routines, given how to clear the selection.
 */
export function useRoutineRowsActions() {
  const { bulkArchive, bulkDone, bulkUpdate, create, copySubRoutines, restore } = useRoutineMutations();
  const { data } = useRoutinesData();
  const queryClient = useQueryClient();
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
    /**
     * Ticks (« Faites le » a day, else now) or unticks the occurrence each shows, told with its undo (on the same ones).
     * @param {string | null} doneOn Day they were done (ticking); null: now.
     * @returns {SelectionAction} Action.
     */
    // The occurrence each shows (unticked: those done; ticked: those still to do), the same for its « Annuler ».
    const shown = active.filter((routine) => routine.currentDate !== null && (allDone || !isDone(routine)));
    const shownIds = shown.map((routine) => routine.id);
    const shownDates = shown.map((routine) => routine.currentDate as string);
    const doneSwitch = (doneOn: string | null) =>
      switchRowsAction({
        on: allDone,
        labels: ['Cocher', 'Décocher'],
        icons: [<CheckCircleIcon key="on" aria-hidden />, <ArrowCounterClockwiseIcon key="off" aria-hidden />],
        loading: bulkDone.isPending,
        apply: (done) => bulkDone.mutateAsync({ ids: shownIds, done, doneOn: done ? doneOn : null, dates: shownDates }),
        done: (done) => `${routinesLabel(shownIds.length)} ${plural(shownIds.length, done ? 'cochée' : 'décochée')}.`,
      });
    return {
      done: allDone
        ? { ...doneSwitch(null), disabled: shownIds.length === 0 }
        : {
            ...doneSwitch(null),
            // Ticked « Faites le » a day, asked first.
            onClick: () =>
              openFormPanel(`Cocher ${routinesLabel(shownIds.length)}`, (close) => (
                <BulkTickForm
                  onCancel={close}
                  onSubmit={(doneOn) => {
                    close();
                    doneSwitch(doneOn).onClick();
                  }}
                />
              )),
            disabled: shownIds.length === 0,
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
              return copyId;
            },
            done: activeIds.length > 1 ? `${activeLabel} ${plural(activeIds.length, 'dupliquée')}.` : 'Routine dupliquée.',
            // Its panel, once the routines are refreshed with it.
            open: (copyId) => {
              const copy = cachedItem(queryClient, routinesKey, copyId, (routinesData: RoutinesDataQuery) => routinesData.routines);
              if (copy) openRoutineForm({ routine: copy });
            },
            loading: create.isPending || copySubRoutines.isPending,
          },
        ),
        disabled: activeIds.length === 0,
      },
      // Fields inherited again or emptied on purpose, on the sub-routines among them, undone from its toast.
      inheritance: inheritanceRowsAction({
        fields: ROUTINE_INHERITANCE_OPTIONS,
        about: activeLabel,
        withParent: active.filter((routine) => routine.parentId).length,
        onApply: async (change) => {
          await bulkUpdate.mutateAsync({ ids: activeIds, changes: change });
          notifyWithUndo(`Héritage changé pour ${activeLabel}.`, () => restore.mutate(active, ON_ERROR));
        },
        onDone: onClear,
      }),
      archive: archiveRowsAction({
        archived: allArchived,
        loading: bulkArchive.isPending,
        apply: (archived) => bulkArchive.mutateAsync({ ids, archived }),
        label,
        count: ids.length,
        feminine: true,
        clear: onClear,
      }),
      // Its own dialog: what to do with the sub-routines; their panels closed once deleted (the panel's menu too).
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
                if (!success) return;
                closeRoutinePanels(ids);
                onClear();
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
