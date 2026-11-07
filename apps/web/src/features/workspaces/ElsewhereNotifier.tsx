import { notifications } from '@mantine/notifications';
import { addDays } from '@ordo/shared';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { graphql } from '../../graphql';
import type { ElsewhereAlarmsQuery, ElsewhereUnreadMailsQuery } from '../../graphql/graphql';
import { localToday } from '../../lib/dates';
import { executeIn } from '../../lib/graphql-client';
import { playChime } from '../alarms/alarm-sound';
import { claim, dueAlarms, ringAlarm, ringReminders, systemNotification, toastBody, type RingLink } from '../alarms/ring';
import { fetchCalendarEvents, type EventOccurrence } from '../calendar/api';
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

const ElsewhereMailAccountsDocument = graphql(`
  query ElsewhereMailAccounts {
    mailAccounts {
      id
    }
  }
`);

const ElsewhereUnreadMailsDocument = graphql(`
  query ElsewhereUnreadMails($accountId: ID!) {
    mailMessages(accountId: $accountId, folder: "INBOX", page: 0, unread: true) {
      messages {
        uid
        subject
        from {
          name
          address
        }
      }
    }
  }
`);

type ElsewhereAlarm = ElsewhereAlarmsQuery['alarms'][number];
type UnreadMail = ElsewhereUnreadMailsQuery['mailMessages']['messages'][number];

const TICK_MS = 15_000;
const ALARMS_MS = 60_000;
const CALENDAR_MS = 5 * 60_000;
const MAILS_MS = 2 * 60_000;
/** Beyond this many new mails at once, one toast sums them up. */
const MAX_MAIL_TOASTS = 3;

/**
 * Gives the notifications of a workspace that is not the one open: its alarms, event reminders and new mails,
 * as chosen in its settings. Their links open that workspace. Renders nothing.
 * @param {{ workspace: Workspace }} props Workspace.
 * @returns {null} Nothing.
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
    // Unread mails already seen per account: the first check only learns them (no toast for old mails).
    const seenMails = new Map<string, Set<number>>();
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

    /**
     * Shows the unread mails of an account that were not there at the previous check.
     * @param {string} accountId Account.
     * @param {UnreadMail[]} messages Unread mails.
     * @returns {void}
     */
    const announceMails = (accountId: string, messages: UnreadMail[]) => {
      const seen = seenMails.get(accountId);
      seenMails.set(accountId, new Set(messages.map((message) => message.uid)));
      if (!seen) return;
      const fresh = messages.filter((message) => !seen.has(message.uid) && claim(`ordo.alarm.mail:${accountId}:${message.uid}`, 24 * 3600_000));
      if (fresh.length === 0) return;
      playChime();
      const inbox = link(`Ouvrir la boîte de réception dans « ${name} »`, `/mail?account=${accountId}&folder=INBOX`);
      if (fresh.length > MAX_MAIL_TOASTS) {
        const title = `${fresh.length} nouveaux mails`;
        systemNotification(title, name, `mail:${accountId}`);
        notifications.show({ color: 'teal', icon: <EnvelopeSimpleIcon />, title, message: toastBody([`Espace « ${name} »`], [inbox]) });
        return;
      }
      for (const message of fresh) {
        const title = message.subject || '(sans objet)';
        const from = message.from[0]?.name || message.from[0]?.address;
        systemNotification(title, [name, from].filter(Boolean).join(' · '), `mail:${accountId}:${message.uid}`);
        notifications.show({
          color: 'teal',
          icon: <EnvelopeSimpleIcon />,
          title,
          message: toastBody([`Espace « ${name} »`, from && `De ${from}`], [link('Lire le mail', `/mail?account=${accountId}&folder=INBOX&uid=${message.uid}`)]),
        });
      }
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
    if (wanted.has('MAILS')) {
      every(() => {
        executeIn(id, ElsewhereMailAccountsDocument)
          .then(({ mailAccounts }) =>
            Promise.all(
              mailAccounts.map(({ id: accountId }) =>
                executeIn(id, ElsewhereUnreadMailsDocument, { accountId })
                  .then(({ mailMessages }) => announceMails(accountId, mailMessages.messages))
                  // An unreachable account leaves out its mails, not the others.
                  .catch(() => undefined),
              ),
            ),
          )
          .catch(() => undefined);
      }, MAILS_MS);
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

  return null;
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
