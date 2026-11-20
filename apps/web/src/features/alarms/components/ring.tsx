import { entrySeconds, occurrenceReminders, parisInstant, previousOccurrence, taskReminders, type PlannedReminder } from '@ordo/shared';
import type { ReactNode } from 'react';
import { AlarmIcon, CalendarBlankIcon, CheckSquareIcon } from '@phosphor-icons/react';
import type { EventOccurrence } from '../../calendar/api';
import type { Alarm } from '../api';
import type { Task } from '../../tasks/api';
import { playChime } from '../lib/alarm-sound';
import * as fmt from '../../../lib/format';
import { notifyInfo, type NotifyAction } from '../../../lib/notify';
import { taggedKey } from '../../../lib/tagged-key';

/** Alarms missed by more than this (app closed) do not ring any more. */
export const MAX_DELAY_MS = 6 * 3600_000;

/** Link of a notification to a page of the app. */
export type RingLink = NotifyAction;

/**
 * Claims an occurrence for this tab: another open tab (of any workspace), or this one before a reload, that
 * already rang it wins. Claims expire after `ttlMs`.
 * @param {string} key Occurrence key.
 * @param {number} [ttlMs] Lifetime of the claim. Optional. Default = 10 minutes.
 * @returns {boolean} True when this tab rings it.
 */
export function claim(key: string, ttlMs = 10 * 60_000): boolean {
  try {
    const expiry = Number(localStorage.getItem(key) ?? 0);
    if (expiry > Date.now()) return false;
    localStorage.setItem(key, String(Date.now() + ttlMs));
    // Expired claims are removed as they are met.
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const stored = localStorage.key(index);
      if (stored?.startsWith('ordo.alarm.') && Number(localStorage.getItem(stored)) < Date.now()) localStorage.removeItem(stored);
    }
  } catch {
    // Storage unavailable: ring anyway.
  }
  return true;
}

/**
 * Shows a system notification, when allowed.
 * @param {string} title Title.
 * @param {string | undefined} body Text.
 * @param {string} tag Tag (one notification per tag).
 * @returns {void}
 */
export function systemNotification(title: string, body: string | undefined, tag: string): void {
  if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag });
}

/**
 * Rings an alarm: chime, system notification and an information toast.
 * @param {Alarm} alarm Alarm.
 * @param {string} key Occurrence key, deduplicating tabs.
 * @param {RingLink[]} links Task or project, workspace.
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringAlarm(alarm: Pick<Alarm, 'label' | 'note'>, key: string, links: RingLink[], workspaceLabel?: string): void {
  if (!claim(`ordo.alarm.${key}`)) return;
  // eslint-disable-next-line no-restricted-syntax -- an alarm (not a reminder) rings here.
  playChime();
  systemNotification(alarm.label, [workspaceLabel, alarm.note].filter(Boolean).join(' · ') || undefined, key);
  notifyInfo({ icon: <AlarmIcon />, title: alarm.label, lines: [workspaceLabel && `Espace « ${workspaceLabel} »`, alarm.note], actions: links });
}

/** What the toast of a reminder shows. */
export interface ReminderToast {
  icon: ReactNode;
  title: string;
  /** Lines under the title (empty ones left out). */
  lines: (string | null | undefined | false)[];
  actions: RingLink[];
}

/**
 * Rings the reminders that are due (missed by less than a few hours): the one way tasks, routines and events ring
 * (decision D16). Each key rings once across tabs (`claim`); chime, system notification and an information toast.
 * @template {PlannedReminder} P
 * @param {P[]} planned Reminders (keys without the `ordo.alarm.` prefix).
 * @param {Date} now Current time.
 * @param {(reminder: P) => ReminderToast} toast Toast of a reminder.
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringPlannedReminders<P extends PlannedReminder>(planned: P[], now: Date, toast: (reminder: P) => ReminderToast, workspaceLabel?: string): void {
  for (const reminder of planned) {
    const at = reminder.at.getTime();
    if (now.getTime() < at || now.getTime() - at > MAX_DELAY_MS) continue;
    const key = `ordo.alarm.${reminder.key}`;
    if (!claim(key, MAX_DELAY_MS + 3600_000)) continue;
    // eslint-disable-next-line no-restricted-syntax -- ringPlannedReminders itself.
    playChime();
    const { icon, title, lines, actions } = toast(reminder);
    const shown = [workspaceLabel && `Espace « ${workspaceLabel} »`, ...lines].filter((line): line is string => Boolean(line));
    systemNotification(title, shown.join(' · ') || undefined, key);
    notifyInfo({ id: key, icon, title, lines: shown, actions });
  }
}

/**
 * Start of an event occurrence: its instant, or Paris midnight of its first day when all day.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {Date} Start.
 */
