import { modelDelegate } from './delegate';
import { commentBodySchema, daySchema, formatOptionalDay, occurrenceKey, parseOptionalDay, readOccurrenceKey } from '@ordo/shared';
import { prisma } from '../../db';
import type { Comment, Prisma } from '../../generated/prisma/client';
import { clientError, notFound, orNotFound, parseField } from '../../graphql/errors';
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

/**
 * Model of an item commented, and the archivable element that locks it: itself, or the element it is in (its field).
 * `occurrences`: its comments are on one occurrence, of every routine (ALWAYS) or of a recurring event
 * only (RECURRING: a one-off event has a single occurrence, without date).
 */
type TargetModel = { model: string; lock?: ArchivableModel; via?: string; occurrences?: 'ALWAYS' | 'RECURRING' };

/** Model of each item that takes comments (a mail is named by its Message-ID, kept on its server). */
const TARGET_MODELS: Record<Exclude<CommentTarget, 'MAIL'>, TargetModel> = {
  ROUTINE: { model: 'routine', lock: 'routine', occurrences: 'ALWAYS' },
  EVENT: { model: 'calendarEvent', lock: 'calendarEvent', occurrences: 'RECURRING' },
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
  findUnique(args: { where: { id: string }; select: Record<string, true> }): PromiseLike<Record<string, unknown> | null>;
}

/**
 * Whether the comments of a kind of item are on its occurrences (routines and events).
 * @param {CommentTarget} target Kind of item.
 * @returns {boolean} On occurrences.
 */
export const onOccurrences = (target: CommentTarget): boolean => target !== 'MAIL' && TARGET_MODELS[target].occurrences !== undefined;

/**
 * Checks that the item a comment goes on exists and is not archived, nor in an archived element (an item of a sheet or
 * of a shopping list): an archived element is read only, its comments too. For a routine or a recurring event, the
 * occurrence is required (its day); a one-off event and the other items take none.
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @param {string | null} [occurrenceDate] Occurrence (YYYY-MM-DD); none given: not checked (a comment already there). Optional.
 * @returns {Promise<Date | null>} Occurrence stored with the comment.
 */
async function assertTarget(target: CommentTarget, id: string, occurrenceDate?: string | null): Promise<Date | null> {
  if (target === 'MAIL') {
    if (!id.trim()) throw notFound('Élément');
    if (occurrenceDate) throw clientError('BAD_USER_INPUT', 'Cet élément n’a pas d’occurrences.');
    return null;
  }
  const { model, lock, via, occurrences } = TARGET_MODELS[target];
  const select = { [via ?? 'id']: true, ...(occurrences === 'RECURRING' ? { recurrence: true } : {}) } as Record<string, true>;
  const item = await orNotFound(modelDelegate<FindDelegate>(model).findUnique({ where: { id }, select }), 'Élément');
  if (lock) await assertNotArchived(lock, item[via ?? 'id'] as string);
  if (occurrenceDate === undefined) return null;
  const dated = occurrences === 'ALWAYS' || (occurrences === 'RECURRING' && item.recurrence !== null);
  if (!dated) {
    if (occurrenceDate) throw clientError('BAD_USER_INPUT', 'Cet élément n’a pas d’occurrences.');
    return null;
  }
  if (!occurrenceDate) throw clientError('BAD_USER_INPUT', 'Occurrence manquante.');
  return parseOptionalDay(parseField('occurrenceDate', daySchema(), occurrenceDate));
}

/**
 * Filter of the comments of an item: those of one of its occurrences for a routine or an event (null: a one-off event),
 * else all of them.
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @param {string | null} [occurrenceDate] Occurrence (YYYY-MM-DD). Optional.
 * @returns {Prisma.CommentWhereInput} Filter.
 */
