import { contactName, contributorLinkSchema, readEmails, readPhones, readReminders, type ContributorLinkInput, type ContributorLinkKind, type LabelledEmail, type Phone, type Reminder } from '@ordo/shared';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound, parseField } from '../../graphql/errors';
import { assertNotArchived, type ArchivableKind, type ArchiveTargets } from '../core/archive';
import { isMember } from './members';
import { NO_PEOPLE_SETTLER, peopleChanges, personChange, type PeopleChange, type PeopleChangeSettler } from '../calendar/birthdays';

/** Details of a person as they are read from its row. */
const DETAILS_SELECT = { birthDate: true, birthdayReminders: true, emails: true, phones: true } as const;

/** What a contributor's link and its details are read from: its membership, its relation, its contact. */
export const CONTRIBUTOR_LINK_SELECT = {
  id: true,
  teamMember: true,
  userId: true,
  contactId: true,
  ...DETAILS_SELECT,
  treasuryRelations: { select: { id: true, name: true, ...DETAILS_SELECT } },
  contact: { select: { firstName: true, lastName: true, email: true, phones: true, client: { select: { name: true } } } },
} satisfies Prisma.ContributorSelect;

/** A contributor with what its link and its details are read from. */
export type LinkedContributor = Prisma.ContributorGetPayload<{ select: typeof CONTRIBUTOR_LINK_SELECT }>;

/** Details of a contributor, those of what it is linked to. */
export interface ContributorDetails {
  link: ContributorLinkKind;
  relationId: string | null;
  contactId: string | null;
  /** Name of the relation, or of the contact with its client (« Prénom Nom · Client »); none for a member or nothing. */
  linkName: string | null;
  birthDate: string | null;
  birthdayReminders: Reminder[];
  emails: LabelledEmail[];
  phones: Phone[];
}

/**
 * Link of a contributor and the details that apply to it: a member's own (stored on its row), its relation's, its
 * contact's (its single email, its phones, no birthday), or none. Its own details stay stored, unused, while it is
 * not a member.
 * @param {LinkedContributor} contributor Contributor (`CONTRIBUTOR_LINK_SELECT`).
 * @returns {ContributorDetails} Link and details.
 */
export function contributorDetails(contributor: LinkedContributor): ContributorDetails {
  /**
   * Details read from a row.
   * @param {{ birthDate: string | null, birthdayReminders: unknown, emails: unknown, phones: unknown }} row Member or relation.
   * @returns {Pick<ContributorDetails, 'birthDate' | 'birthdayReminders' | 'emails' | 'phones'>} Details.
   */
  const of = (row: { birthDate: string | null; birthdayReminders: unknown; emails: unknown; phones: unknown }) => ({
    birthDate: row.birthDate,
    birthdayReminders: readReminders(row.birthdayReminders),
    emails: readEmails(row.emails),
    phones: readPhones(row.phones),
  });
  const none = { relationId: null, contactId: null, linkName: null };
  if (isMember(contributor)) return { link: 'MEMBER', ...none, ...of(contributor) };
  const relation = contributor.treasuryRelations[0];
  if (relation) return { link: 'RELATION', ...none, relationId: relation.id, linkName: relation.name, ...of(relation) };
  const { contact } = contributor;
  if (contact)
    return {
      link: 'CONTACT',
      ...none,
      contactId: contributor.contactId,
      linkName: `${contactName(contact)} · ${contact.client.name}`,
      birthDate: null,
      birthdayReminders: [],
      emails: contact.email ? [{ label: '', address: contact.email }] : [],
      phones: readPhones(contact.phones),
    };
  return { link: 'NONE', ...none, birthDate: null, birthdayReminders: [], emails: [], phones: [] };
}

/**
 * Refuses to make a contributor a member or a relation when it is already linked to something else (a contributor
 * is linked to a membership, a relation or a contact, one at most).
 * @param {string} contributorId Contributor.
 * @param {'MEMBER' | 'RELATION'} as What it would become.
 * @param {string | null} [relationId] Relation saved (its own link is no other one). Optional.
 * @returns {Promise<void>}
 */
