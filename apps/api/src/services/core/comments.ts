import { commentBodySchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Comment } from '../../generated/prisma/client';
import { clientError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { ARCHIVED_MESSAGE } from './archive';
import { deleteOrNotFound } from './lookup';

/** Items that take comments (tasks have their own), and their column on a comment. */
export const COMMENT_TARGETS = {
  ROUTINE: 'routineId',
  EVENT: 'eventId',
  SCHEDULE: 'scheduleId',
  TIME_ENTRY: 'timeEntryId',
  SHOPPING_LIST: 'shoppingListId',
  SHOPPING_PRODUCT: 'shoppingProductId',
  SHOPPING_ITEM: 'shoppingItemId',
  SHEET_ITEM: 'sheetItemId',
  STOCK_ITEM: 'stockItemId',
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
 * Checks that the item a comment goes on exists and is not archived, nor in an archived element (an item of a sheet or
 * of a shopping list): an archived element is read only, its comments too (a mail is named by its Message-ID, kept on
 * its server).
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @returns {Promise<void>}
 */
async function assertTarget(target: CommentTarget, id: string): Promise<void> {
  const where = { where: { id }, select: { archivedAt: true } };
  const found: () => Promise<{ archivedAt: Date | null } | null> = {
    ROUTINE: () => prisma.routine.findUnique(where),
    EVENT: () => prisma.calendarEvent.findUnique(where),
    SCHEDULE: () => prisma.workSchedule.findUnique(where),
    TIME_ENTRY: async () => (await prisma.timeEntry.findUnique({ where: { id }, select: { id: true } })) && { archivedAt: null },
    SHOPPING_LIST: () => prisma.shoppingList.findUnique(where),
    SHOPPING_PRODUCT: () => prisma.shoppingProduct.findUnique(where),
    SHOPPING_ITEM: async () => (await prisma.shoppingItem.findUnique({ where: { id }, select: { list: { select: { archivedAt: true } } } }))?.list ?? null,
    SHEET_ITEM: async () => (await prisma.sheetItem.findUnique({ where: { id }, select: { sheet: { select: { archivedAt: true } } } }))?.sheet ?? null,
    STOCK_ITEM: () => prisma.stockItem.findUnique(where),
    DOCUMENT: () => prisma.accountingDocument.findUnique(where),
    IMPORTED_DOCUMENT: () => prisma.importedDocument.findUnique(where),
    CATALOG_ITEM: () => prisma.catalogItem.findUnique(where),
    TREASURY_ENTRY: () => prisma.treasuryEntry.findUnique(where),
    BUDGET: () => prisma.treasuryBudget.findUnique(where),
    RELATION: () => prisma.treasuryRelation.findUnique(where),
    LIBRARY_DOCUMENT: async () => (await prisma.libraryDocument.findUnique({ where: { id }, select: { id: true } })) && { archivedAt: null },
    MAIL: async () => (id.trim() ? { archivedAt: null } : null),
  }[target];
  const item = await found();
  if (!item) throw notFound('Élément');
  if (item.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
}

/**
 * Checks that the item of a comment can still take changes (assertTarget).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
async function assertCommentTarget(id: string): Promise<void> {
  const comment = await orNotFound(prisma.comment.findUnique({ where: { id } }), 'Commentaire');
  const target = (Object.keys(COMMENT_TARGETS) as CommentTarget[]).find((kind) => comment[COMMENT_TARGETS[kind]]);
  if (target) await assertTarget(target, comment[COMMENT_TARGETS[target]]!);
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
 * Comments an item (not an archived one).
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
 * Changes a comment (not one of an archived item).
 * @param {string} id Comment id.
 * @param {string} body Markdown.
 * @returns {Promise<Comment>} Comment.
 */
export async function updateComment(id: string, body: string): Promise<Comment> {
  const data = parseInput(z.object({ body: commentBodySchema }), { body });
  await assertCommentTarget(id);
  return prisma.comment.update({ where: { id }, data: { body: data.body } });
}

/**
 * Deletes a comment (not one of an archived item).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
export async function deleteComment(id: string): Promise<void> {
  await assertCommentTarget(id);
  await deleteOrNotFound(prisma.comment, id, 'Commentaire');
}
