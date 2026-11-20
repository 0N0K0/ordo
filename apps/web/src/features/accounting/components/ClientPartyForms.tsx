import { Fieldset, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { clientContactSchema, clientDetailsSchema, clientServiceSchema, type Address, type Phone } from '@ordo/shared';
import { AddressFields } from './AddressFields';
import { PhonesField } from './PhonesField';
import { useAppForm, useFieldSave, formCallbacks, nestedErrors } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { useClientBilling, useClientPartyMutations, type ClientBilling, type ClientContact, type ClientService } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { CLIENT_KIND_LABELS } from '../lib/labels';
import { useLiveValue, type LiveSource } from '../../../lib/live-value';

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
 * Values of the billing details of a client.
 * @param {ClientBilling} client Client, as the cache holds it.
 * @returns {DetailsValues} Values.
 */
const detailsValues = (client: ClientBilling): DetailsValues => ({
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
});

/** Fields of the details, a service or a contact saved on leaving them (decision D22): texts, the address, the phones. */
const DETAILS_ON_BLUR = ['firstName', 'lastName', 'address', 'email', 'phones', 'website', 'vatNumber', 'siren', 'siret', 'activityCode'] as const;

/** Props of the panels of a client's details, services and contacts. */
interface PartyPanelProps {
  /** Archived client: read only, followed while the panel is open (archived elsewhere). Optional. Default = not read only. */
  readOnly?: LiveSource<boolean>;
}

/**
 * Billing details of a client: professional (identifiers, website) or individual (first and last name),
 * address, email and phones. Each field is saved as soon as it changes (texts, the address and the phones on leaving
 * them, decision D22, `useFieldSave`), the client of the cache followed.
 * @param {{ client: ClientBilling } & PartyPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ClientDetailsForm({ client, readOnly: readOnlySource }: { client: ClientBilling } & PartyPanelProps) {
  const readOnly = useLiveValue(readOnlySource) ?? false;
  const { updateDetails } = useClientPartyMutations();
  const { data: cached } = useClientBilling(client.id);
  const base = useAppForm<DetailsValues>({ initialValues: detailsValues(client), schema: clientDetailsSchema });
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: (_changes, values) => updateDetails.mutateAsync({ id: client.id, input: values }),
    schema: clientDetailsSchema,
    saved: detailsValues(cached ?? client),
    onBlur: DETAILS_ON_BLUR,
    readOnly,
  });
  const company = form.values.kind === 'COMPANY';

  return (
    <form noValidate onSubmit={form.onSubmit(() => undefined)}>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {!readOnly && <SaveStatus saving={saving} />}
          <SegmentedControl
            data={Object.entries(CLIENT_KIND_LABELS).map(([value, label]) => ({ value, label }))}
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
          <AddressFields legend="Adresse de facturation" {...fieldProps('address')} errors={nestedErrors(form.errors, 'address')} />
          <SimpleGrid cols={{ base: 1, sm: company ? 2 : 1 }} spacing="sm">
            <TextInput label="Email" {...form.getInputProps('email')} />
            {company && <TextInput label="Site internet" placeholder="https://…" {...form.getInputProps('website')} />}
          </SimpleGrid>
          <PhonesField {...fieldProps('phones')} errors={nestedErrors(form.errors, 'phones')} />
          {company && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TextInput label="Numéro de TVA" placeholder="FR12345678901" {...form.getInputProps('vatNumber')} />
              <TextInput label="Code d’activité" description="NAF (France), NACE (UE), NOGA (Suisse)…" {...form.getInputProps('activityCode')} />
              <TextInput label="SIREN" {...form.getInputProps('siren')} />
              <TextInput label="SIRET" {...form.getInputProps('siret')} />
            </SimpleGrid>
          )}
        </Stack>
      </Fieldset>
    </form>
  );
}

interface ServiceValues extends Record<string, unknown> {
  label: string;
  address: Address | null;
  email: string;
  phones: Phone[];
}

/**
 * Values of a service of a client (a new one: empty).
 * @param {ClientService} [service] Service, as the cache holds it. Optional.
 * @returns {ServiceValues} Values.
 */
const serviceValues = (service?: ClientService): ServiceValues => ({
  label: service?.label ?? '',
  address: (service?.address as Address | null) ?? null,
  email: service?.email ?? '',
  phones: (service?.phones as Phone[]) ?? [],
});

/**
 * Service (department, branch) of a client. A new one is a form with « Ajouter »; an existing one, its panel, saves
 * each field on leaving it (decision D22, `useFieldSave`), the one of the cache followed.
 * @param {{ clientId: string, service?: ClientService, onDone: () => void } & PartyPanelProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ClientServiceForm({ clientId, service, onDone, readOnly: readOnlySource }: { clientId: string; service?: ClientService; onDone: () => void } & PartyPanelProps) {
  const readOnly = useLiveValue(readOnlySource) ?? false;
  const { createService, updateService } = useClientPartyMutations();
  const { data: client } = useClientBilling(clientId);
  const base = useAppForm<ServiceValues>({ initialValues: serviceValues(service), schema: clientServiceSchema });
  const current = service && (client?.services.find((item) => item.id === service.id) ?? service);
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: service ? (_changes, input) => updateService.mutateAsync({ id: service.id, input }) : null,
    schema: clientServiceSchema,
    saved: current && serviceValues(current),
    onBlur: ['label', 'address', 'email', 'phones'],
    readOnly,
  });
  return (
    // A new service only: an existing one is saved field by field (Enter saves the text typed).
    <form noValidate onSubmit={form.onSubmit((input) => createService.mutate({ clientId, input }, formCallbacks(form, 'Service ajouté.', onDone)))}>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {service && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Libellé du service" required data-autofocus={service ? undefined : true} placeholder="Comptabilité, agence de Lyon…" {...form.getInputProps('label')} />
          <AddressFields legend="Adresse" {...fieldProps('address')} errors={nestedErrors(form.errors, 'address')} />
          <TextInput label="Email" {...form.getInputProps('email')} />
          <PhonesField {...fieldProps('phones')} errors={nestedErrors(form.errors, 'phones')} />
          {!service && <FormActions onCancel={onDone} loading={createService.isPending} submitLabel="Ajouter" />}
        </Stack>
      </Fieldset>
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
 * Values of a contact of a client (a new one: empty, in the service given).
 * @param {ClientContact} [contact] Contact, as the cache holds it. Optional.
 * @param {string | null} [serviceId] Service of a new contact. Optional.
 * @returns {ContactValues} Values.
 */
const contactValues = (contact?: ClientContact, serviceId?: string | null): ContactValues => ({
  serviceId: contact ? (contact.serviceId ?? null) : (serviceId ?? null),
  firstName: contact?.firstName ?? '',
  lastName: contact?.lastName ?? '',
  email: contact?.email ?? '',
  jobTitle: contact?.jobTitle ?? '',
  phones: (contact?.phones as Phone[]) ?? [],
});

/**
 * Contact person at a client, possibly in one of its services. A new one is a form with « Ajouter »; an existing one,
 * its panel, saves each field as soon as it changes (texts and phones on leaving them, decision D22, `useFieldSave`),
 * the one of the cache followed.
 * @param {{ client: ClientBilling, contact?: ClientContact, serviceId?: string | null, onDone: () => void } & PartyPanelProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function ClientContactForm({
  client,
  contact,
  serviceId,
  onDone,
  readOnly: readOnlySource,
}: { client: ClientBilling; contact?: ClientContact; serviceId?: string | null; onDone: () => void } & PartyPanelProps) {
  const readOnly = useLiveValue(readOnlySource) ?? false;
  const { createContact, updateContact } = useClientPartyMutations();
  const { data: cached } = useClientBilling(client.id);
  const base = useAppForm<ContactValues>({ initialValues: contactValues(contact, serviceId), schema: clientContactSchema });
  const current = contact && (cached?.contacts.find((item) => item.id === contact.id) ?? contact);
  const services = (cached ?? client).services;
  const { form, saving, fieldProps } = useFieldSave(base, {
    save: contact ? (_changes, input) => updateContact.mutateAsync({ id: contact.id, input }) : null,
    schema: clientContactSchema,
    saved: current && contactValues(current),
    onBlur: ['firstName', 'lastName', 'email', 'jobTitle', 'phones'],
    readOnly,
  });
  return (
    // A new contact only: an existing one is saved field by field (Enter saves the text typed).
    <form noValidate onSubmit={form.onSubmit((input) => createContact.mutate({ clientId: client.id, input }, formCallbacks(form, 'Contact ajouté.', onDone)))}>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {contact && !readOnly && <SaveStatus saving={saving} />}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="Prénom" required data-autofocus={contact ? undefined : true} {...form.getInputProps('firstName')} />
            <TextInput label="Nom" required {...form.getInputProps('lastName')} />
            <TextInput label="Fonction" {...form.getInputProps('jobTitle')} />
            <Select
              label="Service"
              placeholder={services.length ? 'Aucun (client)' : 'Aucun service'}
              data={services.map((service) => ({ value: service.id, label: service.label }))}
              clearable
              disabled={services.length === 0}
              {...form.getInputProps('serviceId')}
            />
          </SimpleGrid>
          <TextInput label="Email" {...form.getInputProps('email')} />
          <PhonesField {...fieldProps('phones')} errors={nestedErrors(form.errors, 'phones')} />
          {client.kind === 'INDIVIDUAL' && (
            <Text size="xs" c="dimmed">
              Client particulier : les contacts servent surtout aux proches ou aux intermédiaires.
            </Text>
          )}
          {!contact && <FormActions onCancel={onDone} loading={createContact.isPending} submitLabel="Ajouter" />}
        </Stack>
      </Fieldset>
    </form>
  );
}
