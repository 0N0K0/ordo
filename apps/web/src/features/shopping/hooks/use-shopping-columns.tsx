import { useMemo } from 'react';
import { ShoppingCartIcon } from '@phosphor-icons/react';
import { booleanColumn } from '../../../components/data-table/table/boolean-column';
import { stateColumn, type ColumnState } from '../../../components/data-table/table/state-column';
import { FEEDBACK_COLORS } from '../../../components/feedback/feedback-colors';
import { BADGE_COLUMN, multiValues, withArchived, type DataColumn, type YesNoStates } from '../../../components/data-table/table/data-table';
import { categoryOptions, categoryPaths } from '../../../components/tree/category-tree';
import { itemChoices } from '../../../components/items/item-look';
import { localDay } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useProductStock, useStockLocations } from '../../stock/api';
import { type TaskContext, taskNumbered, useTaskContext } from '../../tasks/hooks/use-task-context';
import { useShoppingData, type ShoppingBaseList, type ShoppingCategory, type ShoppingList, type ShoppingProduct, type ShoppingStore } from '../api';
import { deliveryLabel } from '../lib/delivery-format';
import { shoppingTotal } from '../lib/export';
import { consumableColumn } from '../lib/product-columns';
import { itemColumns, optionalColumn } from '../lib/shopping-columns';
import { categoriesForBaseList, leftToBuy, listClosed, listTasks, shoppingProgress, usePeople } from '../lib/shopping-format';

type ShoppingItem = ShoppingList['items'][number];


/** States of « Manque » of a reference, in its column and on its state buttons: a blue cart (to buy), an empty one. */
export const MISSING_STATES: YesNoStates = {
  labels: { yes: 'Manque', no: 'Pourvu' },
  icons: { yes: { icon: ShoppingCartIcon, tone: 'info', badge: true }, no: 'empty' },
  toggleLabels: { yes: 'Marquer comme manquant (sur la prochaine liste générée)', no: 'Marquer comme pourvu' },
};

/** States of a shopping list: open blue (under way), closed gray. */
const LIST_STATES: ColumnState<'OPEN' | 'CLOSED'>[] = [
  { id: 'OPEN', label: 'En cours', color: FEEDBACK_COLORS.info },
  { id: 'CLOSED', label: 'Clôturée', color: 'gray' },
];

/** States of « Acheté » of an item of a list, on its state buttons. */
export const BOUGHT_STATES: YesNoStates = {
  labels: { yes: 'Acheté', no: 'À acheter' },
  toggleLabels: { yes: 'Marquer comme acheté', no: 'Marquer comme à acheter' },
};

/** States of « Suivie en stock » of a reference, on its state buttons. */
export const STOCK_TRACKED_STATES: YesNoStates = {
  labels: { yes: 'Suivie en stock', no: 'Non suivie en stock' },
  toggleLabels: { yes: 'Suivre en stock', no: 'Ne plus suivre en stock' },
};

