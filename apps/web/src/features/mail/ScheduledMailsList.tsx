import { EmptyState } from '../../components/feedback/EmptyState';
import { ActionIcon, Badge, Group, Paper, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { ArrowCounterClockwiseIcon, ClockCountdownIcon, PaperPlaneRightIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailAccounts, useMailActions, useScheduledMails } from './api';
import * as fmt from '../../lib/format';

/**
 * Mails scheduled to be sent (and those whose sending failed): send now, or cancel (back to the drafts of
 * their account, to be changed).
 * @returns {JSX.Element} List.
 */
export function ScheduledMailsList() {
  const { data: scheduled } = useScheduledMails();
  const { data: accounts } = useMailAccounts();
  const { sendScheduled, cancelScheduled } = useMailActions();
  const onError = (error: Error) => notifyError(error.message);

  if (!scheduled?.length) {
    return (
      <Stack align="center" gap="sm" p="xl">
        <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
          <ClockCountdownIcon aria-hidden />
        </ThemeIcon>
        <EmptyState compact message="Aucun envoi programmé. Programmez un mail depuis sa fenêtre de rédaction (« Programmer »)." />
      </Stack>
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
                  {mail.status === 'FAILED' ? 'Échec' : mail.status === 'SENDING' ? 'Envoi en cours' : fmt.dateTimeShort(new Date(String(mail.sendAt)))}
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
                <Tooltip label="Envoyer maintenant">
                  <ActionIcon
                    variant="subtle"
                    aria-label={`Envoyer maintenant « ${mail.subject} »`}
                    loading={sendScheduled.isPending && sendScheduled.variables === mail.id}
                    onClick={() => sendScheduled.mutate(mail.id, { onSuccess: () => notifySuccess('Mail envoyé.'), onError })}
                  >
                    <PaperPlaneRightIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Annuler l’envoi (retour aux brouillons)">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Annuler l’envoi de « ${mail.subject} »`}
                    loading={cancelScheduled.isPending && cancelScheduled.variables === mail.id}
                    onClick={() => cancelScheduled.mutate(mail.id, { onSuccess: () => notifySuccess('Envoi annulé : le mail est dans les brouillons.'), onError })}
                  >
                    <ArrowCounterClockwiseIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
