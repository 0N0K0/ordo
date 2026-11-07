import { addDays } from '@ordo/shared';
import { useEffect } from 'react';
import { graphql } from '../../graphql';
import type { ElsewhereAlarmsQuery } from '../../graphql/graphql';
import { localToday } from '../../lib/dates';
import { executeIn } from '../../lib/graphql-client';
import { dueAlarms, ringAlarm, ringReminders, type RingLink } from '../alarms/ring';
import { fetchCalendarEvents, type EventOccurrence } from '../calendar/api';
import { MailWatcher } from '../mail/MailWatcher';
import { useWorkspaces, type Workspace } from './api';
import { switchWorkspace } from './switch';

const ElsewhereAlarmsDocument = graphql(`
  query ElsewhereAlarms {
    alarms {
      ...AlarmFields
      task {
        id
        number
        title
        projectId
      }
      project {
        id
        title
      }
    }
    runningTimeEntry {
      id
      startedAt
      endedAt
      pausedAt
      pausedSeconds
      duration
    }
  }
`);

const ElsewhereMarkAlarmFiredDocument = graphql(`
  mutation ElsewhereMarkAlarmFired($id: ID!, $at: DateTime!) {
    markAlarmFired(id: $id, at: $at)
  }
`);

type ElsewhereAlarm = ElsewhereAlarmsQuery['alarms'][number];

const TICK_MS = 15_000;
const ALARMS_MS = 60_000;
const CALENDAR_MS = 5 * 60_000;

/**
 * Gives the notifications of a workspace that is not the one open: its alarms, event reminders and new mails,
 * as chosen in its settings (mails: every 10 minutes, and when asked). Their links open that workspace.
 * @param {{ workspace: Workspace }} props Workspace.
 * @returns {JSX.Element | null} Mail watcher of the workspace, or nothing.
 */
function ElsewhereWorkspace({ workspace }: { workspace: Workspace }) {
  const { id, name } = workspace;
  const sources = workspace.notifyElsewhere.join(',');

  useEffect(() => {
    const wanted = new Set(sources.split(','));
    let alarms: ElsewhereAlarm[] = [];
    let running: ElsewhereAlarmsQuery['runningTimeEntry'] = null;
    let upcoming: EventOccurrence[] = [];
    const trackingSteps = new Map<string, number>();
    const timers: number[] = [];

    /**
     * Link opening a page of that workspace.
     * @param {string} label Label.
     * @param {string} path Path.
     * @returns {RingLink} Link.
     */
    const link = (label: string, path: string): RingLink => ({ label, onClick: () => switchWorkspace(id, path) });

    /**
     * Runs a check now and then regularly.
     * @param {() => void} fn Check.
     * @param {number} period Period.
     * @returns {void}
     */
    const every = (fn: () => void, period: number) => {
      fn();
      timers.push(window.setInterval(fn, period));
    };

    /**
     * Links of an alarm: its task, or else its project, or else the workspace.
     * @param {ElsewhereAlarm} alarm Alarm.
     * @returns {RingLink[]} Links.
     */
    const alarmLinks = (alarm: ElsewhereAlarm): RingLink[] => {
      if (alarm.task) return [link(`#${alarm.task.number} ${alarm.task.title}`, `/projects/${alarm.task.projectId}?tab=tasks&task=${alarm.task.id}`)];
      if (alarm.project) return [link(alarm.project.title, `/projects/${alarm.project.id}`)];
      return [link(`Ouvrir « ${name} »`, '/')];
    };

    /**
     * Records an occurrence of an alarm as rung (locally at once, so the next check does not record it again).
     * @param {ElsewhereAlarm} alarm Alarm.
     * @param {Date} at Occurrence.
     * @returns {void}
     */
    const markFired = (alarm: ElsewhereAlarm, at: Date) => {
      alarm.lastFiredAt = at.toISOString();
      executeIn(id, ElsewhereMarkAlarmFiredDocument, { id: alarm.id, at: at.toISOString() }).catch(() => undefined);
    };

    if (wanted.has('ALARMS')) {
      every(() => {
        executeIn(id, ElsewhereAlarmsDocument)
          .then((data) => {
            alarms = data.alarms;
            running = data.runningTimeEntry;
          })
          .catch(() => undefined);
      }, ALARMS_MS);
    }
    if (wanted.has('CALENDAR')) {
      every(() => {
        const today = localToday();
        fetchCalendarEvents({ from: addDays(today, -1), to: addDays(today, 8) }, id)
          .then((occurrences) => {
            upcoming = occurrences;
          })
          .catch(() => undefined);
      }, CALENDAR_MS);
    }
    if (wanted.has('ALARMS') || wanted.has('CALENDAR')) {
      timers.push(
        window.setInterval(() => {
          const now = new Date();
          if (wanted.has('CALENDAR')) ringReminders(upcoming, now, [link(`Voir l’agenda de « ${name} »`, '/calendar')], name);
          if (wanted.has('ALARMS')) for (const { alarm, key } of dueAlarms(alarms, running, now, trackingSteps, markFired)) ringAlarm(alarm, key, alarmLinks(alarm), name);
        }, TICK_MS),
      );
    }
    return () => timers.forEach((timer) => window.clearInterval(timer));
  }, [id, name, sources]);

  // New mails: fetched every 10 minutes, and when asked.
  return workspace.notifyElsewhere.includes('MAILS') ? <MailWatcher workspace={{ id, name }} /> : null;
}

/**
 * Gives the notifications the other workspaces still give while this one is open (see their settings).
 * Renders nothing.
 * @returns {JSX.Element} Notifiers.
 */
export function ElsewhereNotifier() {
  const { data } = useWorkspaces();
  const others = (data?.workspaces ?? []).filter((item) => item.id !== data?.currentWorkspaceId && item.notifyElsewhere.length > 0);
  return (
    <>
      {others.map((workspace) => (
        <ElsewhereWorkspace key={workspace.id} workspace={workspace} />
      ))}
    </>
  );
}
