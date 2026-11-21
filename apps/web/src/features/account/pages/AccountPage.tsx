import { PAGES } from '../../../app/pages';
import { EnvelopeSimpleIcon, FloppyDiskIcon, XIcon } from '@phosphor-icons/react';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { PageHeader } from '../../../components/page/PageHeader';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { changeEmailFormSchema, changePasswordFormSchema, changeUsernameFormSchema, type ChangeEmailFormValues, type ChangePasswordFormValues, type ChangeUsernameFormValues } from '@ordo/shared';
import { useMemo } from 'react';

import { useAppForm, formCallbacks } from '../../../lib/form';
import { toastCallbacks } from '../../../lib/notify';
import { useCancelEmailChange, useChangePassword, useChangeUsername, useMe, useRequestEmailChange, type AccountUser } from '../../auth/api';
import { NewPasswordFields } from '../../auth/components/NewPasswordFields';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ActionButton } from '../../../components/actions/ActionButton';
import { RingSettingsForm } from '../components/RingSettingsForm';
import { readRingSettings } from '@ordo/shared';

/**
 * Username change form.
 * @param {object} props Component props.
 * @param {AccountUser} props.user Current user.
 * @returns {JSX.Element} Form.
 */
function UsernameForm({ user }: { user: AccountUser }) {
  const changeUsername = useChangeUsername();
  const form = useAppForm<ChangeUsernameFormValues>({
    initialValues: { username: user.username, currentPassword: '' },
    schema: changeUsernameFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    changeUsername.mutate(
      values,
      formCallbacks(form, 'Identifiant modifié.', (updated: { username: string }) => {
        form.setInitialValues({ username: updated.username, currentPassword: '' });
        form.reset();
      }),
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Identifiant" description="3 à 32 caractères : lettres, chiffres, « . », « _ » et « - »." autoComplete="username" required {...form.getInputProps('username')} />
        <PasswordInput label="Mot de passe actuel" autoComplete="current-password" required {...form.getInputProps('currentPassword')} />
        <FormActions submitLabel="Modifier l’identifiant" submitIcon={<FloppyDiskIcon aria-hidden />} loading={changeUsername.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Email change form, with the pending change if any.
 * @param {object} props Component props.
 * @param {AccountUser} props.user Current user.
 * @returns {JSX.Element} Form.
 */
function EmailForm({ user }: { user: AccountUser }) {
  const requestEmailChange = useRequestEmailChange();
  const cancelEmailChange = useCancelEmailChange();
  const form = useAppForm<ChangeEmailFormValues>({
    initialValues: { email: '', currentPassword: '' },
    schema: changeEmailFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    requestEmailChange.mutate(
      values,
      formCallbacks(form, 'Un lien de confirmation a été envoyé à la nouvelle adresse.', () => form.reset()),
    );
  });

  /**
   * Cancels the pending email change.
   * @returns {void}
   */
  const handleCancel = () => {
    cancelEmailChange.mutate(undefined, toastCallbacks('Changement d’adresse annulé.'));
  };

  return (
    <Stack gap="md">
      <Text size="sm">
        Adresse actuelle : <strong>{user.email}</strong>
      </Text>
      {user.pendingEmail && (
        <NoticeAlert kind="info" title="Confirmation en attente">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">
              Un lien a été envoyé à <strong>{user.pendingEmail}</strong>. L’adresse sera remplacée une fois le lien ouvert.
            </Text>
            <ActionButton priority="tertiary" icon={<XIcon aria-hidden />} onClick={handleCancel} loading={cancelEmailChange.isPending}>
              Annuler le changement
            </ActionButton>
          </Stack>
        </NoticeAlert>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <TextInput label="Nouvelle adresse email" type="email" autoComplete="email" required {...form.getInputProps('email')} />
          <PasswordInput label="Mot de passe actuel" autoComplete="current-password" required {...form.getInputProps('currentPassword')} />
          <FormActions submitLabel="Changer d’adresse" submitIcon={<EnvelopeSimpleIcon aria-hidden />} loading={requestEmailChange.isPending} />
        </Stack>
      </form>
    </Stack>
  );
}

/**
 * Password change form.
 * @param {object} props Component props.
 * @param {AccountUser} props.user Current user.
 * @returns {JSX.Element} Form.
 */
function PasswordForm({ user }: { user: AccountUser }) {
  const changePassword = useChangePassword();
  const userInputs = useMemo(() => [user.username, user.email], [user.username, user.email]);
  const form = useAppForm<ChangePasswordFormValues>({
    initialValues: { currentPassword: '', password: '', confirmation: '' },
    schema: changePasswordFormSchema,
  });

  const handleSubmit = form.onSubmit(({ currentPassword, password }) => {
    changePassword.mutate(
      { currentPassword, password },
      formCallbacks(form, 'Mot de passe modifié. Vos autres sessions ont été fermées.', () => form.reset()),
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <PasswordInput label="Mot de passe actuel" autoComplete="current-password" required {...form.getInputProps('currentPassword')} />
        <NewPasswordFields form={form} userInputs={userInputs} />
        <FormActions submitLabel="Modifier le mot de passe" submitIcon={<FloppyDiskIcon aria-hidden />} loading={changePassword.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Account settings: username, email, password, and how alarms ring (every workspace).
 * @returns {JSX.Element | null} Account page.
 */
export function AccountPage() {
  const { data: user } = useMe();
  if (!user) return null;

  return (
    <Stack gap="lg">
      <PageHeader title={PAGES.account.label} />
      <SettingsSection title="Identifiant" description="Utilisable à la place de l’adresse email pour se connecter.">
        <UsernameForm key={user.username} user={user} />
      </SettingsSection>
      <SettingsSection title="Adresse email" description="Sert à la connexion et à la réinitialisation du mot de passe. La nouvelle adresse doit être confirmée.">
        <EmailForm user={user} />
      </SettingsSection>
      <SettingsSection title="Mot de passe" description="Les autres sessions ouvertes seront fermées.">
        <PasswordForm user={user} />
      </SettingsSection>
      <SettingsSection title="Sonnerie des alarmes" description="Alarmes et rappels de tous les espaces. Chaque rappel peut choisir sa propre sonnerie.">
        <RingSettingsForm settings={readRingSettings(user.ringSettings)} />
      </SettingsSection>
    </Stack>
  );
}
