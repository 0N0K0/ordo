import { IconAction } from '../../../components/actions/IconAction';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Badge, Box, Group, Paper, Stack, Text } from '@mantine/core';
import { ArrowCounterClockwiseIcon, ClockCountdownIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import { toastCallbacks } from '../../../lib/notify';
import { useMailAccounts, useMailActions, useScheduledMails } from '../api';
import * as fmt from '../../../lib/format';

/**
 * Mails scheduled to be sent (and those whose sending failed): send now, or cancel (back to the drafts of
 * their account, to be changed).
 * @returns {JSX.Element} List.
 */
export function ScheduledMailsList() {
  const { data: scheduled } = useScheduledMails();
  const { data: accounts } = useMailAccounts();
  const { sendScheduled, cancelScheduled } = useMailActions();

  if (!scheduled?.length) {
    return (
      <Box p="xl">
        <EmptyState plain icon={<ClockCountdownIcon aria-hidden />} message="Aucun envoi programmé. Programmez un mail depuis sa fenêtre de rédaction (« Programmer »)." />
      </Box>
    );
  }
  return (
    <Stack gap={0}>
      {scheduled.map((mail) => (
        <Paper key={mail.id} p="sm" radius={0} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {mail.subject}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                À : {mail.to.join(', ') || '—'} · {accounts?.find((account) => account.id === mail.accountId)?.email ?? ''}
              </Text>
              <Group gap={6}>
                <Badge size="sm" variant="light" color={mail.status === 'FAILED' ? 'red' : 'blue'} leftSection={<ClockCountdownIcon aria-hidden />}>
                  {mail.status === 'FAILED' ? 'Échec' : mail.status === 'SENDING' ? 'Envoi en cours' : fmt.dateTimeShort(mail.sendAt)}
                </Badge>
                {mail.error && (
                  <Text size="xs" c="red" lineClamp={2}>
                    {mail.error}
                  </Text>
                )}
              </Group>
            </Stack>
            {mail.status !== 'SENDING' && (
              <Group gap={2} wrap="nowrap">
                <IconAction
                  label="Envoyer maintenant"
                  aria-label={`Envoyer maintenant « ${mail.subject} »`}
                  loading={sendScheduled.isPending && sendScheduled.variables === mail.id}
                  onClick={() => sendScheduled.mutate(mail.id, toastCallbacks('Mail envoyé.'))}
                >
                  <PaperPlaneRightIcon aria-hidden />
                </IconAction>
                <IconAction
                  label="Annuler l’envoi (retour aux brouillons)"
                  aria-label={`Annuler l’envoi de « ${mail.subject} »`}
                  loading={cancelScheduled.isPending && cancelScheduled.variables === mail.id}
                  onClick={() => cancelScheduled.mutate(mail.id, toastCallbacks('Envoi annulé : le mail est dans les brouillons.'))}
                >
                  <ArrowCounterClockwiseIcon aria-hidden />
                </IconAction>
              </Group>
            )}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
