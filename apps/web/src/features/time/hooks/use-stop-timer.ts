import { agreed, entrySeconds, formatDuration, sumOf } from '@ordo/shared';
import { toastCallbacks } from '../../../lib/notify';
import { countOf, plural } from '../../../lib/text';
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
 * Only the timers this call really stopped are told; one already stopped elsewhere: « Ce chrono était déjà arrêté. »
 * (« Ces chronos étaient déjà arrêtés. » for « Arrêter tout »), in an information toast.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, stopAll: (entries: readonly TimeEntry[]) => void, isPending: boolean }} Stop actions and their state.
 */
export function useStopTimer() {
  const { stop, stopAll } = useTimeMutations();
  return {
    stopTimer: (entry: TimeEntry) => stop.mutate(entry.id, toastCallbacks((stopped) => (stopped ? savedTimeMessage(entry) : { info: 'Ce chrono était déjà arrêté.' }))),
    stopAll: (entries: readonly TimeEntry[]) =>
      stopAll.mutate(
        undefined,
        toastCallbacks((result) => {
          const ids = new Set(result.map((entry) => entry.id));
          const stopped = entries.filter((entry) => ids.has(entry.id));
          return stopped.length ? `${countOf(stopped.length, 'chrono')} ${agreed('arrêté', false, stopped.length)}. Temps enregistré : ${formatDuration(sumOf(stopped, (entry) => entrySeconds(entry)))}.` : { info: plural(entries.length, 'Ce chrono était déjà arrêté.', 'Ces chronos étaient déjà arrêtés.') };
        }),
      ),
    isPending: stop.isPending || stopAll.isPending,
  };
}
