import { birthdayRingOf, calendarRingPage, DEFAULT_RING_SETTINGS, readRingSettings, routineRingOf, routinesRingPage, type RingPage } from '@ordo/shared';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ringBirthdayReminders, ringEphemerisReminders } from '../lib/ring-calendar';
import { usePersonOpener } from '../../calendar/hooks/use-person-opener';
import { openRoutineTick } from '../../routines/lib/open-routine-tick';
import type { Routine } from '../../routines/api';
import { useAlarmMutations, type Alarm } from '../api';
import { useRingSources } from '../hooks/use-ring-sources';
import { configureRinging, loadRings, refreshRestoredRings, type KeptRing } from '../lib/ringing';
import { listenToPushes } from '../lib/push';
import { useMe } from '../../auth/api';
import { useWorkspaces } from '../../workspaces/api';
import { switchWorkspace } from '../../workspaces/lib/switch';
import { unlockAudioOnGesture } from '../../../lib/alarm-sound';
import { dueAlarms, ringAlarm, ringReminders, ringTaskReminders, type RingLink } from './ring';
import { markDoneAction, ringRoutineReminders } from '../lib/ring-routines';
import { alarmTarget } from '../lib/alarm-labels';
import { useCountdownRinger } from '../../countdowns/hooks/use-countdown-ringer';

const TICK_MS = 15_000;
/** How often the rings kept by the API are followed (stopped or snoozed in another tab or device). */
const RINGS_MS = 60_000;

/**
 * Rings the alarms of the workspace open while the app is (`startRinging`: the ringtone of the settings of the user or
 * of the reminder, for their duration, a system notification when allowed, a toast with « Arrêter » and « Répéter
 * dans N min », rung again as set; the rings kept by the API followed every minute). Scheduled alarms ring at their times (missed ones, within a few hours, ring
 * on opening); tracking alarms ring after every set duration of each running timer; the reminders of events, routines,
 * tasks, éphémérides and birthdays at their moments; the timers of the user at their end, in any workspace
 * (`useCountdownRinger`). Renders nothing.
 * @returns {null} Nothing.
 */
