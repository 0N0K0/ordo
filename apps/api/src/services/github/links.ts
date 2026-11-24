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

/** An item of a board to remove, with the task that had it. */
interface LeavingItem {
  id: string;
  itemId: string;
  link: GithubProjectLink | null;
}

/**
 * Items of the given tasks, each with its board (found now: the project, and its link, may be deleted right after).
 * @param {string[]} ids Task ids.
 * @returns {Promise<LeavingItem[]>} Items.
 */
async function itemsOf(ids: string[]): Promise<LeavingItem[]> {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids }, githubItemId: { not: null } }, select: { id: true, githubItemId: true, projectId: true } });
  return Promise.all(tasks.map(async (task) => ({ id: task.id, itemId: task.githubItemId!, link: task.projectId ? await linkOfProject(task.projectId) : null })));
}

/**
 * Removes items from their boards in the background (a draft issue is deleted, an issue stays in its repository), once
 * the current work is committed (`afterCommit`); a GitHub failure is only logged.
 * @param {LeavingItem[]} items Items.
 * @param {boolean} unlessRelinked An item a task holds again by then (its issue added to the board again by a sync, the
 * board then giving the same item) is kept.
 * @returns {void}
 */
function removeItems(items: LeavingItem[], unlessRelinked: boolean): void {
  const removed = items.filter((item) => item.link);
  if (removed.length === 0) return;
  afterCommit(() => {
    void (async () => {
      const token = await githubToken();
      for (const { itemId, link } of removed) {
        // Read just before the removal: a sync relinking the item between this read and the removal (a few
        // milliseconds) still loses it, and archives its task at the next sync.
        if (unlessRelinked && (await prisma.task.findUnique({ where: { githubItemId: itemId }, select: { id: true } }))) continue;
        // One failure does not keep the others on their boards.
        await deleteItem(token, link!.githubProjectId, itemId).catch((error: unknown) => console.warn('Item GitHub non retiré.', { itemId, error }));
      }
    })().catch((error: unknown) => console.warn('Items GitHub non retirés.', error));
  });
}

/**
 * Removes from their GitHub boards the items of tasks about to be deleted (a draft issue is deleted, an issue stays in
 * its repository). Done in the background: a GitHub failure does not block the deletion. Inside a transaction, started
 * only once it is committed (a rollback keeps the tasks and their items).
 * @param {string[]} ids Task ids.
 * @returns {Promise<void>}
 */
export async function forgetGithubItems(ids: string[]): Promise<void> {
  removeItems(await itemsOf(ids), false);
}

/**
 * Items of tasks about to move to a project that leave their board (out of any project, or to a tree with another
 * board or none; a task without board found keeps no item either); those staying in the same tree keep theirs.
 * @param {string[]} ids Task ids.
 * @param {string | null} projectId Project the tasks move to (null: out of any project).
 * @returns {Promise<{ ids: string[], remove: () => void }>} Tasks whose item goes (their `githubItemId` to clear with
 * the move), and the removal of their items from the boards, to call once the move is written (it waits for the commit
 * of the current transaction, and keeps an item a task holds again by then).
 */
export async function githubItemsLeaving(ids: string[], projectId: string | null): Promise<{ ids: string[]; remove: () => void }> {
  const target = projectId ? await linkOfProject(projectId) : null;
  const leaving = (await itemsOf(ids)).filter((item) => !item.link || item.link.id !== target?.id);
  return { ids: leaving.map((item) => item.id), remove: () => removeItems(leaving, true) };
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
