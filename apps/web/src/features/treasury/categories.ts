import { treeOptions, type TreeOption } from '../../components/tree-select/tree-select';
import type { TreasuryDirection } from '@ordo/shared';
import type { TreasuryCategory } from './api';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Category placed in its tree: depth and full path. */
export interface PlacedCategory {
  category: TreasuryCategory;
  /** 0 for a top-level category. */
  depth: number;
  /** "Parent › Enfant". */
  path: string;
}

/**
 * Categories of a direction in tree order (each category followed by its sub-categories, in their manual order then by name).
 * @param {TreasuryCategory[]} categories All categories.
 * @param {TreasuryDirection} [direction] Direction kept; both when omitted. Optional.
 * @returns {PlacedCategory[]} Placed categories.
 */
export function categoryTree(categories: readonly TreasuryCategory[], direction?: TreasuryDirection): PlacedCategory[] {
  const kept = categories.filter((category) => !direction || category.direction === direction);
  const ids = new Set(kept.map((category) => category.id));
  const children = new Map<string | null, TreasuryCategory[]>();
  for (const category of kept) {
    // A parent of another direction (should not happen) or missing: shown at the top level.
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), category]);
  }
  const placed: PlacedCategory[] = [];
  /**
   * Adds the sub-categories of a parent, recursively.
   * @param {string | null} parent Parent id, null for the top level.
   * @param {number} depth Depth of the children.
   * @param {string} prefix Path of the parent.
   * @returns {void}
   */
  const visit = (parent: string | null, depth: number, prefix: string) => {
    for (const category of [...(children.get(parent) ?? [])].sort((a, b) => a.position - b.position || collator.compare(a.name, b.name))) {
      const path = prefix ? `${prefix} › ${category.name}` : category.name;
      placed.push({ category, depth, path });
      visit(category.id, depth + 1, path);
    }
  };
  visit(null, 0, '');
  return placed;
}

/**
 * Select options of the categories of a direction, in tree order, each name indented under its parent (treeSelectProps).
 * @param {TreasuryCategory[]} categories All categories.
 * @param {TreasuryDirection} direction Direction.
 * @param {string} [exclude] Category left out with its sub-categories (a category cannot be its own parent). Optional.
 * @returns {TreeOption[]} Options.
 */
export function categoryOptions(categories: readonly TreasuryCategory[], direction: TreasuryDirection, exclude?: string): TreeOption[] {
  return treeOptions(
    categoryTree(categories, direction).map(({ category }) => ({ id: category.id, parentId: category.parentId ?? null, label: category.name, color: category.color })),
    undefined,
    new Set(exclude ? [exclude] : []),
  );
}

/**
 * Full path of each category, by id.
 * @param {TreasuryCategory[]} categories All categories.
 * @returns {Map<string, string>} "Parent › Enfant", by id.
 */
export function categoryPaths(categories: readonly TreasuryCategory[]): Map<string, string> {
  return new Map(categoryTree(categories).map((item) => [item.category.id, item.path]));
}

/**
 * Names of a category and of its parents, from the category up.
 * @param {Map<string, TreasuryCategory>} byId Categories by id.
 * @param {string | null} id Category id.
 * @returns {string[]} Names.
 */
export function categoryLineage(byId: ReadonlyMap<string, TreasuryCategory>, id: string | null): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (let current = id ? byId.get(id) : undefined; current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
    seen.add(current.id);
    names.push(current.name);
  }
  return names;
}
