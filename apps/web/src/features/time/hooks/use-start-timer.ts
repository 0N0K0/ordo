import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useTimeMutations, type TimerStartValues } from '../api';

/**
 * Starts a timer (the one running stops) and reports it with « Chrono démarré. ».
 * @returns {{ startTimer: (input: TimerStartValues, onStarted?: () => void) => void, isPending: boolean }} Start action and its state.
 */
export function useStartTimer() {
  const { start } = useTimeMutations();
  return {
    startTimer: (input: TimerStartValues, onStarted?: () => void) =>
      start.mutate(input, {
        onSuccess: () => {
          notifySuccess('Chrono démarré.');
          onStarted?.();
        },
        onError: onMutationError,
      }),
    isPending: start.isPending,
  };
}
