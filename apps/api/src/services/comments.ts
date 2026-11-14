import { commentBodySchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Comment } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';

/** Items that take comments (tasks have their own), and their column on a comment. */
export const COMMENT_TARGETS = {
  ROUTINE: 'routineId',
  EVENT: 'eventId',
  SCHEDULE: 'scheduleId',
  TIME_ENTRY: 'timeEntryId',
  SHOPPING_LIST: 'shoppingListId',
  SHOPPING_PRODUCT: 'shoppingProductId',
  DOCUMENT: 'documentId',
  IMPORTED_DOCUMENT: 'importedDocumentId',
  CATALOG_ITEM: 'catalogItemId',
  TREASURY_ENTRY: 'treasuryEntryId',
  BUDGET: 'budgetId',
  RELATION: 'relationId',
  LIBRARY_DOCUMENT: 'libraryDocumentId',
  MAIL: 'mailMessageId',
} as const;
export type CommentTarget = keyof typeof COMMENT_TARGETS;

/**
 * Checks that the item a comment goes on exists (a mail is named by its Message-ID, kept on its server).
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @returns {Promise<void>}
 */
async function assertTarget(target: CommentTarget, id: string): Promise<void> {
  const where = { where: { id }, select: { id: true } };
  const found = {
    ROUTINE: () => prisma.routine.findUnique(where),
    EVENT: () => prisma.calendarEvent.findUnique(where),
    SCHEDULE: () => prisma.workSchedule.findUnique(where),
    TIME_ENTRY: () => prisma.timeEntry.findUnique(where),
    SHOPPING_LIST: () => prisma.shoppingList.findUnique(where),
    SHOPPING_PRODUCT: () => prisma.shoppingProduct.findUnique(where),
    DOCUMENT: () => prisma.accountingDocument.findUnique(where),
    IMPORTED_DOCUMENT: () => prisma.importedDocument.findUnique(where),
    CATALOG_ITEM: () => prisma.catalogItem.findUnique(where),
    TREASURY_ENTRY: () => prisma.treasuryEntry.findUnique(where),
    BUDGET: () => prisma.treasuryBudget.findUnique(where),
    RELATION: () => prisma.treasuryRelation.findUnique(where),
    LIBRARY_DOCUMENT: () => prisma.libraryDocument.findUnique(where),
    MAIL: async () => (id.trim() ? { id } : null),
  }[target];
  if (!(await found())) throw notFound('Élément');
}

/**
 * Number of comments of items of a kind.
 * @param {CommentTarget} target Kind of items.
 * @param {string[]} ids Items.
 * @returns {Promise<{ id: string, count: number }[]>} Counts (every item asked, 0 included).
 */
export async function commentCounts(target: CommentTarget, ids: string[]): Promise<{ id: string; count: number }[]> {
  const column = COMMENT_TARGETS[target];
  const groups = ids.length ? await prisma.comment.groupBy({ by: [column], where: { [column]: { in: ids } }, _count: { _all: true } }) : [];
  const counts = new Map(groups.map((group) => [(group as Record<string, unknown>)[column] as string, group._count._all]));
  return [...new Set(ids)].map((id) => ({ id, count: counts.get(id) ?? 0 }));
}

/**
 * Comments an item.
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @param {string} body Markdown.
 * @returns {Promise<Comment>} Comment.
 */
export async function addComment(target: CommentTarget, id: string, body: string): Promise<Comment> {
  const data = parseInput(z.object({ body: commentBodySchema }), { body });
  await assertTarget(target, id);
  return prisma.comment.create({ data: { body: data.body, [COMMENT_TARGETS[target]]: id } });
}

/**
 * Changes a comment.
 * @param {string} id Comment id.
 * @param {string} body Markdown.
 * @returns {Promise<Comment>} Comment.
 */
export async function updateComment(id: string, body: string): Promise<Comment> {
  const data = parseInput(z.object({ body: commentBodySchema }), { body });
  if (!(await prisma.comment.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Commentaire');
  return prisma.comment.update({ where: { id }, data: { body: data.body } });
}

/**
 * Deletes a comment.
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
export async function deleteComment(id: string): Promise<void> {
  if (!(await prisma.comment.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Commentaire');
  await prisma.comment.delete({ where: { id } });
}
