import { Button, Group, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { clientContactSchema, clientDetailsSchema, clientServiceSchema, type Address, type Phone } from '@ordo/shared';
import { AddressFields } from '../../components/address/AddressFields';
import { PhonesField } from '../../components/address/PhonesField';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useClientPartyMutations, type ClientBilling, type ClientContact, type ClientService } from './api';

/**
 * Errors of the address fields, from the form errors ("address.city" → "city").
 * @param {Record<string, unknown>} errors Form errors.
 * @returns {Record<string, string>} Address errors.
 */
function addressErrors(errors: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([key]) => key.startsWith('address.'))
      .map(([key, message]) => [key.slice('address.'.length), String(message)]),
  );
}

/**
 * Form buttons.
 * @param {{ onCancel: () => void, loading: boolean, label?: string }} props Component props.
 * @returns {JSX.Element} Buttons.
 */
function FormActions({ onCancel, loading, label = 'Enregistrer' }: { onCancel: () => void; loading: boolean; label?: string }) {
  return (
    <Group justify="flex-end" gap="sm">
      <Button variant="default" onClick={onCancel}>
        Annuler
      </Button>
      <Button type="submit" loading={loading}>
        {label}
      </Button>
    </Group>
  );
}

interface DetailsValues extends Record<string, unknown> {
  kind: 'COMPANY' | 'INDIVIDUAL';
  firstName: string;
  lastName: string;
  address: Address | null;
  email: string;
  phones: Phone[];
  website: string;
  vatNumber: string;
  siren: string;
  siret: string;
  activityCode: string;
}

