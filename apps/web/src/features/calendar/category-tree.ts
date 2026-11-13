import { treeOptions, type TreeOption } from '../../components/tree-select/tree-select';
import type { CalendarCategory } from './api';

export interface CategoryNode {
  category: CalendarCategory;
  depth: number;
}

/**
 * Categories in tree order (each followed by its sub-categories), with their depth.
 * @param {CalendarCategory[]} categories Categories.
 * @returns {CategoryNode[]} Ordered nodes.
 */
export function flattenCategories(categories: CalendarCategory[]): CategoryNode[] {
  const children = new Map<string | null, CalendarCategory[]>();
  for (const category of [...categories].sort((a, b) => a.position - b.position)) {
    children.set(category.parentId ?? null, [...(children.get(category.parentId ?? null) ?? []), category]);
  }
  const result: CategoryNode[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const category of children.get(parentId) ?? []) {
      result.push({ category, depth });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);
  return result;
}

/**
 * A category and all its sub-categories.
 * @param {CalendarCategory[]} categories Categories.
 * @param {string} id Category.
 * @returns {Set<string>} Ids.
 */
export function categorySubtree(categories: CalendarCategory[], id: string): Set<string> {
  const result = new Set([id]);
  for (let added = true; added; ) {
    added = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        added = true;
      }
    }
  }
  return result;
}

/**
 * Select options of the categories, in tree order, each name indented under its parent (treeSelectProps).
 * @param {CalendarCategory[]} categories Categories.
 * @param {Set<string>} [excluded] Categories left out. Optional.
 * @returns {TreeOption[]} Options.
 */
export function categoryOptions(categories: CalendarCategory[], excluded: Set<string> = new Set()): TreeOption[] {
  return treeOptions(
    flattenCategories(categories).map(({ category }) => ({ id: category.id, parentId: category.parentId ?? null, label: category.name, color: category.color })),
    undefined,
    excluded,
  );
}
