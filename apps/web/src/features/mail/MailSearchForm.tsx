import { Button, Divider, Group, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { EMPTY_MAIL_SEARCH, mailSearchSchema, type MailSearchCriteria, type MailSearchInput } from '@ordo/shared';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useMailAccounts, useMailLabels, useMailSearchMutations, type MailSearch } from './api';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';

/**
 * Search folder: name, accounts, folders looked into, done state, flags, unread only, text. Kept in Ordo, it is
 * not created on the mail server.
 * @param {{ search?: MailSearch, initial?: MailSearchCriteria, onDone: (id?: string) => void }} props Search edited (none: new), criteria of a new one, and close (given the new id).
 * @returns {JSX.Element} Form.
 */
export function MailSearchForm({ search, initial, onDone }: { search?: MailSearch; initial?: MailSearchCriteria; onDone: (id?: string) => void }) {
  const { data: accounts } = useMailAccounts();
  const { data: labels } = useMailLabels();
  const { create, update } = useMailSearchMutations();
  const criteria: MailSearchCriteria = { ...EMPTY_MAIL_SEARCH, ...(search ? (search.criteria as Partial<MailSearchCriteria>) : (initial ?? { state: 'todo' })) };
  const form = useAppForm<MailSearchCriteria & { name: string } & Record<string, unknown>>({
    initialValues: { ...criteria, name: search?.name ?? (initial ? 'Recherche' : 'À traiter') },
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
            { id: search.id, input: input as MailSearchInput },
            {
              ...callbacks,
              onSuccess: () => {
                notifySuccess('Dossier de recherche modifié.');
                onDone();
              },
            },
          );
        } else {
          create.mutate(input as MailSearchInput, {
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
        <BatchMultiSelect
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
              ...(criteria.scope === 'folder' && criteria.folder ? [{ value: 'folder', label: `Dossier ${criteria.folder}` }] : []),
            ]}
            value={values.scope}
            onChange={(scope) => form.setValues({ scope: scope as MailSearchCriteria['scope'], folder: scope === 'folder' ? criteria.folder : null })}
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
            onChange={(state) => form.setFieldValue('state', state as MailSearchCriteria['state'])}
          />
        </Stack>
        <BatchMultiSelect
          label="Drapeaux"
          description="Les mails ayant l’un de ces drapeaux."
          placeholder={values.labelIds.length ? undefined : 'Peu importe'}
          data={(labels ?? []).map((label) => ({ value: label.id, label: label.name }))}
          clearable
          {...form.getInputProps('labelIds')}
        />
        <Switch label="Non lus seulement" {...form.getInputProps('unread', { type: 'checkbox' })} />
        <TextInput label="Texte" description="Dans l’objet, les adresses ou le corps." placeholder="Facultatif" {...form.getInputProps('text')} />
        <Divider label="Critères avancés" labelPosition="left" />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput label="De" placeholder="Nom ou adresse" {...form.getInputProps('from')} />
          <TextInput label="À" placeholder="Nom ou adresse" {...form.getInputProps('to')} />
          <TextInput label="Objet" {...form.getInputProps('subject')} />
          <TextInput label="Corps" {...form.getInputProps('body')} />
          <DatePickerInput label="Reçu à partir du" clearable placeholder="—" {...form.getInputProps('since')} />
          <DatePickerInput label="Jusqu’au" clearable placeholder="—" minDate={values.since ?? undefined} {...form.getInputProps('until')} />
        </SimpleGrid>
        <Switch label="Avec pièce jointe" {...form.getInputProps('attachments', { type: 'checkbox' })} />
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
