import { agreed, formatDuration, reachedDurationMax, sumOf } from '@ordo/shared';
import { notifyInfo, toastCallbacks } from '../../../lib/notify';
import { countOf, plural } from '../../../lib/text';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { runningTimersQueryKey, timeQueryKey, useTimeMutations, type TimeEntry } from '../api';

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
 * Tells that a timer was stopped by the API once it had run 24 hours (the longest time): « Chrono arrêté après 24
 * heures », what it was spent on (when given) and « Sa durée est de 24 heures, le maximum d’un temps. »; once per timer.
 * @param {string} id Time entry id.
 * @param {string} [subject] What it was spent on. Optional. Default = not told.
 * @returns {void}
 */
export function notifyTimerCap(id: string, subject?: string): void {
  notifyInfo({ id: `timer-cap-${id}`, title: 'Chrono arrêté après 24 heures', lines: [subject, 'Sa durée est de 24 heures, le maximum d’un temps.'] });
}

/**
 * Message of timers stopped: the time they saved, as the API recorded it.
 * @param {readonly { duration: number | null }[]} stopped Timers stopped (their recorded duration).
 * @returns {string} « Temps enregistré : 1 h 05. ».
 */
export function savedTimeMessage(stopped: readonly { duration: number | null }[]): string {
  return `Temps enregistré : ${formatDuration(sumOf(stopped, (entry) => entry.duration ?? 0))}.`;
}

/** Toast of timers a stop lost twice to a change made meanwhile (they still run). */
const changedMessage = (count: number): string => plural(count, 'Ce chrono vient d’être modifié : réessayez.', 'Ces chronos viennent d’être modifiés : réessayez.');

/**
 * A timer as stopped in the time data reloaded after a stop (a list of times showing it ended, with its recorded
 * duration), else as it was when asked to stop.
 * @param {QueryClient} queryClient Query client.
 * @param {TimeEntry} entry Timer as it was when asked to stop.
 * @returns {TimeEntry} Timer, the freshest known.
 */
function freshEntry(queryClient: QueryClient, entry: TimeEntry): TimeEntry {
  for (const [, data] of queryClient.getQueriesData({ queryKey: timeQueryKey })) {
    const found = Array.isArray(data) ? (data as TimeEntry[]).find((item) => item?.id === entry.id && item.endedAt !== null) : undefined;
    if (found) return found;
  }
  return entry;
}

/**
 * Whether a timer still runs, as the running timers reloaded after a stop show it.
 * @param {QueryClient} queryClient Query client.
 * @param {string} id Time entry id.
 * @returns {boolean} Still running.
 */
const stillRunning = (queryClient: QueryClient, id: string): boolean => (queryClient.getQueryData<TimeEntry[]>(runningTimersQueryKey) ?? []).some((item) => item.id === id);

/**
 * Callbacks of a stop by hand: its toast, and on failure (network…) the timers forgotten as stopped by hand, so that
 * their stop after 24 hours is still told (`useTimerCapNotice`).
 * @template T
 * @param {readonly TimeEntry[]} entries Timers asked to stop.
 * @param {(result: T) => string | { info: string } | null} message Toast of the result.
 * @returns {{ onSuccess: (result: T) => void, onError: (error: Error) => void }} Mutation callbacks.
 */
function stopCallbacks<T>(entries: readonly TimeEntry[], message: (result: T) => string | { info: string } | null) {
  const callbacks = toastCallbacks(message);
  return {
    onSuccess: callbacks.onSuccess,
    onError: (error: Error) => {
      for (const entry of entries) stoppedByHand.delete(entry.id);
      callbacks.onError(error);
    },
  };
}

/**
 * Stops a running timer (the others keep running) and reports the saved time, as the API recorded it (24 hours at
 * most); « Arrêter tout » stops every one of them, and tells those the API stopped (other tabs and devices included).
 * Only the timers this call really stopped are told; one the API had already stopped after 24 hours (its reloaded
 * duration, else its live one: `reachedDurationMax`): « Chrono arrêté après 24 heures » (`notifyTimerCap`); one
 * « Arrêter tout » left running (changed twice meanwhile): « Ce chrono vient d’être modifié : réessayez. »; one already
 * stopped elsewhere: « Ce chrono était déjà arrêté. » (« Ces chronos étaient déjà arrêtés. » for « Arrêter tout »), in
 * information toasts. A stop that fails is not told as by hand.
 * @param {(entry: TimeEntry) => string} [subjectOf] What a timer is spent on, told with its stop after 24 hours. Optional. Default = not told.
 * @returns {{ stopTimer: (entry: TimeEntry) => void, stopAll: (entries: readonly TimeEntry[]) => void, isPending: boolean }} Stop actions and their state.
 */
export function useStopTimer(subjectOf?: (entry: TimeEntry) => string) {
  const { stop, stopAll } = useTimeMutations();
  const queryClient = useQueryClient();
  return {
    stopTimer: (entry: TimeEntry) => {
      stoppedByHand.add(entry.id);
      stop.mutate(
        entry.id,
        stopCallbacks([entry], (stopped) => {
          if (stopped) return savedTimeMessage([stopped]);
          if (!reachedDurationMax(freshEntry(queryClient, entry))) return { info: 'Ce chrono était déjà arrêté.' };
          notifyTimerCap(entry.id, subjectOf?.(entry));
          return null;
        }),
      );
    },
    stopAll: (entries: readonly TimeEntry[]) => {
      for (const entry of entries) stoppedByHand.add(entry.id);
      stopAll.mutate(
        undefined,
        stopCallbacks(entries, (stopped) => {
          for (const entry of stopped) stoppedByHand.add(entry.id);
          const left = entries.filter((entry) => !stopped.some((item) => item.id === entry.id));
          const changed = left.filter((entry) => stillRunning(queryClient, entry.id));
          for (const entry of changed) stoppedByHand.delete(entry.id);
          if (changed.length) notifyInfo({ title: changedMessage(changed.length) });
          const ended = left.filter((entry) => !changed.includes(entry));
          const capped = ended.filter((entry) => reachedDurationMax(freshEntry(queryClient, entry)));
          for (const entry of capped) notifyTimerCap(entry.id, subjectOf?.(entry));
          if (stopped.length) return `${countOf(stopped.length, 'chrono')} ${agreed('arrêté', false, stopped.length)}. ${savedTimeMessage(stopped)}`;
          const already = ended.length - capped.length;
          return already ? { info: plural(already, 'Ce chrono était déjà arrêté.', 'Ces chronos étaient déjà arrêtés.') } : null;
        }),
      );
    },
    isPending: stop.isPending || stopAll.isPending,
  };
}
