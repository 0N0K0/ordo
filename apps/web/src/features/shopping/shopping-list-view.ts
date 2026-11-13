import {
  defaultShoppingListViewConfig,
  filterDay,
  filterPeriod,
  firstShoppingListViews,
  SHOPPING_LIST_FILTER_FIELDS,
  SHOPPING_LIST_STATES,
  shoppingListFilterConditionSchema,
  shoppingListViewConfigSchema,
  type FilterOperator,
  type ShoppingListFilterCondition,
  type ShoppingListFilterField,
  type ShoppingListFilterGroup,
  type ShoppingListGroupBy,
  type ShoppingListSortKey,
  type ShoppingListViewConfig,
} from '@ordo/shared';
import { categoryOptions } from '../../components/category-tree/category-tree';
import { treeSelectProps } from '../../components/tree-select/tree-select';
import { localDay } from '../../lib/dates';
import type { FilterFields } from '../tasks/views/FilterBuilder';
import { useSavedViews } from '../tasks/views/use-saved-views';
import type { TaskContext } from '../tasks/use-task-context';
import type { ShoppingCategory, ShoppingList, ShoppingStore } from './api';
import { shoppingTotal } from './export';
import { listClosed, listTasks } from './shopping-format';

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export const SHOPPING_LIST_FIELD_LABELS: Record<ShoppingListFilterField, string> = {
  name: 'Nom',
  itemNames: 'Produits',
  state: 'État',
  tasks: 'Tâches',
  project: 'Projet',
  categories: 'Catégories des produits',
  stores: 'Magasins',
  itemCount: 'Nombre de produits',
  remaining: 'Produits restant à acheter',
  total: 'Total estimé (€)',
  createdAt: 'Créée le',
  closedAt: 'Archivée le',
  paid: 'Payée',
  complete: 'Tout est acheté',
  perishable: 'A des produits périssables',
};

export const SHOPPING_LIST_FIELD_GROUPS: { group: string; fields: ShoppingListFilterField[] }[] = [
  { group: 'Texte', fields: ['name', 'itemNames'] },
  { group: 'Organisation', fields: ['tasks', 'project', 'categories', 'stores'] },
  { group: 'Contenu', fields: ['itemCount', 'remaining', 'total'] },
  { group: 'Dates', fields: ['createdAt', 'closedAt'] },
  { group: 'État', fields: ['state', 'paid', 'complete', 'perishable'] },
];

export const SHOPPING_LIST_STATE_LABELS: Record<(typeof SHOPPING_LIST_STATES)[number], string> = { OPEN: 'En cours', CLOSED: 'Archivée' };

export const SHOPPING_LIST_SORT_LABELS: Record<ShoppingListSortKey, string> = {
  name: 'Nom',
  createdAt: 'Créée le',
  closedAt: 'Archivée le',
  state: 'État',
  itemCount: 'Nombre de produits',
  remaining: 'Restant à acheter',
  progress: 'Avancement',
  total: 'Total estimé',
  project: 'Projet',
};

export const SHOPPING_LIST_GROUP_BY_LABELS: Record<ShoppingListGroupBy, string> = { state: 'État', project: 'Projet', paid: 'Payée', month: 'Mois de création' };

/**
 * Parses a stored configuration of a view of the lists, falling back to the defaults when it is invalid.
 * @param {unknown} config Stored configuration.
 * @returns {ShoppingListViewConfig} Configuration.
 */
function parseConfig(config: unknown): ShoppingListViewConfig {
  const result = shoppingListViewConfigSchema.safeParse(config);
  return result.success ? result.data : defaultShoppingListViewConfig();
}

/**
 * Saved views of the shopping lists of a scope (a project's tab or the shopping page) and the working copy of the
 * current one; « En cours » and « Archivées » are made when the scope has none.
 * @param {string | null} projectId Project, or null for the shopping page.
 * @returns {object} Views, current view, its working configuration and the view actions.
 */
export function useShoppingListView(projectId: string | null) {
  return useSavedViews<ShoppingListViewConfig>({ projectId, kind: 'SHOPPING_LISTS', parse: parseConfig, blank: defaultShoppingListViewConfig, first: firstShoppingListViews, param: 'listView' });
}

/** What the evaluation of the filters of the lists needs. */
export interface ShoppingListEnv {
  today: string;
  context: TaskContext | null;
  categories: ShoppingCategory[];
  stores: ShoppingStore[];
}

/**
 * Projects of the tasks of a list.
 * @param {ShoppingList} list List.
 * @param {TaskContext | null} context Task context.
 * @returns {string[]} Project ids.
 */
const projectsOf = (list: ShoppingList, context: TaskContext | null) => [...new Set(listTasks(list, context).map((task) => task.projectId))];

