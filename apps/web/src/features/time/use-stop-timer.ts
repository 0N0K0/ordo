import { entrySeconds, formatDuration } from '@ordo/shared';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTimeMutations, type TimeEntry } from './api';

/**
 * Stops the running timer and reports the saved time.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, isPending: boolean }} Stop action and its state.
 */
export function useStopTimer() {
  const { stop } = useTimeMutations();
  return {
    stopTimer: (entry: TimeEntry) => {
      const seconds = entrySeconds(entry);
      stop.mutate(undefined, {
        onSuccess: () => notifySuccess(`Temps enregistré : ${formatDuration(seconds)}.`),
        onError: (error) => notifyError(error.message),
      });
    },
    isPending: stop.isPending,
  };
}
