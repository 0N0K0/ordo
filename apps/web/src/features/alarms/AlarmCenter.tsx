import { Anchor, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { entrySeconds, previousOccurrence } from '@ordo/shared';
import { AlarmIcon } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTasksData } from '../tasks/api';
import { useRunningTimer } from '../time/api';
import { useWorkspace } from '../workspace/api';
import { useAlarmMutations, useAlarms, type Alarm } from './api';
import { playChime, unlockAudioOnGesture } from './alarm-sound';

/** Alarms missed by more than this (app closed) do not ring any more. */
const MAX_DELAY_MS = 6 * 3600_000;
const TICK_MS = 15_000;

/**
 * Claims an occurrence for this tab: another open tab that already rang it wins.
 * @param {string} key Occurrence key.
 * @returns {boolean} True when this tab rings it.
 */
function claim(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
    // Old claims are not needed once recorded by the API; keep the storage small.
    window.setTimeout(() => localStorage.removeItem(key), 10 * 60_000);
  } catch {
    // Storage unavailable: ring anyway.
  }
  return true;
}

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
  const latest = useRef({ alarms, running, tasksData, workspace, markFired });

  useEffect(() => {
    latest.current = { alarms, running, tasksData, workspace, markFired };
  });

  useEffect(() => unlockAudioOnGesture(), []);

  useEffect(() => {
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
              <Anchor component={Link} to={`/projects/${task.projectId}?tab=tasks&task=${task.number}`} size="sm">
                #{task.number} {task.title}
              </Anchor>
            ) : (
              project && (
                <Anchor component={Link} to={`/projects/${project.id}`} size="sm">
                  {project.title}
                </Anchor>
              )
            )}
          </Stack>
        ),
      });
    };

    /**
     * Checks every alarm against the current time and the running timer.
     * @returns {void}
     */
    const tick = () => {
      const { alarms: list, running: entry, markFired: mark } = latest.current;
      if (!list) return;
      const now = new Date();
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
