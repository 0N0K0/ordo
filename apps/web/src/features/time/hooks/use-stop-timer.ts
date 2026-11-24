import { agreed, formatDuration, sumOf } from '@ordo/shared';
import { toastCallbacks } from '../../../lib/notify';
import { countOf, plural } from '../../../lib/text';
import { useTimeMutations, type TimeEntry } from '../api';

/** Timers stopped or abandoned by hand in this tab: their end is not the stop after 24 hours (`useTimerCapNotice` keeps quiet). */
const stoppedByHand = new Set<string>();

/**
 * Whether a timer was stopped or abandoned by hand in this tab (not stopped by the API after 24 hours).
 * @param {string} id Time entry id.
 * @returns {boolean} Stopped by hand.
 */
export function wasStoppedByHand(id: string): boolean {
  return stoppedByHand.has(id);
}

/**
 * Ends a timer by hand otherwise than by stopping it (abandoned): its end is told as such, not as the stop after 24
 * hours; failed, it is forgotten again.
 * @template T
 * @param {string} id Time entry id.
 * @param {() => Promise<T>} run What ends it.
 * @returns {Promise<T>} Its result.
 */
export async function endTimerByHand<T>(id: string, run: () => Promise<T>): Promise<T> {
  stoppedByHand.add(id);
  try {
    return await run();
  } catch (error) {
    stoppedByHand.delete(id);
    throw error;
  }
}

/**
 * Message of timers stopped: the time they saved, as the API recorded it.
 * @param {readonly { duration: number | null }[]} stopped Timers stopped (their recorded duration).
 * @returns {string} « Temps enregistré : 1 h 05. ».
 */
export function savedTimeMessage(stopped: readonly { duration: number | null }[]): string {
  return `Temps enregistré : ${formatDuration(sumOf(stopped, (entry) => entry.duration ?? 0))}.`;
}

/**
 * Stops a running timer (the others keep running) and reports the saved time, as the API recorded it (24 hours at
 * most); « Arrêter tout » stops every one of them, and tells those the API stopped (other tabs and devices included).
 * Only the timers this call really stopped are told; one already stopped elsewhere: « Ce chrono était déjà arrêté. »
 * (« Ces chronos étaient déjà arrêtés. » for « Arrêter tout »), in an information toast.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, stopAll: (entries: readonly TimeEntry[]) => void, isPending: boolean }} Stop actions and their state.
 */
export function useStopTimer() {
  const { stop, stopAll } = useTimeMutations();
  return {
    stopTimer: (entry: TimeEntry) => {
      stoppedByHand.add(entry.id);
      stop.mutate(
        entry.id,
        toastCallbacks((stopped) => (stopped ? savedTimeMessage([stopped]) : { info: 'Ce chrono était déjà arrêté.' })),
      );
    },
    stopAll: (entries: readonly TimeEntry[]) => {
      for (const entry of entries) stoppedByHand.add(entry.id);
      stopAll.mutate(
        undefined,
        toastCallbacks((stopped) => {
          for (const entry of stopped) stoppedByHand.add(entry.id);
          return stopped.length
            ? `${countOf(stopped.length, 'chrono')} ${agreed('arrêté', false, stopped.length)}. ${savedTimeMessage(stopped)}`
            : { info: plural(entries.length, 'Ce chrono était déjà arrêté.', 'Ces chronos étaient déjà arrêtés.') };
        }),
      );
    },
    isPending: stop.isPending || stopAll.isPending,
  };
}
