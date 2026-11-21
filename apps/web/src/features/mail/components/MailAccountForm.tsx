import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { PlugsConnectedIcon } from '@phosphor-icons/react';
import { Checkbox, Fieldset, Group, NumberInput, PasswordInput, Select, SimpleGrid, Stack, Switch, TextInput } from '@mantine/core';
import { mailAccountFormSchema, PASSWORD_AGAIN, passwordsToRetype, type MailAccountFormValues } from '@ordo/shared';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { showFormError, useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { GraphQLRequestError } from '../../../lib/graphql-client';
import { useMailAccountMutations, useMailAccounts, type MailAccount } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ActionButton } from '../../../components/actions/ActionButton';

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

/** Fields of the connection (servers, logins, passwords): saved together, a server changed with its password typed again. */
const CONNECTION = ['imapHost', 'imapPort', 'imapSecure', 'imapUser', 'imapPassword', 'smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword'] as const;

/**
 * Values of the form of an account (or of a new one); its passwords are never shown (empty: kept).
 * @param {MailAccount} [account] Account. Optional.
 * @returns {MailAccountFormValues} Values.
 */
function accountValues(account?: MailAccount): MailAccountFormValues {
  return {
    label: account?.label ?? '',
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
  };
}

/**
 * Values to send: with "same login", the sending login copies the receiving one.
 * @param {MailAccountFormValues} values Form values.
 * @param {boolean} sameLogin Same login for sending.
 * @returns {MailAccountFormValues} Input.
 */
const toInput = (values: MailAccountFormValues, sameLogin: boolean): MailAccountFormValues => (sameLogin ? { ...values, smtpUser: values.imapUser, smtpPassword: values.imapPassword } : values);

