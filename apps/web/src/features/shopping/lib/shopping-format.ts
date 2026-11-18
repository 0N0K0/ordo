import { idsOfKind, peopleKeys, personKey } from '../../../components/people/people-keys';
import { personName, usePeopleOptions } from '../../../components/people/people-options';
import { mapById, byPosition, lineageOf } from '@ordo/shared';
import { categoryTree } from '../../../components/tree/category-tree';
import { useTreasurySettings } from '../../treasury/api';
import { taskRef, useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import type { ShoppingItemInput } from '@ordo/shared';
import type { ShoppingCategory, ShoppingStore } from '../api';
import * as fmt from '../../../lib/format';

/** Units offered (any other can be typed). */
/**
 * Units of quantity offered (those of the shopping settings), with the current one even when it is no longer among
 * them.
 * @param {readonly { name: string }[]} units Units of the settings, in their order.
 * @param {string | null | undefined} [current] Unit of the product or item. Optional.
 * @returns {string[]} Units.
 */
export const unitOptions = (units: readonly { name: string }[], current?: string | null) => {
  const names = units.map((unit) => unit.name);
  return current && !names.includes(current) ? [current, ...names] : names;
};

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
  // An item of a list keeps whether it is optional (a product has none).
  ...('optional' in row ? { optional: Boolean(row.optional) } : {}),
});

/**
 * Items of a list still to buy: not bought, and not optional (bought if possible).
 * @param {readonly T[]} items Items.
 * @returns {T[]} Items.
 */
export const leftToBuy = <T extends { purchasedAt?: unknown; optional?: boolean | null }>(items: readonly T[]): T[] => items.filter((item) => !item.purchasedAt && !item.optional);

/**
 * Progress of a list: its required items bought, out of all of them (the optional ones apart).
 * @param {readonly { purchasedAt?: unknown, optional?: boolean | null }[]} items Items.
 * @returns {{ bought: number, total: number }} Counts.
 */
export function shoppingProgress(items: readonly { purchasedAt?: unknown; optional?: boolean | null }[]): { bought: number; total: number } {
  const required = items.filter((item) => !item.optional);
  return { bought: required.filter((item) => item.purchasedAt).length, total: required.length };
}

/**
 * Input of a new product or item with only a name, in a category (or store).
 * @param {string} name Name.
 * @param {{ categoryId: string | null, storeId: string | null }} place Category and store.
 * @returns {ShoppingItemInput} Input.
 */
export const blankInput = (name: string, place: Partial<Omit<ShoppingItemInput, 'name'>>): ShoppingItemInput => ({
  name,
  categoryId: null,
  storeId: null,
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
  ...place,
});

/**
 * Categories offered in a base list: those attached to it, and those attached to none (a sub-category without any
 * takes those of its parent); the parents of the ones offered stay, to keep the tree.
 * @param {readonly ShoppingCategory[]} categories All categories.
 * @param {string} baseListId Base list.
 * @returns {ShoppingCategory[]} Categories offered.
 */
export function categoriesForBaseList(categories: readonly ShoppingCategory[], baseListId: string): ShoppingCategory[] {
  const byId = mapById(categories);
  /**
   * Base lists a category is offered in, its own or those of the closest parent with some (none: all).
   * @param {ShoppingCategory} category Category.
   * @returns {string[]} Base lists.
   */
  const listsOf = (category: ShoppingCategory): string[] => lineageOf(byId, category.id).find((current) => current.baseListIds.length)?.baseListIds ?? [];

  const kept = new Set<string>();
  for (const category of categories) {
    const lists = listsOf(category);
    if (lists.length && !lists.includes(baseListId)) continue;
    for (const current of lineageOf(byId, category.id)) kept.add(current.id);
  }
  return categories.filter((category) => kept.has(category.id));
}

/** Way products and items are grouped: category, store, way of keeping, or the people they are for. */
export type ShoppingGrouping = 'category' | 'store' | 'storage' | 'people';

/** Groupings offered, with their name. */
export const SHOPPING_GROUPINGS: { value: ShoppingGrouping; label: string }[] = [
  { value: 'category', label: 'Catégorie' },
  { value: 'store', label: 'Magasin' },
  { value: 'storage', label: 'Conservation' },
  { value: 'people', label: 'Bénéficiaire' },
];

/** Name of the group of the rows without one, by grouping. */
export const NO_GROUP_NAME: Record<ShoppingGrouping, string> = {
  category: 'Sans catégorie',
  store: 'Sans magasin',
  storage: 'Non périssable ou sans mode',
  people: 'Personne en particulier',
};