export function commentsWhere(target: CommentTarget, id: string, occurrenceDate: string | null = null): Prisma.CommentWhereInput {
  return { [COMMENT_TARGETS[target]]: id, ...(onOccurrences(target) ? { occurrenceDate: parseOptionalDay(occurrenceDate) } : {}) };
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

/** Kinds of items whose comments are on their occurrences. */
export type OccurrenceTarget = 'ROUTINE' | 'EVENT';

/**
 * Places the comments of routines or events written before they were on occurrences (`occurrenceDate`
 * empty on a routine, or on a recurring event; a one-off event's are its own), the first time they are read, and saves
 * them there.
 * @param {OccurrenceTarget} target Kind of items.
 * @param {readonly string[]} ids Items read.
 * @param {(itemIds: string[]) => Promise<(itemId: string, createdAt: Date) => string | null>} placer Occurrence of a comment
 * of an item, from the day it was written (null: left, a one-off event).
 * @returns {Promise<void>}
 */
export async function placeLegacyComments(
  target: OccurrenceTarget,
  ids: readonly string[],
  placer: (itemIds: string[]) => Promise<(itemId: string, createdAt: Date) => string | null>,
): Promise<void> {
  const column = COMMENT_TARGETS[target];
  if (!ids.length) return;
  const legacy = await prisma.comment.findMany({ where: { [column]: { in: [...new Set(ids)] }, occurrenceDate: null }, select: { id: true, createdAt: true, routineId: true, eventId: true } });
  if (!legacy.length) return;
  const place = await placer([...new Set(legacy.map((comment) => comment[column]!))]);
  const byDay = new Map<string, string[]>();
  for (const comment of legacy) {
    const day = place(comment[column]!, comment.createdAt);
    if (day) byDay.set(day, [...(byDay.get(day) ?? []), comment.id]);
  }
  for (const [day, commentIds] of byDay) await prisma.comment.updateMany({ where: { id: { in: commentIds }, occurrenceDate: null }, data: { occurrenceDate: parseOptionalDay(day) } });
}

/** Occurrences about to be deleted: one (`on`), from one on (`from`), or every one (neither). */
export interface GoneCommentOccurrences {
  id: string;
  on?: string;
  from?: string;
}

/** Items and occurrences about to be deleted, whose comments go with them. */
export interface GoneComments {
  routineIds?: readonly string[];
  routines?: readonly GoneCommentOccurrences[];
  events?: readonly GoneCommentOccurrences[];
}

/**
 * Filter of the comments a deletion takes: those of the routines deleted, and of the occurrences of routines and events
 * deleted.
 * @param {GoneComments} gone Items and occurrences deleted.
 * @returns {Prisma.CommentWhereInput[]} Filters (none: nothing).
 */
function goneCommentsWhere(gone: GoneComments): Prisma.CommentWhereInput[] {
  const occurrences = (column: 'routineId' | 'eventId', items: readonly GoneCommentOccurrences[] = []) =>
    items.map((item): Prisma.CommentWhereInput => ({
      [column]: item.id,
      ...(item.on ? { occurrenceDate: parseOptionalDay(item.on) } : item.from ? { occurrenceDate: { gte: parseOptionalDay(item.from) } } : {}),
    }));
  return [...(gone.routineIds?.length ? [{ routineId: { in: [...gone.routineIds] } }] : []), ...occurrences('routineId', gone.routines), ...occurrences('eventId', gone.events)];
}

/**
 * Number of comments a deletion takes with it, for its confirmation.
 * @param {GoneComments} gone Items and occurrences deleted.
 * @returns {Promise<number>} Comments.
 */
export async function commentsLostOnDelete(gone: GoneComments): Promise<number> {
  const any = goneCommentsWhere(gone);
  return any.length ? prisma.comment.count({ where: { OR: any } }) : 0;
}

/** A comment deleted with its occurrence, as « Annuler » gives it back: its text and its dates. */
export interface CommentSnapshot {
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Deletes the comments of occurrences deleted (those of whole items go with them, `onDelete: Cascade`).
 * @param {GoneComments} gone Occurrences deleted.
 * @returns {Promise<CommentSnapshot[]>} Comments deleted, oldest first (for an undo).
 */
export async function deleteGoneComments(gone: GoneComments): Promise<CommentSnapshot[]> {
  const any = goneCommentsWhere(gone);
  if (!any.length) return [];
  const deleted = await prisma.comment.findMany({ where: { OR: any }, select: { body: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' } });
  await prisma.comment.deleteMany({ where: { OR: any } });
  return deleted;
}

/**
 * Gives back the comments of an occurrence deleted then restored (« Annuler »): on that occurrence, with their text
 * (checked again) and dates.
 * @param {OccurrenceTarget} target Kind of item.
 * @param {string} id Item.
 * @param {string} occurrenceDate Occurrence restored (YYYY-MM-DD).
 * @param {readonly CommentSnapshot[]} comments Comments deleted with it.
 * @returns {Promise<void>}
 */
export async function restoreComments(target: OccurrenceTarget, id: string, occurrenceDate: string, comments: readonly CommentSnapshot[]): Promise<void> {
  if (!comments.length) return;
  const day = parseOptionalDay(parseField('occurrenceDate', daySchema(), occurrenceDate));
  await prisma.comment.createMany({
    data: comments.map((comment) => ({ body: commentBody(comment.body), createdAt: comment.createdAt, updatedAt: comment.updatedAt, [COMMENT_TARGETS[target]]: id, occurrenceDate: day })),
  });
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
 * Number of comments of items of a kind; for routines and events, of occurrences, named by their key (`occurrenceKey`:
 * « id|YYYY-MM-DD », the id alone for a one-off event).
 * @param {CommentTarget} target Kind of items.
 * @param {string[]} ids Items (occurrence keys for routines and events).
 * @returns {Promise<{ id: string, count: number }[]>} Counts (every item asked, 0 included).
 */
export async function commentCounts(target: CommentTarget, ids: string[]): Promise<{ id: string; count: number }[]> {
  const column = COMMENT_TARGETS[target];
  const dated = onOccurrences(target);
  const items = [...new Set(ids.map((id) => (dated ? readOccurrenceKey(id).id : id)))];
  const groups = items.length
    ? await prisma.comment.groupBy({ by: dated ? [column, 'occurrenceDate'] : [column], where: { [column]: { in: items } }, _count: { _all: true } })
    : [];
  const keyOf = (group: Record<string, unknown>) => (dated ? occurrenceKey(group[column] as string, formatOptionalDay(group.occurrenceDate as Date | null)) : (group[column] as string));
  const counts = new Map(groups.map((group) => [keyOf(group as Record<string, unknown>), group._count._all]));
  return [...new Set(ids)].map((id) => ({ id, count: counts.get(id) ?? 0 }));
}

/**
 * Comments an item (not an archived one); a routine or a recurring event on one of its occurrences.
 * @param {CommentTarget} target Kind of item.
 * @param {string} id Item id (Message-ID for a mail).
 * @param {string} body Markdown.
 * @param {string | null} [occurrenceDate] Occurrence (YYYY-MM-DD): required for a routine and a recurring event. Optional.
 * @returns {Promise<Comment>} Comment.
 */
export async function addComment(target: CommentTarget, id: string, body: string, occurrenceDate: string | null = null): Promise<Comment> {
  const text = commentBody(body);
  const occurrence = await assertTarget(target, id, occurrenceDate ?? null);
  return prisma.comment.create({ data: { body: text, [COMMENT_TARGETS[target]]: id, occurrenceDate: occurrence } });
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
