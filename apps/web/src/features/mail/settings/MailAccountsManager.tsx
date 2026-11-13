import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { ActionIcon, Button, Group, Paper, Skeleton, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { EnvelopeSimpleIcon, PencilSimpleIcon, PlusIcon, SignatureIcon, TrashIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../../lib/notify';
import { useMailAccountMutations, useMailAccounts, type MailAccount } from '../api';
import { MailAccountForm } from './MailAccountForm';
import { SignatureForm } from './SignatureForm';

let modalCount = 0;

/**
 * Settings of the mail accounts: add, edit, signature, remove.
 * @returns {JSX.Element} Manager.
 */
export function MailAccountsManager() {
  const { data: accounts, isPending } = useMailAccounts();
  const { remove } = useMailAccountMutations();

  /**
   * Opens a modal whose content receives a close callback.
   * @param {string} title Title.
   * @param {(close: () => void) => JSX.Element} render Content.
   * @returns {void}
   */
  const open = (title: string, render: (close: () => void) => React.ReactNode) => {
    const modalId = `mail-account-${++modalCount}`;
    modals.open({ modalId, title, size: 'xl', children: render(() => modals.close(modalId)) });
  };

  /**
   * Asks for confirmation before removing an account.
   * @param {MailAccount} account Account.
   * @returns {void}
   */
  const confirmDelete = (account: MailAccount) => {
    confirmDestructive({ title: 'Retirer la boîte mail', risks: (
<>
<Text size="sm">
            {account.email} ne sera plus lue ni utilisée par Ordo, et ses réglages (mots de passe, signature) seront supprimés.
            Les mails restent sur le serveur, et ceux rattachés à des projets restent dans Ordo. Cette action est irréversible.
          </Text>
</>
), confirmLabel: 'Retirer', onConfirm: () => { remove.mutate(account.id, {
                onSuccess: () => notifySuccess('Boîte mail retirée.'),
                onError: (error) => notifyError(error.message),
              }); } });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Boîtes mail
            </Title>
            <Text size="sm" c="dimmed">
              Lues en direct sur le serveur (IMAP) et utilisées pour l’envoi (SMTP). Seuls les mails rattachés à un projet sont
              copiés dans Ordo.
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => open('Nouvelle boîte mail', (close) => <MailAccountForm onDone={close} />)}>
            Ajouter
          </Button>
        </Group>
        {isPending ? (
          <Skeleton height={48} />
        ) : !accounts?.length ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <EnvelopeSimpleIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune boîte mail configurée.
            </Text>
          </Group>
        ) : (
          <Stack gap="xs">
            {accounts.map((account) => (
              <Group key={account.id} gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" radius="xl">
                  <EnvelopeSimpleIcon aria-hidden />
                </ThemeIcon>
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {account.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {account.displayName ? `${account.displayName} <${account.email}>` : account.email}
                    {account.signature ? ' · signature' : ''}
                  </Text>
                </Stack>
                <Tooltip label="Signature">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Signature de ${account.name}`}
                    onClick={() => open(`Signature — ${account.name}`, (close) => <SignatureForm account={account} onDone={close} />)}
                  >
                    <SignatureIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Modifier">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Modifier ${account.name}`}
                    onClick={() => open(`Modifier — ${account.name}`, (close) => <MailAccountForm account={account} onDone={close} />)}
                  >
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Retirer">
                  <ActionIcon variant="subtle" color="red" aria-label={`Retirer ${account.name}`} onClick={() => confirmDelete(account)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