/** Label of the switch showing the empty groups, by grouping. */
export const EMPTY_GROUPS_LABEL: Record<ShoppingGrouping, string> = {
  category: 'Catégories vides',
  store: 'Magasins vides',
  storage: 'Modes vides',
  people: 'Bénéficiaires sans achat',
};

/**
 * Keys of the people a row is for: members and relations.
 * @param {{ memberIds: string[], relationIds: string[] }} row Product or item.
 * @returns {string[]} Keys.
 */
export const rowPeopleKeys = (row: { memberIds: string[]; relationIds: string[] }) => peopleKeys({ member: row.memberIds, relation: row.relationIds });

/**
 * Members and relations of people keys.
 * @param {readonly string[]} keys Keys.
 * @returns {{ memberIds: string[], relationIds: string[] }} People of a row.
 */
export const rowPeopleOf = (keys: readonly string[]) => ({ memberIds: idsOfKind(keys, 'member'), relationIds: idsOfKind(keys, 'relation') });

/**
 * Groups a row is in: its category, store or way of keeping, or each of its people (none: the group without).
 * @param {ShoppingFields} row Product or item.
 * @param {ShoppingGrouping} grouping Grouping.
 * @returns {string[]} Group ids.
 */
export function groupsOfRow(row: Pick<ShoppingFields, 'categoryId' | 'storeId' | 'storageId' | 'perishable' | 'memberIds' | 'relationIds'>, grouping: ShoppingGrouping): string[] {
  if (grouping === 'people') return rowPeopleKeys(row);
  const id = grouping === 'category' ? row.categoryId : grouping === 'store' ? row.storeId : row.perishable ? row.storageId : null;
  return id ? [id] : [];
}

/**
 * Fields changed when a row is moved from a group to another (a person replaced by another, or all cleared).
 * @param {ShoppingFields} row Product or item.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {string | null} from Group it leaves (null: the one without).
 * @param {string | null} to Group it goes to (null: the one without).
 * @returns {Partial<ShoppingItemInput> | null} Changes, null when there is none.
 */
export function moveToGroup(row: ShoppingFields, grouping: ShoppingGrouping, from: string | null, to: string | null): Partial<ShoppingItemInput> | null {
  if (from === to) return null;
  if (grouping === 'category') return { categoryId: to };
  if (grouping === 'store') return { storeId: to };
  if (grouping === 'storage') return to ? { perishable: true, storageId: to } : { storageId: null };
  if (!to) return { memberIds: [], relationIds: [] };
  const keys = rowPeopleKeys(row).filter((key) => key !== from);
  if (keys.includes(to)) return null;
  keys.push(to);
  return rowPeopleOf(keys);
}

/**
 * Fields of a row added in a group.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {string | null} groupId Group (null: the one without).
 * @returns {Partial<ShoppingItemInput>} Fields.
 */
export function placeInGroup(grouping: ShoppingGrouping, groupId: string | null): Partial<ShoppingItemInput> {
  if (!groupId) return {};
  if (grouping === 'category') return { categoryId: groupId };
  if (grouping === 'store') return { storeId: groupId };
  if (grouping === 'storage') return { perishable: true, storageId: groupId };
  return rowPeopleOf([groupId]);
}

