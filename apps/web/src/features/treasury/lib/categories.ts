import { withArchived, type ColumnChoice } from '../../../components/data-table/table/data-table';
import { lineageOf, LEVEL } from '@ordo/shared';
import type { TreasuryDirection } from '@ordo/shared';
import { categoryOptions as treeCategoryOptions, categoryTree as treeCategoryTree, type PlacedCategory } from '../../../components/tree/category-tree';
import { type TreeOption } from '../../../components/tree/tree-select';
import type { TreasuryCategory } from '../api';
import { unarchived } from '../../../lib/archive';

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
 * Select options of the categories of a direction, in tree order (treeSelectProps), as the generic tree. Archived
 * categories are not offered (greyed out above sub-categories offered), except the current value(s).
 * @param {readonly TreasuryCategory[]} categories All categories.
 * @param {TreasuryDirection} direction Direction.
 * @param {string} [exclude] Category left out with its sub-categories (a category cannot be its own parent). Optional.
 * @param {string | readonly (string | null | undefined)[] | null} [keep] Current value(s), offered even when archived. Optional.
 * @returns {TreeOption[]} Options.
 */
export function categoryOptions(categories: readonly TreasuryCategory[], direction: TreasuryDirection, exclude?: string, keep?: string | readonly (string | null | undefined)[] | null): TreeOption[] {
  const offered = new Set(unarchived(categories, keep).map((category) => category.id));
  return treeCategoryOptions(
    categories.filter((category) => category.direction === direction),
    exclude,
    (id) => offered.has(id),
  );
}

/**
 * Choices of a column filter on the categories, spending then income, in tree order: all of them (archived ones keep
 * their labels), the archived flagged so the filter offers them only while they are in it.
 * @param {readonly TreasuryCategory[]} categories All categories.
 * @returns {ColumnChoice[]} Choices.
 */
export function categoryChoices(categories: readonly TreasuryCategory[]): ColumnChoice[] {
  const all = categories.map((category) => category.id);
  return withArchived([...categoryOptions(categories, 'OUT', undefined, all), ...categoryOptions(categories, 'IN', undefined, all)], categories);
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
  return lineageOf(byId, id).map((category) => category.label);
}
