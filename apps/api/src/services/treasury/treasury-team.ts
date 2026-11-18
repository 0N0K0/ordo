import {
  parseDay,
  treasuryContextPeriodSchema,
  treasuryContextSchema,
  treasuryRelationSchema,
  type TreasuryContextInput,
  type TreasuryContextPeriodInput,
  type TreasuryRelationInput,
  normalize,
  requiredText,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { Prisma, type Contributor, type TreasuryContext, type TreasuryContextPeriod, type TreasuryRelation } from '../../generated/prisma/client';
import { clientError, fieldError, isUniqueConflict, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { createContributor } from '../workspace/contributors';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertNotArchived } from '../core/archive';

/** Members of the team (professional workspace) or household (personal one): "Moi", then the others. */
const memberWhere = { OR: [{ teamMember: true }, { userId: { not: null } }] } satisfies Prisma.ContributorWhereInput;

/**
 * Tells whether a contributor is a member: flagged as one, or the app user ("Moi", always one).
 * @param {{ teamMember: boolean, userId: string | null }} contributor Contributor.
 * @returns {boolean} Whether they are a member.
 */
export function isMember(contributor: { teamMember: boolean; userId: string | null }): boolean {
  return contributor.teamMember || contributor.userId !== null;
}

/**
 * Members of the team or household, "Moi" first, then by name.
 * @returns {Promise<Contributor[]>} Members.
 */
export async function listMembers(): Promise<Contributor[]> {
  const members = await prisma.contributor.findMany({ where: memberWhere, orderBy: { name: 'asc' } });
  return members.sort((a, b) => Number(b.userId !== null) - Number(a.userId !== null));
}

/**
 * Handle free in the workspace for a new contributor named so.
 * @param {string} name Name.
 * @returns {Promise<string>} Handle.
 */
async function freeHandle(name: string): Promise<string> {
  const base =
    normalize(name)
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'membre';
  const taken = new Set((await prisma.contributor.findMany({ where: { handle: { startsWith: base } }, select: { handle: true } })).map((item) => item.handle));
  let handle = base;
  for (let index = 2; taken.has(handle); index += 1) handle = `${base}-${index}`;
  return handle;
}

/**
 * Adds a member: an existing contributor, or a new one created with this name (a member always is a contributor).
 * @param {{ contributorId?: string | null, name?: string | null }} input Contributor, or name of a new one.
 * @returns {Promise<Contributor>} Member.
 */
export async function addMember(input: { contributorId?: string | null; name?: string | null }): Promise<Contributor> {
  if (input.contributorId) {
    await assertExists(prisma.contributor, input.contributorId, 'Contributeur');
    // A contributor is a member or a relation, not both.
    const relation = await prisma.treasuryRelation.findFirst({ where: { contributorId: input.contributorId }, select: { name: true } });
    if (relation) throw clientError('BAD_USER_INPUT', `Ce contributeur est la relation « ${relation.name} » : il ne peut pas aussi être membre.`);
    return prisma.contributor.update({ where: { id: input.contributorId }, data: { teamMember: true } });
  }
  const { name } = parseInput(z.object({ name: requiredText(100) }), { name: input.name ?? '' });
  const contributor = await createContributor({ name, handle: await freeHandle(name) });
  return prisma.contributor.update({ where: { id: contributor.id }, data: { teamMember: true } });
}

/**
 * Removes a member from the team: they stay a contributor (tasks, projects, past lines kept). "Moi" stays a member.
 * @param {string} contributorId Contributor.
 * @returns {Promise<void>}
 */
export async function removeMember(contributorId: string): Promise<void> {
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id: contributorId }, select: { userId: true } }), 'Membre');
  if (contributor.userId) throw clientError('BAD_USER_INPUT', 'Vous êtes toujours membre de votre équipe ou de votre foyer.');
  await prisma.contributor.update({ where: { id: contributorId }, data: { teamMember: false } });
}

/**
 * Saves a context.
 * @param {string | null} id Context to change, or null to create one.
 * @param {TreasuryContextInput} input Name and color.
 * @returns {Promise<TreasuryContext>} Context.
 */
