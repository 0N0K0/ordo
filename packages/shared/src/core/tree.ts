/** Separator of the levels of a path (« Maison › Cuisine »). */
export const LEVEL = ' › ';

/** Item of a tree: its id and its parent (none, or unknown: the top level). */
export interface TreeItem {
  id: string;
  parentId?: string | null;
}

/**
 * An item and everything under it, at any depth (cycles stop).
 * @param {readonly TreeItem[]} items Every item of the tree.
 * @param {string} id Item.
 * @param {boolean} [withSelf] The item itself among them. Optional. Default = true.
 * @returns {Set<string>} Ids.
 */
export function subtreeOf(items: readonly TreeItem[], id: string, withSelf = true): Set<string> {
  const children = new Map<string, string[]>();
  for (const item of items) if (item.parentId) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item.id]);
  const result = new Set<string>([id]);
  for (const queue = [id]; queue.length;) {
    for (const child of children.get(queue.shift()!) ?? []) {
      if (result.has(child)) continue;
      result.add(child);
      queue.push(child);
    }
  }
  if (!withSelf) result.delete(id);
  return result;
}

/**
 * An item, then its parent, its grand-parent… up to the top (cycles stop).
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @param {string | null | undefined} id Item.
 * @returns {T[]} The item and its ancestors, closest first.
 */
export function lineageOf<T extends TreeItem>(byId: ReadonlyMap<string, T>, id: string | null | undefined): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  // eslint-disable-next-line no-restricted-syntax -- lineageOf itself.
  for (let current = id ? byId.get(id) : undefined; current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
    seen.add(current.id);
    result.push(current);
  }
  return result;
}

/**
 * Parents of an item, closest first.
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @param {string | null | undefined} id Item.
 * @returns {T[]} Ancestors.
 */
export function ancestorsOf<T extends TreeItem>(byId: ReadonlyMap<string, T>, id: string | null | undefined): T[] {
  return lineageOf(byId, id).slice(1);
}

/**
 * Full path of an item, from the top down to it: « Maison › Étage › Chambre ».
 * @param {ReadonlyMap<string, T>} byId Items by id.
 * @param {string | null | undefined} id Item.
 * @param {(item: T) => string} label Name of an item.
 * @returns {string} Path, empty for no item.
 */
export function pathOf<T extends TreeItem>(byId: ReadonlyMap<string, T>, id: string | null | undefined, label: (item: T) => string): string {
  return lineageOf(byId, id).reverse().map(label).join(LEVEL);
}

/**
 * Children of each parent, in the order of the items; an item whose parent is missing comes at the top level (null).
 * @param {readonly T[]} items Every item of the tree.
 * @returns {Map<string | null, T[]>} Children by parent.
 */
export function childrenByParent<T extends TreeItem>(items: readonly T[]): Map<string | null, T[]> {
  const ids = new Set(items.map((item) => item.id));
  const children = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), item]);
  }
  return children;
}

/**
 * Whether a target is reached from some starts by following links (a blocking chain, dependencies…), cycles stopping.
 * @param {(id: string) => readonly string[]} next Ids an id links to.
 * @param {readonly string[]} starts Ids the walk starts from.
 * @param {string} target Id looked for.
 * @returns {boolean} Reached.
 */
export function reaches(next: (id: string) => readonly string[], starts: readonly string[], target: string): boolean {
  const seen = new Set<string>();
  for (const stack = [...starts]; stack.length;) {
    const current = stack.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...next(current));
  }
  return false;
}

/**
 * Whether an id is a start or one of its ancestors, following a parent map (cycles stop): moving `id` under `start`
 * would put it under itself.
 * @param {ReadonlyMap<string, string | null | undefined>} parentOf Parent of each id.
 * @param {string} start Id the walk starts from (the new parent).
 * @param {string} id Id looked for (the item moved).
 * @returns {boolean} Found.
 */
export function isUnderOrSelf(parentOf: ReadonlyMap<string, string | null | undefined>, start: string, id: string): boolean {
  const seen = new Set<string>();
  for (let current: string | null | undefined = start; current && !seen.has(current); current = parentOf.get(current)) {
    if (current === id) return true;
    seen.add(current);
  }
  return false;
}
