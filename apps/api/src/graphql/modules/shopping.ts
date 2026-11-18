import { done } from '../errors';
import { prisma } from '../../db';
import * as shopping from '../../services/shopping/shopping';
import { readSheetSources } from '@ordo/shared';
import { BY_POSITION } from '../../services/core/ordering';
import { builder, type BuilderTypes, type InputFields } from '../builder';
import { relationIds } from '../relation-fields';
import { labelMutations, labelObject, NameColorInput, NameColorPatch, treeItemObject } from '../label-inputs';
import { SheetSourceRef } from './sheets';
import { fromDecimal } from '../../services/core/decimal';
import { productInput, productInputFields, purchaseInput, purchaseInputFields } from '../product-inputs';

treeItemObject('ShoppingCategory', { description: 'Category of the shopping products, in a tree.', positionDescription: 'Manual order among its siblings.' });
builder.prismaObjectFields('ShoppingCategory', (t) => ({
  baseListIds: t.idList(relationIds('baseLists', 'Base lists it is offered in (none: all; a sub-category without any takes those of its parent).')),
}));

labelObject('ShoppingStorage', { description: 'Storage mode of perishable products (fresh, frozen…).' });

labelObject('ShoppingUnit', { description: 'Unit of quantity of the products and items (« kg », « boîte »…); they keep it as text.', colorDescription: 'Unused.' });

labelObject('ShoppingStore', { description: 'Store (or supplier) a product is bought at.' });

builder.prismaObject('ShoppingBaseList', {
  description: 'Base list ("liste type"): products usually bought together.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    position: t.exposeInt('position'),
  }),
});

/** What a product of a base list and an item of a shopping list have in common. */
interface BoughtShape {
  categoryId: string | null;
  storeId: string | null;
  url: string | null;
  note: string | null;
  quantity: Parameters<typeof fromDecimal>[0];
  unit: string | null;
  unitPrice: Parameters<typeof fromDecimal>[0];
  perishable: boolean;
  storageId: string | null;
}

/**
 * Fields of what is bought, on a base list or a shopping list: its category, store, link, note, quantity, unit, price
 * and how it is kept.
 * @param {PothosSchemaTypes.FieldBuilder<BuilderTypes, BoughtShape, 'PrismaObject'>} t Field builder.
 * @returns {object} Fields.
 */
const boughtFields = (t: PothosSchemaTypes.FieldBuilder<BuilderTypes, BoughtShape, 'PrismaObject'>) => ({
  categoryId: t.exposeID('categoryId', { nullable: true }),
  storeId: t.exposeID('storeId', { nullable: true }),
  url: t.exposeString('url', { nullable: true }),
  note: t.exposeString('note', { nullable: true }),
  quantity: t.float({ nullable: true, resolve: (item) => fromDecimal(item.quantity) }),
  unit: t.exposeString('unit', { nullable: true }),
  unitPrice: t.float({ nullable: true, resolve: (item) => fromDecimal(item.unitPrice) }),
  perishable: t.exposeBoolean('perishable'),
  storageId: t.exposeID('storageId', { nullable: true }),
});

builder.prismaObject('ShoppingProduct', {
  description: 'Product of a base list: what is usually bought, marked when missing.',
  fields: (t) => ({
    id: t.exposeID('id'),
    baseListId: t.exposeID('baseListId'),
    name: t.exposeString('name'),
    stockTracked: t.exposeBoolean('stockTracked', { description: 'Followed in the stock.' }),
    consumable: t.exposeBoolean('consumable', { description: 'Used up (taken from the stock by sheets and checklists).' }),
    autoStock: t.exposeBoolean('autoStock', { description: 'Added to the stock by itself once bought (else proposed).' }),
    stockLocationId: t.exposeID('stockLocationId', { nullable: true, description: 'Place it goes to in the stock.' }),
    ...boughtFields(t as unknown as Parameters<typeof boughtFields>[0]),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true, description: 'Date of the last purchase: once past, the product is marked missing.' }),
    missing: t.exposeBoolean('missing'),
    lastPurchasedAt: t.expose('lastPurchasedAt', { type: 'DateTime', nullable: true }),
    lastPrice: t.float({ nullable: true, resolve: (product) => fromDecimal(product.lastPrice) }),
    memberIds: t.idList(relationIds('members')),
    relationIds: t.idList(relationIds('relations')),
  }),
});