export async function saveContext(id: string | null, input: TreasuryContextInput): Promise<TreasuryContext> {
  const data = parseInput(treasuryContextSchema, input);
  await assertExists(prisma.treasuryContext, id, 'Contexte');
  await assertNotArchived('TREASURY_CONTEXT', id);
  try {
    return await prisma.$transaction(async (tx) => {
      if (id) return tx.treasuryContext.update({ where: { id }, data });
      const { _max } = await tx.treasuryContext.aggregate({ _max: { position: true } });
      return tx.treasuryContext.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
    });
  } catch (error) {
    rethrowUnique(error, 'Un contexte porte déjà ce nom.');
  }
}

/**
 * Deletes a context: its periods go with it, the lines that had it keep no context.
 * @param {string} id Context.
 * @returns {Promise<void>}
 */
export async function deleteContext(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryContext, id, 'Contexte');
}

/**
 * Saves a planned period of a context. The lines already saved keep their context.
 * @param {string | null} id Period to change, or null to create one.
 * @param {TreasuryContextPeriodInput} input Context, first and last days, note.
 * @returns {Promise<TreasuryContextPeriod>} Period.
 */
export async function saveContextPeriod(id: string | null, input: TreasuryContextPeriodInput): Promise<TreasuryContextPeriod> {
  const data = parseInput(treasuryContextPeriodSchema, input);
  await assertExists(prisma.treasuryContext, data.contextId, 'Contexte');
  // A period is part of its context: none added to, nor taken from, an archived one.
  await assertNotArchived('TREASURY_CONTEXT', data.contextId);
  const fields = { contextId: data.contextId, startDate: parseDay(data.startDate), endDate: parseDay(data.endDate), note: data.note };
  if (!id) return prisma.treasuryContextPeriod.create({ data: fields });
  const previous = await orNotFound(prisma.treasuryContextPeriod.findUnique({ where: { id }, select: { contextId: true } }), 'Période');
  await assertNotArchived('TREASURY_CONTEXT', previous.contextId);
  return prisma.treasuryContextPeriod.update({ where: { id }, data: fields });
}

/**
 * Deletes a planned period. The lines already saved keep their context.
 * @param {string} id Period.
 * @returns {Promise<void>}
 */
export async function deleteContextPeriod(id: string): Promise<void> {
  await assertNotArchived('TREASURY_CONTEXT', (await prisma.treasuryContextPeriod.findUnique({ where: { id }, select: { contextId: true } }))?.contextId);
  await deleteOrNotFound(prisma.treasuryContextPeriod, id, 'Période');
}

/**
 * Saves a relation: a person out of the team or household (friend, family, partner…) lines and budgets can be for,
 * possibly a contributor too (not a member).
 * @param {string | null} id Relation to change, or null to create one.
 * @param {TreasuryRelationInput} input Name and note.
 * @returns {Promise<TreasuryRelation>} Relation.
 */
export async function saveRelation(id: string | null, input: TreasuryRelationInput): Promise<TreasuryRelation> {
  const parsed = parseInput(treasuryRelationSchema, input);
  await assertExists(prisma.treasuryRelation, id, 'Relation');
  await assertNotArchived('TREASURY_RELATION', id);
  if (parsed.contributorId) {
    const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id: parsed.contributorId }, select: { teamMember: true, userId: true } }), 'Contributeur');
    if (isMember(contributor)) {
      const message = 'Ce contributeur est membre : il n’est pas une relation.';
      throw fieldError('contributorId', message);
    }
  }
  const data = { name: parsed.name, note: parsed.note, contributorId: parsed.contributorId ?? null };
  try {
    return id ? await prisma.treasuryRelation.update({ where: { id }, data }) : await prisma.treasuryRelation.create({ data });
  } catch (error) {
    if (isUniqueConflict(error)) {
      const contributor = String(error.meta?.target ?? '').includes('contributorId') || JSON.stringify(error.meta ?? {}).includes('contributorId');
      const message = contributor ? 'Ce contributeur est déjà une relation.' : 'Une relation porte déjà ce nom.';
      throw fieldError(contributor ? 'contributorId' : 'name', message);
    }
    throw error;
  }
}

/**
 * Deletes a relation: its budgets go with it, its lines become the app user's.
 * @param {string} id Relation.
 * @returns {Promise<void>}
 */
export async function deleteRelation(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryRelation, id, 'Relation');
}