/**
 * Value of a list for a filter field.
 * @param {ShoppingList} list List.
 * @param {ShoppingListFilterField} field Field.
 * @param {ShoppingListEnv} env Environment.
 * @returns {string | number | boolean | string[] | null} Value.
 */
function fieldValue(list: ShoppingList, field: ShoppingListFilterField, env: ShoppingListEnv): string | number | boolean | string[] | null {
  switch (field) {
    case 'name':
      return list.name;
    case 'itemNames':
      return list.items.map((item) => item.name).join('\n');
    case 'state':
      return listClosed(list, env.context) ? 'CLOSED' : 'OPEN';
    case 'tasks':
      return list.taskIds;
    case 'project':
      return projectsOf(list, env.context);
    case 'categories':
      return [...new Set(list.items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))];
    case 'stores':
      return [...new Set(list.items.flatMap((item) => (item.storeId ? [item.storeId] : [])))];
    case 'itemCount':
      return list.items.length;
    case 'remaining':
      return list.items.filter((item) => !item.purchasedAt).length;
    case 'total':
      return shoppingTotal(list.items);
    case 'createdAt':
      return localDay(new Date(String(list.createdAt)));
    case 'closedAt':
      return list.closedAt ? localDay(new Date(String(list.closedAt))) : null;
    case 'paid':
      return list.entryId !== null;
    case 'complete':
      return list.items.length > 0 && list.items.every((item) => item.purchasedAt);
    case 'perishable':
      return list.items.some((item) => item.perishable);
  }
}

/**
 * Ids of some categories and of their sub-categories.
 * @param {ShoppingCategory[]} categories Every category.
 * @param {string} id Category.
 * @returns {Set<string>} Ids.
 */
function subtree(categories: ShoppingCategory[], id: string): Set<string> {
  const result = new Set([id]);
  for (let grown = true; grown;) {
    grown = false;
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id);
        grown = true;
      }
    }
  }
  return result;
}

/**
 * Whether a list meets a condition (an incomplete condition is met).
 * @param {ShoppingListFilterCondition} condition Condition.
 * @param {ShoppingList} list List.
 * @param {ShoppingListEnv} env Environment.
 * @returns {boolean} Met.
 */
function meets(condition: ShoppingListFilterCondition, list: ShoppingList, env: ShoppingListEnv): boolean {
  if (!shoppingListFilterConditionSchema.safeParse(condition).success) return true;
  const operator = condition.operator as FilterOperator;
  const value = fieldValue(list, condition.field, env);
  const wanted = condition.value;
  const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0);
  if (operator === 'isEmpty') return empty;
  if (operator === 'isNotEmpty') return !empty;
  if (operator === 'isTrue') return value === true;
  if (operator === 'isFalse') return value !== true;
  switch (SHOPPING_LIST_FILTER_FIELDS[condition.field]) {
    case 'text': {
      const text = String(value ?? '').toLowerCase();
      const query = String(wanted ?? '').toLowerCase();
      // A list of products: "is" holds when one of them is.
      const lines = text.split('\n');
      if (operator === 'contains') return text.includes(query);
      if (operator === 'notContains') return !text.includes(query);
      if (operator === 'is') return lines.includes(query);
      return !lines.includes(query);
    }
    case 'number': {
      if (typeof value !== 'number' || typeof wanted !== 'number') return operator === 'neq';
      return { eq: value === wanted, neq: value !== wanted, lt: value < wanted, lte: value <= wanted, gt: value > wanted, gte: value >= wanted }[operator as 'eq'] ?? true;
    }
    case 'date': {
      if (typeof value !== 'string') return false;
      if (operator === 'within') {
        const [from, to] = filterPeriod(String(wanted), env.today);
        return value >= from && value < to;
      }
      const day = filterDay(String(wanted), env.today);
      return { is: value === day, before: value < day, after: value > day, onOrBefore: value <= day, onOrAfter: value >= day }[operator as 'is'] ?? true;
    }
    case 'category': {
      const chosen = Array.isArray(wanted) ? wanted : [];
      return operator === 'in' ? chosen.includes(String(value)) : !chosen.includes(String(value));
    }
    case 'reference': {
      // Project: one of the projects of its tasks (or, "dans", a parent of one).
      const chosen = Array.isArray(wanted) ? wanted : [];
      const own = Array.isArray(value) ? value : [];
      const hit =
        operator === 'inTree'
          ? own.some((projectId) => {
              for (let id: string | null = projectId; id; id = env.context?.projectById.get(id)?.parentId ?? null) if (chosen.includes(id)) return true;
              return false;
            })
          : own.some((id) => chosen.includes(id));
      return operator === 'notIn' ? !hit : hit;
    }
    case 'multiReference': {
      const own = Array.isArray(value) ? value : [];
      const chosen = Array.isArray(wanted) ? wanted : [];
      // A category matches with its sub-categories.
      const has = (id: string) => (condition.field === 'categories' ? own.some((item) => subtree(env.categories, id).has(item)) : own.includes(id));
      if (operator === 'anyOf') return chosen.some(has);
      if (operator === 'allOf') return chosen.every(has);
      return !chosen.some(has);
    }
    default:
      return true;
  }
}

