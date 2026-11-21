import { Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { IdentificationCardIcon } from '@phosphor-icons/react';
import { birthDateText, contactName, readBirthDate, readEmails, readPhones, type ContributorLinkKind, type ContributorLinkValues } from '@ordo/shared';
import { useState } from 'react';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { ContactLines } from '../../../components/people/ContactLines';
import { relationWords } from '../../../components/people/people-options';
import { unarchived } from '../../../lib/archive';
import { ActionButton } from '../../../components/actions/ActionButton';
import { useClientContacts } from '../../accounting/api';
import { openContactForm } from '../../accounting/lib/open-contact';
import { openMemberForm } from '../../treasury/lib/open-member';
import { openRelationForm } from '../../treasury/lib/open-relation';
import { useTreasurySettings } from '../../treasury/api';
import { useActiveWorkspace } from '../../workspaces/api';
import type { Contributor } from '../api';
import { useTaskContext } from '../hooks/use-task-context';

interface ContributorLinkFieldProps {
  /** Link as the form holds it. */
  value: ContributorLinkValues;
  /** A link chosen whole (a membership, nothing, or a relation or a contact picked). */
  onChange: (link: ContributorLinkValues) => void;
  /** Contributor edited (its own details, as a member); none for a new one. Optional. */
  contributor?: Contributor;
  /** Errors of the form, by path (`link.relationId`, `link.contactId`). */
  errors: Record<string, unknown>;
}

/** Details shown read only: those of what the contributor is linked to. */
interface LinkedDetails {
  birthDate?: string | null;
  emails: unknown;
  phones: unknown;
}

/**
 * What the details of a contributor come from, one at most: « Membre » (its own, edited in the member's form of the
 * team or household), a relation (its), a contact of a client in a professional workspace (its email and phones, no
 * birthday), or « Aucun ». Membership and nothing are saved at once; a relation or a contact once picked (those of
 * another contributor and the archived ones are not offered, the current one stays). Below, the details that apply,
 * read only, with where they come from, and « Ouvrir la fiche » opening the card they are edited in (the member's,
 * the relation's, the contact's). « Moi » always is a member.
 * @param {ContributorLinkFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function ContributorLinkField({ value, onChange, contributor, errors }: ContributorLinkFieldProps) {
  const { perso } = useActiveWorkspace();
  const words = relationWords(perso);
  const { context } = useTaskContext();
  const { data: settings } = useTreasurySettings();
  const { data: contacts } = useClientContacts(!perso);
  // A relation or a contact being picked: shown before it is saved.
  const [picking, setPicking] = useState<ContributorLinkKind | null>(null);
  const kind = picking ?? value.kind;
  const self = contributor?.id;
  // Those of another contributor are not offered.
  const takenContacts = new Set((context?.contributors ?? []).filter((item) => item.id !== self && item.contactId).map((item) => item.contactId));
  const relations = unarchived(settings?.treasuryRelations ?? [], value.relationId).filter((relation) => !relation.contributorId || relation.contributorId === self);
  const offeredContacts = unarchived(contacts ?? [], value.contactId).filter((contact) => !takenContacts.has(contact.id) && (!contact.client.archived || contact.id === value.contactId));
  const contactGroups = [...new Set(offeredContacts.map((contact) => contact.client.name))].map((group) => ({
    group,
    items: offeredContacts.filter((contact) => contact.client.name === group).map((contact) => ({ value: contact.id, label: contactName(contact) })),
  }));
  const kinds = [
    { value: 'MEMBER', label: 'Membre' },
    { value: 'RELATION', label: words.noun },
    ...(perso ? [] : [{ value: 'CONTACT', label: 'Contact' }]),
    { value: 'NONE', label: 'Aucun' },
  ];

  /**
   * Chooses a kind: a membership or nothing is the link; a relation or a contact waits for its pick.
   * @param {ContributorLinkKind} next Kind chosen.
   * @returns {void}
   */
  const choose = (next: ContributorLinkKind) => {
    if (next === 'RELATION' || next === 'CONTACT') {
      setPicking(next === value.kind ? null : next);
      return;
    }
    setPicking(null);
    onChange({ kind: next, relationId: null, contactId: null });
  };

  const relation = settings?.treasuryRelations.find((item) => item.id === value.relationId);
  const contact = contacts?.find((item) => item.id === value.contactId);
  const team = perso ? 'Foyer' : 'Équipe';
  /** Where the details come from, and the details (none while a relation or a contact is being picked). */
  const source: { text: string; details: LinkedDetails | null } =
    kind !== value.kind
      ? { text: kind === 'RELATION' ? `Choisissez ${words.the}.` : 'Choisissez le contact.', details: null }
      : kind === 'MEMBER'
        ? { text: `Celles du membre, modifiables dans « ${team} » des paramètres.`, details: contributor ?? null }
        : kind === 'RELATION'
          ? { text: `Celles de ${words.the} « ${relation?.name ?? contributor?.linkName ?? ''} », modifiables dans sa fiche.`, details: relation ?? null }
          : kind === 'CONTACT'
            ? {
                text: `Celles du contact « ${contact ? `${contactName(contact)} · ${contact.client.name}` : (contributor?.linkName ?? '')} », modifiables dans sa fiche client (un contact n’a pas d’anniversaire).`,
                details: contact ? { birthDate: null, emails: contact.email ? [{ label: '', address: contact.email }] : [], phones: contact.phones } : null,
              }
            : { text: 'Aucune coordonnée ni anniversaire.', details: null };
  const birth = readBirthDate(source.details?.birthDate);
  /** Opens the card the details are edited in: the member's, the relation's, the contact's in its client; none for a new member or nothing. */
  const openSource =
    kind !== value.kind
      ? null
      : kind === 'MEMBER' && contributor
        ? () => openMemberForm(contributor)
        : kind === 'RELATION' && relation
          ? () => openRelationForm(relation, perso)
          : kind === 'CONTACT' && contact
            ? () => openContactForm(contact.client.id, contact.id, Boolean(contact.archived || contact.client.archived))
            : null;

  return (
    <LabeledField label="Coordonnées et anniversaire" description="Un contributeur n’en a pas de propres : ce sont ceux de ce à quoi il est lié." gap="xs" error={errors.link as string | undefined}>
      <SegmentedControl fullWidth size="xs" data={kinds} value={kind} onChange={(next) => choose(next as ContributorLinkKind)} disabled={contributor?.isMe} aria-label="Lié à" />
      {kind === 'RELATION' && (
        <Select
          aria-label={words.noun}
          placeholder={relations.length ? `Choisir ${words.the}…` : words.none}
          searchable
          data={relations.map((item) => ({ value: item.id, label: item.name }))}
          value={value.kind === 'RELATION' ? value.relationId : null}
          onChange={(relationId) => {
            if (!relationId) return;
            setPicking(null);
            onChange({ kind: 'RELATION', relationId, contactId: null });
          }}
          error={errors['link.relationId'] as string | undefined}
        />
      )}
      {kind === 'CONTACT' && (
        <Select
          aria-label="Contact"
          placeholder={offeredContacts.length ? 'Choisir le contact…' : 'Aucun contact libre'}
          searchable
          data={contactGroups}
          value={value.kind === 'CONTACT' ? value.contactId : null}
          onChange={(contactId) => {
            if (!contactId) return;
            setPicking(null);
            onChange({ kind: 'CONTACT', relationId: null, contactId });
          }}
          error={errors['link.contactId'] as string | undefined}
        />
      )}
      <Stack gap={2}>
        <Text size="xs" c="dimmed">
          {source.text}
        </Text>
        {birth && <Text size="sm">Date de naissance : {birthDateText(birth)}</Text>}
        {source.details && <ContactLines emails={readEmails(source.details.emails)} phones={readPhones(source.details.phones)} />}
        {openSource && (
          <Group>
            <ActionButton priority="tertiary" icon={<IdentificationCardIcon aria-hidden />} onClick={openSource}>
              Ouvrir la fiche
            </ActionButton>
          </Group>
        )}
      </Stack>
    </LabeledField>
  );
}
