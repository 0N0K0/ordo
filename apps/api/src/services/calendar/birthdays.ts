import { personBirthdayId, readBirthDate, readReminders, type BirthdayPerson, type Reminder } from '@ordo/shared';
import { prisma } from '../../db';
import { isMember } from '../people/members';

/**
 * Birthday of a person: derived from its birth date at read time, no row of its own. Slot
 * conditions name it by `birthdaySlotId(id)`, or by one of its `aliases`.
 */
export interface PersonBirthday {
  /** `contributor:<id>` or `relation:<id>` (`personBirthdayId`). */
  id: string;
  contributorId: string | null;
  relationId: string | null;
  name: string;
  /** YYYY-MM-DD, or --MM-DD without year. */
  birthDate: string;
  reminders: Reminder[];
  /** Its person is archived: shown nowhere, no moment to the slot conditions. */
  archived: boolean;
  /** Other birthday ids of the same person: the contributor linked to the relation. */
  aliases: string[];
}

/** A contributor or a relation as its birthday is derived from. */
export interface BirthdayRow {
  id: string;
  name: string;
  birthDate: string | null;
  birthdayReminders: unknown;
  archived: boolean;
  /** A relation: the contributor it is. Optional. */
  contributorId?: string | null;
  /** A contributor: member of the team or household (« Moi » included), the only ones with a birthday of their own. Optional. */
  member?: boolean;
}

/** The contributors and relations of the workspace, as their birthdays are derived from. */
export interface BirthdayRows {
  contributors: BirthdayRow[];
  relations: BirthdayRow[];
}

/** People of the workspace as a change would leave them (a birth date changed, a person archived, linked, deleted…). */
export type PeopleChange = (people: BirthdayRows) => BirthdayRows;

/**
 * Before a change of the people is saved, once checked: what it does to the routines whose conditions name birthdays
 * (`settleScheduleChange`).
 */
export type PeopleChangeSettler = (change: PeopleChange) => Promise<void>;

/** No settling (internal changes). */
export const NO_PEOPLE_SETTLER: PeopleChangeSettler = async () => {};

/**
 * Change of one person: its fields changed (a new one added), or removed (null).
 * @param {BirthdayPerson} person Contributor or relation.
 * @param {string} id Its id (any id for a new one).
 * @param {Partial<BirthdayRow> | null} patch Fields changed; null: deleted.
 * @returns {PeopleChange} Change.
 */
export function personChange(person: BirthdayPerson, id: string, patch: Partial<BirthdayRow> | null): PeopleChange {
  const key = person === 'contributor' ? 'contributors' : 'relations';
  return (people) => {
    const rows = people[key];
    const found = rows.some((row) => row.id === id);
    const changed = patch === null ? rows.filter((row) => row.id !== id) : found ? rows.map((row) => (row.id === id ? { ...row, ...patch } : row)) : [...rows, { id, name: '', birthDate: null, birthdayReminders: [], archived: false, ...patch }];
    return { ...people, [key]: changed };
  };
}

/**
 * Changes made one after the other.
 * @param {readonly PeopleChange[]} changes Changes.
 * @returns {PeopleChange} Change.
 */
export function peopleChanges(changes: readonly PeopleChange[]): PeopleChange {
  return (people) => changes.reduce((current, change) => change(current), people);
}

/**
 * Birthdays of some people: members of the team or household (« Moi » included) and relations with a valid birth
 * date, archived ones flagged. A contributor that is not a member has none of its own: linked to a relation, the
 * relation's birthday is its (its id an alias of it, neither archived); otherwise none.
 * @param {BirthdayRows} people Contributors and relations.
 * @returns {PersonBirthday[]} Birthdays, by name.
 */
