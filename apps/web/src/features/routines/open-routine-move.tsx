import { modals } from '@mantine/modals';
import type { Routine } from './api';
import { RoutineMoveForm } from './RoutineMoveForm';

let modalCount = 0;

/**
 * Opens the form moving an occurrence of a routine to another day.
 * @param {Routine} routine Routine.
 * @returns {void}
 */
export function openRoutineMove(routine: Routine): void {
  const modalId = `routine-move-${++modalCount}`;
  modals.open({ modalId, title: `Reporter ou avancer « ${routine.title} »`, children: <RoutineMoveForm routineId={routine.id} onDone={() => modals.close(modalId)} /> });
}