export async function assertNoOtherLink(contributorId: string, as: 'MEMBER' | 'RELATION', relationId: string | null = null): Promise<void> {
  const contributor = contributorDetails(await orNotFound(prisma.contributor.findUnique({ where: { id: contributorId }, select: CONTRIBUTOR_LINK_SELECT }), 'Contributeur', as === 'RELATION' ? 'contributorId' : undefined));
  const what = as === 'MEMBER' ? 'membre' : 'une relation';
  /**
   * Error of the link refused: under the contributor of a relation, a toast for a member.
   * @param {string} message Message.
   * @returns {Error} Error.
   */
  const refused = (message: string) => (as === 'RELATION' ? fieldError('contributorId', message) : clientError('BAD_USER_INPUT', message));
  if (as === 'RELATION' && contributor.link === 'MEMBER') throw refused('Ce contributeur est membre : il n’est pas une relation.');
  if (as === 'MEMBER' && contributor.link === 'RELATION') throw refused(`Ce contributeur est la relation « ${contributor.linkName} » : il ne peut pas aussi être membre.`);
  if (as === 'RELATION' && contributor.link === 'RELATION' && contributor.relationId !== relationId) throw refused('Ce contributeur est déjà une relation.');
  if (contributor.link === 'CONTACT') throw refused(`Ce contributeur est le contact « ${contributor.linkName} » : il ne peut pas aussi être ${what}.`);
}

/**
 * Links a contributor to one of a membership of the team or household, a relation, a contact or nothing: the link
 * replaces the one it had (a relation it was loses it). "Moi" always is a member. A relation or a contact is one
 * contributor at most; an archived relation, an archived contact or a contact of an archived client, is not newly
 * chosen. Checked first,
 * then settled (the birthday that applies to it moves), then returned as the work that saves it.
 * @param {{ id: string, userId: string | null } | null} contributor Contributor, or none for a new one.
 * @param {ContributorLinkInput} input Link.
 * @param {PeopleChangeSettler} [settle] Run once checked, before it is saved, when the birthdays change. Optional. Default = none.
 * @returns {Promise<(contributorId: string) => Promise<void>>} Save of the link, for this contributor (a new one once created).
 */
export async function contributorLink(
  contributor: { id: string; userId: string | null } | null,
  input: ContributorLinkInput,
  settle: PeopleChangeSettler = NO_PEOPLE_SETTLER,
): Promise<(contributorId: string) => Promise<void>> {
  const link = parseField('link', contributorLinkSchema, input);
  if (contributor?.userId && link.kind !== 'MEMBER') throw fieldError('link', 'Vous êtes toujours membre de votre équipe ou de votre foyer.');
  const current = contributor ? contributorDetails(await prisma.contributor.findUniqueOrThrow({ where: { id: contributor.id }, select: CONTRIBUTOR_LINK_SELECT })) : null;
  const relationId = link.kind === 'RELATION' ? link.relationId! : null;
  const contactId = link.kind === 'CONTACT' ? link.contactId! : null;
  if (relationId) {
    const relation = await orNotFound(prisma.treasuryRelation.findUnique({ where: { id: relationId }, select: { contributorId: true } }), 'Relation', 'link.relationId');
    if (relation.contributorId && relation.contributorId !== contributor?.id) throw fieldError('link.relationId', 'Cette relation est déjà liée à un autre contributeur.');
    await assertNotArchived('treasuryRelation', relationId, { keep: current?.relationId, field: 'link.relationId' });
  }
  if (contactId) {
    const contact = await orNotFound(prisma.clientContact.findUnique({ where: { id: contactId }, select: { clientId: true, contributor: { select: { id: true } } } }), 'Contact', 'link.contactId');
    if (contact.contributor && contact.contributor.id !== contributor?.id) throw fieldError('link.contactId', 'Ce contact est déjà lié à un autre contributeur.');
    if (current?.contactId !== contactId) {
      await assertNotArchived('client', contact.clientId, { field: 'link.contactId' });
      await assertNotArchived('clientContact', contactId, { field: 'link.contactId' });
    }
  }
  const member = link.kind === 'MEMBER';
  if (contributor && current) {
    // The birthday that applies to it: its own as a member, its relation's.
    const changes: PeopleChange[] = [];
    if (member !== (current.link === 'MEMBER')) changes.push(personChange('contributor', contributor.id, { member }));
    if (current.relationId !== relationId) {
      if (current.relationId) changes.push(personChange('relation', current.relationId, { contributorId: null }));
      if (relationId) changes.push(personChange('relation', relationId, { contributorId: contributor.id }));
    }
    if (changes.length) await settle(peopleChanges(changes));
  }
  return async (contributorId) => {
    await prisma.$transaction([
      prisma.treasuryRelation.updateMany({ where: { contributorId, ...(relationId && { id: { not: relationId } }) }, data: { contributorId: null } }),
      ...(relationId ? [prisma.treasuryRelation.update({ where: { id: relationId }, data: { contributorId } })] : []),
      prisma.contributor.update({ where: { id: contributorId }, data: { teamMember: member, contactId } }),
    ]);
  };
}

