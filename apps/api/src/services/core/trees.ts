import { isUnderOrSelf, lineageOf, subtreeOf } from '@ordo/shared';
import { prisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';
import { fieldError, notFound, orNotFound } from '../../graphql/errors';
import { assertNotArchived, type ArchivableModel } from './archive';
import { moveInList, nextPositionIn, type OrderedModel } from './ordering';

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
 * Ids of an item of a tree and of all its descendants.
 * @param {OrderedModel} model Model.
 * @param {string} id Item.
 * @param {boolean} [withSelf] Whether the item itself is included. Optional. Default = true.
 * @returns {Promise<string[]>} Ids.
 */
export async function subtreeIds(model: OrderedModel, id: string, withSelf = true): Promise<string[]> {
  return [...subtreeOf(await delegate(model).findMany({ select: { id: true, parentId: true } }), id, withSelf)];
}

/**
 * Ids of an item of a tree and of its ancestors, the item first and its root last.
 * @param {OrderedModel} model Model.
 * @param {string | null | undefined} id Item (none: no id).
 * @returns {Promise<string[]>} Ids.
 */
export async function lineageIds(model: OrderedModel, id: string | null | undefined): Promise<string[]> {
  if (!id) return [];
  const items = await delegate(model).findMany({ select: { id: true, parentId: true } });
  return lineageOf(new Map(items.map((item) => [item.id, item])), id).map((item) => item.id);
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

/** Item of a tree as its service reads it. */
type TreeNode = { id: string; parentId: string | null };

/** What the CRUD of a tree model needs (each delegate of Prisma has these). */
interface TreeListDelegate<T> {
  findUnique(args: { where: { id: string }; include?: object }): Promise<T | null>;
  create(args: { data: Record<string, unknown> }): Promise<T>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<T>;
}

/** Models of a settings tree: an order, a parent, an archive date. */
export type TreeListModel = OrderedModel & ArchivableModel;

/** Messages of a tree service. */
export interface TreeListMessages {
  /** Name of a missing item (« Catégorie »). */
  notFound: string;
  /** Name of a missing parent (« Catégorie parente »). */
  missingParent: string;
  /** Message of an item placed under itself or one of its descendants. */
  loop: string;
}

/** What differs from one tree to another. */
export interface TreeListHooks<T extends TreeNode, D extends { parentId?: string | null }> {
  /** Validates an input (its schema, the checks of the model), knowing the item changed (none: a new one). */
  parse(input: unknown, current: T | null): Promise<D> | D;
  /** Input saving an item under another parent, all else kept (for a move). */
  moveInput(current: T, parentId: string | null): unknown;
  /** Relations loaded with the item changed (its base lists…). Optional. */
  include?: object;
  /** Prisma data of a new item. Optional. Default = the parsed input. */
  createData?(data: D): Record<string, unknown>;
  /** Prisma data of a changed item. Optional. Default = the parsed input. */
  updateData?(data: D): Record<string, unknown>;
  /** Saves a changed item, in place of a plain update (a cascade…). Optional. */
  save?(id: string, data: Record<string, unknown>, current: T, parsed: D): Promise<T>;
  /** Siblings scope of an item besides its parent (its direction…). Optional. */
  siblings?(current: T): object;
}

/**
 * CRUD of a settings tree, with the same rules everywhere: a parent exists and is not the item or one of its
 * descendants, nothing new goes under an archived parent, an archived item is not changed, an item goes last among
 * its siblings when created or put under another parent, and a deleted item's children go up a level.
 * @param {TreeListModel} model Model.
 * @param {TreeListMessages} messages Error messages.
 * @param {TreeListHooks<T, D>} hooks What differs from one tree to another.
 * @returns {object} Tree service: `create`, `update`, `move` and `remove`.
 */
export function treeListService<T extends TreeNode, D extends { parentId?: string | null }>(model: TreeListModel, messages: TreeListMessages, hooks: TreeListHooks<T, D>) {
  /**
   * Delegate of the model (scoped to the current workspace, as every model).
   * @returns {TreeListDelegate<T>} Delegate.
   */
  const items = () => (prisma as unknown as Record<string, TreeListDelegate<T>>)[model];

  /**
   * Loads an item (with the relations of the hooks), NOT_FOUND when missing.
   * @param {string} id Item id.
   * @returns {Promise<T>} Item.
   */
  const find = (id: string) => orNotFound(items().findUnique({ where: { id }, ...(hooks.include && { include: hooks.include }) }), messages.notFound);

  /**
   * Position after the last child of a parent.
   * @param {string | null} parentId Parent, null for the top level.
   * @returns {Promise<number>} Position.
   */
  const lastPosition = (parentId: string | null) => nextPositionIn(model, { parentId });

  /**
   * Validates an input and its parent.
   * @param {unknown} input Input.
   * @param {T | null} current Item changed, or null for a new one.
   * @returns {Promise<D>} Parsed input.
   */
  const parse = async (input: unknown, current: T | null): Promise<D> => {
    const data = await hooks.parse(input, current);
    const parentId = data.parentId ?? null;
    await assertTreeParent(model, parentId, current?.id, { missing: messages.missingParent, loop: messages.loop });
    // An archived item takes no new child (those already there stay).
    if (parentId !== (current?.parentId ?? null)) await assertNotArchived(model, parentId);
    return data;
  };

  /**
   * Updates an item; under another parent, it goes last.
   * @param {string} id Item id.
   * @param {unknown} input Item.
   * @returns {Promise<T>} Item.
   */
  const update = async (id: string, input: unknown): Promise<T> => {
    const current = await find(id);
    await assertNotArchived(model, id);
    const parsed = await parse(input, current);
    const parentId = parsed.parentId ?? null;
    const data = { ...(hooks.updateData ? hooks.updateData(parsed) : parsed), ...(parentId !== current.parentId && { position: await lastPosition(parentId) }) };
    return hooks.save ? hooks.save(id, data, current, parsed) : items().update({ where: { id }, data });
  };

  return {
    /**
     * Creates an item, last among its siblings.
     * @param {unknown} input Item.
     * @returns {Promise<T>} Item.
     */
    async create(input: unknown): Promise<T> {
      const parsed = await parse(input, null);
      const data = hooks.createData ? hooks.createData(parsed) : parsed;
      return items().create({ data: { ...data, position: await lastPosition(parsed.parentId ?? null) } });
    },

    update,

    /**
     * Moves an item under another parent (or to the top level), then at an index among its siblings.
     * @param {string} id Item id.
     * @param {string | null | undefined} parentId New parent, null for the top level; undefined: unchanged.
     * @param {number | null} [index] Index among its (new) siblings; last when omitted. Optional.
     * @returns {Promise<void>}
     */
    async move(id: string, parentId: string | null | undefined, index?: number | null): Promise<void> {
      const current = await find(id);
      await assertNotArchived(model, id);
      const parent = parentId === undefined ? current.parentId : parentId;
      if (parent !== current.parentId) await update(id, hooks.moveInput(current, parent));
      if (index === null || index === undefined) return;
      await moveInList(model, id, index, { ...hooks.siblings?.(current), parentId: parent });
    },

    /**
     * Deletes an item: its children go up a level (under its parent).
     * @param {string} id Item id.
     * @returns {Promise<void>}
     */
    async remove(id: string): Promise<void> {
      await deleteTreeNode(model, await find(id));
    },
  };
}
