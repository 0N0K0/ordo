import { categoryOptions, categoryTree, type PlacedCategory } from '../../components/category-tree/category-tree';
import { useTreasurySettings } from '../treasury/api';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import type { ShoppingItemInput } from '@ordo/shared';
import type { ShoppingCategory, ShoppingStore } from './api';
import * as fmt from '../../lib/format';
import { localToday } from '../../lib/dates';

/**
 * Quantity and unit of a product or an item ("2 kg", "3 boîte"), empty without quantity nor unit.
 * @param {{ quantity: number | null, unit: string | null }} item Product or item.
 * @returns {string} Text.
 */
export const quantityText = ({ quantity, unit }: { quantity?: number | null; unit?: string | null }) => [quantity != null ? fmt.number(quantity, 3) : null, unit].filter(Boolean).join(' ');

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
export const todayIso = () => localToday();

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

/** Category placed in its tree. */
export type PlacedShoppingCategory = PlacedCategory<ShoppingCategory>;

/**
 * Categories in tree order: each one followed by its sub-categories, by name (as the treasury categories).
 * @param {readonly ShoppingCategory[]} categories All categories.
 * @returns {PlacedShoppingCategory[]} Placed categories.
 */
export const shoppingCategoryTree = (categories: readonly ShoppingCategory[]): PlacedShoppingCategory[] => categoryTree(categories);

/** Select options of the categories, indented as their tree (without the one edited and its sub-categories). */
export const shoppingCategoryOptions = categoryOptions;

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
 * Members of the team or household and relations, by id, to name the people of a product or an item. For an item of a
 * list of a project, the members offered are the contributors of the project (those chosen stay); relations always.
 * @param {string[]} [projectIds] Projects of the list (through its tasks); none: every member. Optional.
 * @param {string[]} [keep] Members already chosen, offered anyway. Optional.
 * @returns {{ members: Map<string, string>, relations: Map<string, string>, options: object[] }} Names and select options.
 */
export function usePeople(projectIds: string[] = [], keep: string[] = []) {
  const { data } = useTreasurySettings();
  const { context } = useTaskContext();
  const members = new Map((data?.treasuryMembers ?? []).map((member) => [member.id, member.isMe ? 'Moi' : member.name]));
  const relations = new Map((data?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  // Members are contributors: of a project, its contributors only.
  const allowed = projectIds.length && context ? new Set(context.assignableFor(projectIds, keep).map((contributor) => contributor.id)) : null;
  const options = [
    { group: 'Membres', items: [...members].filter(([id]) => !allowed || allowed.has(id)).map(([id, name]) => ({ value: `m:${id}`, label: name })) },
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

/**
 * Options of a multi-select of the tasks of a list: the open tasks, and those already chosen (even closed).
 * @param {TaskContext | null} context Task context.
 * @param {string[]} chosen Tasks of the list.
 * @returns {{ value: string, label: string }[]} Options.
 */
export function taskOptions(context: TaskContext | null, chosen: string[]) {
  const { tasks, labelOf } = taskChoices(context);
  const extra = chosen.flatMap((id) => {
    const task = context?.taskById.get(id);
    return task && !tasks.includes(task) ? [task] : [];
  });
  return [...extra, ...tasks].map((task) => ({ value: task.id, label: labelOf(task) }));
}

/**
 * Tasks of a list known to the task context.
 * @param {{ taskIds: string[] }} list List.
 * @param {TaskContext | null} context Task context.
 * @returns {TaskContext['tasks']} Tasks.
 */
export function listTasks(list: { taskIds: string[] }, context: TaskContext | null) {
  return list.taskIds.flatMap((id) => {
    const task = context?.taskById.get(id);
    return task ? [task] : [];
  });
}

/**
 * Whether a list is closed: by hand, or along with its tasks (all of them closed). The task context gives the state
 * of the tasks right away (after a task is closed or reopened).
 * @param {{ closed: boolean, closedAt: string | null, taskIds: string[] }} list List.
 * @param {TaskContext | null} context Task context.
 * @returns {boolean} Closed.
 */
export function listClosed(list: { closed: boolean; closedAt: string | null; taskIds: string[] }, context: TaskContext | null): boolean {
  if (list.closedAt) return true;
  const tasks = listTasks(list, context);
  if (!context || tasks.length < list.taskIds.length) return list.closed;
  return tasks.length > 0 && tasks.every((task) => task.closed);
}

/**
 * Lists whose tasks belong to some projects.
 * @param {T[]} lists Lists.
 * @param {TaskContext | null} context Task context.
 * @param {ReadonlySet<string>} projectIds Projects.
 * @returns {T[]} Lists of the projects.
 */
export function listsOfProjects<T extends { taskIds: string[] }>(lists: T[], context: TaskContext | null, projectIds: ReadonlySet<string>): T[] {
  return lists.filter((list) => listTasks(list, context).some((task) => task.projectId !== null && projectIds.has(task.projectId)));
}