function occurrenceStart(occurrence: EventOccurrence): Date {
  return occurrence.allDay ? parisInstant(occurrence.startDate) : new Date(occurrence.start);
}

/**
 * Rings the reminders of event occurrences that are due: minutes before their start, or at a time of the day of their
 * first day or of some days before it; a cancelled occurrence does not ring.
 * @param {EventOccurrence[]} occurrences Occurrences of the next days.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Calendar, workspace.
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringReminders(occurrences: EventOccurrence[], now: Date, links: RingLink[], workspaceLabel?: string): void {
  for (const occurrence of occurrences) {
    if (occurrence.calledOff) continue;
    const start = occurrenceStart(occurrence);
    const body = [occurrence.allDay ? 'Journée entière' : fmt.dateTimeShort(start), occurrence.location].filter(Boolean).join(' · ');
    const key = taggedKey('event', occurrence.key);
    ringPlannedReminders(
      occurrenceReminders(key, occurrence.startDate, start, occurrence.reminders),
      now,
      () => ({ icon: <CalendarBlankIcon />, title: occurrence.label, lines: [body], actions: links }),
      workspaceLabel,
    );
  }
}

/** What the reminders of a task are rung from (a task of the open workspace or of another one). */
export type RemindedTask = Pick<Task, 'id' | 'label' | 'closed' | 'archived' | 'effectiveMinDate' | 'effectiveDeadline' | 'reminders'>;

/**
 * Rings the reminders of the open tasks (not closed nor archived) that are due: at their times of the day, every day
 * from their « Ouverture » to their « Échéance » (the « Échéance » day only without « Ouverture »; none without it), or
 * once some days before their « Échéance », those they go by: their own, else those of their single sprint.
 * @template {RemindedTask} T
 * @param {T[]} tasks Tasks.
 * @param {Date} now Current time.
 * @param {(task: T) => RingLink[]} links Links of a task (its page).
 * @param {string} [workspaceLabel] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringTaskReminders<T extends RemindedTask>(tasks: T[], now: Date, links: (task: T) => RingLink[], workspaceLabel?: string): void {
  for (const task of tasks) {
    if (task.closed || task.archived || !task.reminders.length) continue;
    const days = { minDate: task.effectiveMinDate, deadline: task.effectiveDeadline, reminders: task.reminders };
    ringPlannedReminders(taskReminders(taggedKey('task', task.id), days, now), now, () => ({
      icon: <CheckSquareIcon />,
      title: task.label,
      lines: [task.effectiveDeadline && `Échéance : ${fmt.day(task.effectiveDeadline)}`],
      actions: links(task),
    }), workspaceLabel);
  }
}

/**
 * Alarms due now, against the current time and the running timer. Scheduled alarms are due at their times
 * (missed ones, within a few hours, too) and recorded as rung; tracking alarms after every set duration of the
 * running timer.
 * @template {Alarm} A
 * @param {A[]} alarms Alarms.
 * @param {object | null | undefined} running Running timer.
 * @param {Date} now Current time.
 * @param {Map<string, number>} trackingSteps Last step seen per tracking alarm and timer (kept between checks).
 * @param {(alarm: A, at: Date) => void} markFired Records an occurrence as done.
 * @returns {{ alarm: A, key: string }[]} Alarms to ring, with their occurrence keys.
 */
export function dueAlarms<A extends Alarm>(
  alarms: A[],
  running: (Parameters<typeof entrySeconds>[0] & { id: string }) | null | undefined,
  now: Date,
  trackingSteps: Map<string, number>,
  markFired: (alarm: A, at: Date) => void,
): { alarm: A; key: string }[] {
  const due: { alarm: A; key: string }[] = [];
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;

    if (alarm.type === 'TRACKING_DURATION') {
      if (!running || running.pausedAt || !alarm.minutes) continue;
      const key = `${alarm.id}:${running.id}`;
      const step = Math.floor(entrySeconds(running, now.getTime()) / (alarm.minutes * 60));
      const previous = trackingSteps.get(key);
      trackingSteps.set(key, step);
      // First check of this timer: steps already past do not ring.
      if (previous !== undefined && step > previous && step > 0) due.push({ alarm, key: `${key}:${step}` });
      continue;
    }

    const occurrence = previousOccurrence(alarm, now);
    if (!occurrence) continue;
    const since = new Date(alarm.lastFiredAt ?? alarm.createdAt);
    if (occurrence <= since || now.getTime() - occurrence.getTime() > MAX_DELAY_MS) continue;
    // Recorded first: the occurrence is done even when skipped because a timer runs.
    markFired(alarm, occurrence);
    if (alarm.type === 'NOT_TRACKING' && running) continue;
    due.push({ alarm, key: `${alarm.id}:${occurrence.getTime()}` });
  }
  return due;
}
