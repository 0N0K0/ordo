import { prisma } from '../db';
import type { Prisma } from '../generated/prisma/client';

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
