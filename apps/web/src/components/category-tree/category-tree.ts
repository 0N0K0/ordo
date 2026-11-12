/** Category of a tree (shopping, routines…): a name, an optional color and a parent. */
export interface TreeCategory {
  id: string;
  name: string;
  color?: string | null;
  parentId?: string | null;
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
 * Categories in tree order: each one followed by its sub-categories, by name.
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
    for (const category of [...(children.get(parent) ?? [])].sort((a, b) => collator.compare(a.name, b.name))) {
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
