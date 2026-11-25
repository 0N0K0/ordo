import { countdownRingKey, countdownRingText, isRingtone, recordRingAgain, RING_LATE_MS } from '@ordo/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { claim, openRingTarget, startRinging, type RingLink } from '../../alarms/lib/ringing';
import { countdownsQueryKey, sendCountdownRung, useCountdowns, type Countdown } from '../api';

/** Wait before the ring of a timer the API did not record is recorded again (a device clock ahead of the server's). */
const RECORD_AGAIN_MS = 5000;

/** Timers whose ring is being recorded in this tab (one recording at a time per timer, its retries included). */
const recording = new Set<string>();

/**
 * Records the ring of a timer with the API (it no longer shows), the timers refreshed. Not recorded because its end has
 * not passed yet for the server (this device's clock is ahead), it is recorded again a few seconds later while it
 * still shows with the same end (`recordRingAgain`): it does not stay shown ended. One recording at a time per timer.
 * @param {Countdown} countdown Timer rung.
 * @param {QueryClient} queryClient Query client (the timers as they show now).
 * @returns {void}
 */
function recordRung(countdown: Countdown, queryClient: QueryClient): void {
  if (recording.has(countdown.id)) return;
  recording.add(countdown.id);
  /**
   * Sends the record, then again a few seconds later while it is refused and the timer still shows the same.
   * @returns {void}
   */
  const send = (): void => {
    sendCountdownRung(countdown.id)
      .then(async (recorded) => {
        await queryClient.invalidateQueries({ queryKey: countdownsQueryKey });
        if (recorded) return recording.delete(countdown.id);
        window.setTimeout(() => {
          const current = queryClient.getQueryData<Countdown[]>(countdownsQueryKey)?.find((item) => item.id === countdown.id);
          if (recordRingAgain(countdown, current)) send();
          else recording.delete(countdown.id);
        }, RECORD_AGAIN_MS);
      })
      .catch(() => recording.delete(countdown.id));
  };
  send();
}

/**
 * Rings the end of a timer, once across tabs (`claim`), by the one ring of the app (`startRinging`: the ringtone of the
 * timer, else the one of the settings; « Arrêter », « Répéter dans N min »), and records it with the API (`recordRung`:
 * it no longer shows; its ring goes on as the others, `AlarmRing`).
 * @param {Countdown} countdown Timer over.
 * @param {QueryClient} queryClient Query client (the timers refreshed once recorded).
 * @returns {void}
 */
function ringCountdownEnd(countdown: Countdown, queryClient: QueryClient): void {
  const key = countdownRingKey(countdown.id);
  if (claim(`ordo.alarm.${key}`, RING_LATE_MS + 3600_000)) {
    const target = countdown.path ? { path: countdown.path, workspaceId: countdown.workspaceId } : null;
    const actions: RingLink[] = target ? [{ label: countdown.linkLabel ?? 'Ouvrir', to: target, onClick: () => openRingTarget(target) }] : [];
    startRinging({
      key,
      dueAt: new Date(countdown.endsAt ?? Date.now()),
      ...countdownRingText(countdown),
      actions,
      ...(isRingtone(countdown.ringtone) && { ringtone: countdown.ringtone }),
      workspaceId: countdown.workspaceId,
    });
  }
  recordRung(countdown, queryClient);
}

/**
 * Rings the timers of the user at their end while the app is open, in any workspace: each running one is
 * planned at its end; one over while the app was closed rings on opening (within 6 hours, as the reminders missed).
 * A timer paused, given more time or cancelled is planned again as the API gives it. Renders nothing (`AlarmCenter`).
 * @returns {void}
 */
export function useCountdownRinger(): void {
  const { data: countdowns } = useCountdowns();
  const queryClient = useQueryClient();
  useEffect(() => {
    const timers = (countdowns ?? []).flatMap((countdown) => {
      if (!countdown.endsAt) return [];
      const delay = new Date(countdown.endsAt).getTime() - Date.now();
      if (delay < -RING_LATE_MS) return [];
      return [window.setTimeout(() => ringCountdownEnd(countdown, queryClient), Math.max(0, delay))];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [countdowns, queryClient]);
}
