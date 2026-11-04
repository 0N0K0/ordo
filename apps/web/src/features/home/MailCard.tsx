import { Group, Stack, Text } from '@mantine/core';
import { CheckCircleIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useMailAccounts, useUnreadMails } from '../mail/api';
import classes from './Home.module.css';
import { HomeCard, HomeEmpty } from './HomeCard';
import { dayLabel, localDayOf } from './home-data';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const MAX_ROWS = 6;

/**
 * Unread mails of the inboxes of every account, latest first.
 * @param {{ today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function MailCard({ today }: { today: string }) {
  const accounts = useMailAccounts();
  const accountIds = accounts.data?.map((account) => account.id) ?? [];
  const unread = useUnreadMails(accountIds);
  const loading = accounts.isPending || (accountIds.length > 0 && !unread.data);
  const several = accountIds.length > 1;

  return (
    <HomeCard title="Mails non lus" icon={<EnvelopeSimpleIcon aria-hidden />} to="/mail" linkLabel="Boîte de réception" loading={loading}>
      {!loading && accountIds.length === 0 && <HomeEmpty icon={<EnvelopeSimpleIcon aria-hidden />}>Aucune boîte mail configurée.</HomeEmpty>}
      {!loading && unread.error && unread.data?.length === 0 && <HomeEmpty icon={<EnvelopeSimpleIcon aria-hidden />}>Boîte mail injoignable.</HomeEmpty>}
      {!loading && accountIds.length > 0 && !unread.error && unread.data?.length === 0 && <HomeEmpty icon={<CheckCircleIcon aria-hidden />}>Aucun mail non lu.</HomeEmpty>}
      {!loading && unread.data && unread.data.length > 0 && (
        <Stack gap={0}>
          {unread.data.slice(0, MAX_ROWS).map(({ accountId, message }) => {
            const day = message.date ? localDayOf(message.date) : null;
            const account = several ? accounts.data?.find((item) => item.id === accountId) : undefined;
            return (
              <Link key={`${accountId}-${message.uid}`} to={`/mail?account=${accountId}&folder=INBOX&uid=${message.uid}`} className={classes.row}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Stack gap={0} miw={0}>
                    <Text size="sm" fw={600} truncate>
                      {message.from[0]?.name || message.from[0]?.address || 'Expéditeur inconnu'}
                    </Text>
                    <Text size="xs" truncate>
                      {message.subject || '(sans objet)'}
                      {account && (
                        <Text span size="xs" c="dimmed">
                          {' '}
                          · {account.name}
                        </Text>
                      )}
                    </Text>
                  </Stack>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {day === today && message.date ? timeFormat.format(new Date(message.date)) : day ? dayLabel(day, today) : ''}
                  </Text>
                </Group>
              </Link>
            );
          })}
          {unread.data.length > MAX_ROWS && (
            <Text size="xs" c="dimmed" pt={4}>
              + {unread.data.length - MAX_ROWS} autre{unread.data.length - MAX_ROWS > 1 ? 's' : ''}
            </Text>
          )}
        </Stack>
      )}
    </HomeCard>
  );
}
