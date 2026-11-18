import { entrySeconds, formatDuration } from '@ordo/shared';
import { toastCallbacks } from '../../../lib/notify';
import { useTimeMutations, type TimeEntry } from '../api';

/**
 * Message of a timer stopped: the time it saved.
 * @param {TimeEntry} entry Timer stopped.
 * @returns {string} « Temps enregistré : 1 h 05. ».
 */
export function savedTimeMessage(entry: TimeEntry): string {
  return `Temps enregistré : ${formatDuration(entrySeconds(entry))}.`;
}

/**
 * Stops the running timer and reports the saved time.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, isPending: boolean }} Stop action and its state.
 */
export function useStopTimer() {
  const { stop } = useTimeMutations();
  return {
    stopTimer: (entry: TimeEntry) => stop.mutate(undefined, toastCallbacks(savedTimeMessage(entry))),
    isPending: stop.isPending,
  };
}
