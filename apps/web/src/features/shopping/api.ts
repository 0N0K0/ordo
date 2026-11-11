import type { ShoppingCategoryInput, ShoppingItemInput, ShoppingProductInput, ShoppingStoreInput } from '@ordo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { ShoppingDataQuery, ShoppingListsQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type ShoppingCategory = ShoppingDataQuery['shoppingCategories'][number];
export type ShoppingStore = ShoppingDataQuery['shoppingStores'][number];
export type ShoppingProduct = ShoppingDataQuery['shoppingProducts'][number];
export type ShoppingList = ShoppingListsQuery['shoppingLists'][number];
export type ShoppingItem = ShoppingList['items'][number];

const shoppingKey = ['shopping'] as const;

const ShoppingDataDocument = graphql(`
  query ShoppingData {
    shoppingCategories {
      id
      name
      color
      parentId
    }
    shoppingStores {
      id
      name
      color
      position
    }
    shoppingProducts {
      id
      name
      categoryId
      storeId
      url
      note
      quantity
      unit
      unitPrice
      missing
      lastPurchasedAt
      lastPrice
      memberIds
      relationIds
    }
  }
`);

const ShoppingListsDocument = graphql(`
  query ShoppingLists($taskId: ID) {
    shoppingLists(taskId: $taskId) {
      id
      name
      taskId
      entryId
      entry {
        id
        date
        label
        amount
      }
      closed
      closedAt
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
        purchasedAt
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
const CreateStore = graphql(`
  mutation CreateShoppingStore($input: ShoppingStoreInput!) {
    createShoppingStore(input: $input)
  }
`);
const UpdateStore = graphql(`
  mutation UpdateShoppingStore($id: ID!, $input: ShoppingStorePatch!) {
    updateShoppingStore(id: $id, input: $input)
  }
`);
const DeleteStore = graphql(`
  mutation DeleteShoppingStore($id: ID!) {
    deleteShoppingStore(id: $id)
  }
`);
const MoveStore = graphql(`
  mutation MoveShoppingStore($id: ID!, $index: Int!) {
    moveShoppingStore(id: $id, index: $index)
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
  mutation CreateShoppingList($name: String!, $taskId: ID, $fromMissing: Boolean!) {
    createShoppingList(name: $name, taskId: $taskId, fromMissing: $fromMissing)
  }
`);
const UpdateList = graphql(`
  mutation UpdateShoppingList($id: ID!, $name: String!, $taskId: ID) {
    updateShoppingList(id: $id, name: $name, taskId: $taskId)
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
  mutation AddShoppingItem($listId: ID!, $productId: ID, $input: ShoppingItemInput) {
    addShoppingItem(listId: $listId, productId: $productId, input: $input)
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
  mutation SaveShoppingItemToBase($id: ID!) {
    saveShoppingItemToBase(id: $id)
  }
`);
const DeleteItem = graphql(`
  mutation DeleteShoppingItem($id: ID!) {
    deleteShoppingItem(id: $id)
  }
`);

/**
 * Categories, stores and products of the base list.
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKey }),
  });
}

/**
 * Item ticked as bought or not, shown at once (the lists and the base list are refreshed after).
 * @returns {UseMutationResult} Mutation.
 */
function usePurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: string; purchased: boolean }) => (await execute(SetItemPurchased, variables)).setShoppingItemPurchased,
    onMutate: async ({ id, purchased }) => {
      await queryClient.cancelQueries({ queryKey: [...shoppingKey, 'lists'] });
      const previous = queryClient.getQueriesData<ShoppingList[]>({ queryKey: [...shoppingKey, 'lists'] });
      const purchasedAt = purchased ? new Date().toISOString() : null;
      queryClient.setQueriesData<ShoppingList[]>({ queryKey: [...shoppingKey, 'lists'] }, (lists) =>
        lists?.map((list) => ({ ...list, items: list.items.map((item) => (item.id === id ? { ...item, purchasedAt } : item)) })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: shoppingKey }),
  });
}

/**
 * Mutations of the shopping lists, their items, the base list and its categories and stores.
 * @returns {object} Mutations.
 */
export function useShoppingMutations() {
  const queryClient = useQueryClient();
  return {
    createCategory: useShoppingMutation(async (input: ShoppingCategoryInput) => (await execute(CreateCategory, { input })).createShoppingCategory),
    updateCategory: useShoppingMutation(async (variables: { id: string; input: ShoppingCategoryInput }) => (await execute(UpdateCategory, variables)).updateShoppingCategory),
    deleteCategory: useShoppingMutation(async (id: string) => (await execute(DeleteCategory, { id })).deleteShoppingCategory),
    createStore: useShoppingMutation(async (input: ShoppingStoreInput) => (await execute(CreateStore, { input })).createShoppingStore),
    updateStore: useShoppingMutation(async (variables: { id: string; input: Partial<ShoppingStoreInput> }) => (await execute(UpdateStore, variables)).updateShoppingStore),
    deleteStore: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteStore, { id })).deleteShoppingStore),
    moveStore: useShoppingMutation(async (variables: { id: string; index: number }) => (await execute(MoveStore, variables)).moveShoppingStore),
    createProduct: useShoppingMutation(async (input: ShoppingProductInput) => (await execute(CreateProduct, { input: productVariables(input) })).createShoppingProduct),
    updateProduct: useShoppingMutation(
      async ({ id, input }: { id: string; input: ShoppingProductInput }) => (await execute(UpdateProduct, { id, input: productVariables(input) })).updateShoppingProduct,
    ),
    setMissing: useShoppingMutation(async (variables: { ids: string[]; missing: boolean }) => (await execute(SetProductsMissing, variables)).setShoppingProductsMissing),
    deleteProduct: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteProduct, { id })).deleteShoppingProduct),
    createList: useShoppingMutation(async (variables: { name: string; taskId: string | null; fromMissing: boolean }) => (await execute(CreateList, variables)).createShoppingList),
    updateList: useShoppingMutation(async (variables: { id: string; name: string; taskId: string | null }) => (await execute(UpdateList, variables)).updateShoppingList),
    setClosed: useShoppingMutation(async (variables: { id: string; closed: boolean }) => (await execute(SetListClosed, variables)).setShoppingListClosed),
    duplicateList: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DuplicateList, { id })).duplicateShoppingList),
    deleteList: useShoppingMutation(async ({ id }: { id: string }) => (await execute(DeleteList, { id })).deleteShoppingList),
    attachEntry: useShoppingMutation(async (variables: { id: string; entryId: string | null }) => {
      const done = (await execute(AttachEntry, variables)).attachShoppingListEntry;
      // The entry got lines of split.
      await queryClient.invalidateQueries({ queryKey: ['accounting', 'treasury'] });
      return done;
    }),
    addItem: useShoppingMutation(
      async (variables: { listId: string; productId?: string | null; input?: ShoppingItemInput | null }) =>
        (await execute(AddItem, { listId: variables.listId, productId: variables.productId ?? null, input: variables.input ? itemVariables(variables.input) : null })).addShoppingItem,
    ),
    updateItem: useShoppingMutation(async ({ id, input }: { id: string; input: ShoppingItemInput }) => (await execute(UpdateItem, { id, input: itemVariables(input) })).updateShoppingItem),
    setPurchased: usePurchaseMutation(),
    saveToBase: useShoppingMutation(async ({ id }: { id: string }) => (await execute(SaveItemToBase, { id })).saveShoppingItemToBase),
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
const productVariables = (input: ShoppingProductInput) => ({ ...itemVariables(input), missing: input.missing });
