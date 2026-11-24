import { afterCommit, prisma } from '../../db';
import type { GithubProjectLink } from '../../generated/prisma/client';
import { deleteIssueComment, deleteItem } from './board';
import { githubToken } from './client';

/**
 * Board link of a project: its own, or the one of its closest linked ancestor.
 * @param {string} projectId Project.
 * @returns {Promise<GithubProjectLink | null>} Link.
 */
async function linkOfProject(projectId: string): Promise<GithubProjectLink | null> {
  for (let current: string | null = projectId; current;) {
    const link = await prisma.githubProjectLink.findUnique({ where: { projectId: current } });
    if (link) return link;
    current = (await prisma.project.findUnique({ where: { id: current }, select: { parentId: true } }))?.parentId ?? null;
  }
  return null;
}

/**
 * Removes from their GitHub boards the items of tasks about to be deleted or to leave their project (a draft issue is
 * deleted, an issue stays in its repository). Done in the background: a GitHub failure does not block the deletion.
 * Inside a transaction, started only once it is committed (a rollback keeps the tasks and their items).
 * @param {string[]} ids Task ids.
 * @returns {Promise<void>}
 */
export async function forgetGithubItems(ids: string[]): Promise<void> {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids }, githubItemId: { not: null } }, select: { githubItemId: true, projectId: true } });
  if (tasks.length === 0) return;
  // Boards found now: the project (and its link) may be deleted right after.
  const items = (await Promise.all(tasks.map(async (task) => ({ itemId: task.githubItemId!, link: task.projectId ? await linkOfProject(task.projectId) : null })))).filter((item) => item.link);
  if (items.length === 0) return;
  afterCommit(() => {
    void (async () => {
      const token = await githubToken();
      for (const { itemId, link } of items) await deleteItem(token, link!.githubProjectId, itemId);
    })().catch((error: unknown) => console.warn('Items GitHub non retirés.', error));
  });
}

/**
 * Deletes on GitHub the comment of an Ordo comment about to be deleted, in the background.
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
export async function forgetGithubComment(id: string): Promise<void> {
  const comment = await prisma.taskComment.findUnique({ where: { id }, select: { githubCommentId: true } });
  if (!comment?.githubCommentId) return;
  void (async () => deleteIssueComment(await githubToken(), comment.githubCommentId!))().catch((error: unknown) => console.warn('Commentaire GitHub non supprimé.', error));
}
