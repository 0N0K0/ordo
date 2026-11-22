import { birthdayRings, entrySeconds, ephemerisRings, eventRings, routineRings, taskRings, timerCountsForAlarm, trackingStep, type RemindedBirthday, type RemindedOccurrence, type RemindedTask, type TreeItem } from '@ordo/shared';
import { scheduleRules } from '../../calendar/api';
import type { Alarm } from '../api';
import { nextRings } from './alarm-labels';
import type { Routine } from '../../routines/api';
import type { RemindedSchedule } from './ring-calendar';

/** A running timer, as the alarms on its duration count it. */
export type RingTimer = Parameters<typeof entrySeconds>[0] & { id: string; projectId: string | null; taskIds: readonly string[] };

/** What the alarm center rings, in the workspace open: alarms, running timers, reminders and the timers of the user. */
export interface RingSources {
  alarms: readonly Alarm[] | undefined;
  running: readonly RingTimer[] | undefined;
  /** Every project of the workspace (id and parent). */
  projects: readonly TreeItem[];
  tasks: readonly RemindedTask[];
  routines: Routine[];
  /** First moment a reminder of a routine may ring from, out of its slots; null: none soon. */
  deferRoutine: (routine: Routine, at: Date) => Date | null;
  occurrences: readonly RemindedOccurrence[];
  schedules: readonly RemindedSchedule[];
  birthdays: readonly RemindedBirthday[];
  /** Timers of the user, any workspace (`endsAt` null while paused). */
  countdowns: readonly { endsAt?: string | null }[];
}

/**
 * Rule of the days an éphéméride covers, read from its fields.
 * @param {RemindedSchedule} schedule Éphéméride.
 * @returns {ReturnType<typeof scheduleRules>[number]} Rule.
 */
export const ephemerisRule = (schedule: RemindedSchedule) => scheduleRules([schedule])[0];

/**
 * Next step of a running timer for an alarm on its duration: when its tracked time reaches the next multiple of the
 * alarm's minutes; none while paused.
 * @param {number} minutes Step of the alarm.
 * @param {RingTimer} entry Running timer.
 * @param {Date} now Now.
 * @returns {Date | null} Instant.
 */
function nextTrackingRing(minutes: number, entry: RingTimer, now: Date): Date | null {
  if (entry.pausedAt) return null;
  const seconds = (trackingStep(minutes, entry, now) + 1) * minutes * 60 - entrySeconds(entry, now.getTime());
  return new Date(now.getTime() + seconds * 1000);
}

/**
 * Next ring after now, with the same planners the alarm center rings from: the reminders of events, tasks, routines,
 * éphémérides and birthdays (`eventRings`, `taskRings`, `routineRings`, `ephemerisRings`, `birthdayRings`), the
 * scheduled alarms (`nextRings`; « pas de chrono » not while a timer runs), the steps of the running timers for the
 * alarms on their duration, and the ends of the running timers of the user.
 * @param {RingSources} sources What rings.
 * @param {Date} now Now.
 * @returns {Date | null} Instant of the next ring, null when nothing is planned.
 */
export function nextRingAt(sources: RingSources, now: Date): Date | null {
  const timers = sources.running ?? [];
  const planned: (Date | null)[] = [
    ...[
      ...eventRings(sources.occurrences),
      ...taskRings(sources.tasks, now),
      ...routineRings(sources.routines, sources.deferRoutine),
      ...ephemerisRings(sources.schedules, ephemerisRule, now),
      ...birthdayRings(sources.birthdays, now),
    ].map((reminder) => reminder.at),
    ...nextRings(sources.alarms ?? [], now)
      .filter(({ alarm }) => alarm.type !== 'NOT_TRACKING' || timers.length === 0)
      .map(({ at }) => at),
    ...(sources.alarms ?? []).flatMap((alarm) => {
      const { minutes } = alarm;
      if (!alarm.enabled || alarm.type !== 'TRACKING_DURATION' || !minutes) return [];
      return timers.filter((entry) => timerCountsForAlarm(alarm, entry, sources.projects)).map((entry) => nextTrackingRing(minutes, entry, now));
    }),
    ...sources.countdowns.map((countdown) => (countdown.endsAt ? new Date(countdown.endsAt) : null)),
  ];
  let next: Date | null = null;
  for (const at of planned) if (at && at > now && (!next || at < next)) next = at;
  return next;
}
