import { lineageOf, mapById } from '@ordo/shared';
import { prisma } from '../../db';

/** Root project of a project (the elements without project make a tree of their own: null). */
export type ProjectRootOf = (projectId: string | null) => string | null;

/**
 * Root project of each project, loaded once: tasks and routines are only linked inside the same project tree.
 * @returns {Promise<ProjectRootOf>} Root lookup.
 */
export async function loadProjectRootOf(): Promise<ProjectRootOf> {
  const byId = mapById(await prisma.project.findMany({ select: { id: true, parentId: true } }));
  // eslint-disable-next-line no-restricted-syntax -- loadProjectRootOf itself.
  return (projectId) => (projectId === null ? null : (lineageOf(byId, projectId).at(-1)?.id ?? projectId));
}
