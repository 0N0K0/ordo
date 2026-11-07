import { addDays } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { localToday } from '../../lib/dates';
import { fetchCalendarEvents, type EventOccurrence } from '../calendar/api';
import { useTasksData } from '../tasks/api';
import { useRunningTimer } from '../time/api';
import { useWorkspace } from '../workspace/api';
import { useAlarmMutations, useAlarms, type Alarm } from './api';
import { unlockAudioOnGesture } from './alarm-sound';
import { dueAlarms, ringAlarm, ringReminders, type RingLink } from './ring';

const TICK_MS = 15_000;

/**
 * Rings the alarms of the workspace open while the app is: chime, system notification (when allowed) and a
 * toast that stays until closed. Scheduled alarms ring at their times (missed ones, within a few hours, ring
 * on opening); tracking alarms ring after every set duration of the running timer. Renders nothing.
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
     * Link of a toast to a page of the app (toasts are outside the router: no Link in them).
     * @param {string} label Label.
     * @param {string} path Path.
     * @returns {RingLink} Link.
     */
    const link = (label: string, path: string): RingLink => ({ label, onClick: () => latest.current.navigate(path) });

    /**
     * Links of an alarm: its task, or else its project.
     * @param {Alarm} alarm Alarm.
     * @returns {RingLink[]} Links.
     */
    const alarmLinks = (alarm: Alarm): RingLink[] => {
      const { tasksData: data, workspace: space } = latest.current;
      const task = alarm.taskId ? data?.tasks.find((item) => item.id === alarm.taskId) : undefined;
      // Its number is only unique in its project: the project comes with it.
      const place = task ? space?.projects.find((item) => item.id === task.projectId)?.title : undefined;
      if (task) return [link(`${place ? `${place} ` : ''}#${task.number} ${task.title}`, `/projects/${task.projectId}?tab=tasks&task=${task.id}`)];
      const project = alarm.projectId ? space?.projects.find((item) => item.id === alarm.projectId) : undefined;
      return project ? [link(project.title, `/projects/${project.id}`)] : [];
    };

    /**
     * Checks every alarm against the current time and the running timer, and the event reminders.
     * @returns {void}
     */
    const tick = () => {
      const { alarms: list, running: entry, markFired: mark } = latest.current;
      const now = new Date();
      ringReminders(upcoming.current, now, [link('Voir l’agenda', '/calendar')]);
      if (!list) return;
      const due = dueAlarms(list, entry, now, trackingSteps.current, (alarm, at) => mark.mutate({ id: alarm.id, at: at.toISOString() }));
      for (const { alarm, key } of due) ringAlarm(alarm, key, alarmLinks(alarm));
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
