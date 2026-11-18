import type { NewStockItemInput, ProductStockInput, ShoppingDeliveryInput, ShoppingOrderInput, StockCountInput, StockLocationInput, StockMoveInput, StockPurchaseInput } from '@ordo/shared';
import { useInvalidatingMutation } from '../../../lib/mutation';
import { shoppingKey } from '../../shopping/api';
import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { StockCountsQuery, StockItemsQuery, StockLocationsQuery, StockMovementsQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type StockLocation = StockLocationsQuery['stockLocations'][number];
export type StockItem = StockItemsQuery['stockItems'][number];
export type StockLot = StockItem['lots'][number];
export type StockMovement = StockMovementsQuery['stockMovements'][number];
export type StockCount = StockCountsQuery['stockCounts'][number];

export const stockKey = ['stock'] as const;

const StockLocationsDocument = graphql(`
  query StockLocations {
    stockLocations {
      id
      archived
      label
      color
      iconUrl
      parentId
      position
    }
  }
`);

const StockItemsDocument = graphql(`
  query StockItems {
    stockItems {
      id
      archived
      productId
      label
      categoryId
      unit
      locationId
      note
      perishable
      position
      createdAt
      updatedAt
      quantity
      consumable
      memberIds
      relationIds
      lots {
        id
        quantity
        expiresAt
        createdAt
      }
    }
  }
`);

const StockMovementsDocument = graphql(`
  query StockMovements($itemId: ID) {
    stockMovements(itemId: $itemId) {
      id
      itemId
      itemLabel
      lotId
      kind
      quantity
      date
      note
      source
      shoppingListId
      sheetId
      countId
    }
  }
`);

const StockCountsDocument = graphql(`
  query StockCounts {
    stockCounts {
      id
      date
      locationId
      note
      lines
    }
  }
`);

const ProductStockDocument = graphql(`
  query ProductStock {
    productStock {
      productId
      quantity
    }
  }
`);

const CreateLocation = graphql(`
  mutation CreateStockLocation($input: StockLocationInput!) {
    createStockLocation(input: $input)
  }
`);
const UpdateLocation = graphql(`
  mutation UpdateStockLocation($id: ID!, $input: StockLocationInput!) {
    updateStockLocation(id: $id, input: $input)
  }
`);
const MoveLocation = graphql(`
  mutation MoveStockLocation($id: ID!, $parentId: ID, $index: Int) {
    moveStockLocation(id: $id, parentId: $parentId, index: $index)
  }
`);
const DeleteLocation = graphql(`
  mutation DeleteStockLocation($id: ID!) {
    deleteStockLocation(id: $id)
  }
`);
const CreateItem = graphql(`
  mutation CreateStockItem($input: StockItemInput!) {
    createStockItem(input: $input)
  }
`);
const UpdateItem = graphql(`
  mutation UpdateStockItem($id: ID!, $input: StockItemInput!) {
    updateStockItem(id: $id, input: $input)
  }
`);
const DeleteItem = graphql(`
  mutation DeleteStockItem($id: ID!) {
    deleteStockItem(id: $id)
  }
`);
const MoveStock = graphql(`
  mutation MoveStock($input: StockMoveInput!) {
    moveStock(input: $input)
  }
`);
const SetLotExpiry = graphql(`
  mutation SetStockLotExpiry($id: ID!, $expiresAt: Date) {
    setStockLotExpiry(id: $id, expiresAt: $expiresAt)
  }
`);
const RecordCount = graphql(`
  mutation RecordStockCount($input: StockCountInput!) {
    recordStockCount(input: $input)
  }
`);
const SetProductStock = graphql(`
  mutation SetProductStock($id: ID!, $input: ProductStockInput!) {
    setProductStock(id: $id, input: $input)
  }
`);
const AddPurchase = graphql(`
  mutation AddStockPurchase($input: StockPurchaseInput!) {
    addStockPurchase(input: $input)
  }
`);
const SetOrder = graphql(`
  mutation SetShoppingOrder($listId: ID!, $input: ShoppingOrderInput!) {
    setShoppingOrder(listId: $listId, input: $input)
  }
`);
const CreateDelivery = graphql(`
  mutation CreateShoppingDelivery($listId: ID!, $input: ShoppingDeliveryInput!) {
    createShoppingDelivery(listId: $listId, input: $input)
  }
`);
const UpdateDelivery = graphql(`
  mutation UpdateShoppingDelivery($id: ID!, $input: ShoppingDeliveryInput!) {
    updateShoppingDelivery(id: $id, input: $input)
  }
`);
const DeleteDelivery = graphql(`
  mutation DeleteShoppingDelivery($id: ID!) {
    deleteShoppingDelivery(id: $id)
  }
`);
const SetDeliveryReceived = graphql(`
  mutation SetShoppingDeliveryReceived($id: ID!, $received: Boolean!) {
    setShoppingDeliveryReceived(id: $id, received: $received)
  }
`);

/**
 * Places of the stock, in their order.
 * @returns {object} Query.
 */
export function useStockLocations() {
  return useQuery({ queryKey: [...stockKey, 'locations'], queryFn: async () => (await execute(StockLocationsDocument)).stockLocations });
}

/**
 * Items of the stock, with their lots.
 * @returns {object} Query.
 */
export function useStockItems() {
  return useQuery({ queryKey: [...stockKey, 'items'], queryFn: async () => (await execute(StockItemsDocument)).stockItems });
}

/**
 * Movements of the stock, latest first: all, or those of an item.
 * @param {string | null} [itemId] Item. Optional.
 * @returns {object} Query.
 */
export function useStockMovements(itemId: string | null = null) {
  return useQuery({ queryKey: [...stockKey, 'movements', itemId], queryFn: async () => (await execute(StockMovementsDocument, { itemId })).stockMovements });
}

/**
 * Inventories, latest first.
 * @returns {object} Query.
 */
export function useStockCounts() {
  return useQuery({ queryKey: [...stockKey, 'counts'], queryFn: async () => (await execute(StockCountsDocument)).stockCounts });
}

/**
 * Quantities in stock of the references, by reference.
 * @returns {Map<string, number>} Quantities.
 */
export function useProductStock(): Map<string, number> {
  const { data } = useQuery({ queryKey: [...stockKey, 'products'], queryFn: async () => (await execute(ProductStockDocument)).productStock });
  return new Map((data ?? []).map((row) => [row.productId, row.quantity]));
}

/**
 * Mutation refreshing the stock and the shopping once done.
 * @param {(variables: V) => Promise<R>} fn Mutation.
 * @returns {object} Mutation.
 */
function useStockMutation<V, R>(fn: (variables: V) => Promise<R>) {
  return useInvalidatingMutation(fn, { invalidate: [stockKey, shoppingKey] });
}

/**
 * Changes of the stock, of the stock settings of the references and of the remote orders.
 * @returns {object} Mutations.
 */
export function useStockMutations() {
  return {
    createLocation: useStockMutation(async (input: StockLocationInput) => (await execute(CreateLocation, { input })).createStockLocation),
    updateLocation: useStockMutation(async (variables: { id: string; input: StockLocationInput }) => (await execute(UpdateLocation, variables)).updateStockLocation),
    moveLocation: useStockMutation(async (variables: { id: string; parentId: string | null; index: number }) => (await execute(MoveLocation, variables)).moveStockLocation),
    deleteLocation: useStockMutation(async (id: string) => (await execute(DeleteLocation, { id })).deleteStockLocation),
    createItem: useStockMutation(async (input: NewStockItemInput) => (await execute(CreateItem, { input })).createStockItem),
    updateItem: useStockMutation(async (variables: { id: string; input: NewStockItemInput }) => (await execute(UpdateItem, variables)).updateStockItem),
    deleteItem: useStockMutation(async (id: string) => (await execute(DeleteItem, { id })).deleteStockItem),
    move: useStockMutation(async (input: StockMoveInput) => (await execute(MoveStock, { input })).moveStock),
    setLotExpiry: useStockMutation(async (variables: { id: string; expiresAt: string | null }) => (await execute(SetLotExpiry, variables)).setStockLotExpiry),
    recordCount: useStockMutation(async (input: StockCountInput) => (await execute(RecordCount, { input })).recordStockCount),
    setProductStock: useStockMutation(async (variables: { id: string; input: ProductStockInput }) => (await execute(SetProductStock, variables)).setProductStock),
    addPurchase: useStockMutation(async (input: StockPurchaseInput) => (await execute(AddPurchase, { input })).addStockPurchase),
    setOrder: useStockMutation(async (variables: { listId: string; input: ShoppingOrderInput }) => (await execute(SetOrder, variables)).setShoppingOrder),
    createDelivery: useStockMutation(async (variables: { listId: string; input: ShoppingDeliveryInput }) => (await execute(CreateDelivery, variables)).createShoppingDelivery),
    updateDelivery: useStockMutation(async (variables: { id: string; input: ShoppingDeliveryInput }) => (await execute(UpdateDelivery, variables)).updateShoppingDelivery),
    deleteDelivery: useStockMutation(async (id: string) => (await execute(DeleteDelivery, { id })).deleteShoppingDelivery),
    setDeliveryReceived: useStockMutation(async (variables: { id: string; received: boolean }) => (await execute(SetDeliveryReceived, variables)).setShoppingDeliveryReceived),
  };
}
