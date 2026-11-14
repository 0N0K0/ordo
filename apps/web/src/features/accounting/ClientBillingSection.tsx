import { ListSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../components/panels/panels';
import { ActionIcon, Anchor, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import { addressLines, hasAddress, type Address, type Phone } from '@ordo/shared';
import { PencilSimpleIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@phosphor-icons/react';
import { countryName } from '../../components/address/countries';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useClientBilling, useClientPartyMutations, type ClientBilling, type ClientContact, type ClientService } from './api';
import { ClientContactForm, ClientDetailsForm, ClientServiceForm } from './ClientPartyForms';


/**
 * Address, email and phones, as text lines.
 * @param {{ address: unknown, email?: string | null, phones: unknown, website?: string | null }} props Contact information.
 * @returns {JSX.Element} Lines.
 */
function ContactInfo({ address, email, phones, website }: { address: unknown; email?: string | null; phones: unknown; website?: string | null }) {
  const postal = address as Address | null;
  const numbers = (phones as Phone[]) ?? [];
  return (
    <Stack gap={2}>
      {hasAddress(postal) && addressLines(postal!, countryName).map((line) => <Text key={line} size="sm">{line}</Text>)}
      {email && (
        <Anchor href={`mailto:${email}`} size="sm">
          {email}
        </Anchor>
      )}
      {numbers.map((phone) => (
        <Text key={`${phone.label}${phone.number}`} size="sm">
          {phone.label ? `${phone.label} : ` : ''}
          {phone.number}
        </Text>
      ))}
      {/* Validated as http(s) by the API; checked again before becoming a link. */}
      {website &&
        (/^https?:\/\//i.test(website) ? (
          <Anchor href={website} target="_blank" rel="noopener noreferrer" size="sm">
            {website}
          </Anchor>
        ) : (
          <Text size="sm">{website}</Text>
        ))}
    </Stack>
  );
}

/**
 * One contact person.
 * @param {{ client: ClientBilling, contact: ClientContact }} props Component props.
 * @returns {JSX.Element} Contact.
 */
function ContactRow({ client, contact }: { client: ClientBilling; contact: ClientContact }) {
  const { deleteContact } = useClientPartyMutations();
  const name = `${contact.firstName} ${contact.lastName}`;
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={0}>
        <Text size="sm" fw={600}>
          {name}
          {contact.jobTitle && (
            <Text span size="sm" c="dimmed" fw={400}>
              {' '}
              — {contact.jobTitle}
            </Text>
          )}
        </Text>
        <ContactInfo address={null} email={contact.email} phones={contact.phones} />
      </Stack>
      <Group gap={2} wrap="nowrap">
        <Tooltip label="Modifier">
          <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${name}`} onClick={() => openFormPanel('Modifier le contact', (close) => <ClientContactForm client={client} contact={contact} onDone={close} />)}>
            <PencilSimpleIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Supprimer">
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={`Supprimer ${name}`}
            onClick={() =>
              confirmDestructive({ title: 'Supprimer le contact', risks: `${name} sera supprimé définitivement. Cette action est irréversible.`, onConfirm: () =>
                deleteContact.mutate(contact.id, { onSuccess: () => notifySuccess('Contact supprimé.'), onError: (error) => notifyError(error.message) }) })
            }
          >
            <TrashIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

/**
 * One service with its contacts.
 * @param {{ client: ClientBilling, service: ClientService }} props Component props.
 * @returns {JSX.Element} Service.
 */
function ServiceCard({ client, service }: { client: ClientBilling; service: ClientService }) {
  const { deleteService } = useClientPartyMutations();
  const contacts = client.contacts.filter((contact) => contact.serviceId === service.id);
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4}>
            <Text fw={600}>{service.name}</Text>
            <ContactInfo address={service.address} email={service.email} phones={service.phones} />
          </Stack>
          <Group gap={2} wrap="nowrap">
            <Tooltip label="Ajouter un contact">
              <ActionIcon variant="subtle" color="gray" aria-label={`Ajouter un contact à ${service.name}`} onClick={() => openFormPanel('Nouveau contact', (close) => <ClientContactForm client={client} serviceId={service.id} onDone={close} />)}>
                <UserPlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Modifier">
              <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${service.name}`} onClick={() => openFormPanel('Modifier le service', (close) => <ClientServiceForm clientId={client.id} service={service} onDone={close} />)}>
                <PencilSimpleIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Supprimer">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label={`Supprimer ${service.name}`}
                onClick={() =>
                  confirmDestructive({ title: 'Supprimer le service', risks: `Le service « ${service.name} » sera supprimé définitivement ; ses contacts restent rattachés au client. Cette action est irréversible.`, onConfirm: () => deleteService.mutate(service.id, { onSuccess: () => notifySuccess('Service supprimé.'), onError: (error) => notifyError(error.message) }) })
                }
              >
                <TrashIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        {contacts.map((contact) => (
          <ContactRow key={contact.id} client={client} contact={contact} />
        ))}
      </Stack>
    </Paper>
  );
}

