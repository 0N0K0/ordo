import { modelDelegate } from './delegate';
import { commentBodySchema } from '@ordo/shared';
import { prisma } from '../../db';
import type { Comment } from '../../generated/prisma/client';
import { notFound, orNotFound, parseField } from '../../graphql/errors';
import { assertNotArchived, type ArchivableModel } from './archive';
import { deleteOrNotFound, findOrNotFound } from './lookup';

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

/** Model of an item commented, and the archivable element that locks it: itself, or the element it is in (its field). */
type TargetModel = { model: string; lock?: ArchivableModel; via?: string };

/** Model of each item that takes comments (a mail is named by its Message-ID, kept on its server). */
const TARGET_MODELS: Record<Exclude<CommentTarget, 'MAIL'>, TargetModel> = {
  ROUTINE: { model: 'routine', lock: 'routine' },
  EVENT: { model: 'calendarEvent', lock: 'calendarEvent' },
  SCHEDULE: { model: 'workSchedule', lock: 'workSchedule' },
  TIME_ENTRY: { model: 'timeEntry' },
  SHOPPING_LIST: { model: 'shoppingList', lock: 'shoppingList' },
  SHOPPING_PRODUCT: { model: 'shoppingProduct', lock: 'shoppingProduct' },
  SHOPPING_ITEM: { model: 'shoppingItem', lock: 'shoppingList', via: 'listId' },
  SHEET_ITEM: { model: 'sheetItem', lock: 'sheet', via: 'sheetId' },
  STOCK_ITEM: { model: 'stockItem', lock: 'stockItem' },
  DOCUMENT: { model: 'accountingDocument', lock: 'accountingDocument' },
  IMPORTED_DOCUMENT: { model: 'importedDocument', lock: 'importedDocument' },
  CATALOG_ITEM: { model: 'catalogItem', lock: 'catalogItem' },
  TREASURY_ENTRY: { model: 'treasuryEntry', lock: 'treasuryEntry' },
  BUDGET: { model: 'treasuryBudget', lock: 'treasuryBudget' },
  RELATION: { model: 'treasuryRelation', lock: 'treasuryRelation' },
  LIBRARY_DOCUMENT: { model: 'libraryDocument' },
};

/** Model delegate able to find one record by id (`prisma.routine`…). */
interface FindDelegate {
  findUnique(args: { where: { id: string }; select: Record<string, true> }): PromiseLike<Record<string, string> | null>;
}

/**
 * Checks that the item a comment goes on exists and is not archived, nor in an archived element (an item of a sheet or
 * of a shopping list): an archived element is read only, its comments too.
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @returns {Promise<void>}
 */
async function assertTarget(target: CommentTarget, id: string): Promise<void> {
  if (target === 'MAIL') {
    if (!id.trim()) throw notFound('Élément');
    return;
  }
  const { model, lock, via } = TARGET_MODELS[target];
  const item = await orNotFound(modelDelegate<FindDelegate>(model).findUnique({ where: { id }, select: { [via ?? 'id']: true } }), 'Élément');
  if (lock) await assertNotArchived(lock, item[via ?? 'id']);
}

/**
 * Checks that the item of a comment can still take changes (assertTarget).
 * @param {string} id Comment id.
 * @returns {Promise<void>}
 */
async function assertCommentTarget(id: string): Promise<void> {
  const comment = await findOrNotFound(prisma.comment, id, 'Commentaire');
  const target = (Object.keys(COMMENT_TARGETS) as CommentTarget[]).find((kind) => comment[COMMENT_TARGETS[kind]]);
  if (target) await assertTarget(target, comment[COMMENT_TARGETS[target]]!);
}

/**
 * Body of a comment, checked (markdown, not empty).
 * @param {string} body Markdown.
 * @returns {string} Body.
 */
export function commentBody(body: string): string {
  return parseField('body', commentBodySchema, body);
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
  const text = commentBody(body);
  await assertTarget(target, id);
  return prisma.comment.create({ data: { body: text, [COMMENT_TARGETS[target]]: id } });
}

/**
 * Changes a comment (not one of an archived item).
 * @param {string} id Comment id.
 * @param {string} body Markdown.
 * @returns {Promise<Comment>} Comment.
 */
export async function updateComment(id: string, body: string): Promise<Comment> {
  const text = commentBody(body);
  await assertCommentTarget(id);
  return prisma.comment.update({ where: { id }, data: { body: text } });
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