/** What the groups of a shopping table are named from. */
interface ShoppingGroupLabels {
  categories: ShoppingCategory[];
  stores: ShoppingStore[];
  /** Ways of keeping. Optional (needed to group by them). */
  storages?: { id: string; name: string; color?: string | null; position?: number }[];
  /** People by key ("m:id", "r:id"). Optional (needed to group by them). */
  people?: ReadonlyMap<string, string>;
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
 * (a tree, as the treasury categories), or by store, way of keeping or person (a row for several people is under each
 * of them); the rows without come last.
 * @param {T[]} items Products or items, in their order.
 * @param {ShoppingGrouping} grouping Grouping.
 * @param {ShoppingGroupLabels} labels Names of the groups.
 * @param {boolean} [showEmpty=false] Also the empty categories or stores (to drop something in them). Optional.
 * @returns {ShoppingRow<T>[]} Rows.
 */
export function shoppingRows<T extends Pick<ShoppingFields, 'categoryId' | 'storeId' | 'storageId' | 'perishable' | 'memberIds' | 'relationIds'>>(
  items: T[],
  grouping: ShoppingGrouping,
  labels: ShoppingGroupLabels,
  showEmpty = false,
): ShoppingRow<T>[] {
  const groups =
    grouping === 'category'
      ? categoryTree(labels.categories).map(({ category, depth, color }) => ({ id: category.id, name: category.name, color, depth, parentId: category.parentId ?? null }))
      : grouping === 'store'
        ? [...labels.stores].sort(byPosition).map((store) => ({ id: store.id, name: store.name, color: store.color, depth: 0, parentId: null }))
        : grouping === 'storage'
          ? [...(labels.storages ?? [])]
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((storage) => ({ id: storage.id, name: storage.name, color: storage.color ?? null, depth: 0, parentId: null }))
          : [...(labels.people ?? [])].map(([id, name]) => ({ id, name, color: null, depth: 0, parentId: null }));
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
  const keysOf = new Map(items.map((item) => [item, groupsOfRow(item, grouping).filter((id) => known.has(id))]));
  const inSubtree = new Map<string, T[]>(groups.map((group) => [group.id, []]));
  for (const item of items) {
    const above = new Set((keysOf.get(item) ?? []).flatMap(chain));
    for (const id of above) inSubtree.get(id)?.push(item);
  }
  const rows: ShoppingRow<T>[] = [];
  for (const group of groups) {
    const subtree = inSubtree.get(group.id) ?? [];
    if (!showEmpty && subtree.length === 0) continue;
    const parents = chain(group.id).slice(0, -1);
    rows.push({ kind: 'group', id: group.id, name: group.name, color: group.color, depth: group.depth, parents, items: subtree });
    for (const item of items) if (keysOf.get(item)?.includes(group.id)) rows.push({ kind: 'item', item, depth: group.depth + 1, groupId: group.id, parents: [...parents, group.id] });
  }
  const others = items.filter((item) => !keysOf.get(item)?.length);
  if (others.length || showEmpty) {
    rows.push({ kind: 'group', id: null, name: NO_GROUP_NAME[grouping], color: null, depth: 0, parents: [], items: others });
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
 * People a product, an item or a sheet item can be for, by id, and their names: beneficiaries, so any contributor and
 * any relation, whatever the project.
 * @returns {{ members: Map<string, string>, relations: Map<string, string>, byKey: Map<string, string>, options: object[], archived: Set<string> }} Names (also by
 *   people key), select options and the people keys of the archived ones.
 */
export function usePeople() {
  const { data } = useTreasurySettings();
  const { context } = useTaskContext();
  const buildOptions = usePeopleOptions();
  const members = new Map((context?.contributors ?? []).map((contributor) => [contributor.id, personName(contributor)]));
  const relations = new Map((data?.treasuryRelations ?? []).map((relation) => [relation.id, relation.name]));
  const options = buildOptions(
    [...members].map(([id, name]) => ({ value: personKey('member', id), label: name })),
    [...relations].map(([id, name]) => ({ value: personKey('relation', id), label: name })),
  );
  const byKey = new Map([...[...members].map(([id, name]) => [personKey('member', id), name] as const), ...[...relations].map(([id, name]) => [personKey('relation', id), name] as const)]);
  const archived = new Set([
    ...(context?.contributors ?? []).filter((contributor) => contributor.archived).map((contributor) => personKey('member', contributor.id)),
    ...(data?.treasuryRelations ?? []).filter((relation) => relation.archived).map((relation) => personKey('relation', relation.id)),
  ]);
  return { members, relations, byKey, options, archived };
}

/**
 * Open tasks a list can be attached to, with their place.
 * @param {TaskContext | null} context Task context.
 * @returns {object} Tasks and their label.
 */
export function taskChoices(context: TaskContext | null) {
  const tasks = (context?.tasks ?? []).filter((task) => !task.closed && !task.archived);
  const labelOf = (task: (typeof tasks)[number]) => context?.taskLabel(task) ?? `${taskRef(task)}${task.title}`;
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

/** Color of the units (they show none: the color rule asks for one). */
export const UNIT_COLOR = '#868e96';

/**
 * « Gâteau · 1,5 »: a sheet an item of a list comes from, with its share (none: its name alone).
 * @param {{ name: string, quantity: number | null }} source Sheet and share.
 * @returns {string} Text.
 */
export const sheetSourceText = (source: { name: string; quantity: number | null }) => (source.quantity !== null ? `${source.name} · ${fmt.number(source.quantity, 3)}` : source.name);
