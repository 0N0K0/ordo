import { calendarRingPage, reminderDayRange, routinesRingPage, workspaceRingPage, type RingPage } from '@ordo/shared';
import { useEffect } from 'react';
import { graphql } from '../../../graphql';
import type { ElsewhereAlarmsQuery, ElsewhereRemindersQuery } from '../../../graphql/graphql';
import { executeIn } from '../../../lib/graphql-client';
import { dueAlarms, ringAlarm, ringReminders, ringTaskReminders, type RingLink } from '../../alarms/components/ring';
import { ringRoutineReminders } from '../../alarms/lib/ring-routines';
import { ringBirthdayReminders, ringEphemerisReminders } from '../../alarms/lib/ring-calendar';
import { fetchCalendarEvents, type EventOccurrence } from '../../calendar/api';
import { MailWatcher } from '../../mail/components/MailWatcher';
import { useWorkspaces, type Workspace } from '../api';
import { switchWorkspace } from '../lib/switch';
import { alarmTarget } from '../../alarms/lib/alarm-labels';

const ElsewhereAlarmsDocument = graphql(`
  query ElsewhereAlarms {
    alarms {
      ...AlarmFields
      task {
        id
        number
        label
        projectId
      }
      project {
        id
        label
      }
    }
    projects {
      id
      label
    }
    runningTimeEntries {
      id
      startedAt
      endedAt
      pausedAt
      pausedSeconds
      duration
    }
  }
`);

const ElsewhereRemindersDocument = graphql(`
  query ElsewhereReminders {
    tasks {
      id
      number
      label
      projectId
      closed
      archived
      effectiveMinDate
      effectiveDeadline
      reminders {
        ...ReminderFields
      }
    }
    routines {
      id
      label
      archived
      location
      estimate
      currentDate
      reminders {
        ...ReminderFields
      }
      reminderOccurrences {
        date
        day
        slots {
          slot
          fromTime
          dueTime
        }
      }
      slots {
        index
        fromTime
        dueTime
        optional
        done
        windows
      }
    }
    workSchedules {
      id
      archived
      label
      startDate
      endDate
      typeId
      ephemeris
      cases
      exceptions
      reminders {
        ...ReminderFields
      }
    }
    birthdays {
      id
      name
      birthDate
      reminders {
        ...ReminderFields
      }
    }
  }
`);

const ElsewhereMarkAlarmFiredDocument = graphql(`
  mutation ElsewhereMarkAlarmFired($id: ID!, $at: DateTime!) {
    markAlarmFired(id: $id, at: $at)
  }
`);

type ElsewhereAlarm = ElsewhereAlarmsQuery['alarms'][number];
type ElsewhereTask = ElsewhereRemindersQuery['tasks'][number];

const TICK_MS = 15_000;
const ALARMS_MS = 60_000;
const CALENDAR_MS = 5 * 60_000;

/**
 * Gives the notifications of a workspace that is not the one open: its alarms and the reminders of its tasks, routines,
 * events, éphémérides and birthdays always (they ring whatever workspace is open), its new mails as chosen in its settings (every 10 minutes,
 * and when asked). Their links open that workspace. A routine reminder waits for no free moment here (the slot rules
 * are those of the open workspace) and offers no « Marquer comme faite ».
 * @param {{ workspace: Workspace }} props Workspace.
 * @returns {JSX.Element | null} Mail watcher of the workspace, or nothing.
 */
function ElsewhereWorkspace({ workspace }: { workspace: Workspace }) {
  const { id, label } = workspace;

  useEffect(() => {
    let alarms: ElsewhereAlarm[] = [];
    let running: ElsewhereAlarmsQuery['runningTimeEntries'] = [];
    // Labels of the projects: a task number is only unique in its project.
    let projectLabels = new Map<string, string>();
    let upcoming: EventOccurrence[] = [];
    let reminded: ElsewhereRemindersQuery = { tasks: [], routines: [], workSchedules: [], birthdays: [] };
    const trackingSteps = new Map<string, number>();
    const timers: number[] = [];

    /**
     * Link opening a page of that workspace.
     * @param {RingPage} page Label and path.
     * @returns {RingLink} Link.
     */
    const link = ({ label: text, path }: RingPage): RingLink => ({ label: text, to: { path, workspaceId: id }, onClick: () => switchWorkspace(id, path) });

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
      // As in the open workspace; the label of the project of a task from the projects of that workspace.
      const target = alarmTarget(
        { taskId: alarm.task?.id ?? null, projectId: alarm.project?.id ?? null },
        () => alarm.task ?? undefined,
        (id) => (alarm.project?.id === id ? alarm.project : projectLabels.has(id) ? { id, label: projectLabels.get(id)! } : undefined),
      );
      return [link(target ? { label: target.label, path: target.to } : workspaceRingPage(label))];
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

    /**
     * Links of a task: its page in that workspace.
     * @param {ElsewhereTask} task Task.
     * @returns {RingLink[]} Links.
     */
    const taskLinks = (task: ElsewhereTask): RingLink[] => {
      const target = alarmTarget({ taskId: task.id, projectId: null }, () => task, (id) => (projectLabels.has(id) ? { id, label: projectLabels.get(id)! } : undefined));
      return [link(target ? { label: target.label, path: target.to } : workspaceRingPage(label))];
    };

    every(() => {
      executeIn(id, ElsewhereAlarmsDocument)
        .then((data) => {
          alarms = data.alarms;
          projectLabels = new Map(data.projects.map((project) => [project.id, project.label]));
          running = data.runningTimeEntries;
        })
        .catch(() => undefined);
    }, ALARMS_MS);
    every(() => {
      fetchCalendarEvents(reminderDayRange(new Date()), id)
        .then((occurrences) => {
          upcoming = occurrences;
        })
        .catch(() => undefined);
      executeIn(id, ElsewhereRemindersDocument)
        .then((data) => {
          reminded = data;
        })
        .catch(() => undefined);
    }, CALENDAR_MS);
    timers.push(
      window.setInterval(() => {
        const now = new Date();
        const space = { id, label };
        const calendarLinks = [link(calendarRingPage(label))];
        ringReminders(upcoming, now, calendarLinks, space);
        ringEphemerisReminders(reminded.workSchedules, now, calendarLinks, space);
        ringBirthdayReminders(reminded.birthdays, now, () => calendarLinks, space);
        ringTaskReminders(reminded.tasks, now, taskLinks, space);
        ringRoutineReminders(reminded.routines, now, [link(routinesRingPage(label))], undefined, undefined, space);
        for (const { alarm, key } of dueAlarms(alarms, running, now, trackingSteps, markFired)) ringAlarm(alarm, key, alarmLinks(alarm), space);
      }, TICK_MS),
    );
    return () => timers.forEach((timer) => window.clearInterval(timer));
  }, [id, label]);

  // New mails: fetched every 10 minutes, and when asked.
  return workspace.notifyElsewhere.includes('MAILS') ? <MailWatcher workspace={{ id, label }} /> : null;
}

/**
 * Gives the notifications of the other workspaces while this one is open: their alarms and reminders always, their
 * new mails as chosen in their settings.
 * Renders nothing.
 * @returns {JSX.Element} Notifiers.
 */
export function ElsewhereNotifier() {
  const { data } = useWorkspaces();
  const others = (data?.workspaces ?? []).filter((item) => item.id !== data?.currentWorkspaceId);
  return (
    <>
      {others.map((workspace) => (
        <ElsewhereWorkspace key={workspace.id} workspace={workspace} />
      ))}
    </>
  );
}
