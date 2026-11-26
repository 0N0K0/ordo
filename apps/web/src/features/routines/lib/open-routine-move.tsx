import { openFormPanel } from '../../../components/panels/panels';
import type { Routine } from '../api';
import { RoutineMoveForm } from '../components/RoutineMoveForm';

/**
 * Opens the form changing an occurrence of a routine: another day, other times, or cancelled.
 * @param {Routine} routine Routine.
 * @param {string | null} [date] Occurrence chosen first (the day that identifies it). Optional. Default = its current one (the next one once ticked).
 * @returns {void}
 */
export function openRoutineMove(routine: Routine, date?: string | null): void {
  openFormPanel(`Reporter ou annuler « ${routine.label} »`, (close) => <RoutineMoveForm routineId={routine.id} date={date} onDone={close} />);
}
