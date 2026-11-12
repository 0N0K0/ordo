import { prisma } from '../../db';
import * as shopping from '../../services/shopping';
import { builder } from '../builder';

const float = (value: { toNumber(): number } | null) => (value === null ? null : value.toNumber());

builder.prismaObject('ShoppingCategory', {
  description: 'Category of the shopping products, in a tree.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color', { nullable: true }),
    parentId: t.exposeID('parentId', { nullable: true }),
  }),
});

builder.prismaObject('ShoppingStore', {
  description: 'Store (or supplier) a product is bought at.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('ShoppingBaseList', {
  description: 'Base list ("liste type"): products usually bought together.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('ShoppingProduct', {
  description: 'Product of a base list: what is usually bought, marked when missing.',
  fields: (t) => ({
    id: t.exposeID('id'),
    baseListId: t.exposeID('baseListId'),
    name: t.exposeString('name'),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    storeId: t.exposeID('storeId', { nullable: true }),
    url: t.exposeString('url', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    quantity: t.float({ nullable: true, resolve: (product) => float(product.quantity) }),
    unit: t.exposeString('unit', { nullable: true }),
    unitPrice: t.float({ nullable: true, resolve: (product) => float(product.unitPrice) }),
    missing: t.exposeBoolean('missing'),
    lastPurchasedAt: t.expose('lastPurchasedAt', { type: 'DateTime', nullable: true }),
    lastPrice: t.float({ nullable: true, resolve: (product) => float(product.lastPrice) }),
    memberIds: t.idList({ select: { members: { select: { id: true } } }, resolve: (product) => product.members.map((member) => member.id) }),
    relationIds: t.idList({ select: { relations: { select: { id: true } } }, resolve: (product) => product.relations.map((relation) => relation.id) }),
  }),
});

builder.prismaObject('ShoppingItem', {
  description: 'Item of a shopping list: a copy of a product of the base list, or an item of this list only.',
  fields: (t) => ({
    id: t.exposeID('id'),
    listId: t.exposeID('listId'),
    productId: t.exposeID('productId', { nullable: true }),
    name: t.exposeString('name'),
    categoryId: t.exposeID('categoryId', { nullable: true }),
    storeId: t.exposeID('storeId', { nullable: true }),
    url: t.exposeString('url', { nullable: true }),
    note: t.exposeString('note', { nullable: true }),
    quantity: t.float({ nullable: true, resolve: (item) => float(item.quantity) }),
    unit: t.exposeString('unit', { nullable: true }),
    unitPrice: t.float({ nullable: true, resolve: (item) => float(item.unitPrice) }),
    purchasedAt: t.expose('purchasedAt', { type: 'DateTime', nullable: true }),
    position: t.exposeInt('position'),
    memberIds: t.idList({ select: { members: { select: { id: true } } }, resolve: (item) => item.members.map((member) => member.id) }),
    relationIds: t.idList({ select: { relations: { select: { id: true } } }, resolve: (item) => item.relations.map((relation) => relation.id) }),
  }),
});

builder.prismaObject('ShoppingList', {
  description: 'Shopping list, possibly attached to a task and to the treasury entry paying it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    taskId: t.exposeID('taskId', { nullable: true }),
    entryId: t.exposeID('entryId', { nullable: true }),
    entry: t.relation('entry', { nullable: true, description: 'Treasury entry paying the list.' }),
    closedAt: t.expose('closedAt', { type: 'DateTime', nullable: true }),
    closed: t.boolean({
      description: 'Closed by hand, or along with its task.',
      select: { closedAt: true, task: { select: { closedAt: true } } },
      resolve: (list) => list.closedAt !== null || Boolean(list.task?.closedAt),
    }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    items: t.relation('items', { query: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } }),
  }),
});

const CategoryInput = builder.inputType('ShoppingCategoryInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string(), parentId: t.id() }),
});

