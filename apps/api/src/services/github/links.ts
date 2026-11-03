import { prisma } from '../../db';
import type { GithubProjectLink } from '../../generated/prisma/client';
import { deleteItem } from './board';
import { githubToken } from './client';

/**
 * Board link of a project: its own, or the one of its closest linked ancestor.
 * @param {string} projectId Project.
 * @returns {Promise<GithubProjectLink | null>} Link.
 */
export async function linkOfProject(projectId: string): Promise<GithubProjectLink | null> {
  for (let current: string | null = projectId; current; ) {
    const link = await prisma.githubProjectLink.findUnique({ where: { projectId: current } });
    if (link) return link;
    current = (await prisma.project.findUnique({ where: { id: current }, select: { parentId: true } }))?.parentId ?? null;
  }
  return null;
}

/**
 * Removes from their GitHub boards the items of tasks about to be deleted (a draft issue is deleted, an
 * issue stays in its repository). Done in the background: a GitHub failure does not block the deletion.
 * @param {string[]} ids Task ids.
 * @returns {Promise<void>}
 */
export async function forgetGithubItems(ids: string[]): Promise<void> {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids }, githubItemId: { not: null } }, select: { githubItemId: true, projectId: true } });
  if (tasks.length === 0) return;
  void (async () => {
    const token = await githubToken();
    for (const task of tasks) {
      const link = await linkOfProject(task.projectId);
      if (link) await deleteItem(token, link.githubProjectId, task.githubItemId!);
    }
  })().catch((error: unknown) => console.warn('Items GitHub non retirés.', error));
}
