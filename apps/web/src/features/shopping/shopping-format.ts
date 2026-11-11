import { useTreasurySettings } from '../treasury/api';
import type { TaskContext } from '../tasks/use-task-context';
import type { ShoppingCategory, ShoppingStore } from './api';

const moneyFormat = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const quantityFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });

/**
 * Price as euros.
 * @param {number} value Amount.
 * @returns {string} Text.
 */
export const money = (value: number) => moneyFormat.format(value);

/**
 * Quantity and unit of a product or an item ("2 kg", "3 boîte"), empty without quantity nor unit.
 * @param {{ quantity: number | null, unit: string | null }} item Product or item.
 * @returns {string} Text.
 */
export const quantityText = ({ quantity, unit }: { quantity?: number | null; unit?: string | null }) => [quantity != null ? quantityFormat.format(quantity) : null, unit].filter(Boolean).join(' ');

/** Way products and items are grouped. */
export type ShoppingGrouping = 'category' | 'store';

export interface ShoppingGroup<T> {
  /** Category or store id, null for the items without one. */
  id: string | null;
  name: string;
  color: string | null;
  items: T[];
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Category placed in its tree. */
export interface PlacedShoppingCategory {
  category: ShoppingCategory;
  /** 0 for a top-level category. */
  depth: number;
  /** "Parent › Enfant". */
  path: string;
  /** Its color, or the one of its closest parent with one. */
  color: string | null;
}

/**
 * Categories in tree order: each one followed by its sub-categories, by name (as the treasury categories).
 * @param {readonly ShoppingCategory[]} categories All categories.
 * @returns {PlacedShoppingCategory[]} Placed categories.
 */
export function shoppingCategoryTree(categories: readonly ShoppingCategory[]): PlacedShoppingCategory[] {
  const ids = new Set(categories.map((category) => category.id));
  const children = new Map<string | null, ShoppingCategory[]>();
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), category]);
  }
  const placed: PlacedShoppingCategory[] = [];
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
 * Select options of the categories, sub-categories indented under their parent.
 * @param {readonly ShoppingCategory[]} categories All categories.
 * @param {string} [exclude] Category left out with its sub-categories (a category cannot be its own parent). Optional.
 * @returns {{ value: string, label: string }[]} Options.
 */
export function shoppingCategoryOptions(categories: readonly ShoppingCategory[], exclude?: string): { value: string; label: string }[] {
  const tree = shoppingCategoryTree(categories);
  const excluded = exclude ? tree.find((item) => item.category.id === exclude) : undefined;
  return tree
    .filter((item) => !excluded || (item.path !== excluded.path && !item.path.startsWith(`${excluded.path} › `)))
    .map((item) => ({ value: item.category.id, label: `${'\u2003'.repeat(item.depth)}${item.category.name}` }));
}

/**
 * Products or items grouped by category (in tree order, named by their path) or by store; the ones without come
 * last.
 * @param {T[]} items Products or items.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {{ categories: ShoppingCategory[], stores: ShoppingStore[] }} labels Categories and stores.
 * @returns {ShoppingGroup<T>[]} Groups (empty ones left out).
 */
export function groupShopping<T extends { categoryId?: string | null; storeId?: string | null }>(
  items: T[],
  grouping: ShoppingGrouping,
  { categories, stores }: { categories: ShoppingCategory[]; stores: ShoppingStore[] },
): ShoppingGroup<T>[] {
  const key = (item: T) => (grouping === 'category' ? item.categoryId : item.storeId) ?? null;
  const labels =
    grouping === 'category'
      ? shoppingCategoryTree(categories).map(({ category, path, color }) => ({ id: category.id, name: path, color }))
      : [...stores].sort((a, b) => a.position - b.position).map((store) => ({ id: store.id, name: store.name, color: store.color }));
  const groups: ShoppingGroup<T>[] = labels.map((label) => ({ ...label, items: items.filter((item) => key(item) === label.id) }));
  const known = new Set(labels.map((label) => label.id));
  groups.push({ id: null, name: grouping === 'category' ? 'Sans catégorie' : 'Sans magasin', color: null, items: items.filter((item) => !known.has(key(item) ?? '')) });
  return groups.filter((group) => group.items.length > 0);
}

/**
 * Members of the team or household and relations, by id, to name the people of a product or an item.
 * @returns {{ members: Map<string, string>, relations: Map<string, string>, options: object[] }} Names and select options.
 */
export function usePeople() {
  const { data } = useTreasurySettings();
  const members = new Map((data?.treasuryMembers ?? []).map((member) => [member.id, member.isMe ? 'Moi' : member.name]));
  const relations = new Map((data?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const options = [
    { group: 'Membres', items: [...members].map(([id, name]) => ({ value: `m:${id}`, label: name })) },
    { group: 'Relations', items: [...relations].map(([id, name]) => ({ value: `r:${id}`, label: name })) },
  ].filter((group) => group.items.length > 0);
  return { members, relations, options };
}

/**
 * Open tasks a list can be attached to, with their place.
 * @param {TaskContext | null} context Task context.
 * @returns {object} Tasks and their label.
 */
export function taskChoices(context: TaskContext | null) {
  const tasks = (context?.tasks ?? []).filter((task) => !task.closed && !task.archived);
  const labelOf = (task: (typeof tasks)[number]) => context?.taskLabel(task) ?? `#${task.number} ${task.title}`;
  return { tasks, labelOf };
}