function birthdaysOf({ contributors, relations }: BirthdayRows): PersonBirthday[] {
  const valid = (row: BirthdayRow): row is BirthdayRow & { birthDate: string } => readBirthDate(row.birthDate) !== null;
  const contributorOf = new Map(contributors.map((contributor) => [contributor.id, contributor]));
  /**
   * Birthday of a person.
   * @param {BirthdayPerson} person Contributor or relation.
   * @param {BirthdayRow & { birthDate: string }} row Its row.
   * @returns {PersonBirthday} Birthday.
   */
  const birthday = (person: BirthdayPerson, row: BirthdayRow & { birthDate: string }): PersonBirthday => {
    const contributor = person === 'relation' && row.contributorId ? contributorOf.get(row.contributorId) : undefined;
    return {
      id: personBirthdayId(person, row.id),
      contributorId: person === 'contributor' ? row.id : (row.contributorId ?? null),
      relationId: person === 'relation' ? row.id : null,
      name: row.name,
      birthDate: row.birthDate,
      reminders: readReminders(row.birthdayReminders),
      archived: row.archived,
      aliases: contributor && !contributor.member && !contributor.archived && !row.archived ? [personBirthdayId('contributor', contributor.id)] : [],
    };
  };
  return [
    ...contributors.filter((row) => row.member && valid(row)).map((row) => birthday('contributor', row as BirthdayRow & { birthDate: string })),
    ...relations.filter(valid).map((row) => birthday('relation', row)),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/**
 * Birthdays of the people of the workspace: members of the team or household and relations with a valid birth
 * date; the contributor linked to a relation is named by the relation's (an alias of it).
 * @param {{ archived?: boolean, change?: PeopleChange }} [options] Archived people too (flagged), and the people as a
 * change would leave them. Optional. Default = not archived, as they are.
 * @returns {Promise<PersonBirthday[]>} Birthdays, by name.
 */
export async function birthdays({ archived = false, change }: { archived?: boolean; change?: PeopleChange } = {}): Promise<PersonBirthday[]> {
  const select = { id: true, name: true, birthDate: true, birthdayReminders: true, archivedAt: true } as const;
  const [contributors, relations] = await Promise.all([
    prisma.contributor.findMany({ select: { ...select, teamMember: true, userId: true } }),
    prisma.treasuryRelation.findMany({ select: { ...select, contributorId: true } }),
  ]);
  const rows = (items: { archivedAt: Date | null }[]) => items.map(({ archivedAt, ...item }) => ({ ...item, archived: archivedAt !== null }) as BirthdayRow);
  const people = {
    contributors: rows(contributors.map(({ teamMember, userId, ...contributor }) => ({ ...contributor, member: isMember({ teamMember, userId }) }))),
    relations: rows(relations),
  };
  const all = birthdaysOf(change ? change(people) : people);
  return archived ? all : all.filter((birthday) => !birthday.archived);
}

/** A person a slot condition may name by its birthday, with or without one: its birthday id, name, archived or not. */
export interface BirthdayPersonName {
  /** `contributor:<id>` or `relation:<id>` (`personBirthdayId`). */
  id: string;
  name: string;
  archived: boolean;
}

/**
 * Every contributor and relation of the workspace, archived ones too, by birthday id: the names of the people a slot
 * condition cites, even those without a birthday (archived, without birth date, contributor linked to a contact or to
 * nothing).
 * @returns {Promise<BirthdayPersonName[]>} People.
 */
export async function birthdayPersonNames(): Promise<BirthdayPersonName[]> {
  const select = { id: true, name: true, archivedAt: true } as const;
  const [contributors, relations] = await Promise.all([prisma.contributor.findMany({ select }), prisma.treasuryRelation.findMany({ select })]);
  /**
   * Name of one person.
   * @param {BirthdayPerson} person Contributor or relation.
   * @param {{ id: string, name: string, archivedAt: Date | null }} row Its row.
   * @returns {BirthdayPersonName} Name.
   */
  const named = (person: BirthdayPerson, row: { id: string; name: string; archivedAt: Date | null }): BirthdayPersonName => ({ id: personBirthdayId(person, row.id), name: row.name, archived: row.archivedAt !== null });
  return [...contributors.map((row) => named('contributor', row)), ...relations.map((row) => named('relation', row))];
}
