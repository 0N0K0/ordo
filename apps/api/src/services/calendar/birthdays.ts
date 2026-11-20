import { personBirthdayId, readBirthDate, readReminders, type BirthdayPerson, type Reminder } from '@ordo/shared';
import { prisma } from '../../db';

/**
 * Birthday of a person (lot 16, decision FO): derived from its birth date at read time, no row of its own. Slot
 * conditions name it by `birthdaySlotId(id)` (lot 16c, decision FP), or by one of its `aliases` (decision FQ).
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
  /** Its person is archived: shown nowhere, no moment to the slot conditions (decision FQ). */
  archived: boolean;
  /**
   * Other birthday ids of the same person (decision FQ): the relation linked to the contributor whose birthday applies,
   * or the contributor without birth date of the relation whose birthday applies.
   */
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
 * (`settleScheduleChange`, decision FQ).
 */
export type PeopleChangeSettler = (change: PeopleChange) => Promise<void>;

/** No settling (internal changes). */
export const NO_PEOPLE_SETTLER: PeopleChangeSettler = async () => {};

/**
 * Change of one person (decision FQ): its fields changed (a new one added), or removed (null).
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
 * Birthdays of some people (decision FO, FQ): contributors (members of the team or household included) and relations
 * with a valid birth date, archived ones flagged. One person, one birthday: a relation linked to a contributor with a
 * birth date (not archived) gives none of its own, its id naming the contributor's (`aliases`); a contributor without
 * birth date linked to a relation with one is named by the relation's.
 * @param {BirthdayRows} people Contributors and relations.
 * @returns {PersonBirthday[]} Birthdays, by name.
 */
function birthdaysOf({ contributors, relations }: BirthdayRows): PersonBirthday[] {
  const valid = (row: BirthdayRow): row is BirthdayRow & { birthDate: string } => readBirthDate(row.birthDate) !== null;
  const contributorOf = new Map(contributors.map((contributor) => [contributor.id, contributor]));
  /**
   * The contributor of a relation whose birthday applies to it: one with a birth date, neither archived.
   * @param {BirthdayRow} relation Relation.
   * @returns {BirthdayRow | undefined} Contributor.
   */
  const applying = (relation: BirthdayRow) => {
    const contributor = relation.contributorId ? contributorOf.get(relation.contributorId) : undefined;
    return contributor && valid(contributor) && !contributor.archived && !relation.archived ? contributor : undefined;
  };
  const aliasesOf = new Map<string, string[]>();
  /**
   * Adds an alias to a birthday.
   * @param {string} id Birthday.
   * @param {string} alias Other id naming it.
   * @returns {void}
   */
  const alias = (id: string, alias: string) => aliasesOf.set(id, [...(aliasesOf.get(id) ?? []), alias]);
  const own = relations.filter((relation) => valid(relation) && !applying(relation));
  for (const relation of relations) {
    const contributor = applying(relation);
    if (contributor) alias(personBirthdayId('contributor', contributor.id), personBirthdayId('relation', relation.id));
  }
  for (const relation of own) {
    const contributor = relation.contributorId ? contributorOf.get(relation.contributorId) : undefined;
    if (contributor && !valid(contributor) && !contributor.archived && !relation.archived) alias(personBirthdayId('relation', relation.id), personBirthdayId('contributor', contributor.id));
  }
  /**
   * Birthday of a person.
   * @param {BirthdayPerson} person Contributor or relation.
   * @param {BirthdayRow & { birthDate: string }} row Its row.
   * @returns {PersonBirthday} Birthday.
   */
  const birthday = (person: BirthdayPerson, row: BirthdayRow & { birthDate: string }): PersonBirthday => {
    const id = personBirthdayId(person, row.id);
    return {
      id,
      contributorId: person === 'contributor' ? row.id : (row.contributorId ?? null),
      relationId: person === 'relation' ? row.id : null,
      name: row.name,
      birthDate: row.birthDate,
      reminders: readReminders(row.birthdayReminders),
      archived: row.archived,
      aliases: aliasesOf.get(id) ?? [],
    };
  };
  return [
    ...contributors.filter(valid).map((row) => birthday('contributor', row)),
    ...own.filter(valid).map((row) => birthday('relation', row)),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/**
 * Birthdays of the people of the workspace (decision FO): contributors (members of the team or household included) and
 * relations with a valid birth date; a relation that also is a contributor with a birth date gives none (the
 * contributor's is the one shown, its id an alias of it, decision FQ).
 * @param {{ archived?: boolean, change?: PeopleChange }} [options] Archived people too (flagged), and the people as a
 * change would leave them. Optional. Default = not archived, as they are.
 * @returns {Promise<PersonBirthday[]>} Birthdays, by name.
 */
export async function birthdays({ archived = false, change }: { archived?: boolean; change?: PeopleChange } = {}): Promise<PersonBirthday[]> {
  const select = { id: true, name: true, birthDate: true, birthdayReminders: true, archivedAt: true } as const;
  const [contributors, relations] = await Promise.all([prisma.contributor.findMany({ select }), prisma.treasuryRelation.findMany({ select: { ...select, contributorId: true } })]);
  const rows = (items: { archivedAt: Date | null }[]) => items.map(({ archivedAt, ...item }) => ({ ...item, archived: archivedAt !== null }) as BirthdayRow);
  const people = { contributors: rows(contributors), relations: rows(relations) };
  const all = birthdaysOf(change ? change(people) : people);
  return archived ? all : all.filter((birthday) => !birthday.archived);
}
