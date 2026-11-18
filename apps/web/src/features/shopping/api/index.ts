import { treasuryKey } from '../../treasury/api';
import type { QueryClient } from '@tanstack/react-query';
import { reorderSettingsItems } from '../../../components/settings/settings-api';
import { moveToIndex, useInvalidatingMutation } from '../../../lib/mutation';
import type { ShoppingCategoryInput, ShoppingItemInput, ShoppingProductInput, ShoppingStoreInput } from '@ordo/shared';
import { useQuery } from '@tanstack/react-query';
import { moveInTree } from '../../../components/tree/category-tree';
import { graphql } from '../../../graphql';
import type { ShoppingDataQuery, ShoppingListsQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type ShoppingCategory = ShoppingDataQuery['shoppingCategories'][number];
export type ShoppingStore = ShoppingDataQuery['shoppingStores'][number];
export type ShoppingBaseList = ShoppingDataQuery['shoppingBaseLists'][number];
export type ShoppingStorage = ShoppingDataQuery['shoppingStorages'][number];
export type ShoppingUnit = ShoppingDataQuery['shoppingUnits'][number];
export type ShoppingProduct = ShoppingDataQuery['shoppingProducts'][number];
export type ShoppingList = ShoppingListsQuery['shoppingLists'][number];
export type ShoppingItem = ShoppingList['items'][number];

/** Key of every query of the shopping (lists, products, settings), refreshed by what changes them. */
export const shoppingKey = ['shopping'] as const;

const ShoppingDataDocument = graphql(`
  query ShoppingData {
    shoppingCategories {
      id
      archived
      name
      color
      iconUrl
      parentId
      position
      baseListIds
    }
    shoppingStorages {
      id
      archived
      name
      color
      iconUrl
      position
    }
    shoppingUnits {
      id
      archived
      name
      color
      iconUrl
      position
    }
    shoppingStores {
      id
      archived
      name
      color
      iconUrl
      position
    }
    shoppingBaseLists {
      id
      archived
      name
      color
      iconUrl
      position
    }
    shoppingProducts {
      id
      archived
      baseListId
      name
      categoryId
      storeId
      url
      note
      quantity
      unit
      unitPrice
      perishable
      storageId
      expiresAt
      missing
      lastPurchasedAt
      lastPrice
      memberIds
      relationIds
      stockTracked
      consumable
      autoStock
      stockLocationId
    }
  }
`);

const ShoppingListsDocument = graphql(`
  query ShoppingLists($taskId: ID) {
    shoppingLists(taskId: $taskId) {
      id
      archived
      name
      taskIds
      entryId
      entry {
        id
        date
        label
        amount
      }
      closed
      closedAt
      remote
      deliveryAddress
      deliveryLat
      deliveryLon
      deliveries {
        id
        label
        trackingUrl
        pickup
        windowFrom
        windowTo
        address
        lat
        lon
        receivedAt
        position
      }
      createdAt
      items {
        id
        listId
        productId
        name
        categoryId
        storeId
        url
        note
        quantity
        unit
        unitPrice
        perishable
        storageId
        expiresAt
        purchasedAt
        optional
        deliveryId
        sheetSources {
          sheetId
          name
          quantity
        }
        position
        memberIds
        relationIds
      }
    }
  }
`);

const CreateCategory = graphql(`
  mutation CreateShoppingCategory($input: ShoppingCategoryInput!) {
    createShoppingCategory(input: $input)
  }
`);
const UpdateCategory = graphql(`
  mutation UpdateShoppingCategory($id: ID!, $input: ShoppingCategoryInput!) {
    updateShoppingCategory(id: $id, input: $input)
  }
`);
const DeleteCategory = graphql(`
  mutation DeleteShoppingCategory($id: ID!) {
    deleteShoppingCategory(id: $id)
  }
`);
const MoveCategory = graphql(`
  mutation MoveShoppingCategory($id: ID!, $parentId: ID, $index: Int) {
    moveShoppingCategory(id: $id, parentId: $parentId, index: $index)
  }
`);
const CreateUnit = graphql(`
  mutation CreateShoppingUnit($input: NameColorInput!) {
    createShoppingUnit(input: $input) {
      id
    }
  }
`);
const UpdateUnit = graphql(`
  mutation UpdateShoppingUnit($id: ID!, $input: NameColorPatch!) {
    updateShoppingUnit(id: $id, input: $input) {
      id
    }
  }
`);
const DeleteUnit = graphql(`
  mutation DeleteShoppingUnit($id: ID!) {
    deleteShoppingUnit(id: $id)
  }
`);
const MoveProducts = graphql(`
  mutation MoveShoppingProducts($ids: [ID!]!, $baseListId: ID!) {
    moveShoppingProducts(ids: $ids, baseListId: $baseListId)
  }
`);

const CreateStorage = graphql(`
  mutation CreateShoppingStorage($input: NameColorInput!) {
    createShoppingStorage(input: $input) {
      id
    }
  }
`);
const UpdateStorage = graphql(`
  mutation UpdateShoppingStorage($id: ID!, $input: NameColorPatch!) {
    updateShoppingStorage(id: $id, input: $input) {
      id
    }
  }
`);
const DeleteStorage = graphql(`
  mutation DeleteShoppingStorage($id: ID!) {
    deleteShoppingStorage(id: $id)
  }
`);
const DuplicateItem = graphql(`
  mutation DuplicateShoppingItem($id: ID!) {
    duplicateShoppingItem(id: $id)
  }
`);
const CreateStore = graphql(`
  mutation CreateShoppingStore($input: NameColorInput!) {
    createShoppingStore(input: $input) {
      id
    }
  }
`);
const UpdateStore = graphql(`
  mutation UpdateShoppingStore($id: ID!, $input: NameColorPatch!) {
    updateShoppingStore(id: $id, input: $input) {
      id
    }
  }
`);
const DeleteStore = graphql(`
  mutation DeleteShoppingStore($id: ID!) {
    deleteShoppingStore(id: $id)
  }
`);
const CreateBaseList = graphql(`
  mutation CreateShoppingBaseList($name: String!) {
    createShoppingBaseList(name: $name)
  }
`);
const RenameBaseList = graphql(`
  mutation RenameShoppingBaseList($id: ID!, $name: String!) {
    renameShoppingBaseList(id: $id, name: $name)
  }
`);
const DeleteBaseList = graphql(`
  mutation DeleteShoppingBaseList($id: ID!) {
    deleteShoppingBaseList(id: $id)
  }
`);
const CreateProduct = graphql(`
  mutation CreateShoppingProduct($input: ShoppingProductInput!) {
    createShoppingProduct(input: $input)
  }
`);
const UpdateProduct = graphql(`
  mutation UpdateShoppingProduct($id: ID!, $input: ShoppingProductInput!) {
    updateShoppingProduct(id: $id, input: $input)
  }
`);
const SetProductsMissing = graphql(`
  mutation SetShoppingProductsMissing($ids: [ID!]!, $missing: Boolean!) {
    setShoppingProductsMissing(ids: $ids, missing: $missing)
  }
`);
const DeleteProduct = graphql(`
  mutation DeleteShoppingProduct($id: ID!) {
    deleteShoppingProduct(id: $id)
  }
`);
const CreateList = graphql(`
  mutation CreateShoppingList($name: String!, $taskIds: [ID!]!, $baseListIds: [ID!]!) {
    createShoppingList(name: $name, taskIds: $taskIds, baseListIds: $baseListIds)
  }
`);
const UpdateList = graphql(`
  mutation UpdateShoppingList($id: ID!, $name: String!, $taskIds: [ID!]!) {
    updateShoppingList(id: $id, name: $name, taskIds: $taskIds)
  }
`);
const SetListClosed = graphql(`
  mutation SetShoppingListClosed($id: ID!, $closed: Boolean!) {
    setShoppingListClosed(id: $id, closed: $closed)
  }
`);
const DuplicateList = graphql(`
  mutation DuplicateShoppingList($id: ID!) {
    duplicateShoppingList(id: $id)
  }
`);
const DeleteList = graphql(`
  mutation DeleteShoppingList($id: ID!) {
    deleteShoppingList(id: $id)
  }
`);
const AttachEntry = graphql(`
  mutation AttachShoppingListEntry($id: ID!, $entryId: ID) {
    attachShoppingListEntry(id: $id, entryId: $entryId)
  }
`);
const AddItem = graphql(`
  mutation AddShoppingItem($listId: ID!, $input: ShoppingItemInput!) {
    addShoppingItem(listId: $listId, input: $input)
  }
`);
const AddProducts = graphql(`
  mutation AddShoppingProducts($listId: ID!, $productIds: [ID!]!) {
    addShoppingProducts(listId: $listId, productIds: $productIds)
  }
`);
const UpdateItem = graphql(`
  mutation UpdateShoppingItem($id: ID!, $input: ShoppingItemInput!) {
    updateShoppingItem(id: $id, input: $input)
  }
`);
const SetItemPurchased = graphql(`
  mutation SetShoppingItemPurchased($id: ID!, $purchased: Boolean!) {
    setShoppingItemPurchased(id: $id, purchased: $purchased)
  }
`);
const SaveItemToBase = graphql(`
  mutation SaveShoppingItemToBase($id: ID!, $baseListId: ID!) {
    saveShoppingItemToBase(id: $id, baseListId: $baseListId)
  }
`);
const DeleteItem = graphql(`
  mutation DeleteShoppingItem($id: ID!) {
    deleteShoppingItem(id: $id)
  }
`);

/**
 * Categories, stores, base lists and their products.
 * @returns {UseQueryResult} Query state.
 */
export function useShoppingData() {
  return useQuery({ queryKey: [...shoppingKey, 'data'], queryFn: () => execute(ShoppingDataDocument) });
}

/**
 * Shopping lists, latest first: all, or those of a task.
 * @param {string | null} [taskId] Task. Optional.
 * @returns {UseQueryResult} Query state.
 */
export function useShoppingLists(taskId: string | null = null) {
  return useQuery({ queryKey: [...shoppingKey, 'lists', taskId], queryFn: async () => (await execute(ShoppingListsDocument, { taskId })).shoppingLists });
}

/**
 * Mutation refreshing the shopping data (and the treasury, which a list may change) once done.
 * @param {(variables: V) => Promise<R>} fn Request.
 * @returns {UseMutationResult<R, Error, V>} Mutation.
 */
function useShoppingMutation<V, R>(fn: (variables: V) => Promise<R>) {
  return useInvalidatingMutation(fn, { invalidate: [shoppingKey] });
}

/**
 * Mutation shown at once in the cached shopping data (put back on failure), refreshed once done.
 * @param {(variables: V) => Promise<R>} fn Request.
 * @param {(queryClient: QueryClient, variables: V) => void} patch Change of the cache.
 * @returns {UseMutationResult<R, Error, V>} Mutation.
 */
function useOptimisticMutation<V, R>(fn: (variables: V) => Promise<R>, patch: (queryClient: QueryClient, variables: V) => void) {
  return useInvalidatingMutation(fn, { invalidate: [shoppingKey], optimistic: patch });
}

/**
 * Changes an item in the cached lists.
 * @param {QueryClient} queryClient Query client.
 * @param {string} id Item id.
 * @param {(item: ShoppingItem) => ShoppingItem} change Change.
 * @returns {void}
 */
function patchItem(queryClient: QueryClient, id: string, change: (item: ShoppingItem) => ShoppingItem): void {
  queryClient.setQueriesData<ShoppingList[]>({ queryKey: [...shoppingKey, 'lists'] }, (lists) =>
    lists?.map((list) => ({ ...list, items: list.items.map((item) => (item.id === id ? change(item) : item)) })),
  );
}

/**
 * Changes products in the cached base lists.
 * @param {QueryClient} queryClient Query client.
 * @param {(product: ShoppingProduct) => ShoppingProduct | null} change Change (null: unchanged).
 * @returns {void}
 */
function patchProducts(queryClient: QueryClient, change: (product: ShoppingProduct) => ShoppingProduct | null): void {
  queryClient.setQueryData<ShoppingDataQuery>([...shoppingKey, 'data'], (data) => data && { ...data, shoppingProducts: data.shoppingProducts.map((product) => change(product) ?? product) });
}

/**
 * Fields of an input as they are cached (empty texts as null).
 * @param {ShoppingItemInput} input Input.
 * @returns {object} Fields.
 */
const cached = (input: ShoppingItemInput) => ({
  name: input.name,
  categoryId: input.categoryId,
  storeId: input.storeId,
  url: input.url || null,
  note: input.note || null,
  quantity: input.quantity,
  unit: input.unit || null,
  unitPrice: input.unitPrice,
  memberIds: input.memberIds ?? [],
  relationIds: input.relationIds ?? [],
  perishable: input.perishable ?? false,
  storageId: input.perishable ? (input.storageId ?? null) : null,
  expiresAt: input.perishable ? (input.expiresAt ?? null) : null,
});

/**
 * Mutations of the shopping lists, their items, the base list and its categories and stores.
 * @returns {object} Mutations.
 */
export function useShoppingMutations() {
  return {
    createCategory: useShoppingMutation(async (input: ShoppingCategoryInput) => (await execute(CreateCategory, { input })).createShoppingCategory),
    updateCategory: useShoppingMutation(async (variables: { id: string; input: ShoppingCategoryInput }) => (await execute(UpdateCategory, variables)).updateShoppingCategory),
    deleteCategory: useShoppingMutation(async (id: string) => (await execute(DeleteCategory, { id })).deleteShoppingCategory),
    moveCategory: useOptimisticMutation(
      async (variables: { id: string; parentId: string | null; index: number }) => (await execute(MoveCategory, variables)).moveShoppingCategory,
      (client, { id, parentId, index }) =>
        client.setQueryData<ShoppingDataQuery>([...shoppingKey, 'data'], (data) => data && { ...data, shoppingCategories: moveInTree(data.shoppingCategories, id, parentId, index) }),
    ),
    createUnit: useShoppingMutation(async (input: ShoppingStoreInput) => (await execute(CreateUnit, { input })).createShoppingUnit),
    // A renamed or deleted unit changes the products and items in it: the lists are refreshed too.
    updateUnit: useShoppingMutation(async (variables: { id: string; input: Partial<ShoppingStoreInput> }) => (await execute(UpdateUnit, variables)).updateShoppingUnit),
    deleteUnit: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteUnit, { id })).deleteShoppingUnit),
    moveProducts: useShoppingMutation(async (variables: { ids: string[]; baseListId: string }) => (await execute(MoveProducts, variables)).moveShoppingProducts),
    createStorage: useShoppingMutation(async (input: ShoppingStoreInput) => (await execute(CreateStorage, { input })).createShoppingStorage),
    updateStorage: useShoppingMutation(async (variables: { id: string; input: Partial<ShoppingStoreInput> }) => (await execute(UpdateStorage, variables)).updateShoppingStorage),
    deleteStorage: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteStorage, { id })).deleteShoppingStorage),
    createStore: useShoppingMutation(async (input: ShoppingStoreInput) => (await execute(CreateStore, { input })).createShoppingStore),
    updateStore: useShoppingMutation(async (variables: { id: string; input: Partial<ShoppingStoreInput> }) => (await execute(UpdateStore, variables)).updateShoppingStore),
    deleteStore: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteStore, { id })).deleteShoppingStore),
    createBaseList: useShoppingMutation(async ({ name }: { name: string }) => (await execute(CreateBaseList, { name })).createShoppingBaseList),
    renameBaseList: useShoppingMutation(async (variables: { id: string; name: string }) => (await execute(RenameBaseList, variables)).renameShoppingBaseList),
    deleteBaseList: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteBaseList, { id })).deleteShoppingBaseList),
    moveBaseList: useOptimisticMutation(
      // The new order of all the base lists (the list moved at its index), saved as the settings lists are.
      (variables: { id: string; index: number; ids: string[] }) => reorderSettingsItems('SHOPPING_BASE_LIST', variables.ids),
      (client, { id, index }) =>
        client.setQueryData<ShoppingDataQuery>([...shoppingKey, 'data'], (data) => {
          const order = data && moveToIndex(data.shoppingBaseLists, id, index);
          if (!data || !order) return data;
          return { ...data, shoppingBaseLists: order.map((baseList, position) => ({ ...baseList, position })) };
        }),
    ),
    createProduct: useShoppingMutation(async (input: ShoppingProductInput) => (await execute(CreateProduct, { input: productVariables(input) })).createShoppingProduct),
    updateProduct: useOptimisticMutation(
      async ({ id, input }: { id: string; input: ShoppingProductInput }) => (await execute(UpdateProduct, { id, input: productVariables(input) })).updateShoppingProduct,
      (client, { id, input }) => patchProducts(client, (product) => (product.id === id ? { ...product, ...cached(input), baseListId: input.baseListId, missing: input.missing } : null)),
    ),
    setMissing: useOptimisticMutation(
      async (variables: { ids: string[]; missing: boolean }) => (await execute(SetProductsMissing, variables)).setShoppingProductsMissing,
      (client, { ids, missing }) => patchProducts(client, (product) => (ids.includes(product.id) ? { ...product, missing } : null)),
    ),
    deleteProduct: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteProduct, { id })).deleteShoppingProduct),
    createList: useShoppingMutation(async (variables: { name: string; taskIds: string[]; baseListIds: string[] }) => (await execute(CreateList, variables)).createShoppingList),
    updateList: useShoppingMutation(async (variables: { id: string; name: string; taskIds: string[] }) => (await execute(UpdateList, variables)).updateShoppingList),
    setClosed: useShoppingMutation(async (variables: { id: string; closed: boolean }) => (await execute(SetListClosed, variables)).setShoppingListClosed),
    duplicateList: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DuplicateList, { id })).duplicateShoppingList),
    deleteList: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteList, { id })).deleteShoppingList),
    // The entry gets lines of split.
    attachEntry: useInvalidatingMutation(async (variables: { id: string; entryId: string | null }) => (await execute(AttachEntry, variables)).attachShoppingListEntry, {
      invalidate: [shoppingKey, treasuryKey],
    }),
    addItem: useShoppingMutation(async ({ listId, input }: { listId: string; input: ShoppingItemInput }) => (await execute(AddItem, { listId, input: itemVariables(input) })).addShoppingItem),
    addProducts: useShoppingMutation(async (variables: { listId: string; productIds: string[] }) => (await execute(AddProducts, variables)).addShoppingProducts),
    updateItem: useOptimisticMutation(
      async ({ id, input }: { id: string; input: ShoppingItemInput }) => (await execute(UpdateItem, { id, input: itemVariables(input) })).updateShoppingItem,
      (client, { id, input }) => patchItem(client, id, (item) => ({ ...item, ...cached(input) })),
    ),
    duplicateItem: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DuplicateItem, { id })).duplicateShoppingItem),
    setPurchased: useOptimisticMutation(
      async (variables: { id: string; purchased: boolean }) => (await execute(SetItemPurchased, variables)).setShoppingItemPurchased,
      (client, { id, purchased }) => patchItem(client, id, (item) => ({ ...item, purchasedAt: purchased ? new Date().toISOString() : null })),
    ),
    saveToBase: useShoppingMutation(async (variables: { id: string; baseListId: string }) => (await execute(SaveItemToBase, variables)).saveShoppingItemToBase),
    deleteItem: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteItem, { id })).deleteShoppingItem),
  };
}

/**
 * GraphQL variables of an item (people always given).
 * @param {ShoppingItemInput} input Item.
 * @returns {object} Variables.
 */
const itemVariables = (input: ShoppingItemInput) => ({ ...input, memberIds: input.memberIds ?? [], relationIds: input.relationIds ?? [] });

/**
 * GraphQL variables of a product (people always given).
 * @param {ShoppingProductInput} input Product.
 * @returns {object} Variables.
 */
const productVariables = (input: ShoppingProductInput) => ({ ...itemVariables(input), baseListId: input.baseListId, missing: input.missing });
