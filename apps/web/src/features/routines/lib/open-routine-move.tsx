import { openFormPanel } from '../../../components/panels/panels';
import type { Routine } from '../api';
import { RoutineMoveForm } from '../components/RoutineMoveForm';

/**
 * Opens the form changing an occurrence of a routine: another day, other times, or cancelled.
 * @param {Routine} routine Routine.
 * @returns {void}
 */
export function openRoutineMove(routine: Routine): void {
  openFormPanel(`Reporter ou annuler « ${routine.title} »`, (close) => <RoutineMoveForm routineId={routine.id} onDone={close} />);
}