/** States of « Ajout auto au stock » of a reference, on its state buttons. */
export const AUTO_STOCK_STATES: YesNoStates = {
  labels: { yes: 'Ajoutée au stock une fois achetée', no: 'Pas ajoutée au stock' },
  toggleLabels: { yes: 'Ajouter au stock une fois achetée', no: 'Ne plus ajouter au stock une fois achetée' },
};
/** What the columns of the lists need: the tasks, the categories and the stores. */
interface ListEnv {
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
const projectsOf = (list: ShoppingList, context: TaskContext | null) => [...new Set(listTasks(list, context).flatMap((task) => (task.projectId ? [task.projectId] : [])))];

/**
 * Columns of the lists: shown, sorted, filtered, grouped, exported as on every table.
 * @param {ListEnv} env Tasks, categories and stores.
 * @returns {DataColumn<ShoppingList>[]} Columns.
 */
function listColumns(env: ListEnv): DataColumn<ShoppingList>[] {
  const { context } = env;
  const categoryPath = categoryPaths(env.categories);
  const taskLabel = (id: string) => {
    const task = context?.taskById.get(id);
    return task ? (context?.taskLabel(task) ?? taskNumbered(task)) : '';
  };
  const projectNames = (list: ShoppingList) => projectsOf(list, context).map((id) => context?.projectLabel(id) ?? '');
  const categoryNames = (list: ShoppingList) => [...new Set(list.items.flatMap((item) => (item.categoryId ? [categoryPath.get(item.categoryId) ?? ''] : [])))];
  const storeNames = (list: ShoppingList) => [...new Set(list.items.flatMap((item) => (item.storeId ? [env.stores.find((store) => store.id === item.storeId)?.label ?? ''] : [])))];
  const listState = (list: ShoppingList) => (listClosed(list, context) ? 'CLOSED' : 'OPEN');
  return [
    { id: 'label', required: true, label: 'Liste', size: 260, locked: true, bulk: true, sortValue: (list) => list.label, text: (list) => list.label },
    {
      id: 'tasks',
      label: 'Tâches',
      size: 260,
      bulk: true,
      sortValue: (list) => list.taskIds.map(taskLabel).sort()[0] ?? null,
      text: (list) => list.taskIds.map(taskLabel).filter(Boolean).join(', '),
      filter: { kind: 'choices', value: (list) => list.taskIds, options: context ? context.taskOptions(context.tasks) : [] },
    },
    {
      id: 'project',
      label: 'Projet',
      size: 180,
      hiddenByDefault: true,
      sortValue: (list) =>
        projectsOf(list, context)
          .map((id) => context?.projectLabel(id) ?? '')
          .sort()[0] ?? null,
      ...multiValues(projectNames),
      filter: {
        kind: 'choices',
        value: (list) => projectsOf(list, context),
        options: context ? context.projectOptions(context.projects) : [],
      },
    },
    stateColumn({ id: 'state', required: true, label: 'État', size: 110, hiddenByDefault: true, states: LIST_STATES, value: listState }),
    {
      id: 'progress',
      label: 'Achats',
      size: 100,
      ...BADGE_COLUMN,
      groupable: false,
      sortValue: (list) => (shoppingProgress(list.items).total ? shoppingProgress(list.items).bought / shoppingProgress(list.items).total : null),
      text: (list) => `${shoppingProgress(list.items).bought} / ${shoppingProgress(list.items).total}`,
      filter: false,
    },
    {
      id: 'remaining',
      required: true,
      label: 'Restant',
      size: 90,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (list) => leftToBuy(list.items).length,
      text: (list) => fmt.count(leftToBuy(list.items).length),
      filter: { kind: 'number', value: (list) => leftToBuy(list.items).length },
    },
    {
      id: 'itemCount',
      required: true,
      label: 'Produits',
      size: 90,
      numeric: true,
      hiddenByDefault: true,
      sortValue: (list) => list.items.length,
      text: (list) => fmt.count(list.items.length),
      filter: { kind: 'number', value: (list) => list.items.length },
    },
    {
      id: 'total',
      label: 'Total estimé',
      size: 120,
      numeric: true,
      sortValue: (list) => shoppingTotal(list.items) || null,
      text: (list) => fmt.money(shoppingTotal(list.items)),
      formatTotal: fmt.money,
    },
    {
      id: 'createdAt',
      required: true,
      label: 'Créée le',
      size: 110,
      sortValue: (list) => list.createdAt,
      text: (list) => fmt.day(list.createdAt),
      filter: { kind: 'date', value: (list) => localDay(list.createdAt) },
    },
    {
      id: 'closedAt',
      label: 'Clôturée le',
      size: 110,
      hiddenByDefault: true,
      sortValue: (list) => list.closedAt || null,
      text: (list) => (list.closedAt ? fmt.day(list.closedAt) : ''),
      filter: { kind: 'date', value: (list) => (list.closedAt ? localDay(list.closedAt) : null) },
    },
    booleanColumn<ShoppingList>({ id: 'paid', label: 'Payée', size: 90, hiddenByDefault: true, groupLabels: { yes: 'Payée', no: 'À payer' }, value: (list) => list.entryId !== null }),
    {
      id: 'categories',
      label: 'Catégories',
      size: 180,
      hiddenByDefault: true,
      ...multiValues(categoryNames),
      filter: {
        kind: 'choices',
        value: (list) => [...new Set(list.items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))],
        options: withArchived(categoryOptions(env.categories), env.categories),
      },
    },
    {
      id: 'stores',
      label: 'Magasins',
      size: 180,
      hiddenByDefault: true,
      ...multiValues(storeNames),
      filter: {
        kind: 'choices',
        value: (list) => [...new Set(list.items.flatMap((item) => (item.storeId ? [item.storeId] : [])))],
        options: itemChoices(env.stores),
      },
    },
    {
      id: 'itemNames',
      label: 'Libellés des produits',
      size: 220,
      hiddenByDefault: true,
      groupable: false,
      ...multiValues((list) => list.items.map((item) => item.label)),
    },
  ];
}

