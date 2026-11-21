import { countdownRingKey, countdownRingText, isRingtone, RING_LATE_MS } from '@ordo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { claim, openRingTarget, startRinging, type RingLink } from '../../alarms/lib/ringing';
import { countdownsQueryKey, sendCountdownRung, useCountdowns, type Countdown } from '../api';

/**
 * Rings the end of a timer, once across tabs (`claim`), by the one ring of the app (`startRinging`: the ringtone of the
 * timer, else the one of the settings; « Arrêter », « Répéter dans N min »), and records it with the API (it no longer
 * shows; its ring goes on as the others, `AlarmRing`).
 * @param {Countdown} countdown Timer over.
 * @param {() => void} rung Called once recorded (the timers refreshed).
 * @returns {void}
 */
function ringCountdownEnd(countdown: Countdown, rung: () => void): void {
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
  sendCountdownRung(countdown.id)
    .then(rung)
    .catch(() => undefined);
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
      const rung = () => void queryClient.invalidateQueries({ queryKey: countdownsQueryKey });
      return [window.setTimeout(() => ringCountdownEnd(countdown, rung), Math.max(0, delay))];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [countdowns, queryClient]);
}
