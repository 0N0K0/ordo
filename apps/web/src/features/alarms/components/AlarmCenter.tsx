import { reminderDayRange } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { fetchCalendarEvents, useBirthdays, useWorkSchedules, type EventOccurrence } from '../../calendar/api';
import { ringBirthdayReminders, ringEphemerisReminders } from '../lib/ring-calendar';
import { usePersonOpener } from '../../calendar/hooks/use-person-opener';
import { useTasksData } from '../../tasks/api';
import { useRoutineMutations, useRoutinesData } from '../../routines/api';
import { useRunningTimer } from '../../time/api';
import { useProjectTree } from '../../projects/api';
import { useAlarmMutations, useAlarms, type Alarm } from '../api';
import { unlockAudioOnGesture } from '../lib/alarm-sound';
import { dueAlarms, ringAlarm, ringReminders, ringTaskReminders, type RingLink } from './ring';
import { ringRoutineReminders } from '../lib/ring-routines';
import { ON_ERROR } from '../../../lib/notify';
import { useSlotRules, routineDoable } from '../../calendar/hooks/use-slot-rules';
import { PAGES } from '../../../app/pages';
import { alarmTarget } from '../lib/alarm-labels';

const TICK_MS = 15_000;

/**
 * Rings the alarms of the workspace open while the app is: chime, system notification (when allowed) and a
 * toast that stays until closed. Scheduled alarms ring at their times (missed ones, within a few hours, ring
 * on opening); tracking alarms ring after every set duration of the running timer; the reminders of events, routines,
 * tasks, éphémérides and birthdays at their moments. Renders nothing.
 * @returns {null} Nothing.
 */
export function AlarmCenter() {
  const { data: alarms } = useAlarms();
  const { data: running } = useRunningTimer();
  const { data: tasksData } = useTasksData();
  const { data: workspace } = useProjectTree();
  const { markFired } = useAlarmMutations();
  const { data: routinesData } = useRoutinesData();
  const { setDone } = useRoutineMutations();
  const slotRules = useSlotRules();
  const { data: schedules } = useWorkSchedules();
  const { data: birthdays } = useBirthdays();
  const openPerson = usePersonOpener();
  // Tracking alarms: last rung step per alarm and timer, so a reload does not ring past steps again.
  const trackingSteps = useRef(new Map<string, number>());
  // Event occurrences of the next days, for their reminders.
  const upcoming = useRef<EventOccurrence[]>([]);
  useEffect(() => {
    /**
     * Loads the event occurrences from yesterday to the most days a reminder rings before (« N jours avant »).
     * @returns {void}
     */
    const load = () => {
      fetchCalendarEvents(reminderDayRange(new Date()))
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
  const latest = useRef({ alarms, running, tasksData, workspace, markFired, navigate, routinesData, setDone, slotRules, schedules, birthdays, openPerson });

  useEffect(() => {
    latest.current = { alarms, running, tasksData, workspace, markFired, navigate, routinesData, setDone, slotRules, schedules, birthdays, openPerson };
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
      const target = alarmTarget(
        alarm,
        (id) => data?.tasks.find((item) => item.id === id),
        (id) => space?.projects.find((item) => item.id === id),
      );
      return target ? [link(target.label, target.to)] : [];
    };

    /**
     * Checks every alarm against the current time and the running timer, and the reminders of events, routines and tasks.
     * @returns {void}
     */
    const tick = () => {
      const { alarms: list, running: entry, markFired: mark } = latest.current;
      const now = new Date();
      ringReminders(upcoming.current, now, [link('Voir l’agenda', PAGES.calendar.path)]);
      ringEphemerisReminders(latest.current.schedules ?? [], now, [link('Voir l’agenda', PAGES.calendar.path)]);
      ringBirthdayReminders(latest.current.birthdays ?? [], now, (birthday) => [{ label: 'Ouvrir la fiche', onClick: () => latest.current.openPerson(birthday) }]);
      ringRoutineReminders(
        latest.current.routinesData?.routines ?? [],
        now,
        [link('Voir les routines', PAGES.routines.path)],
        (routine, slot) => latest.current.setDone.mutate({ id: routine.id, done: true, slot }, ON_ERROR),
        (routine, at) => latest.current.slotRules.nextAllowedAt(routineDoable(routine), at),
      );
      const { tasksData: data, workspace: space } = latest.current;
      ringTaskReminders(data?.tasks ?? [], now, (task) => {
        const target = alarmTarget({ taskId: task.id, projectId: null }, () => task, (id) => space?.projects.find((item) => item.id === id));
        return target ? [link(target.label, target.to)] : [];
      });
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
