import { ArchiveIcon, ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { SelectionAction } from '../../components/data-table/SelectionBar';
import { notifyError, notifySuccess, notifyWithUndo } from '../../lib/notify';
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
  const [duplicating, setDuplicating] = useState(false);
  return (routines: Routine[], onClear: () => void): SelectionAction[] => {
    const ids = routines.map((routine) => routine.id);
    const label = routinesLabel(ids.length);
    const allArchived = routines.every((routine) => routine.archived);
    const allDone = routines.every((routine) => routine.currentDate === null || isDone(routine));
    const movable = routines.filter((routine) => !routine.archived && movableOccurrence(routine));
    const onError = (error: Error) => notifyError(error.message);

    return [
      {
        label: allDone ? 'Décocher' : 'Cocher',
        icon: allDone ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />,
        loading: bulkDone.isPending,
        onClick: () =>
          bulkDone.mutate(
            { ids, done: !allDone },
            {
              onSuccess: (count) => notifyWithUndo(`${routinesLabel(count)} ${allDone ? 'décochée' : 'cochée'}${count > 1 ? 's' : ''}.`, () => bulkDone.mutate({ ids, done: allDone }, { onError })),
              onError,
            },
          ),
      },
      {
        label: 'Reporter au lendemain',
        icon: <ArrowBendUpRightIcon aria-hidden />,
        disabled: movable.length === 0,
        onClick: () => {
          for (const routine of movable) postpone(routine);
        },
      },
      {
        label: 'Dupliquer',
        icon: <CopyIcon aria-hidden />,
        loading: duplicating,
        onClick: async () => {
          setDuplicating(true);
          try {
            // Each with its sub-routines (one under another checked routine comes with it).
            const checked = new Set(ids);
            const byId = new Map((data?.routines ?? []).map((routine) => [routine.id, routine]));
            const under = (routine: Routine) => {
              for (let parent = routine.parentId ? byId.get(routine.parentId) : undefined; parent; parent = parent.parentId ? byId.get(parent.parentId) : undefined)
                if (checked.has(parent.id)) return true;
              return false;
            };
            for (const routine of routines.filter((item) => !under(item))) {
              const copyId = await create.mutateAsync({ ...routineInputOf(routine), title: `${routine.title} (copie)` });
              if ((data?.routines ?? []).some((item) => item.parentId === routine.id)) await copySubRoutines.mutateAsync({ fromId: routine.id, toId: copyId });
            }
            notifySuccess(`${label} dupliquée${ids.length > 1 ? 's' : ''}.`);
          } catch (error) {
            onError(error as Error);
          } finally {
            setDuplicating(false);
          }
        },
      },
      {
        label: allArchived ? 'Restaurer' : 'Archiver',
        icon: allArchived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
        loading: bulkArchive.isPending,
        onClick: () =>
          bulkArchive.mutate(
            { ids, archived: !allArchived },
            {
              onSuccess: () => {
                notifyWithUndo(`${label} ${allArchived ? 'restaurée' : 'archivée'}${ids.length > 1 ? 's' : ''}.`, () => bulkArchive.mutate({ ids, archived: allArchived }, { onError }));
                onClear();
              },
              onError,
            },
          ),
      },
      {
        label: 'Supprimer',
        icon: <TrashIcon aria-hidden />,
        loading: bulkRemove.isPending,
        destructive: {
          title: 'Supprimer les routines',
          risks: `${label} seront supprimées définitivement avec l’historique de leurs coches. Leurs sous-routines remonteront d’un niveau ; le temps chronométré reste, sans routine. Cette action est irréversible ; pour les retirer sans perdre leurs données, archivez-les plutôt.`,
        },
        onClick: () =>
          bulkRemove.mutate(ids, {
            onSuccess: (count) => {
              notifySuccess(`${routinesLabel(count)} supprimée${count > 1 ? 's' : ''}.`);
              onClear();
            },
            onError,
          }),
      },
    ];
  };
}
