import { ActionIcon, Badge, Button, Group, Paper, Skeleton, Stack, Switch, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { emailSchema, usernameSchema } from '@ordo/shared';
import { EnvelopeSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { z } from 'zod';
import { SettingsGrid } from '../../components/settings/SettingsGrid';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useAccountMutations, useAccounts, type ManagedAccount } from './api';

const accountFormSchema = z.object({ username: usernameSchema, email: emailSchema });

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/**
 * One account: login name, email, state; for the other accounts, link sent again, on / off, deletion.
 * @param {{ account: ManagedAccount }} props Component props.
 * @param {ManagedAccount} props.account Account.
 * @returns {JSX.Element} Row.
 */
function AccountRow({ account }: { account: ManagedAccount }) {
  const { resend, setDisabled, remove } = useAccountMutations();
  const admin = account.role === 'ADMIN';

  /**
   * Asks for confirmation before deleting the account.
   * @returns {void}
   */
  const confirmDelete = () => {
    const modalId = `delete-account-${account.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le compte',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le compte « {account.username} » sera supprimé définitivement, avec ses espaces et tout ce qu’ils contiennent (projets, tâches, temps, agenda, documents, trésorerie…). La personne ne
            pourra plus se connecter. Cette action est irréversible : pour lui retirer l’accès sans rien perdre, désactivez plutôt le compte.
          </Text>
          <DestructiveActions
            loading={remove.isPending}
            onCancel={() => modals.close(modalId)}
            onConfirm={() =>
              remove.mutate(account.id, {
                onSuccess: () => {
                  modals.close(modalId);
                  notifySuccess('Compte supprimé.');
                },
                onError: (error) => notifyError(error.message),
              })
            }
          />
        </Stack>
      ),
    });
  };

  return (
    <Paper withBorder radius="md" p="md" style={{ opacity: account.disabled ? 0.6 : 1 }}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Text fw={600}>{account.username}</Text>
            {admin && (
              <Badge size="sm" variant="light">
                Administratrice
              </Badge>
            )}
            {account.passwordPending && (
              <Badge size="sm" variant="light" color="yellow">
                Mot de passe à choisir
              </Badge>
            )}
            {account.disabled && (
              <Badge size="sm" variant="light" color="gray">
                Désactivé
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" truncate>
            {account.email}
          </Text>
          <Text size="xs" c="dimmed">
            Créé le {dateFormat.format(new Date(account.createdAt))}
          </Text>
        </Stack>
        {!admin && (
          <Group gap="xs" wrap="nowrap">
            {account.passwordPending && (
              <Tooltip label="Renvoyer le lien d’activation">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Renvoyer le lien d’activation à ${account.username}`}
                  loading={resend.isPending}
                  onClick={() => resend.mutate(account.id, { onSuccess: () => notifySuccess('Lien renvoyé.'), onError: (error) => notifyError(error.message) })}
                >
                  <EnvelopeSimpleIcon aria-hidden />
                </ActionIcon>
              </Tooltip>
            )}
            <Switch
              aria-label={account.disabled ? `Réactiver ${account.username}` : `Désactiver ${account.username}`}
              checked={!account.disabled}
              onChange={(event) =>
                setDisabled.mutate(
                  { id: account.id, disabled: !event.currentTarget.checked },
                  {
                    onSuccess: (updated) => notifySuccess(updated.disabled ? 'Compte désactivé : la personne est déconnectée.' : 'Compte réactivé.'),
                    onError: (error) => notifyError(error.message),
                  },
                )
              }
            />
            <Tooltip label="Supprimer">
              <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${account.username}`} onClick={confirmDelete}>
                <TrashIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>
    </Paper>
  );
}

/**
 * Accounts (admin only): the list, and the creation of an account, whose owner receives by email a link to choose
 * the password. Each account has its own personal workspaces; only the admin has professional ones.
 * @returns {JSX.Element} Manager.
 */
export function AccountsManager() {
  const { data, isPending } = useAccounts(true);
  const { create } = useAccountMutations();
  const form = useAppForm({ initialValues: { username: '', email: '' }, schema: accountFormSchema });

  const handleSubmit = form.onSubmit((values) =>
    create.mutate(values, {
      onSuccess: (account) => {
        notifySuccess(`Compte « ${account.username} » créé : un lien d’activation a été envoyé à ${account.email}.`);
        form.reset();
      },
      onError: (error) => showFormError(form, error),
    }),
  );

  return (
    <SettingsGrid>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={2} size="h4">
            Comptes
          </Title>
          <Text size="sm" c="dimmed">
            Chaque compte a ses propres espaces, personnels, que les autres ne voient pas. Vous seule gérez les comptes et avez des espaces professionnels.
          </Text>
          {isPending ? (
            <Stack gap="xs" aria-label="Chargement">
              <Skeleton height={72} />
              <Skeleton height={72} />
            </Stack>
          ) : (
            (data ?? []).map((account) => <AccountRow key={account.id} account={account} />)
          )}
        </Stack>
      </Paper>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="sm">
          <Title order={2} size="h4">
            Nouveau compte
          </Title>
          <Text size="sm" c="dimmed">
            La personne reçoit par email un lien, valable 7 jours, pour choisir son mot de passe.
          </Text>
          <form onSubmit={handleSubmit} noValidate>
            <Stack gap="sm">
              <TextInput label="Identifiant" required autoComplete="off" {...form.getInputProps('username')} />
              <TextInput label="Adresse email" type="email" required autoComplete="off" {...form.getInputProps('email')} />
              <Group justify="flex-end">
                <Button type="submit" leftSection={<PlusIcon aria-hidden />} loading={create.isPending}>
                  Créer le compte
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </SettingsGrid>
  );
}
