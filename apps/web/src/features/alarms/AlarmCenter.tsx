import { Anchor, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { addDays, entrySeconds, previousOccurrence } from '@ordo/shared';
import { AlarmIcon, CalendarBlankIcon } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { localToday } from '../../lib/dates';
import { fetchCalendarEvents, type EventOccurrence } from '../calendar/api';
import { useTasksData } from '../tasks/api';
import { useRunningTimer } from '../time/api';
import { useWorkspace } from '../workspace/api';
import { useAlarmMutations, useAlarms, type Alarm } from './api';
import { playChime, unlockAudioOnGesture } from './alarm-sound';

/** Alarms missed by more than this (app closed) do not ring any more. */
const MAX_DELAY_MS = 6 * 3600_000;
const TICK_MS = 15_000;

/**
 * Claims an occurrence for this tab: another open tab, or this one before a reload, that already rang it
 * wins. Claims expire after `ttlMs`.
 * @param {string} key Occurrence key.
 * @param {number} [ttlMs] Lifetime of the claim. Optional. Default = 10 minutes.
 * @returns {boolean} True when this tab rings it.
 */
function claim(key: string, ttlMs = 10 * 60_000): boolean {
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
 * Start of an event occurrence: its instant, or local midnight of its first day when all day.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {Date} Start.
 */
function occurrenceStart(occurrence: EventOccurrence): Date {
  return occurrence.allDay ? new Date(`${occurrence.startDate}T00:00:00`) : new Date(occurrence.start);
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Rings alarms while the app is open: chime, system notification (when allowed) and a toast that stays
 * until closed. Scheduled alarms ring at their times (missed ones, within a few hours, ring on opening);
 * tracking alarms ring after every set duration of the running timer. Renders nothing.
 * @returns {null} Nothing.
 */
export function AlarmCenter() {
  const { data: alarms } = useAlarms();
  const { data: running } = useRunningTimer();
  const { data: tasksData } = useTasksData();
  const { data: workspace } = useWorkspace();
  const { markFired } = useAlarmMutations();
  // Tracking alarms: last rung step per alarm and timer, so a reload does not ring past steps again.
  const trackingSteps = useRef(new Map<string, number>());
  // Event occurrences of the next days, for their reminders.
  const upcoming = useRef<EventOccurrence[]>([]);
  useEffect(() => {
    /**
     * Loads the event occurrences from yesterday to the day after tomorrow.
     * @returns {void}
     */
    const load = () => {
      const today = localToday();
      fetchCalendarEvents({ from: addDays(today, -1), to: addDays(today, 8) })
        .then((occurrences) => {
          upcoming.current = occurrences;
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const navigate = useNavigate();
  const latest = useRef({ alarms, running, tasksData, workspace, markFired, navigate });

  useEffect(() => {
    latest.current = { alarms, running, tasksData, workspace, markFired, navigate };
  });

  useEffect(() => unlockAudioOnGesture(), []);

  useEffect(() => {
    /**
     * Opens a page of the app from a toast (toasts are outside the router: no Link in them).
     * @param {string} path Path.
     * @returns {void}
     */
    const go = (path: string) => latest.current.navigate(path);

    /**
     * Shows an alarm.
     * @param {Alarm} alarm Alarm.
     * @param {string} key Occurrence key, deduplicating tabs.
     * @returns {void}
     */
    const ring = (alarm: Alarm, key: string) => {
      if (!claim(`ordo.alarm.${key}`)) return;
      const { tasksData: data, workspace: space } = latest.current;
      const task = alarm.taskId ? data?.tasks.find((item) => item.id === alarm.taskId) : undefined;
      const project = alarm.projectId ? space?.projects.find((item) => item.id === alarm.projectId) : undefined;
      playChime();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(alarm.title, { body: alarm.note ?? undefined, tag: key });
      }
      notifications.show({
        color: 'orange',
        icon: <AlarmIcon />,
        title: alarm.title,
        autoClose: false,
        message: (
          <Stack gap={4}>
            {alarm.note && (
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {alarm.note}
              </Text>
            )}
            {task ? (
              <Anchor component="button" type="button" size="sm" onClick={() => go(`/projects/${task.projectId}?tab=tasks&task=${task.number}`)}>
                #{task.number} {task.title}
              </Anchor>
            ) : (
              project && (
                <Anchor component="button" type="button" size="sm" onClick={() => go(`/projects/${project.id}`)}>
                  {project.title}
                </Anchor>
              )
            )}
          </Stack>
        ),
      });
    };

    /**
     * Rings the reminders of event occurrences that are due (missed by less than a few hours).
     * @param {Date} now Current time.
     * @returns {void}
     */
    const ringReminders = (now: Date) => {
      for (const occurrence of upcoming.current) {
        const start = occurrenceStart(occurrence);
        for (const minutes of occurrence.reminders) {
          const at = start.getTime() - minutes * 60_000;
          if (now.getTime() < at || now.getTime() - at > MAX_DELAY_MS) continue;
          const key = `ordo.alarm.event:${occurrence.key}:${minutes}`;
          if (!claim(key, MAX_DELAY_MS + 3600_000)) continue;
          playChime();
          const when = occurrence.allDay ? 'Journée entière' : timeFormat.format(start);
          const body = [when, occurrence.location].filter(Boolean).join(' · ');
          if ('Notification' in window && Notification.permission === 'granted') new Notification(occurrence.title, { body, tag: key });
          notifications.show({
            color: 'blue',
            icon: <CalendarBlankIcon />,
            title: occurrence.title,
            autoClose: false,
            message: (
              <Stack gap={4}>
                <Text size="sm">{body}</Text>
                <Anchor component="button" type="button" size="sm" onClick={() => go('/calendar')}>
                  Voir l’agenda
                </Anchor>
              </Stack>
            ),
          });
        }
      }
    };

    /**
     * Checks every alarm against the current time and the running timer, and the event reminders.
     * @returns {void}
     */
    const tick = () => {
      const { alarms: list, running: entry, markFired: mark } = latest.current;
      const now = new Date();
      ringReminders(now);
      if (!list) return;
      for (const alarm of list) {
        if (!alarm.enabled) continue;

        if (alarm.type === 'TRACKING_DURATION') {
          if (!entry || entry.pausedAt || !alarm.minutes) continue;
          const key = `${alarm.id}:${entry.id}`;
          const step = Math.floor(entrySeconds(entry, now.getTime()) / (alarm.minutes * 60));
          const previous = trackingSteps.current.get(key);
          trackingSteps.current.set(key, step);
          // First check of this timer: steps already past do not ring.
          if (previous !== undefined && step > previous && step > 0) ring(alarm, `${key}:${step}`);
          continue;
        }

        const occurrence = previousOccurrence(alarm, now);
        if (!occurrence) continue;
        const since = new Date(alarm.lastFiredAt ?? alarm.createdAt);
        if (occurrence <= since || now.getTime() - occurrence.getTime() > MAX_DELAY_MS) continue;
        // Recorded first: the occurrence is done even when skipped because a timer runs.
        mark.mutate({ id: alarm.id, at: occurrence.toISOString() });
        if (alarm.type === 'NOT_TRACKING' && entry) continue;
        ring(alarm, `${alarm.id}:${occurrence.getTime()}`);
      }
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