builder.prismaObject('ShoppingItem', {
  description: 'Item of a shopping list: a copy of a product of the base list, or an item of this list only.',
  fields: (t) => ({
    id: t.exposeID('id'),
    listId: t.exposeID('listId'),
    productId: t.exposeID('productId', { nullable: true }),
    name: t.exposeString('name'),
    ...boughtFields(t as unknown as Parameters<typeof boughtFields>[0]),
    expiresAt: t.expose('expiresAt', { type: 'Date', nullable: true }),
    purchasedAt: t.expose('purchasedAt', { type: 'DateTime', nullable: true }),
    optional: t.exposeBoolean('optional', { description: 'Not needed: bought if possible (the list is done without it).' }),
    position: t.exposeInt('position'),
    memberIds: t.idList(relationIds('members')),
    relationIds: t.idList(relationIds('relations')),
    deliveryId: t.exposeID('deliveryId', { nullable: true, description: 'Delivery of the remote order it comes with.' }),
    sheetSources: t.field({
      type: [SheetSourceRef],
      description: 'Sheets it comes from, with their share of its quantity; none: added by hand.',
      resolve: (item) => readSheetSources(item.sheetSources),
    }),
  }),
});

builder.prismaObject('ShoppingList', {
  description: 'Shopping list, possibly attached to some tasks and to the treasury entry paying it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    taskIds: t.idList(relationIds('tasks')),
    entryId: t.exposeID('entryId', { nullable: true }),
    entry: t.relation('entry', { nullable: true, description: 'Treasury entry paying the list.' }),
    closedAt: t.expose('closedAt', { type: 'DateTime', nullable: true }),
    closed: t.boolean({
      description: 'Closed by hand, or along with its tasks (all of them closed).',
      select: { closedAt: true, tasks: { select: { closedAt: true } } },
      resolve: (list) => list.closedAt !== null || shopping.tasksClosed(list.tasks),
    }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    items: t.relation('items', { query: { orderBy: BY_POSITION } }),
    remote: t.exposeBoolean('remote', { description: 'Ordered remotely: followed by its deliveries.' }),
    deliveryAddress: t.exposeString('deliveryAddress', { nullable: true }),
    deliveryLat: t.exposeFloat('deliveryLat', { nullable: true }),
    deliveryLon: t.exposeFloat('deliveryLon', { nullable: true }),
    deliveries: t.relation('deliveries', { query: { orderBy: [{ position: 'asc' }, { windowFrom: 'asc' }] } }),
  }),
});

const CategoryInput = builder.inputType('ShoppingCategoryInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string(), parentId: t.id(), baseListIds: t.idList() }),
});



/**
 * Fields of a shopping product and of a shopping item.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const shoppingFields = (t: InputFields) => ({
  name: t.string({ required: true }),
  ...productInputFields(t, { people: true, perishable: false }),
  ...purchaseInputFields(t),
  unitPrice: t.float(),
  expiresAt: t.field({ type: 'Date' }),
});

const ProductInput = builder.inputType('ShoppingProductInput', {
  fields: (t) => ({ ...shoppingFields(t), baseListId: t.id({ required: true }), missing: t.boolean({ required: true }) }),
});

const ItemInput = builder.inputType('ShoppingItemInput', { fields: (t) => ({ ...shoppingFields(t), optional: t.boolean({ description: 'Not needed: bought if possible.' }) }) });

/**
 * Item input with omitted optional fields as null (an empty id too, as in the sheets and the stock).
 * @param {typeof ItemInput.$inferInput} input GraphQL input.
 * @returns {object} Service input.
 */
