import { useTreasurySettings } from '../treasury/api';
import type { TaskContext } from '../tasks/use-task-context';
import type { ShoppingItemInput } from '@ordo/shared';
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

/** Units offered (any other can be typed). */
export const UNITS = ['pièce', 'kg', 'g', 'L', 'cl', 'boîte', 'paquet', 'bouteille', 'sachet', 'lot', 'rouleau', 'carton', 'paire'];

/** Fields shared by a product of a base list and an item of a list, as shown in a table. */
export interface ShoppingFields {
  id: string;
  name: string;
  categoryId?: string | null;
  storeId?: string | null;
  url?: string | null;
  note?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  memberIds: string[];
  relationIds: string[];
  perishable: boolean;
  storageId?: string | null;
  /** "Best before" date, YYYY-MM-DD. */
  expiresAt?: string | null;
}

/**
 * Today, as the dates of the products are written (YYYY-MM-DD, local time).
 * @returns {string} Date.
 */
export const todayIso = () => new Date().toLocaleDateString('sv-SE');

/**
 * Whether a perishable product or item is past its date.
 * @param {{ perishable: boolean, expiresAt?: string | null }} row Product or item.
 * @returns {boolean} Expired.
 */
export const isExpired = ({ perishable, expiresAt }: { perishable: boolean; expiresAt?: string | null }) => perishable && Boolean(expiresAt) && (expiresAt ?? '') < todayIso();

/**
 * Input of a product or an item, from its current fields (to change some of them).
 * @param {ShoppingFields} row Product or item.
 * @returns {ShoppingItemInput} Input.
 */
export const inputOf = (row: ShoppingFields): ShoppingItemInput => ({
  name: row.name,
  categoryId: row.categoryId ?? null,
  storeId: row.storeId ?? null,
  url: row.url ?? null,
  note: row.note ?? null,
  quantity: row.quantity ?? null,
  unit: row.unit ?? null,
  unitPrice: row.unitPrice ?? null,
  memberIds: row.memberIds,
  relationIds: row.relationIds,
  perishable: row.perishable,
  storageId: row.storageId ?? null,
  expiresAt: row.expiresAt ?? null,
});

/**
 * Input of a new product or item with only a name, in a category (or store).
 * @param {string} name Name.
 * @param {{ categoryId: string | null, storeId: string | null }} place Category and store.
 * @returns {ShoppingItemInput} Input.
 */
export const blankInput = (name: string, place: { categoryId: string | null; storeId: string | null }): ShoppingItemInput => ({
  name,
  ...place,
  url: null,
  note: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  memberIds: [],
  relationIds: [],
  perishable: false,
  storageId: null,
  expiresAt: null,
});

/**
 * Categories offered in a base list: those attached to it, and those attached to none (a sub-category without any
 * takes those of its parent); the parents of the ones offered stay, to keep the tree.
 * @param {readonly ShoppingCategory[]} categories All categories.
 * @param {string} baseListId Base list.
 * @returns {ShoppingCategory[]} Categories offered.
 */
export function categoriesForBaseList(categories: readonly ShoppingCategory[], baseListId: string): ShoppingCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  /**
   * Base lists a category is offered in, its own or those of the closest parent with some (none: all).
   * @param {ShoppingCategory} category Category.
   * @returns {string[]} Base lists.
   */
  const listsOf = (category: ShoppingCategory): string[] => {
    const seen = new Set<string>();
    for (let current: ShoppingCategory | undefined = category; current && !seen.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) {
      seen.add(current.id);
      if (current.baseListIds.length) return current.baseListIds;
    }
    return [];
  };
  const kept = new Set<string>();
  for (const category of categories) {
    const lists = listsOf(category);
    if (lists.length && !lists.includes(baseListId)) continue;
    for (let current: ShoppingCategory | undefined = category; current && !kept.has(current.id); current = current.parentId ? byId.get(current.parentId) : undefined) kept.add(current.id);
  }
  return categories.filter((category) => kept.has(category.id));
}

/** Way products and items are grouped. */
export type ShoppingGrouping = 'category' | 'store';

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

