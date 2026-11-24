import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';

/** Members of the team (professional workspace) or household (personal one): flagged as one, or the app user ("Moi"). */
export const memberWhere = { OR: [{ teamMember: true }, { userId: { not: null } }] } satisfies Prisma.ContributorWhereInput;

/**
 * Tells whether a contributor is a member: flagged as one, or the app user ("Moi", always one).
 * @param {{ teamMember: boolean, userId: string | null }} contributor Contributor.
 * @returns {boolean} Whether they are a member.
 */
export function isMember(contributor: { teamMember: boolean; userId: string | null }): boolean {
  return contributor.teamMember || contributor.userId !== null;
}

/**
 * Contributor profile ("Moi") of the first user of the app (the oldest account, then by id) in the current workspace:
 * the "Moi" of what runs for no one in particular (task automation rules)).
 * @returns {Promise<string | null>} Contributor id, null when there is none.
 */
export async function firstUserContributorId(): Promise<string | null> {
  const first = await prisma.contributor.findFirst({ where: { userId: { not: null } }, orderBy: [{ user: { createdAt: 'asc' } }, { userId: 'asc' }], select: { id: true } });
  return first?.id ?? null;
}
