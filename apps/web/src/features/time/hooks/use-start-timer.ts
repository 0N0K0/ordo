import { formCallbacks } from '../../../lib/form';
import { useRunningTimer, useTimeMutations, type TimerStartValues } from '../api';
import { savedTimeMessage } from './use-stop-timer';

/** Hint of a start while another timer runs (decision Y). */
const TIMER_REPLACED_HINT = 'Le chrono en cours s’arrête (son temps est enregistré).';

/**
 * Tooltip of a button starting a timer, the same everywhere: while another timer runs, that it will stop (decision Y);
 * nothing on a disabled button, nor when no timer runs.
 * @returns {(disabled?: boolean, lead?: string) => string | undefined} Hint builder: the button is disabled (optional,
 * default = false), the text before the warning (optional).
 */
export function useTimerHint(): (disabled?: boolean, lead?: string) => string | undefined {
  const running = useRunningTimer();
  const replacing = Boolean(running.data);
  return (disabled = false, lead) => (disabled || !replacing ? undefined : lead ? `${lead} ${TIMER_REPLACED_HINT}` : TIMER_REPLACED_HINT);
}

/**
 * Starts a timer, the same everywhere (decision Y): the one running stops (its time saved, by the API's stop) and the
 * toast says so, « Chrono démarré. » otherwise.
 * @returns {{ startTimer: (input: TimerStartValues, onStarted?: () => void) => void, isPending: boolean, hint: (disabled?: boolean, lead?: string) => string | undefined }} Start action, its state, and the tooltip of its button (useTimerHint).
 */
export function useStartTimer() {
  const { start } = useTimeMutations();
  const running = useRunningTimer();
  const hint = useTimerHint();
  return {
    startTimer: (input: TimerStartValues, onStarted?: () => void) => {
      const previous = running.data;
      const message = previous ? `Chrono démarré. Le chrono en cours s’est arrêté. ${savedTimeMessage(previous)}` : 'Chrono démarré.';
      start.mutate(
        input,
        formCallbacks(null, message, () => onStarted?.()),
      );
    },
    isPending: start.isPending,
    hint,
  };
}