const LabelInput = builder.inputType('ShoppingStoreInput', {
  description: 'Shopping store.',
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

const LabelPatch = builder.inputType('ShoppingStorePatch', {
  description: 'Changes of a shopping store (omitted fields unchanged).',
  fields: (t) => ({ name: t.string(), color: t.string() }),
});

const shoppingFields = (t: Parameters<Parameters<typeof builder.inputType>[1]['fields']>[0]) => ({
  name: t.string({ required: true }),
  categoryId: t.id(),
  storeId: t.id(),
  url: t.string(),
  note: t.string(),
  quantity: t.float(),
  unit: t.string(),
  unitPrice: t.float(),
  memberIds: t.idList({ required: true }),
  relationIds: t.idList({ required: true }),
});

const ProductInput = builder.inputType('ShoppingProductInput', {
  fields: (t) => ({ ...shoppingFields(t), baseListId: t.id({ required: true }), missing: t.boolean({ required: true }) }),
});

const ItemInput = builder.inputType('ShoppingItemInput', { fields: (t) => shoppingFields(t) });

/**
 * Item input with omitted optional fields as null.
 * @param {typeof ItemInput.$inferInput} input GraphQL input.
 * @returns {object} Service input.
 */
const itemInput = (input: typeof ItemInput.$inferInput) => ({
  ...input,
  categoryId: input.categoryId ?? null,
  storeId: input.storeId ?? null,
  url: input.url ?? null,
  note: input.note ?? null,
  quantity: input.quantity ?? null,
  unit: input.unit ?? null,
  unitPrice: input.unitPrice ?? null,
  memberIds: input.memberIds.map(String),
  relationIds: input.relationIds.map(String),
});

builder.queryFields((t) => ({
  shoppingCategories: t.prismaField({
    type: ['ShoppingCategory'],
    description: 'Categories of the shopping products (a tree).',
    resolve: (query) => prisma.shoppingCategory.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  shoppingStores: t.prismaField({
    type: ['ShoppingStore'],
    resolve: (query) => prisma.shoppingStore.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  shoppingBaseLists: t.prismaField({
    type: ['ShoppingBaseList'],
    description: 'Base lists ("listes types").',
    resolve: (query) => prisma.shoppingBaseList.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  shoppingProducts: t.prismaField({
    type: ['ShoppingProduct'],
    description: 'Products of all the base lists.',
    resolve: (query) => prisma.shoppingProduct.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  shoppingLists: t.prismaField({
    type: ['ShoppingList'],
    description: 'Shopping lists, latest first: all, or those of a task.',
    args: { taskId: t.arg.id() },
    resolve: (query, _root, { taskId }) => prisma.shoppingList.findMany({ ...query, where: taskId ? { taskId: String(taskId) } : {}, orderBy: { createdAt: 'desc' } }),
  }),
}));

builder.mutationFields((t) => ({
  createShoppingCategory: t.id({
    args: { input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { input }) => (await shopping.createCategory({ name: input.name, color: input.color ?? null, parentId: input.parentId ? String(input.parentId) : null })).id,
  }),
  updateShoppingCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await shopping.updateCategory(String(id), { name: input.name, color: input.color ?? null, parentId: input.parentId ? String(input.parentId) : null });
      return true;
    },
  }),
  deleteShoppingCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteCategory(String(id));
      return true;
    },
  }),
  createShoppingStore: t.id({
    args: { input: t.arg({ type: LabelInput, required: true }) },
    resolve: async (_root, { input }) => (await shopping.createStore(input)).id,
  }),
  updateShoppingStore: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: LabelPatch, required: true }) },
    resolve: async (_root, { id, input }) => {
      await shopping.updateStore(String(id), { name: input.name ?? undefined, color: input.color ?? undefined });
      return true;
    },
  }),
  deleteShoppingStore: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteStore(String(id));
      return true;
    },
  }),
  moveShoppingStore: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await shopping.moveStore(String(id), index);
      return true;
    },
  }),
  createShoppingBaseList: t.id({
    args: { name: t.arg.string({ required: true }) },
    resolve: async (_root, { name }) => (await shopping.createBaseList(name)).id,
  }),
  renameShoppingBaseList: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: async (_root, { id, name }) => {
      await shopping.renameBaseList(String(id), name);
      return true;
    },
  }),
  deleteShoppingBaseList: t.boolean({
    description: 'Deletes a base list with its products (the lists made from them keep their items).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteBaseList(String(id));
      return true;
    },
  }),
  moveShoppingBaseList: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await shopping.moveBaseList(String(id), index);
      return true;
    },
  }),
  createShoppingProduct: t.id({
    args: { input: t.arg({ type: ProductInput, required: true }) },
    resolve: async (_root, { input }) => (await shopping.createProduct({ ...itemInput(input), baseListId: String(input.baseListId), missing: input.missing })).id,
  }),
  updateShoppingProduct: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ProductInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await shopping.updateProduct(String(id), { ...itemInput(input), baseListId: String(input.baseListId), missing: input.missing });
      return true;
    },
  }),
  setShoppingProductsMissing: t.boolean({
    args: { ids: t.arg.idList({ required: true }), missing: t.arg.boolean({ required: true }) },
    resolve: async (_root, { ids, missing }) => {
      await shopping.setProductsMissing(ids.map(String), missing);
      return true;
    },
  }),
  deleteShoppingProduct: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteProduct(String(id));
      return true;
    },
  }),
  createShoppingList: t.id({
    description: 'Creates a list, empty or with the missing products of some base lists.',
    args: { name: t.arg.string({ required: true }), taskId: t.arg.id(), baseListIds: t.arg.idList({ required: true }) },
    resolve: async (_root, { name, taskId, baseListIds }) => (await shopping.createList({ name, taskId: taskId ? String(taskId) : null, baseListIds: baseListIds.map(String) })).id,
  }),
  updateShoppingList: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }), taskId: t.arg.id() },
    resolve: async (_root, { id, name, taskId }) => {
      await shopping.updateList(String(id), { name, taskId: taskId ? String(taskId) : null });
      return true;
    },
  }),
  setShoppingListClosed: t.boolean({
    args: { id: t.arg.id({ required: true }), closed: t.arg.boolean({ required: true }) },
    resolve: async (_root, { id, closed }) => {
      await shopping.setListClosed(String(id), closed);
      return true;
    },
  }),
  duplicateShoppingList: t.id({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => (await shopping.duplicateList(String(id))).id,
  }),
  deleteShoppingList: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteList(String(id));
      return true;
    },
  }),
  attachShoppingListEntry: t.boolean({
    description: 'Attaches a list to the treasury entry paying it (adding its split by person), or detaches it (entryId null).',
    args: { id: t.arg.id({ required: true }), entryId: t.arg.id() },
    resolve: async (_root, { id, entryId }) => {
      await shopping.attachListEntry(String(id), entryId ? String(entryId) : null);
      return true;
    },
  }),
  addShoppingItem: t.id({
    description: 'Adds an item of this list only (not from a base list) to a list.',
    args: { listId: t.arg.id({ required: true }), input: t.arg({ type: ItemInput, required: true }) },
    resolve: async (_root, { listId, input }) => (await shopping.addItem(String(listId), itemInput(input))).id,
  }),
  addShoppingProducts: t.int({
    description: 'Adds products of base lists to a list (those already in it are left out); returns the number added.',
    args: { listId: t.arg.id({ required: true }), productIds: t.arg.idList({ required: true }) },
    resolve: (_root, { listId, productIds }) => shopping.addProducts(String(listId), productIds.map(String)),
  }),
  updateShoppingItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: ItemInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await shopping.updateItem(String(id), itemInput(input));
      return true;
    },
  }),
  setShoppingItemPurchased: t.boolean({
    args: { id: t.arg.id({ required: true }), purchased: t.arg.boolean({ required: true }) },
    resolve: async (_root, { id, purchased }) => {
      await shopping.setItemPurchased(String(id), purchased);
      return true;
    },
  }),
  saveShoppingItemToBase: t.id({
    description: 'Adds an item of a list to a base list; returns the product.',
    args: { id: t.arg.id({ required: true }), baseListId: t.arg.id({ required: true }) },
    resolve: async (_root, { id, baseListId }) => (await shopping.saveItemToBase(String(id), String(baseListId))).id,
  }),
  deleteShoppingItem: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await shopping.deleteItem(String(id));
      return true;
    },
  }),
}));
