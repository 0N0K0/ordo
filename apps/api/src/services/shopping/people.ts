import { prisma } from '../../db';
import { assertAllExist } from '../core/lookup';
import { connectIds } from '../core/relations';

/** Include of the people (members, relations) of a product, an item or a sheet item. */
export const withPeople = { members: { select: { id: true } }, relations: { select: { id: true } } } as const;

/** A record read with its people (`withPeople`). */
export type WithPeople = { members: { id: string }[]; relations: { id: string }[] };

/**
 * People of a product or an item, connected on creation or replacing the previous ones (duplicates count once).
 * @param {{ memberIds?: readonly string[] | null, relationIds?: readonly string[] | null }} input Members and relations chosen.
 * @param {'connect' | 'set'} mode Creation or update.
 * @returns {object} Relation data.
 */
export const peopleData = (input: { memberIds?: readonly string[] | null; relationIds?: readonly string[] | null }, mode: 'connect' | 'set') => ({
  members: { [mode]: connectIds(input.memberIds ?? []) },
  relations: { [mode]: connectIds(input.relationIds ?? []) },
});

/**
 * Ids of the people of a record read with `withPeople`.
 * @param {WithPeople} record Product, item or sheet item, with its people.
 * @returns {{ memberIds: string[], relationIds: string[] }} Members and relations.
 */
export const peopleIds = (record: WithPeople): { memberIds: string[]; relationIds: string[] } => ({
  memberIds: record.members.map((member) => member.id),
  relationIds: record.relations.map((relation) => relation.id),
});

/**
 * Checks the people a product, an item or a sheet item is for: beneficiaries, so any contributor and any relation.
 * @param {{ memberIds?: readonly string[] | null, relationIds?: readonly string[] | null }} input Contributors and relations chosen.
 * @returns {Promise<void>}
 */
export async function assertPeople(input: { memberIds?: readonly string[] | null; relationIds?: readonly string[] | null }): Promise<void> {
  await assertAllExist(prisma.contributor, input.memberIds, 'Membre');
  await assertAllExist(prisma.treasuryRelation, input.relationIds, 'Relation');
}
