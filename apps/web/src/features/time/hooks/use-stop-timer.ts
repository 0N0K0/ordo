import { agreed, entrySeconds, formatDuration, sumOf } from '@ordo/shared';
import { toastCallbacks } from '../../../lib/notify';
import { countOf } from '../../../lib/text';
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
 * Stops a running timer (the others keep running) and reports the saved time; « Arrêter tout » stops every one of them.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, stopAll: (entries: readonly TimeEntry[]) => void, isPending: boolean }} Stop actions and their state.
 */
export function useStopTimer() {
  const { stop, stopAll } = useTimeMutations();
  return {
    stopTimer: (entry: TimeEntry) => stop.mutate(entry.id, toastCallbacks(savedTimeMessage(entry))),
    stopAll: (entries: readonly TimeEntry[]) =>
      stopAll.mutate(
        undefined,
        toastCallbacks(`${countOf(entries.length, 'chrono')} ${agreed('arrêté', false, entries.length)}. Temps enregistré : ${formatDuration(sumOf(entries, (entry) => entrySeconds(entry)))}.`),
      ),
    isPending: stop.isPending || stopAll.isPending,
  };
}
