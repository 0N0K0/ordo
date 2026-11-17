import { lineageOf, LEVEL } from '@ordo/shared';
import type { TreasuryDirection } from '@ordo/shared';
import { categoryOptions as treeCategoryOptions, categoryTree as treeCategoryTree, type PlacedCategory } from '../../../components/tree/category-tree';
import { type TreeOption } from '../../../components/tree/tree-select';
import type { TreasuryCategory } from '../api';

export { categoryPaths } from '../../../components/tree/category-tree';

/**
 * Categories of a direction in tree order (each category followed by its sub-categories, in their manual order then by
 * name), as the generic tree.
 * @param {readonly TreasuryCategory[]} categories All categories.
 * @param {TreasuryDirection} [direction] Direction kept; both when omitted. Optional.
 * @returns {PlacedCategory<TreasuryCategory>[]} Placed categories.
 */
export function categoryTree(categories: readonly TreasuryCategory[], direction?: TreasuryDirection): PlacedCategory<TreasuryCategory>[] {
  return treeCategoryTree(categories.filter((category) => !direction || category.direction === direction));
}

/**
 * Select options of the categories of a direction, in tree order (treeSelectProps), as the generic tree.
 * @param {readonly TreasuryCategory[]} categories All categories.
 * @param {TreasuryDirection} direction Direction.
 * @param {string} [exclude] Category left out with its sub-categories (a category cannot be its own parent). Optional.
 * @returns {TreeOption[]} Options.
 */
export function categoryOptions(categories: readonly TreasuryCategory[], direction: TreasuryDirection, exclude?: string): TreeOption[] {
  return treeCategoryOptions(
    categories.filter((category) => category.direction === direction),
    exclude,
  );
}

/**
 * Full paths of a category and of its parents, from the category up (« A › B », « A »).
 * @param {Map<string, TreasuryCategory>} byId Categories by id.
 * @param {string | null} id Category id.
 * @returns {string[]} Paths.
 */
export function categoryPathLineage(byId: ReadonlyMap<string, TreasuryCategory>, id: string | null): string[] {
  const names = categoryLineage(byId, id).reverse();
  return names.map((_, index) => names.slice(0, index + 1).join(LEVEL)).reverse();
}

/**
 * Names of a category and of its parents, from the category up.
 * @param {Map<string, TreasuryCategory>} byId Categories by id.
 * @param {string | null} id Category id.
 * @returns {string[]} Names.
 */
export function categoryLineage(byId: ReadonlyMap<string, TreasuryCategory>, id: string | null): string[] {
  return lineageOf(byId, id).map((category) => category.name);
}
