import { done } from '../errors';
import { STOCK_MOVEMENT_KINDS } from '@ordo/shared';
import { prisma } from '../../db';
import * as stock from '../../services/shopping/stock';
import { builder } from '../builder';
import { relationIds } from '../relation-fields';
import { fromDecimal } from '../../services/core/decimal';
import { productInput, productInputFields } from '../product-inputs';
import { treeItemObject } from '../label-inputs';
import { BY_POSITION } from '../../services/core/ordering';

const StockMovementKindEnum = builder.enumType('StockMovementKind', { values: STOCK_MOVEMENT_KINDS, description: 'Why a quantity of the stock changed.' });

treeItemObject('StockLocation', { description: 'Place things are kept (Frigo, Congélateur…), in a tree.' });

builder.prismaObject('StockLot', {
  description: 'Lot of an item of the stock: a quantity and its date.',
  fields: (t) => ({
    id: t.exposeID('id'),
    itemId: t.exposeID('itemId'),
    quantity: t.float({ resolve: (lot) => fromDecimal(lot.quantity) }),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

builder.prismaObject('StockItem', {
  description: 'Item of the stock: a reference followed in stock, or an item of its own; its quantity is that of its lots.',
  fields: (t) => ({
    id: t.exposeID('id'),
    productId: t.exposeID('productId', { nullable: true }),
    label: t.exposeString('label'),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    unit: t.exposeString('unit', { nullable: true }),
    locationId: t.exposeID('locationId', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    perishable: t.exposeBoolean('perishable'),
    position: t.exposeInt('position'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    lots: t.relation('lots', { query: { orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] } }),
    quantity: t.float({
      description: 'Quantity of its lots.',
      select: { lots: { select: { quantity: true } } },
      resolve: (item) => stock.lotsQuantity(item.lots),
    }),
    memberIds: t.idList(relationIds('members')),
    relationIds: t.idList(relationIds('relations')),
    consumable: t.boolean({
      description: 'Used up: that of its reference (an item of its own is).',
      select: { product: { select: { consumable: true } } },
      resolve: (item) => item.product?.consumable ?? true,
    }),
  }),
});

builder.prismaObject('StockMovement', {
  description: 'Change of a quantity of the stock, signed, with where it comes from.',
  fields: (t) => ({
    id: t.exposeID('id'),
    itemId: t.exposeID('itemId'),
    itemLabel: t.string({ select: { item: { select: { label: true } } }, resolve: (movement) => movement.item.label }),
    lotId: t.exposeID('lotId', { nullable: true }),
    kind: t.expose('kind', { type: StockMovementKindEnum }),
    quantity: t.float({ resolve: (movement) => fromDecimal(movement.quantity) }),
    date: t.expose('date', { type: 'DateTime' }),
    note: t.exposeString('note', { nullable: true }),
    source: t.string({
      nullable: true,
      description: 'What it comes from: the shopping list, the sheet, the checklist, the inventory.',
      select: { shoppingItem: { select: { list: { select: { label: true } } } }, sheet: { select: { label: true } }, checklistItem: { select: { label: true } }, count: { select: { date: true } } },
      resolve: (movement) =>
        movement.shoppingItem
          ? `Liste « ${movement.shoppingItem.list.label} »`
          : movement.sheet
            ? `Fiche « ${movement.sheet.label} »`
            : movement.checklistItem
              ? 'Liste à cocher'
              : movement.count
                ? 'Inventaire'
                : null,
    }),
    shoppingListId: t.id({ nullable: true, select: { shoppingItem: { select: { listId: true } } }, resolve: (movement) => movement.shoppingItem?.listId ?? null }),
    sheetId: t.exposeID('sheetId', { nullable: true }),
    countId: t.exposeID('countId', { nullable: true }),
  }),
});

builder.prismaObject('StockCount', {
  description: 'Inventory: the quantities counted on a day.',
  fields: (t) => ({
    id: t.exposeID('id'),
    date: t.expose('date', { type: 'DateTime' }),
    locationId: t.exposeID('locationId', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    lines: t.int({ select: { _count: { select: { movements: true } } }, resolve: (count) => count._count.movements }),
  }),
});

builder.prismaObject('ShoppingDelivery', {
  description: 'Delivery of a remote order: its tracking, where it arrives (delivered or to pick up), when, received or not.',
  fields: (t) => ({
    id: t.exposeID('id'),
    listId: t.exposeID('listId'),
    label: t.exposeString('label', { nullable: true }),
    trackingUrl: t.exposeString('trackingUrl', { nullable: true }),
    pickup: t.exposeBoolean('pickup'),
    windowFrom: t.expose('windowFrom', { type: 'Date', nullable: true }),
    windowTo: t.expose('windowTo', { type: 'Date', nullable: true }),
    address: t.exposeString('address', { nullable: true }),
    lat: t.exposeFloat('lat', { nullable: true }),
    lon: t.exposeFloat('lon', { nullable: true }),
    receivedAt: t.expose('receivedAt', { type: 'DateTime', nullable: true }),
    position: t.exposeInt('position'),
  }),
});

/** Quantity in stock of a reference. */
const ProductStockRef = builder.objectRef<{ productId: string; quantity: number }>('ProductStock').implement({
  fields: (t) => ({ productId: t.exposeID('productId'), quantity: t.exposeFloat('quantity') }),
});

const LocationInput = builder.inputType('StockLocationInput', { fields: (t) => ({ label: t.string({ required: true }), color: t.string(), parentId: t.id() }) });
const ItemInput = builder.inputType('StockItemInput', {
  fields: (t) => ({
    productId: t.id(),
    label: t.string({ required: true }),
    ...productInputFields(t, { people: true, perishable: true }),
    locationId: t.id(),
    quantity: t.float({ description: 'New item: its quantity to start with.' }),
    expiresAt: t.field({ type: 'Date', description: 'New item: the date of its first lot.' }),
  }),
});
const MoveInput = builder.inputType('StockMoveInput', {
  fields: (t) => ({
    itemId: t.id({ required: true }),
    kind: t.field({ type: StockMovementKindEnum, required: true }),
    quantity: t.float({ required: true }),
    lotId: t.id(),
    expiresAt: t.field({ type: 'Date' }),
    note: t.string(),
  }),
});
const CountLineInput = builder.inputType('StockCountLineInput', { fields: (t) => ({ itemId: t.id({ required: true }), counted: t.float({ required: true }) }) });
const CountInput = builder.inputType('StockCountInput', {
  fields: (t) => ({ locationId: t.id(), note: t.string(), lines: t.field({ type: [CountLineInput], required: true }) }),
});
const ProductStockInput = builder.inputType('ProductStockInput', {
  fields: (t) => ({ stockTracked: t.boolean({ required: true }), consumable: t.boolean({ required: true }), autoStock: t.boolean({ required: true }), stockLocationId: t.id() }),
});
const PurchaseInput = builder.inputType('StockPurchaseInput', {
  fields: (t) => ({ shoppingItemId: t.id({ required: true }), quantity: t.float({ required: true }), locationId: t.id(), expiresAt: t.field({ type: 'Date' }) }),
});
const OrderInput = builder.inputType('ShoppingOrderInput', {
  fields: (t) => ({ remote: t.boolean({ required: true }), deliveryAddress: t.string(), deliveryLat: t.float(), deliveryLon: t.float() }),
});
const DeliveryInput = builder.inputType('ShoppingDeliveryInput', {
  fields: (t) => ({
    label: t.string(),
    trackingUrl: t.string(),
    pickup: t.boolean({ required: true }),
    windowFrom: t.field({ type: 'Date' }),
    windowTo: t.field({ type: 'Date' }),
    address: t.string(),
    lat: t.float(),
    lon: t.float(),
    itemIds: t.idList({ required: true }),
  }),
});

/**
 * Item input as the service reads it.
 * @param {typeof ItemInput.$inferInput} input Input.
 * @returns {import('@ordo/shared').NewStockItemInput} Item.
 */
const itemInput = (input: typeof ItemInput.$inferInput) => ({
  productId: input.productId || null,
  label: input.label,
  ...productInput(input),
  locationId: input.locationId || null,
  expiresAt: input.expiresAt ?? null,
});

/**
 * Delivery input as the service reads it.
 * @param {typeof DeliveryInput.$inferInput} input Input.
 * @returns {import('@ordo/shared').ShoppingDeliveryInput} Delivery.
 */
const deliveryInput = (input: typeof DeliveryInput.$inferInput) => ({
  label: input.label ?? null,
  trackingUrl: input.trackingUrl ?? null,
  pickup: input.pickup,
  windowFrom: input.windowFrom ?? null,
  windowTo: input.windowTo ?? null,
  address: input.address ?? null,
  lat: input.lat ?? null,
  lon: input.lon ?? null,
  itemIds: input.itemIds,
});

builder.queryFields((t) => ({
  stockLocations: t.prismaField({
    type: ['StockLocation'],
    resolve: (query) => prisma.stockLocation.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  stockItems: t.prismaField({
    type: ['StockItem'],
    description: 'Items of the stock, in their order.',
    resolve: (query) => prisma.stockItem.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  stockMovements: t.prismaField({
    type: ['StockMovement'],
    description: 'Movements of the stock, latest first: all, or those of an item.',
    args: { itemId: t.arg.id() },
    resolve: (query, _root, { itemId }) => prisma.stockMovement.findMany({ ...query, where: itemId ? { itemId: itemId } : {}, orderBy: { date: 'desc' }, take: 2000 }),
  }),
  stockCounts: t.prismaField({
    type: ['StockCount'],
    description: 'Inventories, latest first.',
    resolve: (query) => prisma.stockCount.findMany({ ...query, orderBy: { date: 'desc' } }),
  }),
  productStock: t.field({
    type: [ProductStockRef],
    description: 'Quantities in stock of the references (for the shopping lists).',
    resolve: () => stock.stockByProduct(),
  }),
}));

builder.mutationFields((t) => ({
  createStockLocation: t.id({
    args: { input: t.arg({ type: LocationInput, required: true }) },
    resolve: async (_root, { input }) => (await stock.createLocation({ label: input.label, color: input.color ?? null, parentId: input.parentId || null })).id,
  }),
  updateStockLocation: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: LocationInput, required: true }) },
    resolve: (_root, { id, input }) => done(stock.updateLocation(id, { label: input.label, color: input.color ?? null, parentId: input.parentId || null })),
  }),
  moveStockLocation: t.boolean({
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int() },
    resolve: (_root, { id, parentId, index }) => done(stock.moveLocation(id, parentId || null, index)),
  }),
  deleteStockLocation: t.boolean({ args: { id: t.arg.id({ required: true }) }, resolve: (_root, { id }) => done(stock.deleteLocation(id)) }),
  createStockItem: t.id({ args: { input: t.arg({ type: ItemInput, required: true }) }, resolve: async (_root, { input }) => (await stock.createStockItem(itemInput(input))).id }),
  updateStockItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ItemInput, required: true }) },
    resolve: (_root, { id, input }) => done(stock.updateStockItem(id, itemInput(input))),
  }),
  deleteStockItem: t.boolean({ args: { id: t.arg.id({ required: true }) }, resolve: (_root, { id }) => done(stock.deleteStockItem(id)) }),
  moveStock: t.float({
    description: 'Quantity in or out of an item by hand; returns the quantity moved (signed).',
    args: { input: t.arg({ type: MoveInput, required: true }) },
    resolve: (_root, { input }) =>
      stock.moveStock({
        itemId: input.itemId,
        kind: input.kind as 'PURCHASE' | 'CONSUMPTION' | 'LOSS' | 'CORRECTION',
        quantity: input.quantity,
        lotId: input.lotId || null,
        expiresAt: input.expiresAt ?? null,
        note: input.note ?? null,
      }),
  }),
  setStockLotExpiry: t.boolean({
    args: { id: t.arg.id({ required: true }), expiresAt: t.arg({ type: 'Date' }) },
    resolve: (_root, { id, expiresAt }) => done(stock.setLotExpiry(id, expiresAt ?? null)),
  }),
  recordStockCount: t.id({
    args: { input: t.arg({ type: CountInput, required: true }) },
    resolve: async (_root, { input }) =>
      (
        await stock.recordCount({
          locationId: input.locationId || null,
          note: input.note ?? null,
          lines: input.lines.map((line) => ({ itemId: line.itemId, counted: line.counted })),
        })
      ).id,
  }),
  setProductStock: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProductStockInput, required: true }) },
    resolve: (_root, { id, input }) => done(stock.setProductStock(id, { ...input, stockLocationId: input.stockLocationId || null })),
  }),
  addStockPurchase: t.boolean({
    description: 'Adds an item bought on a shopping list to the stock.',
    args: { input: t.arg({ type: PurchaseInput, required: true }) },
    resolve: (_root, { input }) =>
      done(stock.addPurchase({ shoppingItemId: input.shoppingItemId, quantity: input.quantity, locationId: input.locationId || null, expiresAt: input.expiresAt ?? null })),
  }),
  setShoppingOrder: t.boolean({
    args: { listId: t.arg.id({ required: true }), input: t.arg({ type: OrderInput, required: true }) },
    resolve: (_root, { listId, input }) =>
      done(
        stock.setShoppingOrder(listId, {
          remote: input.remote,
          deliveryAddress: input.deliveryAddress ?? null,
          deliveryLat: input.deliveryLat ?? null,
          deliveryLon: input.deliveryLon ?? null,
        }),
      ),
  }),
  createShoppingDelivery: t.id({
    args: { listId: t.arg.id({ required: true }), input: t.arg({ type: DeliveryInput, required: true }) },
    resolve: async (_root, { listId, input }) => (await stock.createDelivery(listId, deliveryInput(input))).id,
  }),
  updateShoppingDelivery: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: DeliveryInput, required: true }) },
    resolve: (_root, { id, input }) => done(stock.updateDelivery(id, deliveryInput(input))),
  }),
  deleteShoppingDelivery: t.boolean({ args: { id: t.arg.id({ required: true }) }, resolve: (_root, { id }) => done(stock.deleteDelivery(id)) }),
  setShoppingDeliveryReceived: t.idList({
    description: 'Marks a delivery received (its items ticked as bought) or not; returns the items ticked now.',
    args: { id: t.arg.id({ required: true }), received: t.arg.boolean({ required: true }) },
    resolve: (_root, { id, received }) => stock.setDeliveryReceived(id, received),
  }),
}));
