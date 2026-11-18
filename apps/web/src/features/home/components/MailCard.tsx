import { NO_SUBJECT } from '@ordo/shared';
import { unarchived } from '../../../lib/archive';
import { mailPath, PAGES } from '../../../app/pages';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { localDay } from '../../../lib/dates';
import { Text } from '@mantine/core';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';

import { useMailAccounts, useUnreadMails } from '../../mail/api';
import { HomeCard } from './HomeCard';
import { HomeList, HomeRow } from './HomeList';
import { dayLabel } from '../lib/home-data';
import * as fmt from '../../../lib/format';

/**
 * Unread mails of the inboxes of every account, latest first.
 * @param {{ today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function MailCard({ today }: { today: string }) {
  const accounts = useMailAccounts();
  // The archived accounts apart.
  const accountIds = unarchived(accounts.data ?? []).map((account) => account.id);
  const unread = useUnreadMails(accountIds);
  const loading = accounts.isPending || (accountIds.length > 0 && !unread.data);
  const several = accountIds.length > 1;

  return (
    <HomeCard title="Mails non lus" icon={<EnvelopeSimpleIcon aria-hidden />} to={PAGES.mail.path} linkLabel="Boîte de réception" loading={loading}>
      {!loading && accountIds.length === 0 && <EmptyState compact icon={<EnvelopeSimpleIcon aria-hidden />} message="Aucune boîte mail configurée." />}
      {!loading && unread.error && unread.data?.length === 0 && <EmptyState compact icon={<EnvelopeSimpleIcon aria-hidden />} message="Boîte mail injoignable." />}
      {!loading && accountIds.length > 0 && !unread.error && unread.data?.length === 0 && <EmptyState compact icon={<CheckCircleIcon aria-hidden />} message="Aucun mail non lu." />}
      {!loading && unread.data && unread.data.length > 0 && (
        <HomeList
          items={unread.data}
          render={({ accountId, message }) => {
            const day = message.date ? localDay(message.date) : null;
            const account = several ? accounts.data?.find((item) => item.id === accountId) : undefined;
            return (
              <HomeRow
                key={`${accountId}-${message.uid}`}
                to={mailPath(accountId, 'INBOX', message.uid)}
                emphasis
                label={message.from[0]?.name || message.from[0]?.address || 'Expéditeur inconnu'}
                subtitle={
                  <>
                    {message.subject || NO_SUBJECT}
                    {account && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        · {account.label}
                      </Text>
                    )}
                  </>
                }
                value={
                  <Text size="xs" c="dimmed">
                    {day === today && message.date ? fmt.time(message.date) : day ? dayLabel(day, today) : ''}
                  </Text>
                }
              />
            );
          }}
        />
      )}
    </HomeCard>
  );
}