/**
 * Billing details of a client: professional (identifiers, website) or individual (first and last name),
 * address, email and phones.
 * @param {{ client: ClientBilling, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ClientDetailsForm({ client, onDone }: { client: ClientBilling; onDone: () => void }) {
  const { updateDetails } = useClientPartyMutations();
  const form = useAppForm<DetailsValues>({
    initialValues: {
      kind: client.kind,
      firstName: client.firstName ?? '',
      lastName: client.lastName ?? '',
      address: (client.address as Address | null) ?? null,
      email: client.email ?? '',
      phones: (client.phones as Phone[]) ?? [],
      website: client.website ?? '',
      vatNumber: client.vatNumber ?? '',
      siren: client.siren ?? '',
      siret: client.siret ?? '',
      activityCode: client.activityCode ?? '',
    },
    schema: clientDetailsSchema,
  });
  const company = form.values.kind === 'COMPANY';

  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        updateDetails.mutate(
          { id: client.id, input: values },
          {
            onSuccess: () => {
              notifySuccess('Coordonnées enregistrées.');
              onDone();
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="md">
        <SegmentedControl
          data={[
            { value: 'COMPANY', label: 'Professionnel' },
            { value: 'INDIVIDUAL', label: 'Particulier' },
          ]}
          value={form.values.kind}
          onChange={(kind) => form.setFieldValue('kind', kind as DetailsValues['kind'])}
          aria-label="Type de client"
        />
        {!company && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="Prénom" {...form.getInputProps('firstName')} />
            <TextInput label="Nom" {...form.getInputProps('lastName')} />
          </SimpleGrid>
        )}
        <AddressFields legend="Adresse de facturation" value={form.values.address} onChange={(address) => form.setFieldValue('address', address)} errors={addressErrors(form.errors)} />
        <SimpleGrid cols={{ base: 1, sm: company ? 2 : 1 }} spacing="sm">
          <TextInput label="Email" {...form.getInputProps('email')} />
          {company && <TextInput label="Site internet" placeholder="https://…" {...form.getInputProps('website')} />}
        </SimpleGrid>
        <PhonesField value={form.values.phones} onChange={(phones) => form.setFieldValue('phones', phones)} />
        {company && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="Numéro de TVA" placeholder="FR12345678901" {...form.getInputProps('vatNumber')} />
            <TextInput label="Code d’activité" description="NAF (France), NACE (UE), NOGA (Suisse)…" {...form.getInputProps('activityCode')} />
            <TextInput label="SIREN" {...form.getInputProps('siren')} />
            <TextInput label="SIRET" {...form.getInputProps('siret')} />
          </SimpleGrid>
        )}
        <FormActions onCancel={onDone} loading={updateDetails.isPending} />
      </Stack>
    </form>
  );
}

interface ServiceValues extends Record<string, unknown> {
  name: string;
  address: Address | null;
  email: string;
  phones: Phone[];
}

/**
 * Service (department, branch) of a client.
 * @param {{ clientId: string, service?: ClientService, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ClientServiceForm({ clientId, service, onDone }: { clientId: string; service?: ClientService; onDone: () => void }) {
  const { createService, updateService } = useClientPartyMutations();
  const form = useAppForm<ServiceValues>({
    initialValues: {
      name: service?.name ?? '',
      address: (service?.address as Address | null) ?? null,
      email: service?.email ?? '',
      phones: (service?.phones as Phone[]) ?? [],
    },
    schema: clientServiceSchema,
  });
  const callbacks = {
    onSuccess: () => {
      notifySuccess(service ? 'Service modifié.' : 'Service ajouté.');
      onDone();
    },
    onError: (error: Error) => showFormError(form, error),
  };
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) => (service ? updateService.mutate({ id: service.id, input }, callbacks) : createService.mutate({ clientId, input }, callbacks)))}
    >
      <Stack gap="md">
        <TextInput label="Nom du service" required data-autofocus placeholder="Comptabilité, agence de Lyon…" {...form.getInputProps('name')} />
        <AddressFields legend="Adresse" value={form.values.address} onChange={(address) => form.setFieldValue('address', address)} errors={addressErrors(form.errors)} />
        <TextInput label="Email" {...form.getInputProps('email')} />
        <PhonesField value={form.values.phones} onChange={(phones) => form.setFieldValue('phones', phones)} />
        <FormActions onCancel={onDone} loading={createService.isPending || updateService.isPending} label={service ? 'Enregistrer' : 'Ajouter'} />
      </Stack>
    </form>
  );
}

interface ContactValues extends Record<string, unknown> {
  serviceId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  phones: Phone[];
}

/**
 * Contact person at a client, possibly in one of its services.
 * @param {{ client: ClientBilling, contact?: ClientContact, serviceId?: string | null, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ClientContactForm({
  client,
  contact,
  serviceId,
  onDone,
}: {
  client: ClientBilling;
  contact?: ClientContact;
  serviceId?: string | null;
  onDone: () => void;
}) {
  const { createContact, updateContact } = useClientPartyMutations();
  const form = useAppForm<ContactValues>({
    initialValues: {
      serviceId: contact ? (contact.serviceId ?? null) : (serviceId ?? null),
      firstName: contact?.firstName ?? '',
      lastName: contact?.lastName ?? '',
      email: contact?.email ?? '',
      jobTitle: contact?.jobTitle ?? '',
      phones: (contact?.phones as Phone[]) ?? [],
    },
    schema: clientContactSchema,
  });
  const callbacks = {
    onSuccess: () => {
      notifySuccess(contact ? 'Contact modifié.' : 'Contact ajouté.');
      onDone();
    },
    onError: (error: Error) => showFormError(form, error),
  };
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        contact ? updateContact.mutate({ id: contact.id, input }, callbacks) : createContact.mutate({ clientId: client.id, input }, callbacks),
      )}
    >
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput label="Prénom" required data-autofocus {...form.getInputProps('firstName')} />
          <TextInput label="Nom" required {...form.getInputProps('lastName')} />
          <TextInput label="Fonction" {...form.getInputProps('jobTitle')} />
          <Select
            label="Service"
            placeholder={client.services.length ? 'Aucun (client)' : 'Aucun service'}
            data={client.services.map((service) => ({ value: service.id, label: service.name }))}
            clearable
            disabled={client.services.length === 0}
            {...form.getInputProps('serviceId')}
          />
        </SimpleGrid>
        <TextInput label="Email" {...form.getInputProps('email')} />
        <PhonesField value={form.values.phones} onChange={(phones) => form.setFieldValue('phones', phones)} />
        {client.kind === 'INDIVIDUAL' && (
          <Text size="xs" c="dimmed">
            Client particulier : les contacts servent surtout aux proches ou aux intermédiaires.
          </Text>
        )}
        <FormActions onCancel={onDone} loading={createContact.isPending || updateContact.isPending} label={contact ? 'Enregistrer' : 'Ajouter'} />
      </Stack>
    </form>
  );
}
