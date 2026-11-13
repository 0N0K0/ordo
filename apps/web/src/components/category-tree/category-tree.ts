/** Category of a tree (shopping, routines…): a name, an optional color and a parent. */
export interface TreeCategory {
  id: string;
  name: string;
  color?: string | null;
  parentId?: string | null;
  /** Manual order among its siblings (by name when equal). Optional. */
  position?: number;
}

/** Category placed in its tree. */
export interface PlacedCategory<C extends TreeCategory> {
  category: C;
  /** 0 for a top-level category. */
  depth: number;
  /** "Parent › Enfant". */
  path: string;
  /** Its color, or the one of its closest parent with one. */
  color: string | null;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Order of siblings: manual position, then name.
 * @param {TreeCategory} a Category.
 * @param {TreeCategory} b Category.
 * @returns {number} Comparison.
 */
export const bySiblingOrder = (a: TreeCategory, b: TreeCategory) => (a.position ?? 0) - (b.position ?? 0) || collator.compare(a.name, b.name);

/**
 * Categories in tree order: each one followed by its sub-categories, in their manual order (then by name).
 * @param {readonly C[]} categories All categories.
 * @returns {PlacedCategory<C>[]} Placed categories.
 */
export function categoryTree<C extends TreeCategory>(categories: readonly C[]): PlacedCategory<C>[] {
  const ids = new Set(categories.map((category) => category.id));
  const children = new Map<string | null, C[]>();
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), category]);
  }
  const placed: PlacedCategory<C>[] = [];
  /**
   * Adds the sub-categories of a parent, recursively.
   * @param {string | null} parent Parent id, null for the top level.
   * @param {number} depth Depth of the children.
   * @param {string} prefix Path of the parent.
   * @param {string | null} inherited Color of the parent.
   * @returns {void}
   */
  const visit = (parent: string | null, depth: number, prefix: string, inherited: string | null) => {
    for (const category of [...(children.get(parent) ?? [])].sort(bySiblingOrder)) {
      const path = prefix ? `${prefix} › ${category.name}` : category.name;
      const color = category.color ?? inherited;
      placed.push({ category, depth, path, color });
      visit(category.id, depth + 1, path, color);
    }
  };
  visit(null, 0, '', null);
  return placed;
}

/**
 * Select options of the categories, indented as their tree.
 * @param {readonly TreeCategory[]} categories All categories.
 * @param {string} [exclude] Category left out with its sub-categories (the one edited). Optional.
 * @returns {{ value: string, label: string }[]} Options.
 */
export function categoryOptions(categories: readonly TreeCategory[], exclude?: string): { value: string; label: string }[] {
  const tree = categoryTree(categories);
  const excluded = exclude ? tree.find((item) => item.category.id === exclude) : undefined;
  return tree
    .filter((item) => !excluded || (item.path !== excluded.path && !item.path.startsWith(`${excluded.path} › `)))
    .map((item) => ({ value: item.category.id, label: `${' '.repeat(item.depth)}${item.category.name}` }));
}

/** Where a dragged category is dropped on another one: before it, after it or under it (last). */
export type TreePlace = 'BEFORE' | 'AFTER' | 'INSIDE';

/**
 * Parent and index among its new siblings of a category dropped on another one; null when the move is not allowed
 * (on itself or one of its sub-categories) or changes nothing.
 * @param {readonly TreeCategory[]} categories All categories (of the tree).
 * @param {string} id Dragged category.
 * @param {string} targetId Category dropped on.
 * @param {TreePlace} place Where.
 * @returns {{ parentId: string | null, index: number } | null} Destination.
 */
export function treeDestination(categories: readonly TreeCategory[], id: string, targetId: string, place: TreePlace): { parentId: string | null; index: number } | null {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const moved = byId.get(id);
  const target = byId.get(targetId);
  if (!moved || !target) return null;
  for (let current: TreeCategory | undefined = target; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
    if (current.id === id) return null;
  }
  const parentOf = (category: TreeCategory) => (category.parentId && byId.has(category.parentId) ? category.parentId : null);
  const parentId = place === 'INSIDE' ? target.id : parentOf(target);
  const siblings = categories.filter((category) => parentOf(category) === parentId).sort(bySiblingOrder);
  const others = siblings.filter((category) => category.id !== id);
  const at = others.findIndex((category) => category.id === targetId);
  const index = place === 'INSIDE' ? others.length : place === 'BEFORE' ? at : at + 1;
  if (parentId === parentOf(moved) && siblings.findIndex((category) => category.id === id) === index) return null;
  return { parentId, index };
}

/**
 * Categories after a move (for the optimistic update of a cache): the moved one under its new parent, its new
 * siblings renumbered.
 * @param {readonly C[]} categories All categories.
 * @param {string} id Moved category.
 * @param {string | null} parentId New parent.
 * @param {number} [index] Index among its new siblings; last when omitted. Optional.
 * @returns {C[]} Categories.
 */
export function moveInTree<C extends TreeCategory>(categories: readonly C[], id: string, parentId: string | null, index?: number | null): C[] {
  const moved = categories.find((category) => category.id === id);
  if (!moved) return [...categories];
  const siblings = categories.filter((category) => category.id !== id && (category.parentId ?? null) === parentId).sort(bySiblingOrder);
  siblings.splice(index === null || index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length)), 0, moved);
  const positions = new Map(siblings.map((category, position) => [category.id, position]));
  return categories.map((category) => {
    const position = positions.get(category.id);
    if (position === undefined) return category;
    return { ...category, position, ...(category.id === id && { parentId }) };
  });
}
