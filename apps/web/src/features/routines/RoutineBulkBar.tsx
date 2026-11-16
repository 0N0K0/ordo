import { ArchiveIcon, ArrowBendUpRightIcon, ArrowCounterClockwiseIcon, CheckCircleIcon, CopyIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { SelectionBar } from '../../components/data-table/SelectionBar';
import { notifyError, notifySuccess, notifyWithUndo } from '../../lib/notify';
import { routineInputOf, useRoutineMutations, type Routine } from './api';
import { routinesLabel } from './routine-cell-edit';
import { isDone, movableOccurrence } from './routine-format';
import { usePostponeRoutine } from './use-routine-move';

interface RoutineBulkBarProps {
  /** Routines selected. */
  routines: Routine[];
  onClear: () => void;
}

/**
 * Actions on the selected routines that their columns cannot do: ticked or unticked, postponed to the next day,
 * duplicated, archived or restored, deleted. Their fields are changed in their cells (a change in one applies to all
 * the routines checked).
 * @param {RoutineBulkBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function RoutineBulkBar({ routines, onClear }: RoutineBulkBarProps) {
  const { bulkArchive, bulkDone, bulkRemove, create } = useRoutineMutations();
  const postpone = usePostponeRoutine();
  const [duplicating, setDuplicating] = useState(false);
  const ids = routines.map((routine) => routine.id);
  const label = routinesLabel(ids.length);
  const allArchived = routines.every((routine) => routine.archived);
  const allDone = routines.every((routine) => routine.currentDate === null || isDone(routine));
  const movable = routines.filter((routine) => !routine.archived && movableOccurrence(routine));
  const onError = (error: Error) => notifyError(error.message);

  return (
    <SelectionBar
      label={`${label} sélectionnée${ids.length > 1 ? 's' : ''}`}
      onClear={onClear}
      actions={[
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
              for (const routine of routines) await create.mutateAsync({ ...routineInputOf(routine), title: `${routine.title} (copie)` });
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
      ]}
    />
  );
}
