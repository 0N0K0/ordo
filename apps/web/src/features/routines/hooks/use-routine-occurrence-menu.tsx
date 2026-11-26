import { ArrowBendUpRightIcon, CalendarDotsIcon, PencilSimpleIcon, TreeViewIcon } from '@phosphor-icons/react';
import type { RowAction, RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { useRoutinesData, type Routine, type RoutineOccurrence } from '../api';
import { useRoutineRowsActions } from '../components/RoutineBulkBar';
import { openRoutineForm } from '../lib/open-routine-form';
import { openRoutineMove } from '../lib/open-routine-move';
import { routineCountdownItem } from '../lib/routine-countdowns';
import { movableOccurrence } from '../lib/routine-format';
import { useConvertActivity } from './use-convert-activity';
import { usePostponeRoutine } from './use-routine-move';

/** Occurrence a menu acts on: the day that identifies it, its due day, and whether it can still be moved. */
export type RoutineMenuOccurrence = Pick<RoutineOccurrence, 'date' | 'dueDate' | 'cancelled' | 'archived' | 'slots'>;

/** Actions of a routine row: its main one (an icon) and those of its « … » menu. */
export interface RoutineRowMenu {
  primary: RowAction | false;
  items: RowMenuEntry[];
}

/**
 * Whether an occurrence can still be moved or cancelled: not cancelled, not of an archived routine, none of its times of
 * the day done.
 * @param {RoutineMenuOccurrence} occurrence Occurrence.
 * @returns {boolean} Movable.
 */
const movable = (occurrence: RoutineMenuOccurrence): boolean => !occurrence.cancelled && !occurrence.archived && !occurrence.slots.some((slot) => slot.done);

/**
 * Actions of a routine for one of its occurrences, the same in its table row and in a list of a day: « Modifier » (its
 * panel, on that occurrence), « Ajouter une sous-routine », « Reporter au lendemain » and « Reporter, changer l’horaire
 * ou annuler… » (that occurrence, while it can be moved), « Dupliquer », « Héritage… » (a sub-routine), « Transformer en
 * tâche », « Archiver » / « Restaurer », « Supprimer », then « Lancer » its dead times for that occurrence. An
 * archived routine: « Restaurer » and « Supprimer » only. Without an occurrence, its
 * current one (the next one once ticked), as the routines table.
 * @returns {(routine: Routine, occurrence?: RoutineMenuOccurrence) => RoutineRowMenu} Actions of a routine.
 */
export function useRoutineOccurrenceMenu() {
  const { data } = useRoutinesData();
  const rowActionsOf = useRoutineRowsActions();
  const postpone = usePostponeRoutine();
  const convert = useConvertActivity();
  const countdownEntries = useCountdownMenuEntries();
  const routines = data?.routines ?? [];
  return (routine: Routine, occurrence?: RoutineMenuOccurrence): RoutineRowMenu => {
    const readOnly = routine.archived;
    const rowActions = rowActionsOf([routine]);
    const canMove = occurrence ? movable(occurrence) : Boolean(movableOccurrence(routine));
    const date = occurrence?.date ?? null;
    return {
      primary: !readOnly && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRoutineForm(occurrence ? { routine, occurrenceDate: occurrence.date } : { routine }) },
      items: [
        !readOnly && { label: 'Ajouter une sous-routine', icon: <TreeViewIcon aria-hidden />, onClick: () => openRoutineForm({ parent: routine }) },
        !readOnly && canMove && 'divider',
        !readOnly && canMove && { label: 'Reporter au lendemain', icon: <ArrowBendUpRightIcon aria-hidden />, onClick: () => postpone(routine, occurrence) },
        !readOnly && canMove && { label: 'Reporter, changer l’horaire ou annuler…', icon: <CalendarDotsIcon aria-hidden />, onClick: () => openRoutineMove(routine, date) },
        'divider',
        !readOnly && rowMenuEntry(rowActions.duplicate),
        // A sub-routine: its fields inherited again or emptied on purpose.
        !readOnly && Boolean(routine.parentId) && rowMenuEntry(rowActions.inheritance),
        !readOnly && convert.toTask(routine, routines.some((item) => item.parentId === routine.id)),
        rowMenuEntry(rowActions.archive),
        rowMenuEntry(rowActions.remove),
        ...(readOnly ? [] : countdownEntries(routine, routineCountdownItem(routine, date ?? routine.currentDate))),
      ],
    };
  };
}
