import { Anchor, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { entrySeconds, previousOccurrence } from '@ordo/shared';
import { AlarmIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { EventOccurrence } from '../calendar/api';
import type { Alarm } from './api';
import { playChime } from './alarm-sound';
import * as fmt from '../../lib/format';

/** Alarms missed by more than this (app closed) do not ring any more. */
export const MAX_DELAY_MS = 6 * 3600_000;

/** Link of a notification to a page of the app. */
export interface RingLink {
  label: string;
  onClick: () => void;
}

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
 * Body of a toast: its text lines, then its links.
 * @param {(string | null | undefined)[]} lines Text lines (empty ones are left out).
 * @param {RingLink[]} links Links.
 * @returns {JSX.Element} Body.
 */
export function toastBody(lines: (string | null | undefined)[], links: RingLink[]): ReactNode {
  return (
    <Stack gap={4}>
      {lines.filter(Boolean).map((line, index) => (
        <Text key={index} size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {line}
        </Text>
      ))}
      {links.map((link) => (
        <Anchor key={link.label} component="button" type="button" size="sm" ta="left" onClick={link.onClick}>
          {link.label}
        </Anchor>
      ))}
    </Stack>
  );
}

/**
 * Rings an alarm: chime, system notification and a toast that stays until closed.
 * @param {Alarm} alarm Alarm.
 * @param {string} key Occurrence key, deduplicating tabs.
 * @param {RingLink[]} links Task or project, workspace.
 * @param {string} [workspaceName] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringAlarm(alarm: Pick<Alarm, 'title' | 'note'>, key: string, links: RingLink[], workspaceName?: string): void {
  if (!claim(`ordo.alarm.${key}`)) return;
  playChime();
  systemNotification(alarm.title, [workspaceName, alarm.note].filter(Boolean).join(' · ') || undefined, key);
  notifications.show({ color: 'orange', icon: <AlarmIcon />, title: alarm.title, autoClose: false, message: toastBody([workspaceName && `Espace « ${workspaceName} »`, alarm.note], links) });
}

/**
 * Start of an event occurrence: its instant, or local midnight of its first day when all day.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {Date} Start.
 */
function occurrenceStart(occurrence: EventOccurrence): Date {
  return occurrence.allDay ? new Date(`${occurrence.startDate}T00:00:00`) : new Date(occurrence.start);
}

/**
 * Rings the reminders of event occurrences that are due (missed by less than a few hours).
 * @param {EventOccurrence[]} occurrences Occurrences of the next days.
 * @param {Date} now Current time.
 * @param {RingLink[]} links Calendar, workspace.
 * @param {string} [workspaceName] Workspace, when not the one open. Optional.
 * @returns {void}
 */
export function ringReminders(occurrences: EventOccurrence[], now: Date, links: RingLink[], workspaceName?: string): void {
  for (const occurrence of occurrences) {
    const start = occurrenceStart(occurrence);
    for (const minutes of occurrence.reminders) {
      const at = start.getTime() - minutes * 60_000;
      if (now.getTime() < at || now.getTime() - at > MAX_DELAY_MS) continue;
      const key = `ordo.alarm.event:${occurrence.key}:${minutes}`;
      if (!claim(key, MAX_DELAY_MS + 3600_000)) continue;
      playChime();
      const when = occurrence.allDay ? 'Journée entière' : fmt.dateTimeShort(start);
      const body = [when, occurrence.location].filter(Boolean).join(' · ');
      systemNotification(occurrence.title, [workspaceName, body].filter(Boolean).join(' · '), key);
      notifications.show({
        color: 'blue',
        icon: <CalendarBlankIcon />,
        title: occurrence.title,
        autoClose: false,
        message: toastBody([workspaceName && `Espace « ${workspaceName} »`, body], links),
      });
    }
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