/** Row of a shopping table: a category (or store) heading, or a product or an item under it. */
export type ShoppingRow<T> =
  | {
      kind: 'group';
      /** Category or store id, null for the rows without one. */
      id: string | null;
      name: string;
      color: string | null;
      depth: number;
      /** Ids of the categories above it. */
      parents: string[];
      /** Products or items in it and in its sub-categories. */
      items: T[];
    }
  | {
      kind: 'item';
      item: T;
      depth: number;
      /** Category or store it is in (null: none). */
      groupId: string | null;
      /** Ids of the categories above it (its own included). */
      parents: string[];
    };

/** Key of the group without category or store, in the collapsed groups. */
export const NO_GROUP = 'none';

/**
 * Rows of a shopping table: by category, each heading followed by its products or items then by its sub-categories
 * (a tree, as the treasury categories), or by store; the rows without category or store come last.
 * @param {T[]} items Products or items, in their order.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {{ categories: ShoppingCategory[], stores: ShoppingStore[] }} labels Categories and stores.
 * @param {boolean} [showEmpty=false] Also the empty categories or stores (to drop something in them). Optional.
 * @returns {ShoppingRow<T>[]} Rows.
 */
export function shoppingRows<T extends { categoryId?: string | null; storeId?: string | null }>(
  items: T[],
  grouping: ShoppingGrouping,
  { categories, stores }: { categories: ShoppingCategory[]; stores: ShoppingStore[] },
  showEmpty = false,
): ShoppingRow<T>[] {
  const key = (item: T) => (grouping === 'category' ? item.categoryId : item.storeId) ?? null;
  const groups =
    grouping === 'category'
      ? shoppingCategoryTree(categories).map(({ category, depth, color }) => ({ id: category.id, name: category.name, color, depth, parentId: category.parentId ?? null }))
      : [...stores].sort((a, b) => a.position - b.position).map((store) => ({ id: store.id, name: store.name, color: store.color, depth: 0, parentId: null }));
  const known = new Set(groups.map((group) => group.id));
  const parentOf = new Map(groups.map((group) => [group.id, group.parentId && known.has(group.parentId) ? group.parentId : null]));
  /**
   * Ids of a group and of the groups above it, the top one first.
   * @param {string} id Group id.
   * @returns {string[]} Ids.
   */
  const chain = (id: string): string[] => {
    const ids: string[] = [];
    for (let current: string | null | undefined = id; current; current = parentOf.get(current)) ids.unshift(current);
    return ids;
  };
  const inSubtree = new Map<string, T[]>(groups.map((group) => [group.id, []]));
  for (const item of items) {
    const id = key(item);
    if (id && known.has(id)) for (const above of chain(id)) inSubtree.get(above)?.push(item);
  }
  const rows: ShoppingRow<T>[] = [];
  for (const group of groups) {
    const subtree = inSubtree.get(group.id) ?? [];
    if (!showEmpty && subtree.length === 0) continue;
    const parents = chain(group.id).slice(0, -1);
    rows.push({ kind: 'group', id: group.id, name: group.name, color: group.color, depth: group.depth, parents, items: subtree });
    for (const item of items) if (key(item) === group.id) rows.push({ kind: 'item', item, depth: group.depth + 1, groupId: group.id, parents: [...parents, group.id] });
  }
  const others = items.filter((item) => !known.has(key(item) ?? ''));
  if (others.length || showEmpty) {
    rows.push({ kind: 'group', id: null, name: grouping === 'category' ? 'Sans catégorie' : 'Sans magasin', color: null, depth: 0, parents: [], items: others });
    for (const item of others) rows.push({ kind: 'item', item, depth: 1, groupId: null, parents: [NO_GROUP] });
  }
  return rows;
}

/**
 * Rows left once the collapsed groups are folded (their headings stay).
 * @param {ShoppingRow<T>[]} rows Rows.
 * @param {ReadonlySet<string>} collapsed Collapsed groups (NO_GROUP for the one without).
 * @returns {ShoppingRow<T>[]} Rows shown.
 */
export const visibleRows = <T>(rows: ShoppingRow<T>[], collapsed: ReadonlySet<string>) => rows.filter((row) => !row.parents.some((id) => collapsed.has(id)));

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