/**
 * Whether a list meets a filter tree.
 * @param {ShoppingListFilterGroup} group Filter.
 * @param {ShoppingList} list List.
 * @param {ShoppingListEnv} env Environment.
 * @returns {boolean} Met.
 */
function matches(group: ShoppingListFilterGroup, list: ShoppingList, env: ShoppingListEnv): boolean {
  if (group.children.length === 0) return true;
  const results = group.children.map((child) => (child.type === 'condition' ? meets(child, list, env) : matches(child, list, env)));
  return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Whether a list is shown by a view: found by the search (its name or a product), meeting the filter.
 * @param {ShoppingListViewConfig} config View configuration.
 * @param {ShoppingList} list List.
 * @param {ShoppingListEnv} env Environment.
 * @returns {boolean} Shown.
 */
export function keptByListView(config: ShoppingListViewConfig, list: ShoppingList, env: ShoppingListEnv): boolean {
  const search = config.search.trim().toLowerCase();
  if (search && ![list.name, ...list.items.map((item) => item.name)].some((text) => text.toLowerCase().includes(search))) return false;
  return matches(config.filter, list, env);
}

/**
 * Lists in the order of a view: its sorts in priority order (empty values last), then the latest first.
 * @param {ShoppingList[]} lists Lists.
 * @param {ShoppingListViewConfig['sorting']} sorting Sorts.
 * @param {ShoppingListEnv} env Environment.
 * @returns {ShoppingList[]} Sorted copy.
 */
export function sortLists(lists: ShoppingList[], sorting: ShoppingListViewConfig['sorting'], env: ShoppingListEnv): ShoppingList[] {
  /**
   * Sort value of a list for a key (null: empty).
   * @param {ShoppingList} list List.
   * @param {ShoppingListSortKey} key Sort key.
   * @returns {string | number | null} Value.
   */
  const valueOf = (list: ShoppingList, key: ShoppingListSortKey): string | number | null => {
    switch (key) {
      case 'name':
        return list.name;
      case 'createdAt':
        return String(list.createdAt);
      case 'closedAt':
        return list.closedAt ? String(list.closedAt) : null;
      case 'state':
        return listClosed(list, env.context) ? 1 : 0;
      case 'itemCount':
        return list.items.length;
      case 'remaining':
        return list.items.filter((item) => !item.purchasedAt).length;
      case 'progress':
        return list.items.length ? list.items.filter((item) => item.purchasedAt).length / list.items.length : null;
      case 'total':
        return shoppingTotal(list.items) || null;
      case 'project': {
        const labels = projectsOf(list, env.context)
          .map((id) => env.context?.projectLabel(id) ?? '')
          .sort(collator.compare);
        return labels[0] ?? null;
      }
    }
  };
  return [...lists].sort((a, b) => {
    for (const { id, desc } of sorting) {
      const [x, y] = [valueOf(a, id), valueOf(b, id)];
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
      if (order) return desc ? -order : order;
    }
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

/** Row of the table of the lists: a group heading (indented as its tree), or a list. */
export type ListRow = { kind: 'group'; key: string; name: string; depth: number; count: number } | { kind: 'list'; key: string; list: ShoppingList; depth: number };

/**
 * Rows of the lists of a view: the lists alone, or under their groups (a list of several projects shows in each;
 * projects under their clients and parents).
 * @param {ShoppingList[]} lists Lists shown, in their order.
 * @param {ShoppingListGroupBy | null} groupBy Field grouped by.
 * @param {ShoppingListEnv} env Environment.
 * @returns {ListRow[]} Rows.
 */
export function listRows(lists: ShoppingList[], groupBy: ShoppingListGroupBy | null, env: ShoppingListEnv): ListRow[] {
  if (!groupBy) return lists.map((list) => ({ kind: 'list', key: list.id, list, depth: 0 }));
  /**
   * Rows of flat groups, in the order given (empty groups left out).
   * @param {{ key: string, name: string }[]} groups Groups.
   * @param {(list: ShoppingList) => string} of Group of a list.
   * @returns {ListRow[]} Rows.
   */
  const flat = (groups: { key: string; name: string }[], of: (list: ShoppingList) => string): ListRow[] =>
    groups.flatMap((group) => {
      const inside = lists.filter((list) => of(list) === group.key);
      return inside.length
        ? [
            { kind: 'group' as const, key: group.key, name: group.name, depth: 0, count: inside.length },
            ...inside.map((list) => ({ kind: 'list' as const, key: `${group.key}/${list.id}`, list, depth: 1 })),
          ]
        : [];
    });
  switch (groupBy) {
    case 'state':
      return flat(
        SHOPPING_LIST_STATES.map((state) => ({ key: state, name: SHOPPING_LIST_STATE_LABELS[state] })),
        (list) => (listClosed(list, env.context) ? 'CLOSED' : 'OPEN'),
      );
    case 'paid':
      return flat(
        [
          { key: 'paid', name: 'Payée' },
          { key: 'unpaid', name: 'Non payée' },
        ],
        (list) => (list.entryId ? 'paid' : 'unpaid'),
      );
    case 'month': {
      const monthOf = (list: ShoppingList) => String(list.createdAt).slice(0, 7);
      const months = [...new Set(lists.map(monthOf))].sort((a, b) => b.localeCompare(a));
      return flat(
        months.map((month) => ({ key: month, name: monthFormat.format(new Date(`${month}-01T12:00:00`)) })),
        monthOf,
      );
    }
    case 'project': {
      const options = env.context?.projectOptions(env.context.projects) ?? [];
      const parentOf = new Map(options.map((option) => [option.value, option.parent]));
      /**
       * Whether a group holds a project of a list (itself or a sub-project).
       * @param {ShoppingList} list List.
       * @param {string} group Group (client or project).
       * @returns {boolean} Inside.
       */
      const within = (list: ShoppingList, group: string) =>
        projectsOf(list, env.context).some((id) => {
          for (let current: string | null | undefined = id; current; current = parentOf.get(current)) if (current === group) return true;
          return false;
        });
      const rows: ListRow[] = [];
      for (const option of options) {
        const inside = lists.filter((list) => within(list, option.value));
        if (inside.length === 0) continue;
        rows.push({ kind: 'group', key: option.value, name: option.label, depth: option.depth, count: inside.length });
        for (const list of lists.filter((item) => projectsOf(item, env.context).includes(option.value))) rows.push({ kind: 'list', key: `${option.value}/${list.id}`, list, depth: option.depth + 1 });
      }
      const loose = lists.filter((list) => projectsOf(list, env.context).length === 0);
      if (loose.length)
        rows.push({ kind: 'group', key: 'none', name: 'Sans tâche', depth: 0, count: loose.length }, ...loose.map((list) => ({ kind: 'list' as const, key: `none/${list.id}`, list, depth: 1 })));
      return rows;
    }
  }
}

/** Operator labels of the fields of the lists, where those of their kind do not fit. */
const OPERATOR_OVERRIDES: Partial<Record<ShoppingListFilterField, Partial<Record<FilterOperator, string>>>> = {
  tasks: { isEmpty: 'aucune', isNotEmpty: 'au moins une' },
  categories: { isEmpty: 'aucune', isNotEmpty: 'au moins une' },
  stores: { isEmpty: 'aucun', isNotEmpty: 'au moins un' },
  project: { in: 'est l’un de', notIn: 'n’est aucun de', isEmpty: 'aucun', isNotEmpty: 'au moins un' },
};

/**
 * Fields of the filters of the lists.
 * @param {ShoppingListEnv} env Environment.
 * @returns {FilterFields<ShoppingListFilterField>} Fields.
 */
export function shoppingListFilterFields(env: ShoppingListEnv): FilterFields<ShoppingListFilterField> {
  const { context } = env;
  return {
    kinds: SHOPPING_LIST_FILTER_FIELDS,
    labels: SHOPPING_LIST_FIELD_LABELS,
    groups: SHOPPING_LIST_FIELD_GROUPS,
    first: 'name',
    options: (field) => {
      switch (field) {
        case 'state':
          return { data: SHOPPING_LIST_STATES.map((state) => ({ value: state, label: SHOPPING_LIST_STATE_LABELS[state] })) };
        case 'tasks':
          return context ? treeSelectProps(context.taskOptions(context.tasks)) : { data: [] };
        case 'project':
          return context ? treeSelectProps(context.projectOptions(context.projects)) : { data: [] };
        case 'categories':
          return treeSelectProps(categoryOptions(env.categories));
        case 'stores':
          return { data: env.stores.map((store) => ({ value: store.id, label: store.name })) };
        default:
          return { data: [] };
      }
    },
    isComplete: (condition) => shoppingListFilterConditionSchema.safeParse(condition).success,
    operatorLabel: (field, operator) => OPERATOR_OVERRIDES[field]?.[operator],
    emptyText: 'Aucun filtre : toutes les listes sont affichées.',
  };
}
