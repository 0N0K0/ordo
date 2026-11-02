import { Alert, Button, Checkbox, Fieldset, Group, NumberInput, PasswordInput, Select, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core';
import { mailAccountFormSchema, type MailAccountFormValues } from '@ordo/shared';
import { CheckCircleIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { showFormError, useAppForm } from '../../../lib/form';
import { GraphQLRequestError } from '../../../lib/graphql-client';
import { notifySuccess } from '../../../lib/notify';
import { useMailAccountMutations, type MailAccount } from '../api';

/** Usual settings of common providers. */
const PRESETS: Record<string, { label: string; imap: [string, number, boolean]; smtp: [string, number, boolean]; saveSent: boolean }> = {
  gmail: { label: 'Gmail', imap: ['imap.gmail.com', 993, true], smtp: ['smtp.gmail.com', 465, true], saveSent: false },
  outlook: { label: 'Outlook / Microsoft 365', imap: ['outlook.office365.com', 993, true], smtp: ['smtp.office365.com', 587, false], saveSent: false },
  ovh: { label: 'OVHcloud', imap: ['ssl0.ovh.net', 993, true], smtp: ['ssl0.ovh.net', 465, true], saveSent: true },
  infomaniak: { label: 'Infomaniak', imap: ['mail.infomaniak.com', 993, true], smtp: ['mail.infomaniak.com', 465, true], saveSent: true },
  gandi: { label: 'Gandi', imap: ['mail.gandi.net', 993, true], smtp: ['mail.gandi.net', 465, true], saveSent: true },
  ionos: { label: 'IONOS', imap: ['imap.ionos.fr', 993, true], smtp: ['smtp.ionos.fr', 465, true], saveSent: true },
};

interface MailAccountFormProps {
  account?: MailAccount;
  onDone: () => void;
}

/**
 * Mail account settings: address, receiving (IMAP) and sending (SMTP) servers, with a connection test.
 * Passwords left empty on edition are kept.
 * @param {MailAccountFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MailAccountForm({ account, onDone }: MailAccountFormProps) {
  const { test, create, update } = useMailAccountMutations();
  const [sameLogin, setSameLogin] = useState(!account || (account.imapUser === account.smtpUser));
  const [tested, setTested] = useState(false);
  const form = useAppForm<MailAccountFormValues>({
    initialValues: {
      name: account?.name ?? '',
      email: account?.email ?? '',
      displayName: account?.displayName ?? '',
      imapHost: account?.imapHost ?? '',
      imapPort: account?.imapPort ?? 993,
      imapSecure: account?.imapSecure ?? true,
      imapUser: account?.imapUser ?? '',
      imapPassword: '',
      smtpHost: account?.smtpHost ?? '',
      smtpPort: account?.smtpPort ?? 465,
      smtpSecure: account?.smtpSecure ?? true,
      smtpUser: account?.smtpUser ?? '',
      smtpPassword: '',
      saveSent: account?.saveSent ?? true,
    },
    schema: mailAccountFormSchema,
  });

  const { imapUser, imapPassword } = form.values;
  // With "same login", the hidden sending login follows the receiving one (and is validated with it).
  useEffect(() => {
    if (sameLogin) form.setValues({ smtpUser: imapUser, smtpPassword: imapPassword });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `form` is a new object on every render.
  }, [sameLogin, imapUser, imapPassword]);

  /**
   * Values to send: with "same login", the sending login copies the receiving one.
   * @param {MailAccountFormValues} values Form values.
   * @returns {MailAccountFormValues} Input.
   */
  const toInput = (values: MailAccountFormValues): MailAccountFormValues =>
    sameLogin ? { ...values, smtpUser: values.imapUser, smtpPassword: values.imapPassword } : values;

  /**
   * Shows an API error; with "same login", errors of the hidden sending fields go to the receiving ones.
   * @param {unknown} error Error.
   * @returns {void}
   */
  const showError = (error: unknown) => {
    if (sameLogin && error instanceof GraphQLRequestError) {
      const { smtpUser, smtpPassword, ...fields } = error.fields;
      if (smtpUser || smtpPassword) {
        form.setErrors({ ...fields, imapUser: fields.imapUser ?? smtpUser, imapPassword: fields.imapPassword ?? smtpPassword });
        return;
      }
    }
    showFormError(form, error);
  };

  const handleSubmit = form.onSubmit((values) => {
    const input = toInput(values);
    const callbacks = {
      onSuccess: () => {
        notifySuccess(account ? 'Boîte mail modifiée.' : 'Boîte mail ajoutée.');
        onDone();
      },
      onError: showError,
    };
    if (account) update.mutate({ id: account.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  /**
   * Fills the servers of a provider.
   * @param {string | null} key Provider.
   * @returns {void}
   */
  const applyPreset = (key: string | null) => {
    const preset = key ? PRESETS[key] : undefined;
    if (!preset) return;
    form.setValues({
      imapHost: preset.imap[0],
      imapPort: preset.imap[1],
      imapSecure: preset.imap[2],
      smtpHost: preset.smtp[0],
      smtpPort: preset.smtp[1],
      smtpSecure: preset.smtp[2],
      saveSent: preset.saveSent,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput label="Nom dans Ordo" placeholder="Pro, Perso…" required data-autofocus {...form.getInputProps('name')} />
          <Select
            label="Hébergeur"
            placeholder="Remplir les serveurs…"
            description="Facultatif : préremplit les serveurs."
            data={Object.entries(PRESETS).map(([value, preset]) => ({ value, label: preset.label }))}
            onChange={applyPreset}
            value={null}
            clearable={false}
          />
          <TextInput
            label="Adresse email"
            required
            {...form.getInputProps('email')}
            onChange={(event) => {
              const email = event.currentTarget.value;
              // The login is usually the address.
              if (!form.values.imapUser || form.values.imapUser === form.values.email) form.setFieldValue('imapUser', email);
              form.setFieldValue('email', email);
            }}
          />
          <TextInput label="Nom d’expéditeur" placeholder="Prénom Nom" {...form.getInputProps('displayName')} />
        </SimpleGrid>

        <Fieldset legend="Réception (IMAP)">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput label="Serveur" required placeholder="imap.exemple.fr" {...form.getInputProps('imapHost')} />
              <NumberInput label="Port" required min={1} max={65535} {...form.getInputProps('imapPort')} />
              <Switch mt={{ sm: 32 }} label="SSL/TLS" {...form.getInputProps('imapSecure', { type: 'checkbox' })} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput label="Identifiant" required {...form.getInputProps('imapUser')} />
              <PasswordInput
                label="Mot de passe"
                required={!account}
                placeholder={account ? 'Inchangé (à ressaisir si le serveur change)' : undefined}
                description="Pour Gmail ou Outlook : un mot de passe d’application."
                {...form.getInputProps('imapPassword')}
              />
            </SimpleGrid>
          </Stack>
        </Fieldset>

        <Fieldset legend="Envoi (SMTP)">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput label="Serveur" required placeholder="smtp.exemple.fr" {...form.getInputProps('smtpHost')} />
              <NumberInput label="Port" required min={1} max={65535} {...form.getInputProps('smtpPort')} />
              <Switch
                mt={{ sm: 32 }}
                label="SSL/TLS"
                description="Désactivé : STARTTLS (port 587)"
                {...form.getInputProps('smtpSecure', { type: 'checkbox' })}
              />
            </SimpleGrid>
            <Checkbox
              label="Mêmes identifiants que pour la réception"
              checked={sameLogin}
              onChange={(event) => setSameLogin(event.currentTarget.checked)}
            />
            {!sameLogin && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput label="Identifiant" required {...form.getInputProps('smtpUser')} />
                <PasswordInput
                  label="Mot de passe"
                  required={!account}
                  placeholder={account ? 'Inchangé (à ressaisir si le serveur change)' : undefined}
                  {...form.getInputProps('smtpPassword')}
                />
              </SimpleGrid>
            )}
            <Switch
              label="Enregistrer les mails envoyés dans « Envoyés »"
              description="À désactiver pour Gmail et Outlook, qui le font déjà."
              {...form.getInputProps('saveSent', { type: 'checkbox' })}
            />
          </Stack>
        </Fieldset>

        {tested && (
          <Alert color="green" icon={<CheckCircleIcon aria-hidden />}>
            Connexion réussie à la réception et à l’envoi.
          </Alert>
        )}
        <Group justify="space-between" gap="sm">
          <Button
            variant="light"
            loading={test.isPending}
            onClick={() => {
              setTested(false);
              if (form.validate().hasErrors) return;
              test.mutate(
                { input: toInput(form.values), id: account?.id },
                { onSuccess: () => setTested(true), onError: showError },
              );
            }}
          >
            Tester la connexion
          </Button>
          <Group gap="sm">
            <Button variant="default" onClick={onDone}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {account ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
