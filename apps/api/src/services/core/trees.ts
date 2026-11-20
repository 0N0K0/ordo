import { modelDelegate } from './delegate';
import { ancestorsOf, isUnderOrSelf, lineageOf, mapById, subtreeOf } from '@ordo/shared';
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
  deleteMany(args: { where: { id: { in: string[] } } }): Prisma.PrismaPromise<unknown>;
  findUnique(args: { where: { id: string }; select: { id: true; parentId: true } }): Promise<{ id: string; parentId: string | null } | null>;
}

/**
 * Delegate of a tree model (scoped to the current workspace, as every model).
 * @param {OrderedModel} model Model.
 * @returns {TreeDelegate} Delegate.
 */
const delegate = (model: OrderedModel) => modelDelegate<TreeDelegate>(model);

/**
 * Checks the parent of an item of a tree: it exists, and is not the item itself nor one of its descendants.
 * @param {OrderedModel} model Model.
 * @param {string | null | undefined} parentId Parent chosen (none: nothing to check).
 * @param {string | null | undefined} id Item placed (none: a new one).
 * @param {{ missing: string, loop: string, field?: string }} messages Name of the missing parent (« Catégorie parente »), message of a loop, field of the error (default « parentId »).
 * @returns {Promise<void>}
 */
export async function assertTreeParent(
  model: OrderedModel,
  parentId: string | null | undefined,
  id: string | null | undefined,
  messages: { missing: string; loop: string; field?: string },
): Promise<void> {
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

/**
 * Topmost items of a selection: a selected item under another selected one moves or goes with it.
 * @param {OrderedModel} model Model.
 * @param {readonly string[]} ids Selected items.
 * @returns {Promise<string[]>} Those without a selected ancestor, in the order given.
 */
export async function topmostIds(model: OrderedModel, ids: readonly string[]): Promise<string[]> {
  const selected = new Set(ids);
  const byId = mapById(await delegate(model).findMany({ select: { id: true, parentId: true } }));
  // eslint-disable-next-line no-restricted-syntax -- topmostIds itself.
  return ids.filter((id) => !ancestorsOf(byId, id).some((parent) => selected.has(parent.id)));
}

/**
 * Items a deletion of tree items takes (`deleteTreeItems`): those given, with their whole sub-trees or not.
 * @param {OrderedModel} model Model.
 * @param {readonly string[]} ids Items.
 * @param {boolean} withSubtree Their sub-trees are deleted too.
 * @returns {Promise<string[]>} Ids deleted.
 */
export async function deletedTreeIds(model: OrderedModel, ids: readonly string[], withSubtree: boolean): Promise<string[]> {
  if (!withSubtree || !ids.length) return [...new Set(ids)];
  const items = await delegate(model).findMany({ select: { id: true, parentId: true } });
  return [...new Set(ids.flatMap((id) => [...subtreeOf(items, id)]))];
}

/**
 * Deletes items of a tree (tasks, routines): with their whole sub-tree, or alone, their children going up a level.
 * Ids missing are skipped; selected items moved up by the deletion of their parent are deleted too.
 * @param {OrderedModel} model Model.
 * @param {readonly string[]} ids Items.
 * @param {boolean} withSubtree Their sub-trees are deleted too (else moved up a level).
 * @param {(ids: string[]) => Promise<void>} [before] Run before each deletion, with the ids about to go (links to forget…). Optional.
 * @returns {Promise<void>}
 */
export async function deleteTreeItems(model: OrderedModel, ids: readonly string[], withSubtree: boolean, before?: (ids: string[]) => Promise<void>): Promise<void> {
  const unique = [...new Set(ids)];
  for (const id of await topmostIds(model, unique)) {
    const item = await delegate(model).findUnique({ where: { id }, select: { id: true, parentId: true } });
    if (!item) continue;
    const gone = withSubtree ? await subtreeIds(model, id) : [id];
    await before?.(gone);
    if (withSubtree) await delegate(model).deleteMany({ where: { id: { in: gone } } });
    else await deleteTreeNode(model, item);
  }
  // Selected items moved up by the deletion of their parent are still selected: deleted as well.
  if (!withSubtree && unique.length) {
    await before?.(unique);
    await delegate(model).deleteMany({ where: { id: { in: unique } } });
  }
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
 * @returns {object} Tree service: `create`, `update`, `move` and `remove`, taking inputs of type `I`.
 */
export function treeListService<T extends TreeNode, D extends { parentId?: string | null }, I = unknown>(model: TreeListModel, messages: TreeListMessages, hooks: TreeListHooks<T, D>) {
  /**
   * Delegate of the model (scoped to the current workspace, as every model).
   * @returns {TreeListDelegate<T>} Delegate.
   */
  const items = () => modelDelegate<TreeListDelegate<T>>(model);

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
    await assertNotArchived(model, parentId, { keep: current?.parentId, field: 'parentId' });
    return data;
  };

  /**
   * Updates an item; under another parent, it goes last.
   * @param {string} id Item id.
   * @param {I} input Item.
   * @returns {Promise<T>} Item.
   */
  const update = async (id: string, input: I): Promise<T> => {
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
     * @param {I} input Item.
     * @returns {Promise<T>} Item.
     */
    async create(input: I): Promise<T> {
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
      if (parent !== current.parentId) await update(id, hooks.moveInput(current, parent) as I);
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
