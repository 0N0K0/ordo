import { InlineActions } from '../../../components/actions/ActionsMenu';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { openModal } from '../../../components/panels/open-modal';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Group, Stack, Text, ThemeIcon } from '@mantine/core';

import { EnvelopeSimpleIcon, PencilSimpleIcon, PlusIcon, SignatureIcon, TrashIcon } from '@phosphor-icons/react';

import { archiveEntry, useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';

import { useMailAccountMutations, useMailAccounts, type MailAccount } from '../api';
import { MailAccountForm } from './MailAccountForm';
import { SignatureForm } from './SignatureForm';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Settings of the mail accounts: add, edit, signature, archive (not read nor synchronised anymore, hidden until
 * « Afficher les archivées », read only) or restore, remove.
 * @returns {JSX.Element} Manager.
 */
export function MailAccountsManager() {
  const { data: accounts, isPending } = useMailAccounts();
  const { remove } = useMailAccountMutations();
  const setArchived = useSetArchived('MAIL_ACCOUNT');
  const { shown, toggle: archivedToggle } = useArchivedToggle(accounts ?? []);

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
    confirmDestructive({
      title: 'Retirer la boîte mail',
      risks: (
        <>
          {account.email} ne sera plus lue ni utilisée par Ordo, et ses réglages (mots de passe, signature) seront supprimés. Les mails restent sur le serveur, et ceux rattachés à des projets restent
          dans Ordo.
        </>
      ),
      confirmLabel: 'Retirer',
      run: () => remove.mutateAsync(account.id),
      done: 'Boîte mail retirée.',
    });
  };

  return (
    <SettingsSection
      title="Boîtes mail"
      description={<>Lues en direct sur le serveur (IMAP) et utilisées pour l’envoi (SMTP). Seuls les mails rattachés à un projet sont copiés dans Ordo.</>}
      actions={
        <>
          <ShowArchivedSwitch {...archivedToggle} label="Afficher les archivées" />
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => open('Nouvelle boîte mail', (close) => <MailAccountForm onDone={close} />)}>
            Ajouter
          </ActionButton>
        </>
      }
    >
      {isPending ? (
        <ListSkeleton items={2} />
      ) : !shown.length ? (
        <EmptyState compact icon={<EnvelopeSimpleIcon aria-hidden />} message="Aucune boîte mail configurée." />
      ) : (
        <Stack gap="xs">
          {shown.map((account) => (
            <Group key={account.id} gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" radius="xl">
                <EnvelopeSimpleIcon aria-hidden />
              </ThemeIcon>
              <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={500} truncate>
                    {account.label}
                  </Text>
                  {account.archived && <ArchivedBadge feminine size="xs" />}
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {account.displayName ? `${account.displayName} <${account.email}>` : account.email}
                  {account.signature ? ' · signature' : ''}
                </Text>
              </Stack>
              <InlineActions
                name={account.label}
                items={[
                  // Archived: read only.
                  !account.archived && {
                    label: 'Signature',
                    icon: <SignatureIcon aria-hidden />,
                    onClick: () => open(`Signature — ${account.label}`, (close) => <SignatureForm account={account} onDone={close} />),
                  },
                  !account.archived && {
                    label: 'Modifier',
                    icon: <PencilSimpleIcon aria-hidden />,
                    onClick: () => open(`Modifier — ${account.label}`, (close) => <MailAccountForm account={account} onDone={close} />),
                  },
                  archiveEntry({ archived: account.archived, type: 'Boîte', label: account.label, feminine: true }, setArchived, account.id),
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
