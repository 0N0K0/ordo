import { isUnderOrSelf } from '@ordo/shared';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { fieldError, notFound } from '../../graphql/errors';
import type { OrderedModel } from './ordering';

/** What the models of a tree have in common (each delegate of Prisma has these). */
interface TreeDelegate {
  findMany(args: { select: { id: true; parentId: true } }): Promise<{ id: string; parentId: string | null }[]>;
  updateMany(args: { where: { parentId: string }; data: { parentId: string | null } }): Prisma.PrismaPromise<unknown>;
  delete(args: { where: { id: string } }): Prisma.PrismaPromise<unknown>;
}

/**
 * Delegate of a tree model (scoped to the current workspace, as every model).
 * @param {OrderedModel} model Model.
 * @returns {TreeDelegate} Delegate.
 */
const delegate = (model: OrderedModel) => (prisma as unknown as Record<string, TreeDelegate>)[model];

/**
 * Checks the parent of an item of a tree: it exists, and is not the item itself nor one of its descendants.
 * @param {OrderedModel} model Model.
 * @param {string | null | undefined} parentId Parent chosen (none: nothing to check).
 * @param {string | null | undefined} id Item placed (none: a new one).
 * @param {{ missing: string, loop: string, field?: string }} messages Name of the missing parent (« Catégorie parente »), message of a loop, field of the error (default « parentId »).
 * @returns {Promise<void>}
 */
export async function assertTreeParent(model: OrderedModel, parentId: string | null | undefined, id: string | null | undefined, messages: { missing: string; loop: string; field?: string }): Promise<void> {
  if (!parentId) return;
  const parentOf = new Map((await delegate(model).findMany({ select: { id: true, parentId: true } })).map((item) => [item.id, item.parentId]));
  if (!parentOf.has(parentId)) throw notFound(messages.missing);
  if (id && isUnderOrSelf(parentOf, parentId, id)) throw fieldError(messages.field ?? 'parentId', messages.loop);
}

/**
 * Deletes an item of a tree, its children going up a level (under its parent), at once.
 * @param {OrderedModel} model Model.
 * @param {{ id: string, parentId: string | null }} item Item.
 * @returns {Promise<void>}
 */
export async function deleteTreeNode(model: OrderedModel, item: { id: string; parentId: string | null }): Promise<void> {
  await prisma.$transaction([delegate(model).updateMany({ where: { parentId: item.id }, data: { parentId: item.parentId } }), delegate(model).delete({ where: { id: item.id } })]);
}
