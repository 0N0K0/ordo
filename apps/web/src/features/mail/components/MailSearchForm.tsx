import { LabeledField } from '../../../components/inputs/LabeledField';
import { Divider, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { listSelectProps } from '../../../components/items/item-look';
import { DatePickerInput } from '@mantine/dates';
import { EMPTY_MAIL_SEARCH, mailSearchSchema, type MailSearchCriteria, type MailSearchInput } from '@ordo/shared';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useMailAccounts, useMailLabels, useMailSearches, useMailSearchMutations, type MailSearch } from '../api';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { FormActions } from '../../../components/dialogs/FormActions';
import { unarchived } from '../../../lib/archive';
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';
import { accountLabel } from '../lib/mail-format';

type SearchValues = MailSearchCriteria & { label: string } & Record<string, unknown>;

/**
 * Values of the form of a search folder.
 * @param {MailSearch} search Search folder.
 * @returns {SearchValues} Values.
 */
const searchValues = (search: MailSearch): SearchValues => ({ ...EMPTY_MAIL_SEARCH, ...(search.criteria as Partial<MailSearchCriteria>), label: search.label });

/**
 * Search folder: label, accounts, folders looked into, done state, flags, unread only, text. Kept in Ordo, it is
 * not created on the mail server. A new one is created by its button; an existing one is saved field by field
 * (the whole folder each time).
 * @param {{ search?: MailSearch, initial?: MailSearchCriteria, onDone: (id?: string) => void }} props Search edited (none: new), criteria of a new one, and close (given the new id).
 * @returns {JSX.Element} Form.
 */
export function MailSearchForm({ search, initial, onDone }: { search?: MailSearch; initial?: MailSearchCriteria; onDone: (id?: string) => void }) {
  const { data: accounts } = useMailAccounts();
  const { data: labels } = useMailLabels();
  const { data: searches } = useMailSearches();
  const { create, update } = useMailSearchMutations();
  const current = search && (searches?.find((item) => item.id === search.id) ?? search);
  const criteria: MailSearchCriteria = { ...EMPTY_MAIL_SEARCH, ...(search ? (search.criteria as Partial<MailSearchCriteria>) : (initial ?? { state: 'todo' })) };
  const base = useAppForm<SearchValues>({
    initialValues: search ? searchValues(search) : { ...criteria, label: initial ? 'Recherche' : 'À traiter' },
    schema: mailSearchSchema,
  });
  const { form, saving } = useFieldSave(base, {
    save: search ? (_changes, input) => update.mutateAsync({ id: search.id, input: input as MailSearchInput }) : null,
    schema: mailSearchSchema,
    saved: current && searchValues(current),
    onBlur: ['label', 'text', 'from', 'to', 'subject', 'body'],
  });
  const values = form.values;
  const received = dateRangeProps(formRange(form, 'since', 'until'));

  return (
    <form
      noValidate
      // A new folder only: an existing one is saved field by field (Enter saves the text typed).
      onSubmit={form.onSubmit((input) =>
        create.mutate(
          input as MailSearchInput,
          formCallbacks(form, 'Dossier de recherche créé.', (id: string) => onDone(id)),
        ),
      )}
    >
      <Stack gap="md">
        {search && <SaveStatus saving={saving} />}
        <Text size="sm" c="dimmed">
          Un dossier de recherche rassemble les mails qui répondent à ses critères, dans une ou plusieurs boîtes. Il n’existe que dans Ordo : rien n’est créé sur le serveur.
        </Text>
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
        <BatchMultiSelect
          label="Boîtes"
          placeholder={values.accountIds.length ? undefined : 'Toutes les boîtes'}
          data={unarchived(accounts ?? [], values.accountIds).map((account) => ({ value: account.id, label: accountLabel(account) }))}
          clearable
          {...form.getInputProps('accountIds')}
        />
        <LabeledField label="Dossiers">
          <SegmentedControl
            data={[
              { value: 'inbox', label: 'Réception' },
              { value: 'all', label: 'Tous (hors corbeille, spam, brouillons, envoyés)' },
              ...(criteria.scope === 'folder' && criteria.folder ? [{ value: 'folder', label: `Dossier ${criteria.folder}` }] : []),
            ]}
            value={values.scope}
            onChange={(scope) => form.setValues({ scope: scope as MailSearchCriteria['scope'], folder: scope === 'folder' ? criteria.folder : null })}
          />
        </LabeledField>
        <LabeledField label="Mails">
          <SegmentedControl
            data={[
              { value: 'todo', label: 'À traiter' },
              { value: 'done', label: 'Traités' },
              { value: 'all', label: 'Tous' },
            ]}
            value={values.state}
            onChange={(state) => form.setFieldValue('state', state as MailSearchCriteria['state'])}
          />
        </LabeledField>
        <BatchMultiSelect
          label="Drapeaux"
          description="Les mails ayant l’un de ces drapeaux."
          placeholder={values.labelIds.length ? undefined : 'Peu importe'}
          {...listSelectProps(labels ?? [], undefined, values.labelIds)}
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
          <DatePickerInput label="Reçu à partir du" clearable placeholder="—" {...received.start} />
          <DatePickerInput label="Jusqu’au" clearable placeholder="—" {...received.end} />
        </SimpleGrid>
        <Switch label="Avec pièce jointe" {...form.getInputProps('attachments', { type: 'checkbox' })} />
        {!search && <FormActions onCancel={() => onDone()} submitLabel="Créer" loading={create.isPending} />}
      </Stack>
    </form>
  );
}