/**
 * Billing section of a client page: details (professional or individual, address, identifiers), services
 * and contacts.
 * @param {{ clientId: string }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function ClientBillingSection({ clientId }: { clientId: string }) {
  const { data: client, isPending } = useClientBilling(clientId);
  if (isPending) return <ListSkeleton items={3} lines={2} />;
  if (!client) return null;
  const company = client.kind === 'COMPANY';
  const identifiers = [
    client.siren && `SIREN ${client.siren}`,
    client.siret && `SIRET ${client.siret}`,
    client.vatNumber && `TVA ${client.vatNumber}`,
    client.activityCode && `Activité ${client.activityCode}`,
  ].filter(Boolean);
  const looseContacts = client.contacts.filter((contact) => !contact.serviceId);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={2} size="h4">
          Facturation
        </Title>
        <Group gap="xs">
          <Button size="xs" variant="light" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openFormPanel('Coordonnées de facturation', (close) => <ClientDetailsForm client={client} onDone={close} />)}>
            Coordonnées
          </Button>
          <Button size="xs" variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openFormPanel('Nouveau service', (close) => <ClientServiceForm clientId={client.id} onDone={close} />)}>
            Service
          </Button>
          <Button size="xs" variant="light" leftSection={<UserPlusIcon aria-hidden />} onClick={() => openFormPanel('Nouveau contact', (close) => <ClientContactForm client={client} onDone={close} />)}>
            Contact
          </Button>
        </Group>
      </Group>
      {/* By the width of what holds it (the settings sidebar). */}
      <SimpleGrid type="container" cols={{ base: 1, '640px': 2 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Stack gap="xs">
            <Group gap="xs">
              <Text fw={600}>{company ? client.name : [client.firstName, client.lastName].filter(Boolean).join(' ') || client.name}</Text>
              <Badge size="sm" variant="light" color="gray">
                {company ? 'Professionnel' : 'Particulier'}
              </Badge>
            </Group>
            <ContactInfo address={client.address} email={client.email} phones={client.phones} website={company ? client.website : null} />
            {identifiers.length > 0 && (
              <Text size="xs" c="dimmed">
                {identifiers.join(' · ')}
              </Text>
            )}
            {!hasAddress(client.address as Address | null) && (
              <Text size="xs" c="dimmed">
                Adresse de facturation à renseigner avant d’éditer des factures.
              </Text>
            )}
          </Stack>
        </Paper>
        {looseContacts.length > 0 && (
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Text fw={600}>Contacts</Text>
              {looseContacts.map((contact) => (
                <ContactRow key={contact.id} client={client} contact={contact} />
              ))}
            </Stack>
          </Paper>
        )}
        {client.services.map((service) => (
          <ServiceCard key={service.id} client={client} service={service} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
