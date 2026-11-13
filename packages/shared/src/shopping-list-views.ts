import { z } from 'zod';
import { filterConditionSchemaFor, filterDepth, filterGroupSchemaFor, MAX_FILTER_DEPTH, type FilterConditionOf, type FilterFieldKind, type FilterGroupOf } from './task-filters';

/** States of a shopping list: in progress, or archived (by hand, or along with its tasks). */
export const SHOPPING_LIST_STATES = ['OPEN', 'CLOSED'] as const;

/** Filterable fields of the shopping lists and their kind. */
export const SHOPPING_LIST_FILTER_FIELDS = {
  name: 'text',
  itemNames: 'text',
  state: 'category',
  tasks: 'multiReference',
  project: 'reference',
  categories: 'multiReference',
  stores: 'multiReference',
  itemCount: 'number',
  remaining: 'number',
  total: 'number',
  createdAt: 'date',
  closedAt: 'date',
  paid: 'boolean',
  complete: 'boolean',
  perishable: 'boolean',
} as const satisfies Record<string, FilterFieldKind>;
export type ShoppingListFilterField = keyof typeof SHOPPING_LIST_FILTER_FIELDS;

export type ShoppingListFilterCondition = FilterConditionOf<ShoppingListFilterField>;
export type ShoppingListFilterGroup = FilterGroupOf<ShoppingListFilterField>;

export const shoppingListFilterConditionSchema = filterConditionSchemaFor(SHOPPING_LIST_FILTER_FIELDS, { state: SHOPPING_LIST_STATES });

/** Root filter of a view of the lists: a group, limited in depth. */
export const shoppingListFilterSchema = filterGroupSchemaFor(shoppingListFilterConditionSchema).refine(
  (group) => filterDepth(group) <= MAX_FILTER_DEPTH + 1,
  `Les groupes de filtres sont limités à ${MAX_FILTER_DEPTH} niveaux.`,
);

/** Sort keys of the lists. */
export const SHOPPING_LIST_SORT_KEYS = ['name', 'createdAt', 'closedAt', 'state', 'itemCount', 'remaining', 'progress', 'total', 'project'] as const;
export type ShoppingListSortKey = (typeof SHOPPING_LIST_SORT_KEYS)[number];

/** Fields the lists can be grouped by. */
export const SHOPPING_LIST_GROUP_BY = ['state', 'project', 'paid', 'month'] as const;
export type ShoppingListGroupBy = (typeof SHOPPING_LIST_GROUP_BY)[number];

export const shoppingListViewConfigSchema = z.object({
  filter: shoppingListFilterSchema,
  /** Quick text search (list name, product names), combined with the filter. */
  search: z.string().max(200).default(''),
  /** Multi-sort, in priority order. Empty: latest first. */
  sorting: z
    .preprocess(
      (value) => (Array.isArray(value) ? value.filter((sort) => (SHOPPING_LIST_SORT_KEYS as readonly unknown[]).includes((sort as { id?: unknown })?.id)) : value),
      z.array(z.object({ id: z.enum(SHOPPING_LIST_SORT_KEYS), desc: z.boolean() })).max(SHOPPING_LIST_SORT_KEYS.length),
    )
    .default([]),
  /** Groups of the table, null for none. */
  groupBy: z.enum(SHOPPING_LIST_GROUP_BY).nullable().catch(null).default(null),
});
export type ShoppingListViewConfig = z.infer<typeof shoppingListViewConfigSchema>;

/**
 * Empty root filter of the lists (matches every list).
 * @returns {ShoppingListFilterGroup} Filter.
 */
export function emptyShoppingListFilter(): ShoppingListFilterGroup {
  return { type: 'group', id: 'root', combinator: 'and', children: [] };
}

/**
 * Configuration of a new view of the lists: every list, latest first.
 * @returns {ShoppingListViewConfig} Config.
 */
export function defaultShoppingListViewConfig(): ShoppingListViewConfig {
  return shoppingListViewConfigSchema.parse({ filter: emptyShoppingListFilter() });
}

/**
 * Views made the first time the lists are shown: those in progress (opened by default), the archived ones.
 * @returns {{ name: string, config: ShoppingListViewConfig }[]} Views.
 */
export function firstShoppingListViews(): { name: string; config: ShoppingListViewConfig }[] {
  /**
   * View of the lists of a state.
   * @param {(typeof SHOPPING_LIST_STATES)[number]} state State.
   * @returns {ShoppingListViewConfig} Config.
   */
  const ofState = (state: (typeof SHOPPING_LIST_STATES)[number]) =>
    shoppingListViewConfigSchema.parse({ filter: { type: 'group', id: 'root', combinator: 'and', children: [{ type: 'condition', id: 'state', field: 'state', operator: 'in', value: [state] }] } });
  return [
    { name: 'En cours', config: ofState('OPEN') },
    { name: 'Archivées', config: ofState('CLOSED') },
  ];
}
