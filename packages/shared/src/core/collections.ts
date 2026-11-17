/**
 * Items by their id.
 * @param {readonly T[]} items Items.
 * @returns {Map<string, T>} Items by id (the last one wins for a repeated id).
 */
export function mapById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Items grouped by a key, in their order, the groups in the order of their first item.
 * @param {readonly T[]} items Items.
 * @param {(item: T) => K} keyOf Key of an item.
 * @returns {Map<K, T[]>} Items by key.
 */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Comparison of two items by their manual order.
 * @param {{ position: number }} a Item.
 * @param {{ position: number }} b Item.
 * @returns {number} Comparison.
 */
export const byPosition = (a: { position: number }, b: { position: number }): number => a.position - b.position;