/**
 * Columns of the table of the shopping lists, with the comments of the lists: on its page and in the settings (no list).
 * @param {readonly ShoppingList[] | undefined} lists Lists shown (their comments counted).
 * @returns {DataColumn<ShoppingList>[]} Columns.
 */
export function useShoppingListColumns(lists: readonly ShoppingList[] | undefined): DataColumn<ShoppingList>[] {
  const { data: shopping } = useShoppingData();
  const { context } = useTaskContext();
  const listComments = useCommentCounts(
    'SHOPPING_LIST',
    (lists ?? []).map((list) => list.id),
  );
  return useMemo(
    () => [...listColumns({ context, categories: shopping?.shoppingCategories ?? [], stores: shopping?.shoppingStores ?? [] }), commentColumn<ShoppingList>(listComments, (list) => list.id)],
    [context, shopping, listComments],
  );
}

/**
 * Sheets the items of a list come from, each once.
 * @param {ShoppingItem[]} items Items.
 * @returns {{ sheetId: string, name: string }[]} Sheets.
 */
export const listSheets = (items: ShoppingItem[]) => [
  ...new Map(items.flatMap((item) => item.sheetSources.map((source) => [source.sheetId, { sheetId: source.sheetId, label: source.label }] as const))).values(),
];

/**
 * Columns of the table of the items of a shopping list: on its page, and in the settings (no list: its deliveries,
 * sheets and comments left out).
 * @param {ShoppingList | undefined} list List.
 * @returns {DataColumn<ShoppingItem>[]} Columns.
 */
export function useShoppingItemColumns(list: ShoppingList | undefined): DataColumn<ShoppingItem>[] {
  const { data } = useShoppingData();
  // Projects of the list, through its tasks: their contributors are the members offered.
  const people = usePeople();
  const inStock = useProductStock();
  const deliveries = list?.deliveries ?? [];
  const deliveryName = (id: string | null | undefined) => deliveryLabel(deliveries, id);
  const itemComments = useCommentCounts(
    'SHOPPING_ITEM',
    (list?.items ?? []).map((item) => item.id),
  );
  return itemColumns<ShoppingItem>(
    {
      categories: data?.shoppingCategories ?? [],
      stores: data?.shoppingStores ?? [],
      storages: data?.shoppingStorages ?? [],
      members: people.members,
      relations: people.relations,
      archivedPeople: people.archived,
    },
    [
      optionalColumn<ShoppingItem>(),
      booleanColumn<ShoppingItem>({ id: 'bought', label: 'Acheté', size: 100, hiddenByDefault: true, states: BOUGHT_STATES, value: (item) => Boolean(item.purchasedAt) }),
      {
        id: 'inStock',
        label: 'En stock',
        size: 100,
        numeric: true,
        sortValue: (item) => (item.productId && inStock.has(item.productId) ? inStock.get(item.productId)! : null),
        text: (item) => (item.productId && inStock.has(item.productId) ? fmt.quantity({ quantity: inStock.get(item.productId) }) : ''),
        filter: { kind: 'number', value: (item) => (item.productId ? (inStock.get(item.productId) ?? null) : null) },
      },
      {
        id: 'delivery',
        label: 'Livraison',
        size: 170,
        bulk: true,
        hiddenByDefault: !list?.remote,
        sortValue: (item) => deliveryName(item.deliveryId) || null,
        text: (item) => deliveryName(item.deliveryId),
        filter: { kind: 'choice', value: (item) => item.deliveryId ?? null, options: deliveries.map((delivery) => ({ value: delivery.id, label: deliveryName(delivery.id) })) },
        groupable: true,
      },
      {
        id: 'sheets',
        label: 'Fiches',
        size: 180,
        sortValue: (item) => item.sheetSources.map((source) => source.label).join(', ') || null,
        text: (item) => item.sheetSources.map((source) => source.label).join(', '),
        filter: {
          kind: 'choices',
          value: (item) => item.sheetSources.map((source) => source.sheetId),
          options: listSheets(list?.items ?? []).map((sheet) => ({ value: sheet.sheetId, label: sheet.label })),
        },
      },
      commentColumn<ShoppingItem>(
        itemComments,
        (item) => item.id,
        (item) => item.note,
      ),
    ],
  );
}

