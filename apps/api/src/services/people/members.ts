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