/** Kinds of the people archived and restored with what they are linked to. */
export const LINKED_PEOPLE_KINDS: ReadonlySet<ArchivableKind> = new Set(['CONTRIBUTOR', 'TREASURY_RELATION', 'CLIENT_CONTACT']);

/**
 * People archived and restored with some others, being linked to them: the relation and the contact of a
 * contributor, the contributor of a relation or of a contact. A member is its own contributor (nothing else); a
 * client is not a person (never along).
 * @param {ArchivableKind} kind Kind of the people given (`LINKED_PEOPLE_KINDS`; any other: none).
 * @param {readonly string[]} ids People.
 * @returns {Promise<ArchiveTargets>} People along, by kind.
 */
export async function linkedPeople(kind: ArchivableKind, ids: readonly string[]): Promise<ArchiveTargets> {
  const list = [...ids];
  /**
   * Id of a row.
   * @param {{ id: string }} row Row.
   * @returns {string} Id.
   */
  const idOf = (row: { id: string }) => row.id;
  if (kind === 'CONTRIBUTOR') {
    const [relations, contacts] = await Promise.all([
      prisma.treasuryRelation.findMany({ where: { contributorId: { in: list } }, select: { id: true } }),
      prisma.clientContact.findMany({ where: { contributor: { is: { id: { in: list } } } }, select: { id: true } }),
    ]);
    return { TREASURY_RELATION: relations.map(idOf), CLIENT_CONTACT: contacts.map(idOf) };
  }
  if (kind === 'TREASURY_RELATION') return { CONTRIBUTOR: (await prisma.contributor.findMany({ where: { treasuryRelations: { some: { id: { in: list } } } }, select: { id: true } })).map(idOf) };
  if (kind === 'CLIENT_CONTACT') return { CONTRIBUTOR: (await prisma.contributor.findMany({ where: { contactId: { in: list } }, select: { id: true } })).map(idOf) };
  return {};
}

/**
 * Refuses an archiving or a restoring of people that would break a rule, from the elements whose state changes (those
 * along included): « Moi » is never archived (BAD_USER_INPUT « Vous ne pouvez pas vous archiver. »); a contact of an
 * archived client is not restored, nor through its contributor (BAD_USER_INPUT « Restaurez d’abord le client. »).
 * @param {ArchiveTargets} changing Elements whose state changes, by kind.
 * @param {boolean} archived Archives (else restores).
 * @returns {Promise<void>}
 */
export async function assertPeopleArchivable(changing: ArchiveTargets, archived: boolean): Promise<void> {
  const contributorIds = [...(changing.CONTRIBUTOR ?? [])];
  const contactIds = [...(changing.CLIENT_CONTACT ?? [])];
  if (archived && contributorIds.length && (await prisma.contributor.count({ where: { id: { in: contributorIds }, userId: { not: null } } })))
    throw clientError('BAD_USER_INPUT', 'Vous ne pouvez pas vous archiver.');
  if (!archived && contactIds.length && (await prisma.clientContact.count({ where: { id: { in: contactIds }, client: { archivedAt: { not: null } } } })))
    throw clientError('BAD_USER_INPUT', 'Restaurez d’abord le client.');
}
