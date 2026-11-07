import { Button, Group, MultiSelect, SegmentedControl, Stack, Switch, Text, TextInput } from '@mantine/core';
import { mailSearchSchema, type MailSearchCriteria, type MailSearchInput } from '@ordo/shared';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useMailAccounts, useMailLabels, useMailSearchMutations, type MailSearch } from './api';

/**
 * Search folder: name, accounts, folders looked into, done state, flags, unread only, text. Kept in Ordo, it is
 * not created on the mail server.
 * @param {{ search?: MailSearch, onDone: (id?: string) => void }} props Search edited (none: new) and close (given the new id).
 * @returns {JSX.Element} Form.
 */
export function MailSearchForm({ search, onDone }: { search?: MailSearch; onDone: (id?: string) => void }) {
  const { data: accounts } = useMailAccounts();
  const { data: labels } = useMailLabels();
  const { create, update } = useMailSearchMutations();
  const criteria = search?.criteria as MailSearchCriteria | undefined;
  const form = useAppForm<MailSearchInput & Record<string, unknown>>({
    initialValues: {
      name: search?.name ?? 'À traiter',
      accountIds: criteria?.accountIds ?? [],
      scope: criteria?.scope ?? 'inbox',
      state: criteria?.state ?? 'todo',
      labelIds: criteria?.labelIds ?? [],
      unread: criteria?.unread ?? false,
      text: criteria?.text ?? '',
    },
    schema: mailSearchSchema,
  });
  const values = form.values;

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => {
        const callbacks = { onError: (error: Error) => showFormError(form, error) };
        if (search) {
          update.mutate(
            { id: search.id, input },
            {
              ...callbacks,
              onSuccess: () => {
                notifySuccess('Dossier de recherche modifié.');
                onDone();
              },
            },
          );
        } else {
          create.mutate(input, {
            ...callbacks,
            onSuccess: (id) => {
              notifySuccess('Dossier de recherche créé.');
              onDone(id);
            },
          });
        }
      })}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Un dossier de recherche rassemble les mails qui répondent à ses critères, dans une ou plusieurs boîtes. Il n’existe que dans Ordo : rien n’est créé sur le serveur.
        </Text>
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <MultiSelect
          label="Boîtes"
          placeholder={values.accountIds.length ? undefined : 'Toutes les boîtes'}
          data={(accounts ?? []).map((account) => ({ value: account.id, label: `${account.name} (${account.email})` }))}
          clearable
          {...form.getInputProps('accountIds')}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Dossiers
          </Text>
          <SegmentedControl
            data={[
              { value: 'inbox', label: 'Réception' },
              { value: 'all', label: 'Tous (hors corbeille, spam, brouillons, envoyés)' },
            ]}
            value={values.scope}
            onChange={(scope) => form.setFieldValue('scope', scope as MailSearchInput['scope'])}
          />
        </Stack>
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Mails
          </Text>
          <SegmentedControl
            data={[
              { value: 'todo', label: 'À traiter' },
              { value: 'done', label: 'Traités' },
              { value: 'all', label: 'Tous' },
            ]}
            value={values.state}
            onChange={(state) => form.setFieldValue('state', state as MailSearchInput['state'])}
          />
        </Stack>
        <MultiSelect
          label="Drapeaux"
          description="Les mails ayant l’un de ces drapeaux."
          placeholder={values.labelIds.length ? undefined : 'Peu importe'}
          data={(labels ?? []).map((label) => ({ value: label.id, label: label.name }))}
          clearable
          {...form.getInputProps('labelIds')}
        />
        <Switch label="Non lus seulement" {...form.getInputProps('unread', { type: 'checkbox' })} />
        <TextInput label="Texte" description="Dans l’objet, les adresses ou le corps." placeholder="Facultatif" {...form.getInputProps('text')} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => onDone()}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
