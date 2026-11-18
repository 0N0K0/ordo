import { prisma, unscopedPrisma } from '../../db';
import type { Prisma } from '../../generated/prisma/client';

/** Manual order of a list: by position, then by creation (two items at the same position). */
export const BY_POSITION: { position?: 'asc'; createdAt?: 'asc' }[] = [{ position: 'asc' }, { createdAt: 'asc' }];

/**
 * Moves an id inside an ordered list.
 * @param {string[]} orderedIds Sibling ids in their current order (may contain `id`).
 * @param {string} id Id to move.
 * @param {number} index Target index in the resulting list.
 * @returns {string[]} New order.
 */
export function moveInOrder(orderedIds: string[], id: string, index: number): string[] {
  const others = orderedIds.filter((other) => other !== id);
  const target = Math.max(0, Math.min(index, others.length));
  return [...others.slice(0, target), id, ...others.slice(target)];
}

/**
 * Saves the new order of siblings after one of them moved: each sibling gets its index as position.
 * @param {string[]} orderedIds Sibling ids in their current order (may contain `id`).
 * @param {string} id Id moved.
 * @param {number} index Target index among the siblings.
 * @param {(id: string, position: number) => Prisma.PrismaPromise<unknown>} save Update of one sibling's position.
 * @returns {Promise<void>}
 */
export async function saveSiblingOrder(orderedIds: string[], id: string, index: number, save: (id: string, position: number) => Prisma.PrismaPromise<unknown>): Promise<void> {
  await prisma.$transaction(moveInOrder(orderedIds, id, index).map((siblingId, position) => save(siblingId, position)));
}

/** What the ordered models have in common (each delegate of Prisma has these). */
interface OrderedDelegate {
  findMany(args: { where?: object; orderBy: typeof BY_POSITION; select: { id: true } }): Promise<{ id: string }[]>;
  update(args: { where: { id: string }; data: { position: number } }): Prisma.PrismaPromise<unknown>;
  aggregate(args: { where?: object; _max: { position: true } }): Promise<{ _max: { position: number | null } }>;
}

/** Name of the delegate of a model with a manual order (`dashboard`, `taskView`…). */
export type OrderedModel = Uncapitalize<Prisma.ModelName>;

/** Client the positions are read and written with: the scoped client, a transaction, or the unscoped one (workspaces). */
export type OrderingClient = typeof prisma | typeof unscopedPrisma | Prisma.TransactionClient;

/**
 * Delegate of an ordered model (scoped to the current workspace, as every model, unless the client is not).
 * @param {OrderedModel} model Model.
 * @param {OrderingClient} [client] Client. Optional. Default = the scoped client.
 * @returns {OrderedDelegate} Delegate.
 */
const delegate = (model: OrderedModel, client: OrderingClient = prisma) => (client as unknown as Record<string, OrderedDelegate>)[model];

/**
 * Moves an item to an index among its siblings (the items matching `where`), all their positions saved at once.
 * @param {OrderedModel} model Model.
 * @param {string} id Item moved (one of the siblings).
 * @param {number} index Its new index.
 * @param {object} [where] Its siblings: its scope (its project, its dashboard…). Optional. Default = every item.
 * @param {Prisma.TransactionClient} [tx] Transaction to run in (the positions are then saved inside it). Optional. Default = a transaction of its own.
 * @returns {Promise<void>}
 */
export async function moveInList(model: OrderedModel, id: string, index: number, where: object = {}, tx?: Prisma.TransactionClient): Promise<void> {
  const siblings = await delegate(model, tx).findMany({ where, orderBy: BY_POSITION, select: { id: true } });
  const ids = siblings.map((item) => item.id);
  const save = (siblingId: string, position: number) => delegate(model, tx).update({ where: { id: siblingId }, data: { position } });
  if (!tx) return saveSiblingOrder(ids, id, index, save);
  for (const [position, siblingId] of moveInOrder(ids, id, index).entries()) await save(siblingId, position);
}

/**
 * Position of an item added at the end of a list.
 * @param {OrderedModel} model Model.
 * @param {object} [where] Its future siblings: its scope (its parent, its project…). Optional. Default = every item.
 * @param {OrderingClient} [client] Client to read with (a transaction, the unscoped client). Optional. Default = the scoped client.
 * @returns {Promise<number>} Position after the last one.
 */
export async function nextPositionIn(model: OrderedModel, where: object = {}, client?: OrderingClient): Promise<number> {
  const { _max } = await delegate(model, client).aggregate({ where, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}
