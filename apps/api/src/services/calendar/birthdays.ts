import { readBirthDate, readReminders, type Reminder } from '@ordo/shared';
import { prisma } from '../../db';

/** Birthday of a person (lot 16, decision FO): derived from its birth date at read time, no row of its own. */
export interface PersonBirthday {
  /** `contributor:<id>` or `relation:<id>`. */
  id: string;
  contributorId: string | null;
  relationId: string | null;
  name: string;
  /** YYYY-MM-DD, or --MM-DD without year. */
  birthDate: string;
  reminders: Reminder[];
}

/**
 * Birthdays of the people of the workspace: contributors (members of the team or household included) and relations
 * with a valid birth date, not archived. A relation that also is a contributor with a birth date gives none (the
 * contributor's is the one shown).
 * @returns {Promise<PersonBirthday[]>} Birthdays, by name.
 */
export async function birthdays(): Promise<PersonBirthday[]> {
  const select = { id: true, name: true, birthDate: true, birthdayReminders: true } as const;
  const [contributors, relations] = await Promise.all([
    prisma.contributor.findMany({ where: { archivedAt: null, birthDate: { not: null } }, select }),
    prisma.treasuryRelation.findMany({ where: { archivedAt: null, birthDate: { not: null } }, select: { ...select, contributorId: true } }),
  ]);
  /**
   * People whose birth date is valid.
   * @template T
   * @param {T[]} people People.
   * @returns {T[]} Those with a valid birth date.
   */
  const valid = <T extends { birthDate: string | null }>(people: T[]) => people.filter((person): person is T & { birthDate: string } => readBirthDate(person.birthDate) !== null);
  const own = valid(contributors);
  const withBirthday = new Set(own.map((contributor) => contributor.id));
  return [
    ...own.map((contributor) => ({ id: `contributor:${contributor.id}`, contributorId: contributor.id, relationId: null, name: contributor.name, birthDate: contributor.birthDate, reminders: readReminders(contributor.birthdayReminders) })),
    ...valid(relations)
      .filter((relation) => !relation.contributorId || !withBirthday.has(relation.contributorId))
      .map((relation) => ({ id: `relation:${relation.id}`, contributorId: relation.contributorId, relationId: relation.id, name: relation.name, birthDate: relation.birthDate, reminders: readReminders(relation.birthdayReminders) })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