const itemInput = (input: typeof ItemInput.$inferInput) => ({
  ...input,
  ...productInput(input),
  ...purchaseInput(input),
  unitPrice: input.unitPrice ?? null,
  expiresAt: input.expiresAt ?? null,
  optional: input.optional ?? false,
});

/**
 * Category input with omitted optional fields as null.
 * @param {typeof CategoryInput.$inferInput} input GraphQL input.
 * @returns {object} Service input.
 */
const categoryInput = (input: typeof CategoryInput.$inferInput) => ({
  name: input.name,
  color: input.color ?? null,
  parentId: input.parentId || null,
  baseListIds: input.baseListIds ?? [],
});

builder.queryFields((t) => ({
  shoppingCategories: t.prismaField({
    type: ['ShoppingCategory'],
    description: 'Categories of the shopping products (a tree).',
    resolve: (query) => prisma.shoppingCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  shoppingStores: t.prismaField({
    type: ['ShoppingStore'],
    resolve: (query) => prisma.shoppingStore.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  shoppingBaseLists: t.prismaField({
    type: ['ShoppingBaseList'],
    description: 'Base lists ("listes types").',
    resolve: (query) => prisma.shoppingBaseList.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  shoppingUnits: t.prismaField({
    type: ['ShoppingUnit'],
    description: 'Units of quantity, in their order.',
    resolve: (query) => prisma.shoppingUnit.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  shoppingStorages: t.prismaField({
    type: ['ShoppingStorage'],
    description: 'Storage modes of the perishable products.',
    resolve: (query) => prisma.shoppingStorage.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  shoppingProducts: t.prismaField({
    type: ['ShoppingProduct'],
    description: 'Products of all the base lists (references).',
    resolve: (query) => prisma.shoppingProduct.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  shoppingLists: t.prismaField({
    type: ['ShoppingList'],
    description: 'Shopping lists, latest first: all, or those of a task.',
    args: { taskId: t.arg.id() },
    resolve: (query, _root, { taskId }) =>
      prisma.shoppingList.findMany({ ...query, where: taskId ? { tasks: { some: { id: taskId } } } : {}, orderBy: { createdAt: 'desc' } }),
  }),
}));

builder.mutationFields((t) => ({
  createShoppingCategory: t.id({
    args: { input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { input }) => (await shopping.createCategory(categoryInput(input))).id,
  }),
  updateShoppingCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CategoryInput, required: true }) },
    resolve: (_root, { id, input }) => done(shopping.updateCategory(id, categoryInput(input))),
  }),
  moveShoppingCategory: t.boolean({
    description: 'Moves a category under another one (parentId), or to the top level (parentId null), at an index among its siblings (last without).',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int() },
    resolve: (_root, { id, parentId, index }) => done(shopping.moveCategory(id, parentId || null, index)),
  }),
  deleteShoppingCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(shopping.deleteCategory(id)),
  }),
  moveShoppingProducts: t.int({
    description: 'Moves products to another base list (after its own); returns how many moved.',
    args: { ids: t.arg.idList({ required: true }), baseListId: t.arg.id({ required: true }) },
    resolve: (_root, { ids, baseListId }) => shopping.moveProducts(ids, baseListId),
  }),
  createShoppingBaseList: t.id({
    args: { name: t.arg.string({ required: true }) },
    resolve: async (_root, { name }) => (await shopping.createBaseList(name)).id,
  }),
  renameShoppingBaseList: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: (_root, { id, name }) => done(shopping.renameBaseList(id, name)),
  }),
  deleteShoppingBaseList: t.boolean({
    description: 'Deletes a base list with its products (the lists made from them keep their items).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(shopping.deleteBaseList(id)),
  }),
  createShoppingProduct: t.id({
    args: { input: t.arg({ type: ProductInput, required: true }) },
    resolve: async (_root, { input }) => (await shopping.createProduct({ ...itemInput(input), baseListId: input.baseListId, missing: input.missing })).id,
  }),
  updateShoppingProduct: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProductInput, required: true }) },
    resolve: (_root, { id, input }) => done(shopping.updateProduct(id, { ...itemInput(input), baseListId: input.baseListId, missing: input.missing })),
  }),
  setShoppingProductsMissing: t.boolean({
    args: { ids: t.arg.idList({ required: true }), missing: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, missing }) => done(shopping.setProductsMissing(ids, missing)),
  }),
  deleteShoppingProduct: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(shopping.deleteProduct(id)),
  }),
  createShoppingList: t.id({
    description: 'Creates a list, empty or with the missing products of some base lists.',
    args: { name: t.arg.string({ required: true }), taskIds: t.arg.idList({ required: true }), baseListIds: t.arg.idList({ required: true }) },
    resolve: async (_root, { name, taskIds, baseListIds }) => (await shopping.createList({ name, taskIds: taskIds, baseListIds: baseListIds })).id,
  }),
  updateShoppingList: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }), taskIds: t.arg.idList({ required: true }) },
    resolve: (_root, { id, name, taskIds }) => done(shopping.updateList(id, { name, taskIds: taskIds })),
  }),
  setShoppingListClosed: t.boolean({
    args: { id: t.arg.id({ required: true }), closed: t.arg.boolean({ required: true }) },
    resolve: (_root, { id, closed }) => done(shopping.setListClosed(id, closed)),
  }),
  duplicateShoppingList: t.id({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => (await shopping.duplicateList(id)).id,
  }),
  deleteShoppingList: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(shopping.deleteList(id)),
  }),
  attachShoppingListEntry: t.boolean({
    description: 'Attaches a list to the treasury entry paying it (adding its split by person), or detaches it (entryId null).',
    args: { id: t.arg.id({ required: true }), entryId: t.arg.id() },
    resolve: (_root, { id, entryId }) => done(shopping.attachListEntry(id, entryId || null)),
  }),
  addShoppingItem: t.id({
    description: 'Adds an item of this list only (not from a base list) to a list.',
    args: { listId: t.arg.id({ required: true }), input: t.arg({ type: ItemInput, required: true }) },
    resolve: async (_root, { listId, input }) => (await shopping.addItem(listId, itemInput(input))).id,
  }),
  addShoppingProducts: t.int({
    description: 'Adds products of base lists to a list (those already in it are left out); returns the number added.',
    args: { listId: t.arg.id({ required: true }), productIds: t.arg.idList({ required: true }) },
    resolve: (_root, { listId, productIds }) => shopping.addProducts(listId, productIds),
  }),
  updateShoppingItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ItemInput, required: true }) },
    resolve: (_root, { id, input }) => done(shopping.updateItem(id, itemInput(input))),
  }),
  duplicateShoppingItem: t.id({
    description: 'Adds the same item again to its list, not bought, without date (the same product bought with another date).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => (await shopping.duplicateItem(id)).id,
  }),
  setShoppingItemPurchased: t.boolean({
    args: { id: t.arg.id({ required: true }), purchased: t.arg.boolean({ required: true }) },
    resolve: (_root, { id, purchased }) => done(shopping.setItemPurchased(id, purchased)),
  }),
  saveShoppingItemToBase: t.id({
    description: 'Adds an item of a list to a base list; returns the product.',
    args: { id: t.arg.id({ required: true }), baseListId: t.arg.id({ required: true }) },
    resolve: async (_root, { id, baseListId }) => (await shopping.saveItemToBase(id, baseListId)).id,
  }),
  deleteShoppingItem: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(shopping.deleteItem(id)),
  }),
}));

const nameColor = { create: NameColorInput, update: NameColorPatch };
labelMutations('ShoppingStore', shopping.shoppingStores, nameColor);
labelMutations('ShoppingStorage', shopping.shoppingStorages, nameColor);
labelMutations('ShoppingUnit', { create: shopping.createUnit, update: shopping.updateUnit, remove: shopping.deleteUnit }, nameColor, {
  update: 'Renames a unit; the products and items in it follow.',
  delete: 'Deletes a unit; the products and items in it are left without one.',
});
