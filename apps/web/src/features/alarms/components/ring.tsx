import { alarmRingKey, alarmRingText, dueAlarmOccurrence, eventRings, isRingDue, RING_LATE_MS, taskRings, trackingRingKey, trackingStep, workspaceRingLine, type entrySeconds, type PlannedRing, type RemindedOccurrence, type RemindedTask } from '@ordo/shared';
import type { Alarm } from '../api';
import { claim, startRinging, type RingLink } from '../lib/ringing';

export type { RingLink };

/**
 * Rings an alarm (`startRinging`: its ringtone for the duration of the settings, its toast until « Arrêter »), once
 * across tabs (`claim`).
 * @param {Alarm} alarm Alarm.
 * @param {string} key Occurrence key, deduplicating tabs.
 * @param {RingLink[]} links Task or project, workspace.
 * @param {{ id: string, label: string }} [workspace] Workspace, when not the one open. Optional.
 * @param {Date} [dueAt] Instant of the occurrence. Optional. Default = now.
 * @returns {void}
 */
export function ringAlarm(alarm: Pick<Alarm, 'label' | 'note'>, key: string, links: RingLink[], workspace?: { id: string; label: string }, dueAt = new Date()): void {
  if (!claim(`ordo.alarm.${key}`)) return;
  const { title, lines } = alarmRingText(alarm);
  startRinging({ key, dueAt, title, lines: [...(workspace ? [workspaceRingLine(workspace.label)] : []), ...lines], actions: links, workspaceId: workspace?.id });
}

/** Workspace a reminder or an alarm belongs to, when it is not the one open. */
export interface RingWorkspace {
  id: string;
  label: string;
}

/**
 * Rings the reminders that are due (missed by less than a few hours, `isRingDue`), as the shared bricks plan them
 * (`eventRings`, `taskRings`, `routineRings`, `ephemerisRings`, `birthdayRings`: the same keys, instants and texts as
 * the server ringing outside the app): the one way tasks, routines and events ring. Each
 * key rings once across tabs (`claim`), by `startRinging` (its ringtone or the one of the settings, for their duration,
 * its toast until « Arrêter », repeated as set).
 * @template {PlannedRing} P
 * @param {P[]} planned Reminders (keys without the `ordo.alarm.` prefix).
 * @param {Date} now Current time.
 * @param {(reminder: P) => RingLink[]} actions Links and actions of the toast of a reminder.
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringPlannedReminders<P extends PlannedRing>(planned: P[], now: Date, actions: (reminder: P) => RingLink[], workspace?: RingWorkspace): void {
  for (const reminder of planned) {
    if (!isRingDue(reminder.at, now)) continue;
    if (!claim(`ordo.alarm.${reminder.key}`, RING_LATE_MS + 3600_000)) continue;
    const lines = [...(workspace ? [workspaceRingLine(workspace.label)] : []), ...reminder.lines.filter(Boolean)];
    startRinging({ key: reminder.key, dueAt: reminder.at, title: reminder.title, lines, actions: actions(reminder), ringtone: reminder.ringtone, workspaceId: workspace?.id });
  }
}

/**
 * Rings the reminders of event occurrences that are due (`eventRings`): minutes before their start or their end, or
 * at a time of the day of their first or last day or of some days before it; a cancelled occurrence does not ring.
 * @param {readonly RemindedOccurrence[]} occurrences Occurrences of the next days.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Calendar, workspace.
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringReminders(occurrences: readonly RemindedOccurrence[], now: Date, links: RingLink[], workspace?: RingWorkspace): void {
  ringPlannedReminders(eventRings(occurrences), now, () => links, workspace);
}

/**
 * Rings the reminders of the open tasks that are due (`taskRings`: at their times of the day from their « Ouverture »
 * to their « Échéance », or some days before their « Échéance »).
 * @template {RemindedTask} T
 * @param {readonly T[]} tasks Tasks.
 * @param {Date} now Current time.
 * @param {(task: T) => RingLink[]} links Links of a task (its page).
 * @param {RingWorkspace} [workspace] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringTaskReminders<T extends RemindedTask>(tasks: readonly T[], now: Date, links: (task: T) => RingLink[], workspace?: RingWorkspace): void {
  ringPlannedReminders(taskRings(tasks, now), now, ({ task }) => links(task), workspace);
}

/**
 * Alarms due now, against the current time and the running timers (several at once). Scheduled alarms
 * are due at their times (missed ones, within a few hours, too) and recorded as rung (« pas de chrono »: skipped while
 * a timer runs); tracking alarms after every set duration of each running timer.
 * @template {Alarm} A
 * @param {A[]} alarms Alarms.
 * @param {readonly object[] | undefined} running Running timers.
 * @param {Date} now Current time.
 * @param {Map<string, number>} trackingSteps Last step seen per tracking alarm and timer (kept between checks).
 * @param {(alarm: A, at: Date) => void} markFired Records an occurrence as done.
 * @returns {{ alarm: A, key: string }[]} Alarms to ring, with their occurrence keys.
 */
export function dueAlarms<A extends Alarm>(
  alarms: A[],
  running: readonly (Parameters<typeof entrySeconds>[0] & { id: string })[] | undefined,
  now: Date,
  trackingSteps: Map<string, number>,
  markFired: (alarm: A, at: Date) => void,
): { alarm: A; key: string }[] {
  const due: { alarm: A; key: string }[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    if (alarm.type === 'TRACKING_DURATION') {
      for (const entry of running ?? []) {
        if (entry.pausedAt || !alarm.minutes) continue;
        const key = `${alarm.id}:${entry.id}`;
        const step = trackingStep(alarm.minutes, entry, now);
        const previous = trackingSteps.get(key);
        trackingSteps.set(key, step);
        // First check of this timer: steps already past do not ring.
        if (previous !== undefined && step > previous && step > 0) due.push({ alarm, key: trackingRingKey(alarm.id, entry.id, step) });
      }
      continue;
    }

    const occurrence = dueAlarmOccurrence(alarm, now);
    if (!occurrence) continue;
    // Recorded first: the occurrence is done even when skipped because a timer runs.
    markFired(alarm, occurrence);
    if (alarm.type === 'NOT_TRACKING' && running?.length) continue;
    due.push({ alarm, key: alarmRingKey(alarm.id, occurrence) });
  }
  return due;
}
