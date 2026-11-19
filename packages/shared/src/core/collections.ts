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

/**
 * How many items have each key (how many tasks use each status, each tag…).
 * @param {readonly T[]} items Items.
 * @param {(item: T) => string | readonly string[] | null | undefined} keysOf Key or keys of an item (none: not counted).
 * @returns {Map<string, number>} Count by key.
 */
export function countBy<T>(items: readonly T[], keysOf: (item: T) => string | readonly string[] | null | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const keys = keysOf(item);
    for (const key of typeof keys === 'string' ? [keys] : (keys ?? [])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * A list of ids with some added and some removed, each once (the same changes made to several items).
 * @param {readonly string[]} list Current ids.
 * @param {readonly string[]} [added] Ids added. Optional.
 * @param {readonly string[]} [removed] Ids removed. Optional.
 * @returns {string[]} New ids.
 */
export function changedList(list: readonly string[], added: readonly string[] = [], removed: readonly string[] = []): string[] {
  return [...new Set([...list.filter((id) => !removed.includes(id)), ...added])];
}

/**
 * Sum of a value over items.
 * @param {readonly T[]} items Items.
 * @param {(item: T, index: number) => number} valueOf Value of an item (and its index).
 * @returns {number} Sum (0 for no item).
 */
export function sumOf<T>(items: readonly T[], valueOf: (item: T, index: number) => number): number {
  let total = 0;
  for (const [index, item] of items.entries()) total += valueOf(item, index);
  return total;
}

/**
 * List with an item moved to an index, the others kept in their order; the index is bounded to the list.
 * @param {readonly T[]} others Items in their order, without the moved one.
 * @param {T} moved Item moved.
 * @param {number} index Its new index.
 * @returns {T[]} New order.
 */
export function movedTo<T>(others: readonly T[], moved: T, index: number): T[] {
  const target = Math.max(0, Math.min(index, others.length));
  // eslint-disable-next-line no-restricted-syntax -- movedTo itself.
  return [...others.slice(0, target), moved, ...others.slice(target)];
}

/**
 * Key of a map or a set made of several parts (« a|b »), the same everywhere: an empty part for none.
 * @param {readonly (string | number | null | undefined)[]} parts Parts of the key.
 * @returns {string} Key.
 */
export const joinedKey = (...parts: readonly (string | number | null | undefined)[]): string => parts.join('|');
