import { InlineActions } from '../../../components/data-table/cells/RowActions';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { openModal } from '../../../components/panels/open-modal';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Button, Group, Stack, Text, ThemeIcon } from '@mantine/core';

import { EnvelopeSimpleIcon, PencilSimpleIcon, PlusIcon, SignatureIcon, TrashIcon } from '@phosphor-icons/react';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useMailAccountMutations, useMailAccounts, type MailAccount } from '../api';
import { MailAccountForm } from './MailAccountForm';
import { SignatureForm } from './SignatureForm';
import { SettingsSection } from '../../../components/settings/SettingsSection';

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
    openModal(title, render, { size: 'xl' });
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
                onError: onMutationError,
              }); } });
  };

  return (
    <SettingsSection
      title="Boîtes mail"
      description={<>Lues en direct sur le serveur (IMAP) et utilisées pour l’envoi (SMTP). Seuls les mails rattachés à un projet sont copiés dans Ordo.</>}
      actions={
        <>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => open('Nouvelle boîte mail', (close) => <MailAccountForm onDone={close} />)}>
            Ajouter
          </Button>
        </>
      }
    >
      {isPending ? (
        <ListSkeleton items={2} />
      ) : !accounts?.length ? (
        <EmptyState compact icon={<EnvelopeSimpleIcon aria-hidden />} message="Aucune boîte mail configurée." />
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
              <InlineActions
                name={account.name}
                items={[
                  { label: 'Signature', icon: <SignatureIcon aria-hidden />, onClick: () => open(`Signature — ${account.name}`, (close) => <SignatureForm account={account} onDone={close} />) },
                  { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => open(`Modifier — ${account.name}`, (close) => <MailAccountForm account={account} onDone={close} />) },
                  { label: 'Retirer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(account) },
                ]}
              />
              </Group>
          ))}
        </Stack>
      )}
    </SettingsSection>
  );
}
