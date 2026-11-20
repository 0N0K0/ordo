import { SectionHeader } from '../../../components/page/SectionHeader';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Anchor, Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { addressLines, contactName, hasAddress, type Address, type Phone } from '@ordo/shared';
import { EyeIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@phosphor-icons/react';
import { countryName } from '../lib/countries';

import { useClientBilling, useClientPartyMutations, type ClientBilling, type ClientContact, type ClientService } from '../api';
import { ClientContactForm, ClientDetailsForm, ClientServiceForm } from './ClientPartyForms';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { CLIENT_KIND_LABELS } from '../lib/labels';
import { useLiveSource, type LiveSource } from '../../../lib/live-value';

/** Props of a contact or a service: archived client, now and followed by the panels it opens. */
interface RowReadOnly {
  /** Archived client: read only. */
  readOnly: boolean;
  /** The same, followed by a panel opened before the client is archived elsewhere. */
  readOnlySource: LiveSource<boolean>;
}

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
      {hasAddress(postal) &&
        addressLines(postal!, countryName).map((line) => (
          <Text key={line} size="sm">
            {line}
          </Text>
        ))}
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
          <Anchor href={website} {...EXTERNAL_LINK} size="sm">
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
 * @param {{ client: ClientBilling, contact: ClientContact } & RowReadOnly} props Component props (`readOnly`: archived client).
 * @returns {JSX.Element} Contact.
 */
function ContactRow({ client, contact, readOnly, readOnlySource }: { client: ClientBilling; contact: ClientContact } & RowReadOnly) {
  const { deleteContact } = useClientPartyMutations();
  const name = contactName(contact);
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
      <InlineActions
        name={name}
        items={[
          {
            label: readOnly ? 'Voir' : 'Modifier',
            icon: readOnly ? <EyeIcon aria-hidden /> : <PencilSimpleIcon aria-hidden />,
            onClick: () => openFormPanel(readOnly ? 'Contact' : 'Modifier le contact', (close) => <ClientContactForm client={client} contact={contact} onDone={close} readOnly={readOnlySource} />),
          },
          !readOnly && {
            label: 'Supprimer',
            icon: <TrashIcon aria-hidden />,
            danger: true,
            onClick: () =>
              confirmDestructive({ title: 'Supprimer le contact', risks: `${name} sera supprimé définitivement.`, run: () => deleteContact.mutateAsync(contact.id), done: 'Contact supprimé.' }),
          },
        ]}
      />
    </Group>
  );
}

/**
 * One service with its contacts.
 * @param {{ client: ClientBilling, service: ClientService } & RowReadOnly} props Component props (`readOnly`: archived client).
 * @returns {JSX.Element} Service.
 */
function ServiceCard({ client, service, readOnly, readOnlySource }: { client: ClientBilling; service: ClientService } & RowReadOnly) {
  const { deleteService } = useClientPartyMutations();
  const contacts = client.contacts.filter((contact) => contact.serviceId === service.id);
  return (
    <SettingsSection
      title={service.label}
      actions={
        <InlineActions
          name={service.label}
          items={[
            !readOnly && {
              label: 'Ajouter un contact',
              icon: <UserPlusIcon aria-hidden />,
              onClick: () => openFormPanel('Nouveau contact', (close) => <ClientContactForm client={client} serviceId={service.id} onDone={close} />),
            },
            {
              label: readOnly ? 'Voir' : 'Modifier',
              icon: readOnly ? <EyeIcon aria-hidden /> : <PencilSimpleIcon aria-hidden />,
              onClick: () => openFormPanel(readOnly ? 'Service' : 'Modifier le service', (close) => <ClientServiceForm clientId={client.id} service={service} onDone={close} readOnly={readOnlySource} />),
            },
            !readOnly && {
              label: 'Supprimer',
              icon: <TrashIcon aria-hidden />,
              danger: true,
              onClick: () =>
                confirmDestructive({
                  title: 'Supprimer le service',
                  risks: `Le service « ${service.label} » sera supprimé définitivement ; ses contacts restent rattachés au client.`,
                  run: () => deleteService.mutateAsync(service.id),
                  done: 'Service supprimé.',
                }),
            },
          ]}
        />
      }
    >
      <ContactInfo address={service.address} email={service.email} phones={service.phones} />
      {contacts.map((contact) => (
        <ContactRow key={contact.id} client={client} contact={contact} readOnly={readOnly} readOnlySource={readOnlySource} />
      ))}
    </SettingsSection>
  );
}

/**
 * Billing section of a client page: details (professional or individual, address, identifiers), services
 * and contacts. Archived client: read only (the panels open read only, and an open one turns read only when the client
 * is archived elsewhere; nothing is added or removed).
 * @param {{ clientId: string, readOnly?: boolean }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function ClientBillingSection({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const { data: client, isPending } = useClientBilling(clientId);
  const readOnlySource = useLiveSource(readOnly);
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
      <SectionHeader
        title="Facturation"
        actions={
          <>
            <ActionButton
              priority="secondary"
              size="xs"
              icon={<PencilSimpleIcon aria-hidden />}
              onClick={() => openFormPanel('Coordonnées de facturation', () => <ClientDetailsForm client={client} readOnly={readOnlySource} />)}
            >
              Coordonnées
            </ActionButton>
            {!readOnly && (
              <>
                <ActionButton
                  priority="secondary"
                  size="xs"
                  icon={<PlusIcon aria-hidden />}
                  onClick={() => openFormPanel('Nouveau service', (close) => <ClientServiceForm clientId={client.id} onDone={close} />)}
                >
                  Nouveau service
                </ActionButton>
                <ActionButton
                  priority="secondary"
                  size="xs"
                  icon={<UserPlusIcon aria-hidden />}
                  onClick={() => openFormPanel('Nouveau contact', (close) => <ClientContactForm client={client} onDone={close} />)}
                >
                  Nouveau contact
                </ActionButton>
              </>
            )}
          </>
        }
      />
      {/* By the width of what holds it (the settings sidebar). */}
      <SimpleGrid type="container" cols={{ base: 1, '640px': 2 }} spacing="md">
        <SettingsSection
          title={
            <Group gap="xs">
              {company ? client.name : [client.firstName, client.lastName].filter(Boolean).join(' ') || client.name}
              <Badge size="sm" variant="light" color="gray">
                {CLIENT_KIND_LABELS[client.kind]}
              </Badge>
            </Group>
          }
        >
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
        </SettingsSection>
        {looseContacts.length > 0 && (
          <SettingsSection title="Contacts">
            {looseContacts.map((contact) => (
              <ContactRow key={contact.id} client={client} contact={contact} readOnly={readOnly} readOnlySource={readOnlySource} />
            ))}
          </SettingsSection>
        )}
        {client.services.map((service) => (
          <ServiceCard key={service.id} client={client} service={service} readOnly={readOnly} readOnlySource={readOnlySource} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
