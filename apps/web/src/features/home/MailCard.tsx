import { Group, Stack, Text } from '@mantine/core';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useMailAccounts, useMailMessages } from '../mail/api';
import classes from './Home.module.css';
import { HomeCard, HomeEmpty } from './HomeCard';
import { dayLabel, localDayOf } from './home-data';

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/**
 * Latest mails of the inbox of the first account, unread ones in bold.
 * @param {{ today: string }} props Component props.
 * @returns {JSX.Element} Card.
 */
export function MailCard({ today }: { today: string }) {
  const accounts = useMailAccounts();
  const account = accounts.data?.[0] ?? null;
  const messages = useMailMessages(account ? { accountId: account.id, folder: 'INBOX', page: 0, search: '' } : null);
  const loading = accounts.isPending || (account !== null && messages.isPending);

  return (
    <HomeCard title="Mails" icon={<EnvelopeSimpleIcon aria-hidden />} to="/mail" linkLabel="Boîte de réception" loading={loading}>
      {!loading && !account && <HomeEmpty icon={<EnvelopeSimpleIcon aria-hidden />}>Aucune boîte mail configurée.</HomeEmpty>}
      {!loading && account && messages.error && <HomeEmpty icon={<EnvelopeSimpleIcon aria-hidden />}>Boîte mail injoignable.</HomeEmpty>}
      {!loading && account && messages.data && messages.data.messages.length === 0 && <HomeEmpty icon={<EnvelopeSimpleIcon aria-hidden />}>Boîte de réception vide.</HomeEmpty>}
      {!loading && account && messages.data && messages.data.messages.length > 0 && (
        <Stack gap={0}>
          {messages.data.messages.slice(0, 6).map((message) => {
            const day = message.date ? localDayOf(message.date) : null;
            return (
              <Link key={message.uid} to={`/mail?account=${account.id}&folder=INBOX&uid=${message.uid}`} className={classes.row}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Stack gap={0} miw={0}>
                    <Text size="sm" fw={message.seen ? 400 : 700} truncate>
                      {message.from[0]?.name || message.from[0]?.address || 'Expéditeur inconnu'}
                    </Text>
                    <Text size="xs" c={message.seen ? 'dimmed' : undefined} truncate>
                      {message.subject || '(sans objet)'}
                    </Text>
                  </Stack>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {day === today && message.date ? timeFormat.format(new Date(message.date)) : day ? dayLabel(day, today) : ''}
                  </Text>
                </Group>
              </Link>
            );
          })}
        </Stack>
      )}
    </HomeCard>
  );
}
