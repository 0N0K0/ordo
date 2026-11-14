import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { graphql } from '../../graphql';
import type { WatchedUnreadMailsQuery } from '../../graphql/graphql';
import { execute, executeIn } from '../../lib/graphql-client';
import { playChime } from '../alarms/alarm-sound';
import { claim, systemNotification, type RingLink } from '../alarms/ring';
import { notifyInfo } from '../../lib/notify';
import { switchWorkspace } from '../workspaces/switch';
import { MAIL_CHECK_MS, onMailCheck } from './mail-check';

const WatchedMailAccountsDocument = graphql(`
  query WatchedMailAccounts {
    mailAccounts {
      id
    }
  }
`);

const WatchedUnreadMailsDocument = graphql(`
  query WatchedUnreadMails($accountId: ID!) {
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

type UnreadMail = WatchedUnreadMailsQuery['mailMessages']['messages'][number];

/** Beyond this many new mails at once, one toast sums them up. */
const MAX_MAIL_TOASTS = 3;

interface MailWatcherProps {
  /** Another workspace than the one open (its mails open there); none: the workspace open. */
  workspace?: { id: string; name: string };
}

/**
 * Fetches the unread mails of the inboxes every 10 minutes, and when asked ("Relever"), and announces the new
 * ones: chime, system notification and a toast leading to the mail (the first fetch only learns the mails
 * already there). Renders nothing.
 * @param {MailWatcherProps} props Component props.
 * @returns {null} Nothing.
 */
export function MailWatcher({ workspace }: MailWatcherProps) {
  const navigate = useNavigate();
  const latest = useRef(navigate);
  useEffect(() => {
    latest.current = navigate;
  });
  const workspaceId = workspace?.id ?? null;
  const name = workspace?.name ?? null;

  useEffect(() => {
    // Unread mails already seen per account.
    const seen = new Map<string, Set<number>>();

    /**
     * Link opening a page of the mails (in their workspace).
     * @param {string} label Label.
     * @param {string} path Path.
     * @returns {RingLink} Link.
     */
    const link = (label: string, path: string): RingLink => ({ label, onClick: () => (workspaceId ? switchWorkspace(workspaceId, path) : latest.current(path)) });
    const where = name ? `Espace « ${name} »` : null;

    /**
     * Shows the unread mails of an account that were not there at the previous fetch.
     * @param {string} accountId Account.
     * @param {UnreadMail[]} messages Unread mails.
     * @returns {void}
     */
    const announce = (accountId: string, messages: UnreadMail[]) => {
      const before = seen.get(accountId);
      seen.set(accountId, new Set(messages.map((message) => message.uid)));
      if (!before) return;
      // Another tab may have announced them already.
      const fresh = messages.filter((message) => !before.has(message.uid) && claim(`ordo.alarm.mail:${accountId}:${message.uid}`, 24 * 3600_000));
      if (fresh.length === 0) return;
      playChime();
      if (fresh.length > MAX_MAIL_TOASTS) {
        const title = `${fresh.length} nouveaux mails`;
        systemNotification(title, name ?? undefined, `mail:${accountId}`);
        notifyInfo({
          icon: <EnvelopeSimpleIcon />,
          title,
          lines: [where],
          actions: [link(name ? `Ouvrir la boîte de réception dans « ${name} »` : 'Ouvrir la boîte de réception', `/mail?account=${accountId}&folder=INBOX`)],
        });
        return;
      }
      for (const message of fresh) {
        const title = message.subject || '(sans objet)';
        const from = message.from[0]?.name || message.from[0]?.address;
        systemNotification(title, [name, from].filter(Boolean).join(' · ') || undefined, `mail:${accountId}:${message.uid}`);
        notifyInfo({ icon: <EnvelopeSimpleIcon />, title, lines: [where, from && `De ${from}`], actions: [link('Lire le mail', `/mail?account=${accountId}&folder=INBOX&uid=${message.uid}`)] });
      }
    };

    /**
     * Fetches the unread mails of every inbox (an unreachable account leaves out its mails, not the others).
     * @returns {void}
     */
    const check = () => {
      const accounts = workspaceId ? executeIn(workspaceId, WatchedMailAccountsDocument) : execute(WatchedMailAccountsDocument);
      accounts
        .then(({ mailAccounts }) =>
          Promise.all(
            mailAccounts.map(({ id: accountId }) =>
              (workspaceId ? executeIn(workspaceId, WatchedUnreadMailsDocument, { accountId }) : execute(WatchedUnreadMailsDocument, { accountId }))
                .then(({ mailMessages }) => announce(accountId, mailMessages.messages))
                .catch(() => undefined),
            ),
          ),
        )
        .catch(() => undefined);
    };

    check();
    const timer = window.setInterval(check, MAIL_CHECK_MS);
    const stop = onMailCheck(check);
    return () => {
      window.clearInterval(timer);
      stop();
    };
  }, [workspaceId, name]);

  return null;
}
