import { unscopedPrisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { currentWorkspaceId } from '../../workspace-context';

/**
 * Fields of the workspace of the current request or job (its label, its settings…).
 * @param {S} select Fields read.
 * @returns {Promise<Prisma.WorkspaceGetPayload<{ select: S }>>} Fields.
 */
export function currentWorkspaceFields<S extends Prisma.WorkspaceSelect>(select: S): Promise<Prisma.WorkspaceGetPayload<{ select: S }>> {
  // eslint-disable-next-line no-restricted-syntax -- currentWorkspaceFields itself.
  return unscopedPrisma.workspace.findUniqueOrThrow({ where: { id: currentWorkspaceId() }, select });
}
