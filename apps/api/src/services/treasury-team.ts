import { parseDay, treasuryContextPeriodSchema, treasuryContextSchema, type TreasuryContextInput, type TreasuryContextPeriodInput } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type Contributor, type TreasuryContext, type TreasuryContextPeriod } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { createContributor } from './contributors';

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
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
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
    if (!(await prisma.contributor.findUnique({ where: { id: input.contributorId }, select: { id: true } }))) throw notFound('Contributeur');
    return prisma.contributor.update({ where: { id: input.contributorId }, data: { teamMember: true } });
  }
  const { name } = parseInput(z.object({ name: z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.') }), { name: input.name ?? '' });
  const contributor = await createContributor({ name, handle: await freeHandle(name) });
  return prisma.contributor.update({ where: { id: contributor.id }, data: { teamMember: true } });
}

/**
 * Removes a member from the team: they stay a contributor (tasks, projects, past lines kept). "Moi" stays a member.
 * @param {string} contributorId Contributor.
 * @returns {Promise<void>}
 */
export async function removeMember(contributorId: string): Promise<void> {
  const contributor = await prisma.contributor.findUnique({ where: { id: contributorId }, select: { userId: true } });
  if (!contributor) throw notFound('Membre');
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
  if (id && !(await prisma.treasuryContext.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Contexte');
  try {
    return await prisma.$transaction(async (tx) => {
      if (id) return tx.treasuryContext.update({ where: { id }, data });
      const { _max } = await tx.treasuryContext.aggregate({ _max: { position: true } });
      return tx.treasuryContext.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw clientError('BAD_USER_INPUT', 'Un contexte porte déjà ce nom.', { fields: { name: 'Un contexte porte déjà ce nom.' } });
    }
    throw error;
  }
}

/**
 * Deletes a context: its periods go with it, the lines that had it keep no context.
 * @param {string} id Context.
 * @returns {Promise<void>}
 */
export async function deleteContext(id: string): Promise<void> {
  const { count } = await prisma.treasuryContext.deleteMany({ where: { id } });
  if (!count) throw notFound('Contexte');
}

/**
 * Saves a planned period of a context. The lines already saved keep their context.
 * @param {string | null} id Period to change, or null to create one.
 * @param {TreasuryContextPeriodInput} input Context, first and last days, note.
 * @returns {Promise<TreasuryContextPeriod>} Period.
 */
export async function saveContextPeriod(id: string | null, input: TreasuryContextPeriodInput): Promise<TreasuryContextPeriod> {
  const data = parseInput(treasuryContextPeriodSchema, input);
  if (!(await prisma.treasuryContext.findUnique({ where: { id: data.contextId }, select: { id: true } }))) throw notFound('Contexte');
  const fields = { contextId: data.contextId, startDate: parseDay(data.startDate), endDate: parseDay(data.endDate), note: data.note };
  if (!id) return prisma.treasuryContextPeriod.create({ data: fields });
  if (!(await prisma.treasuryContextPeriod.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Période');
  return prisma.treasuryContextPeriod.update({ where: { id }, data: fields });
}

/**
 * Deletes a planned period. The lines already saved keep their context.
 * @param {string} id Period.
 * @returns {Promise<void>}
 */
export async function deleteContextPeriod(id: string): Promise<void> {
  const { count } = await prisma.treasuryContextPeriod.deleteMany({ where: { id } });
  if (!count) throw notFound('Période');
}
