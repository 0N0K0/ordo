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