/**
 * Columns of the table of the products of a base list: on the base list, and in the settings (no base list: every
 * category).
 * @param {ShoppingBaseList | null} baseList Base list.
 * @param {readonly ShoppingProduct[]} products Its products shown (their comments counted).
 * @returns {DataColumn<ShoppingProduct>[]} Columns.
 */
export function useBaseListColumns(baseList: ShoppingBaseList | null, products: readonly ShoppingProduct[]): DataColumn<ShoppingProduct>[] {
  const { data } = useShoppingData();
  const people = usePeople();
  const { data: locations } = useStockLocations();
  const places = categoryPaths(locations ?? []);
  const categories = baseList ? categoriesForBaseList(data?.shoppingCategories ?? [], baseList.id) : (data?.shoppingCategories ?? []);
  const productComments = useCommentCounts(
    'SHOPPING_PRODUCT',
    products.map((product) => product.id),
  );
  return itemColumns<ShoppingProduct>(
    { categories, stores: data?.shoppingStores ?? [], storages: data?.shoppingStorages ?? [], members: people.members, relations: people.relations, archivedPeople: people.archived },
    [
      commentColumn<ShoppingProduct>(
        productComments,
        (product) => product.id,
        (product) => product.note,
      ),
      {
        id: 'extra',
        label: 'Dernier achat',
        size: 120,
        sortValue: (product) => product.lastPurchasedAt ?? null,
        text: (product) => (product.lastPurchasedAt ? `${fmt.day(product.lastPurchasedAt)}${product.lastPrice !== null ? ` · ${fmt.money(product.lastPrice)}` : ''}` : ''),
        filter: { kind: 'date', value: (product) => (product.lastPurchasedAt ? localDay(product.lastPurchasedAt) : null) },
      },
      booleanColumn<ShoppingProduct>({ id: 'missing', label: 'Manque', size: 90, hiddenByDefault: true, states: MISSING_STATES, groupLabels: { yes: 'Manquants', no: 'Pourvus' }, value: (product) => product.missing }),
      booleanColumn<ShoppingProduct>({ id: 'stockTracked', label: 'Suivie en stock', size: 130, bulk: true, hiddenByDefault: true, groupable: true, states: STOCK_TRACKED_STATES, groupLabels: { yes: 'Suivis en stock', no: 'Non suivis en stock' }, value: (product) => product.stockTracked }),
      consumableColumn<ShoppingProduct>({ hiddenByDefault: true }),
      booleanColumn<ShoppingProduct>({ id: 'autoStock', label: 'Ajout auto au stock', size: 150, bulk: true, hiddenByDefault: true, groupable: true, states: AUTO_STOCK_STATES, groupLabels: { yes: 'Ajoutés automatiquement au stock', no: 'Non ajoutés automatiquement au stock' }, value: (product) => product.autoStock }),
      {
        id: 'stockLocation',
        label: 'Emplacement en stock',
        size: 170,
        bulk: true,
        hiddenByDefault: true,
        sortValue: (product) => (product.stockLocationId ? (places.get(product.stockLocationId) ?? '') : null),
        text: (product) => (product.stockLocationId ? (places.get(product.stockLocationId) ?? '') : ''),
        filter: {
          kind: 'choice',
          value: (product) => product.stockLocationId ?? null,
          options: withArchived(
            [...places].map(([value, label]) => ({ value, label })),
            locations ?? [],
          ),
        },
        groupable: true,
      },
    ],
  );
}