export function AlarmCenter() {
  const { alarms, running, tasksData, workspace, routinesData, schedules, birthdays, occurrences, deferRoutine } = useRingSources();
  const { markFired } = useAlarmMutations();
  const openPerson = usePersonOpener();
  const { data: me } = useMe();
  const { data: spaces } = useWorkspaces();
  const currentWorkspaceId = spaces?.currentWorkspaceId ?? null;
  // Tracking alarms: last rung step per alarm and timer, so a reload does not ring past steps again.
  const trackingSteps = useRef(new Map<string, number>());
  const navigate = useNavigate();
  const latest = useRef({ alarms, running, tasksData, workspace, markFired, navigate, routinesData, deferRoutine, schedules, birthdays, openPerson, occurrences });

  useEffect(() => {
    latest.current = { alarms, running, tasksData, workspace, markFired, navigate, routinesData, deferRoutine, schedules, birthdays, openPerson, occurrences };
  });

  /**
   * « Faite le » of a time of the day from a toast, on the routine as it is when clicked (ticked meanwhile elsewhere, its
   * time is changed, not ticked again).
   * @param {Routine} routine Routine as it was when it rang.
   * @param {number} slot Time of the day.
   * @returns {void}
   */
  const tickLatest = (routine: Routine, slot: number) => openRoutineTick(latest.current.routinesData?.routines.find((item) => item.id === routine.id) ?? routine, slot);

  useEffect(() => unlockAudioOnGesture(), []);
  // What the service worker tells: a ring pushed while visible, a ring stopped or snoozed from a notification.
  useEffect(() => listenToPushes(), []);
  useCountdownRinger();

  // The ring follows the settings of the user; a link of a ring kept by the API opens its page in its workspace; a ring
  // shown again from the API (reload, another tab or device) of the workspace open gets its actions back.
  useEffect(() => {
    /**
     * Actions of a ring shown again, rebuilt from its key: « Marquer comme faite » (the current occurrence of a routine),
     * « Ouvrir la fiche » (the person of a birthday); the workspace open only, as when it first rang.
     * @param {KeptRing} ring Ring kept by the API.
     * @returns {RingLink[]} Actions.
     */
    const restore = ({ key, workspaceId }: KeptRing): RingLink[] => {
      if (workspaceId && workspaceId !== currentWorkspaceId) return [];
      const { routinesData: data, birthdays: people, openPerson: open } = latest.current;
      const reminded = routineRingOf(key);
      const routine = reminded && data?.routines.find((item) => item.id === reminded.routineId);
      if (reminded && routine && routine.currentDate === reminded.date) {
        // A reminder « À HH:MM » ticks the first time of the day not ticked, as when it rang.
        const slot = reminded.slot ?? routine.slots.find((item) => !item.done)?.index ?? 0;
        return [markDoneAction(() => tickLatest(routine, slot))];
      }
      const birthday = birthdayRingOf(key, people ?? []);
      return birthday ? [{ label: 'Ouvrir la fiche', onClick: () => open(birthday) }] : [];
    };
    configureRinging({
      settings: me?.ringSettings ? readRingSettings(me.ringSettings) : DEFAULT_RING_SETTINGS,
      workspaceId: currentWorkspaceId,
      open: ({ path, workspaceId }) => (workspaceId && workspaceId !== currentWorkspaceId ? switchWorkspace(workspaceId, path) : latest.current.navigate(path)),
      restore,
    });
  }, [me?.ringSettings, currentWorkspaceId]);

  // Once the routines and birthdays are loaded, the rings shown again offer their actions.
  useEffect(() => refreshRestoredRings(), [routinesData, birthdays, currentWorkspaceId]);

  useEffect(() => {
    void loadRings();
    const timer = window.setInterval(() => void loadRings(), RINGS_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    /**
     * Link of a toast to a page of the app (toasts are outside the router: no Link in them).
     * @param {RingPage} page Label and path.
     * @returns {RingLink} Link.
     */
    const link = ({ label, path }: RingPage): RingLink => ({ label, to: { path }, onClick: () => latest.current.navigate(path) });

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
      return target ? [link({ label: target.label, path: target.to })] : [];
    };

    /**
     * Checks every alarm against the current time and the running timers, and the reminders of events, routines and tasks.
     * @returns {void}
     */
    const tick = () => {
      const { alarms: list, running: entry, markFired: mark } = latest.current;
      const now = new Date();
      ringReminders(latest.current.occurrences ?? [], now, [link(calendarRingPage())]);
      ringEphemerisReminders(latest.current.schedules ?? [], now, [link(calendarRingPage())]);
      ringBirthdayReminders(latest.current.birthdays ?? [], now, (birthday) => [{ label: 'Ouvrir la fiche', onClick: () => latest.current.openPerson(birthday) }]);
      ringRoutineReminders(
        latest.current.routinesData?.routines ?? [],
        now,
        [link(routinesRingPage())],
        // « Faite le » in the side panel, as everywhere a routine is ticked.
        (routine, slot) => tickLatest(routine, slot),
        (routine, at) => latest.current.deferRoutine(routine, at),
      );
      const { tasksData: data, workspace: space } = latest.current;
      ringTaskReminders(data?.tasks ?? [], now, (task) => {
        const target = alarmTarget({ taskId: task.id, projectId: null }, () => task, (id) => space?.projects.find((item) => item.id === id));
        return target ? [link({ label: target.label, path: target.to })] : [];
      });
      if (!list) return;
      const due = dueAlarms(list, entry, latest.current.workspace?.projects ?? [], now, trackingSteps.current, (alarm, at) => mark.mutate({ id: alarm.id, at: at.toISOString() }));
      for (const { alarm, key } of due) ringAlarm(alarm, key, alarmLinks(alarm));
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