/**
 * Mail account settings: address, receiving (IMAP) and sending (SMTP) servers, with a connection test. A new account
 * is added by its button; an existing one is saved field by field: its label, address, sender name and
 * « Envoyés » at once (texts on leaving them), its connection together on leaving one of its fields, once a server
 * changed has its password typed again (an error under it until then). Passwords left empty are kept.
 * @param {MailAccountFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function MailAccountForm({ account, onDone }: MailAccountFormProps) {
  const { test, create, update } = useMailAccountMutations();
  const { data: accounts } = useMailAccounts();
  const current = account && (accounts?.find((item) => item.id === account.id) ?? account);
  const [sameLogin, setSameLogin] = useState(!account || account.imapUser === account.smtpUser);
  // The choice as it is when a save is checked (changed and saved in the same event).
  const sameRef = useRef(sameLogin);
  const [tested, setTested] = useState(false);
  const base = useAppForm<MailAccountFormValues>({ initialValues: accountValues(account), schema: mailAccountFormSchema });
  const { form, saving, commit } = useFieldSave(base, {
    save: account ? (_changes, values) => update.mutateAsync({ id: account.id, input: toInput(values, sameLogin) }) : null,
    schema: mailAccountFormSchema,
    saved: current && accountValues(current),
    onBlur: ['label', 'email', 'displayName', ...CONNECTION],
    readOnly: Boolean(current?.archived),
    // A server changed waits for its password, an error under it (under the receiving one with "same login").
    check: (values, fields) => {
      if (!current || !fields.some((field) => (CONNECTION as readonly string[]).includes(field))) return {};
      const same = sameRef.current;
      const [missing] = passwordsToRetype(toInput(values, same), current);
      return missing ? { [same ? 'imapPassword' : missing]: PASSWORD_AGAIN } : {};
    },
  });

  const { imapUser, imapPassword } = form.values;
  // With "same login", the hidden sending login follows the receiving one (and is validated with it).
  useEffect(() => {
    if (sameLogin) base.setValues({ smtpUser: imapUser, smtpPassword: imapPassword });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `base` is a new object on every render.
  }, [sameLogin, imapUser, imapPassword]);

  /**
   * Saves the connection of an existing account together (nothing on a new one), once checked (`check`).
   * @returns {void}
   */
  const saveConnection = () => void commit(CONNECTION);

  /**
   * Props of a field of the connection: saved with the whole connection on leaving it (a switch: once changed).
   * @param {(typeof CONNECTION)[number]} field Field.
   * @param {boolean} [checkbox=false] A switch. Optional. Default = false.
   * @returns {object} Input props.
   */
  const connectionProps = (field: (typeof CONNECTION)[number], checkbox = false) => {
    const props = form.getInputProps(field, checkbox ? { type: 'checkbox' } : undefined);
    if (checkbox) return { ...props, onChange: (event: ChangeEvent<HTMLInputElement>) => (base.setFieldValue(field, event.currentTarget.checked), saveConnection()) };
    return { ...props, onBlur: () => saveConnection() };
  };

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

  // A new account is added; on an existing one, Enter saves the texts typed (the connection with its check).
  const handleSubmit = account
    ? (event: FormEvent) => {
        event.preventDefault();
        commit(['label', 'email', 'displayName']);
        saveConnection();
      }
    : form.onSubmit((values) => {
        // The errors of the hidden sending fields go to the receiving ones.
        create.mutate(toInput(values, sameLogin), { ...formCallbacks(form, 'Boîte mail ajoutée.', onDone), onError: showError });
      });

  /**
   * Fills the servers of a provider (saved with the connection).
   * @param {string | null} key Provider.
   * @returns {void}
   */
  const applyPreset = (key: string | null) => {
    const preset = key ? PRESETS[key] : undefined;
    if (!preset) return;
    base.setValues({
      imapHost: preset.imap[0],
      imapPort: preset.imap[1],
      imapSecure: preset.imap[2],
      smtpHost: preset.smtp[0],
      smtpPort: preset.smtp[1],
      smtpSecure: preset.smtp[2],
      saveSent: preset.saveSent,
    });
    commit(['saveSent']);
    saveConnection();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {account && <SaveStatus saving={saving} />}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput label="Libellé dans Ordo" placeholder="Pro, Perso…" required data-autofocus {...form.getInputProps('label')} />
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
              // The login of a new account is usually the address.
              if (!account && (!form.values.imapUser || form.values.imapUser === form.values.email)) form.setFieldValue('imapUser', email);
              form.setFieldValue('email', email);
            }}
          />
          <TextInput label="Nom d’expéditeur" placeholder="Prénom Nom" {...form.getInputProps('displayName')} />
        </SimpleGrid>

        <Fieldset legend="Réception (IMAP)">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput label="Serveur" required placeholder="imap.exemple.fr" {...connectionProps('imapHost')} />
              <NumberInput label="Port" required min={1} max={65535} {...connectionProps('imapPort')} />
              <Switch mt={{ sm: 32 }} label="SSL/TLS" {...connectionProps('imapSecure', true)} />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput label="Identifiant" required {...connectionProps('imapUser')} />
              <PasswordInput
                label="Mot de passe"
                required={!account}
                placeholder={account ? 'Inchangé (à ressaisir si le serveur change)' : undefined}
                description="Pour Gmail ou Outlook : un mot de passe d’application."
                {...connectionProps('imapPassword')}
              />
            </SimpleGrid>
          </Stack>
        </Fieldset>

        <Fieldset legend="Envoi (SMTP)">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <TextInput label="Serveur" required placeholder="smtp.exemple.fr" {...connectionProps('smtpHost')} />
              <NumberInput label="Port" required min={1} max={65535} {...connectionProps('smtpPort')} />
              <Switch mt={{ sm: 32 }} label="SSL/TLS" description="Désactivé : STARTTLS (port 587)" {...connectionProps('smtpSecure', true)} />
            </SimpleGrid>
            <Checkbox
              label="Mêmes identifiants que pour la réception"
              checked={sameLogin}
              onChange={(event) => {
                const same = event.currentTarget.checked;
                setSameLogin(same);
                sameRef.current = same;
                if (!same) return;
                base.setValues({ smtpUser: base.getValues().imapUser, smtpPassword: base.getValues().imapPassword });
                saveConnection();
              }}
            />
            {!sameLogin && (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput label="Identifiant" required {...connectionProps('smtpUser')} />
                <PasswordInput label="Mot de passe" required={!account} placeholder={account ? 'Inchangé (à ressaisir si le serveur change)' : undefined} {...connectionProps('smtpPassword')} />
              </SimpleGrid>
            )}
            <Switch
              label="Enregistrer les mails envoyés dans « Envoyés »"
              description="À désactiver pour Gmail et Outlook, qui le font déjà."
              {...form.getInputProps('saveSent', { type: 'checkbox' })}
            />
          </Stack>
        </Fieldset>

        {tested && <NoticeAlert kind="success">Connexion réussie à la réception et à l’envoi.</NoticeAlert>}
        <Group justify="space-between" gap="sm">
          <ActionButton
            priority="secondary"
            icon={<PlugsConnectedIcon aria-hidden />}
            loading={test.isPending}
            onClick={() => {
              setTested(false);
              if (form.validate().hasErrors) return;
              test.mutate({ input: toInput(form.values, sameLogin), id: account?.id }, { onSuccess: () => setTested(true), onError: showError });
            }}
          >
            Tester la connexion
          </ActionButton>
          {!account && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={create.isPending} />}
        </Group>
      </Stack>
    </form>
  );
}
