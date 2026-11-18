import { formCallbacks } from '../../../lib/form';
import { useRunningTimer, useTimeMutations, type TimerStartValues } from '../api';
import { savedTimeMessage } from './use-stop-timer';

/** Hint of a start while another timer runs (decision Y). */
export const TIMER_REPLACED_HINT = 'Le chrono en cours s’arrête (son temps est enregistré).';

/**
 * Starts a timer, the same everywhere (decision Y): the one running stops (its time saved, by the API's stop) and the
 * toast says so, « Chrono démarré. » otherwise.
 * @returns {{ startTimer: (input: TimerStartValues, onStarted?: () => void) => void, isPending: boolean, replacing: boolean }} Start action, its state, and whether a timer runs (it would stop).
 */
export function useStartTimer() {
  const { start } = useTimeMutations();
  const running = useRunningTimer();
  return {
    startTimer: (input: TimerStartValues, onStarted?: () => void) => {
      const previous = running.data;
      const message = previous ? `Chrono démarré. Le précédent est arrêté. ${savedTimeMessage(previous)}` : 'Chrono démarré.';
      start.mutate(
        input,
        formCallbacks(null, message, () => onStarted?.()),
      );
    },
    isPending: start.isPending,
    replacing: Boolean(running.data),
  };
}
