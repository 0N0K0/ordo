import {
  fromCents,
  lineageOf,
  mapById,
  parseDay,
  shoppingBaseListNameSchema,
  type ShoppingCategoryInput,
  shoppingCategorySchema,
  type ShoppingItemInput,
  shoppingItemSchema,
  shoppingListNameSchema,
  type ShoppingProductInput,
  shoppingProductSchema,
  shoppingShares,
  shoppingStorageSchema,
  type ShoppingStoreInput,
  shoppingStoreSchema,
  toCents,
} from '@ordo/shared';
import { assertTreeParent, deleteTreeNode } from '../core/trees';
import { prisma } from '../../db';
import { syncPurchaseStock } from './stock';
import { peopleData, peopleIds, withPeople, type WithPeople, assertPeople } from './people';
import {
  Prisma,
  type ShoppingBaseList,
  type ShoppingCategory,
  type ShoppingItem,
  type ShoppingList,
  type ShoppingProduct,
  type ShoppingStorage,
  type ShoppingStore,
  type ShoppingUnit,
} from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { BY_POSITION, moveInList, nextPositionIn } from '../core/ordering';
import { assertAllExist, assertExists } from '../core/lookup';
import { assertNoneArchived, assertNotArchived } from '../core/archive';
import { assertActiveRefs, type ShoppingRefs } from './refs';

const decimal = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));
const number = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
const day = (value: string | null) => (value === null ? null : parseDay(value));

/**
 * Checks the category and the store of a product or an item.
 * @param {{ categoryId: string | null, storeId: string | null }} input Product or item.
 * @returns {Promise<void>}
 */
async function assertPlaces({ categoryId, storeId }: { categoryId: string | null; storeId: string | null }): Promise<void> {
  await assertExists(prisma.shoppingCategory, categoryId, 'Catégorie');
  await assertExists(prisma.shoppingStore, storeId, 'Magasin');
}

/**
 * Checks the storage mode of a product or an item.
 * @param {string | null} storageId Storage mode.
 * @returns {Promise<void>}
 */
async function assertStorage(storageId: string | null): Promise<void> {
  await assertExists(prisma.shoppingStorage, storageId, 'Mode de conservation');
}

type Parsed = Omit<ReturnType<typeof shoppingItemSchema.parse>, 'optional'>;

/**
 * Row fields of a product or an item (people apart).
 * @param {Parsed} input Validated input.
 * @returns {object} Fields.
 */
const fields = (input: Parsed) => ({
  name: input.name,
  categoryId: input.categoryId,
  storeId: input.storeId,
  url: input.url,
  note: input.note,
  quantity: decimal(input.quantity),
  unit: input.unit,
  unitPrice: decimal(input.unitPrice),
  perishable: input.perishable,
  // Storage mode and date only for what is perishable.
  storageId: input.perishable ? input.storageId : null,
  expiresAt: input.perishable ? day(input.expiresAt) : null,
});

/**
 * Validates a product or an item and checks what it refers to.
 * @param {T} schema Schema.
 * @param {unknown} input Input.
 * @param {ShoppingRefs | null} [current] Settings items it has now (still valid when archived). Optional. Default = a new one.
 * @returns {Promise<z.output<T>>} Validated input.
 */
async function parseShopping<T extends typeof shoppingItemSchema | typeof shoppingProductSchema>(schema: T, input: unknown, current?: ShoppingRefs | null) {
  const parsed = parseInput(schema, input) as ReturnType<T['parse']>;
  await assertPlaces(parsed);
  await assertStorage(parsed.perishable ? parsed.storageId : null);
  await assertActiveRefs({ categoryId: parsed.categoryId, storeId: parsed.storeId, storageId: parsed.perishable ? parsed.storageId : null, unit: parsed.unit }, current);
  await assertPeople(parsed);
  return parsed;
}

// Categories ------------------------------------------------------------------------------------------------------

/**
 * Validates a category: its parent exists and is not the category or one of its sub-categories.
 * @param {ShoppingCategoryInput} input Category.
 * @param {string} [id] Category edited. Optional.
 * @param {{ parentId: string | null, baseListIds: string[] }} [current] Parent and base lists it has now (still valid when archived). Optional.
 * @returns {Promise<ReturnType<typeof shoppingCategorySchema.parse>>} Category.
 */
async function parseCategory(input: ShoppingCategoryInput, id?: string, current?: { parentId: string | null; baseListIds: string[] }) {
  const data = parseInput(shoppingCategorySchema, input);
  data.baseListIds = [...new Set(data.baseListIds)];
  await assertAllExist(prisma.shoppingBaseList, data.baseListIds, 'Référence');
  await assertNoneArchived(
    'SHOPPING_BASE_LIST',
    data.baseListIds.filter((baseListId) => !current?.baseListIds.includes(baseListId)),
  );
  if ((data.parentId ?? null) !== (current?.parentId ?? null)) await assertNotArchived('SHOPPING_CATEGORY', data.parentId);
  if (!data.parentId) return data;
  await assertTreeParent('shoppingCategory', data.parentId, id, { missing: 'Catégorie parente', loop: 'Une catégorie ne peut pas être rangée sous elle-même.' });
  return data;
}

/**
 * Creates a category.
 * @param {ShoppingCategoryInput} input Category.
 * @returns {Promise<ShoppingCategory>} Category.
 */
export async function createCategory(input: ShoppingCategoryInput): Promise<ShoppingCategory> {
  const { baseListIds, ...data } = await parseCategory(input);
  return prisma.shoppingCategory.create({ data: { ...data, position: await nextCategoryPosition(data.parentId), baseLists: { connect: baseListIds.map((baseListId) => ({ id: baseListId })) } } });
}

/**
 * Updates a category.
 * @param {string} id Category id.
 * @param {ShoppingCategoryInput} input Category.
 * @returns {Promise<ShoppingCategory>} Category.
 */
export async function updateCategory(id: string, input: ShoppingCategoryInput): Promise<ShoppingCategory> {
  const previous = await orNotFound(prisma.shoppingCategory.findUnique({ where: { id }, select: { parentId: true, baseLists: { select: { id: true } } } }), 'Catégorie');
  await assertNotArchived('SHOPPING_CATEGORY', id);
  const { baseListIds, ...data } = await parseCategory(input, id, { parentId: previous.parentId, baseListIds: previous.baseLists.map((baseList) => baseList.id) });
  // Under another parent, it goes last.
  const moved = (data.parentId ?? null) !== previous.parentId;
  return prisma.shoppingCategory.update({
    where: { id },
    data: { ...data, ...(moved && { position: await nextCategoryPosition(data.parentId) }), baseLists: { set: baseListIds.map((baseListId) => ({ id: baseListId })) } },
  });
}

/**
 * Moves a category under another one (or to the top level), keeping its name, color and base lists.
 * @param {string} id Category id.
 * @param {string | null} parentId New parent, null for the top level.
 * @param {number | null} [index] Index among its new siblings; last when omitted. Optional.
 * @returns {Promise<void>}
 */
export async function moveCategory(id: string, parentId: string | null, index?: number | null): Promise<void> {
  const category = await orNotFound(prisma.shoppingCategory.findUnique({ where: { id }, include: { baseLists: { select: { id: true } } } }), 'Catégorie');
  await assertNotArchived('SHOPPING_CATEGORY', id);
  if (parentId !== category.parentId) await updateCategory(id, { name: category.name, color: category.color, parentId, baseListIds: category.baseLists.map((baseList) => baseList.id) });
  if (index === null || index === undefined) return;
  await moveInList('shoppingCategory', id, index, { parentId });
}

/**
 * Next position among the sub-categories of a parent.
 * @param {string | null | undefined} parentId Parent, null for the top level.
 * @returns {Promise<number>} Position.
 */
async function nextCategoryPosition(parentId: string | null | undefined): Promise<number> {
  return nextPositionIn('shoppingCategory', { parentId: parentId ?? null });
}

/**
 * Deletes a category: its sub-categories go up a level, its products and items are left without one.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await orNotFound(prisma.shoppingCategory.findUnique({ where: { id } }), 'Catégorie');
  await deleteTreeNode('shoppingCategory', category);
}

// Stores ----------------------------------------------------------------------------------------------------------

const STORE_TAKEN = 'Ce magasin existe déjà.';

/**
 * Creates a store, after the others.
 * @param {ShoppingStoreInput} input Name and color.
 * @returns {Promise<ShoppingStore>} Store.
 */
export async function createStore(input: ShoppingStoreInput): Promise<ShoppingStore> {
  const data = parseInput(shoppingStoreSchema, input);
  if (await prisma.shoppingStore.findFirst({ where: { name: data.name } })) throw fieldError('name', STORE_TAKEN);
  const position = await nextPositionIn('shoppingStore');
  return prisma.shoppingStore.create({ data: { ...data, position } });
}

/**
 * Updates the name and/or the color of a store.
 * @param {string} id Store id.
 * @param {Partial<ShoppingStoreInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateStore(id: string, input: Partial<ShoppingStoreInput>): Promise<void> {
  const current = await orNotFound(prisma.shoppingStore.findUnique({ where: { id } }), 'Magasin');
  await assertNotArchived('SHOPPING_STORE', id);
  const data = parseInput(shoppingStoreSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await prisma.shoppingStore.findFirst({ where: { name: data.name, id: { not: id } } })) throw fieldError('name', STORE_TAKEN);
  await prisma.shoppingStore.update({ where: { id }, data });
}

/**
 * Deletes a store: its products and items are left without one.
 * @param {string} id Store id.
 * @returns {Promise<void>}
 */
export async function deleteStore(id: string): Promise<void> {
  await orNotFound(prisma.shoppingStore.findUnique({ where: { id }, select: { id: true } }), 'Magasin');
  await prisma.shoppingStore.delete({ where: { id } });
}

// Storage modes ---------------------------------------------------------------------------------------------------

const STORAGE_TAKEN = 'Ce mode de conservation existe déjà.';

/**
 * Creates a storage mode, after the others.
 * @param {ShoppingStoreInput} input Name and color.
 * @returns {Promise<ShoppingStorage>} Storage mode.
 */
export async function createStorage(input: ShoppingStoreInput): Promise<ShoppingStorage> {
  const data = parseInput(shoppingStorageSchema, input);
  if (await prisma.shoppingStorage.findFirst({ where: { name: data.name } })) throw fieldError('name', STORAGE_TAKEN);
  const position = await nextPositionIn('shoppingStorage');
  return prisma.shoppingStorage.create({ data: { ...data, position } });
}

/**
 * Updates the name and/or the color of a storage mode.
 * @param {string} id Storage mode id.
 * @param {Partial<ShoppingStoreInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateStorage(id: string, input: Partial<ShoppingStoreInput>): Promise<void> {
  const current = await orNotFound(prisma.shoppingStorage.findUnique({ where: { id } }), 'Mode de conservation');
  await assertNotArchived('SHOPPING_STORAGE', id);
  const data = parseInput(shoppingStorageSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await prisma.shoppingStorage.findFirst({ where: { name: data.name, id: { not: id } } })) throw fieldError('name', STORAGE_TAKEN);
  await prisma.shoppingStorage.update({ where: { id }, data });
}

/**
 * Deletes a storage mode: its products and items are left without one.
 * @param {string} id Storage mode id.
 * @returns {Promise<void>}
 */
export async function deleteStorage(id: string): Promise<void> {
  await orNotFound(prisma.shoppingStorage.findUnique({ where: { id }, select: { id: true } }), 'Mode de conservation');
  await prisma.shoppingStorage.delete({ where: { id } });
}

// Base lists -----------------------------------------------------------------------------------------------------

/**
 * Checks a base list.
 * @param {string} id Base list id.
 * @returns {Promise<void>}
 */
async function assertBaseList(id: string): Promise<void> {
  await orNotFound(prisma.shoppingBaseList.findUnique({ where: { id }, select: { id: true } }), 'Référence');
}

/**
 * Creates a base list, after the others.
 * @param {string} name Name.
 * @returns {Promise<ShoppingBaseList>} Base list.
 */
export async function createBaseList(name: string): Promise<ShoppingBaseList> {
  const data = { name: parseInput(shoppingBaseListNameSchema, name) };
  const position = await nextPositionIn('shoppingBaseList');
  return prisma.shoppingBaseList.create({ data: { ...data, position } });
}

/**
 * Renames a base list.
 * @param {string} id Base list id.
 * @param {string} name Name.
 * @returns {Promise<ShoppingBaseList>} Base list.
 */
export async function renameBaseList(id: string, name: string): Promise<ShoppingBaseList> {
  await assertBaseList(id);
  await assertNotArchived('SHOPPING_BASE_LIST', id);
  return prisma.shoppingBaseList.update({ where: { id }, data: { name: parseInput(shoppingBaseListNameSchema, name) } });
}

/**
 * Deletes a base list with its products (the items of the lists made from them stay).
 * @param {string} id Base list id.
 * @returns {Promise<void>}
 */
export async function deleteBaseList(id: string): Promise<void> {
  await assertBaseList(id);
  await prisma.shoppingBaseList.delete({ where: { id } });
}

// Products -------------------------------------------------------------------------------------------------------

/**
 * Adds a product to a base list.
 * @param {ShoppingProductInput} input Product.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function createProduct(input: ShoppingProductInput): Promise<ShoppingProduct> {
  const data = await parseShopping(shoppingProductSchema, input);
  await assertBaseList(data.baseListId);
  await assertNotArchived('SHOPPING_BASE_LIST', data.baseListId);
  return prisma.shoppingProduct.create({ data: { ...fields(data), baseListId: data.baseListId, missing: data.missing, ...peopleData(data, 'connect') } });
}

/**
 * Updates a product of the base list (the lists already made keep their copy).
 * @param {string} id Product id.
 * @param {ShoppingProductInput} input Product.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function updateProduct(id: string, input: ShoppingProductInput): Promise<ShoppingProduct> {
  const current = await orNotFound(prisma.shoppingProduct.findUnique({ where: { id } }), 'Produit');
  await assertNotArchived('SHOPPING_PRODUCT', id);
  await assertNotArchived('SHOPPING_BASE_LIST', current.baseListId);
  const data = await parseShopping(shoppingProductSchema, input, current);
  await assertBaseList(data.baseListId);
  if (data.baseListId !== current.baseListId) await assertNotArchived('SHOPPING_BASE_LIST', data.baseListId);
  const row = fields(data);
  return prisma.shoppingProduct.update({ where: { id }, data: { ...row, baseListId: data.baseListId, missing: data.missing, ...peopleData(data, 'set') } });
}

/**
 * Marks products as missing or not.
 * @param {string[]} ids Product ids.
 * @param {boolean} missing Missing.
 * @returns {Promise<void>}
 */
export async function setProductsMissing(ids: string[], missing: boolean): Promise<void> {
  await assertAllExist(prisma.shoppingProduct, ids, 'Produit');
  await assertNoneArchived('SHOPPING_PRODUCT', ids);
  await prisma.$transaction([prisma.shoppingProduct.updateMany({ where: { id: { in: ids } }, data: { missing } })]);
}

/**
 * Removes a product from the base list (the items of the lists made from it stay).
 * @param {string} id Product id.
 * @returns {Promise<void>}
 */
export async function deleteProduct(id: string): Promise<void> {
  await orNotFound(prisma.shoppingProduct.findUnique({ where: { id } }), 'Produit');
  await prisma.shoppingProduct.delete({ where: { id } });
}

/**
 * Moves products to another base list, after its own (in their order). A product keeps its category when the target
 * list offers it (attached to it, or to no list, or through its closest parent with lists), loses it otherwise.
 * @param {string[]} ids Product ids.
 * @param {string} baseListId Target base list.
 * @returns {Promise<number>} Products moved (those already in the list stay).
 */
export async function moveProducts(ids: string[], baseListId: string): Promise<number> {
  await assertBaseList(baseListId);
  await assertNotArchived('SHOPPING_BASE_LIST', baseListId);
  await assertNoneArchived('SHOPPING_PRODUCT', ids);
  const products = await prisma.shoppingProduct.findMany({
    where: { id: { in: ids } },
    orderBy: BY_POSITION,
    select: { id: true, baseListId: true, categoryId: true },
  });
  if (products.length !== new Set(ids).size) throw notFound('Produit');
  const moved = products.filter((product) => product.baseListId !== baseListId);
  if (moved.length === 0) return 0;
  const categories = await prisma.shoppingCategory.findMany({ select: { id: true, parentId: true, baseLists: { select: { id: true } } } });
  const byId = mapById(categories);
  /**
   * Whether a category is offered in the target list: the lists of the closest category with some (none: all).
   * @param {string} categoryId Category.
   * @returns {boolean} Offered.
   */
  const offered = (categoryId: string) => {
    // The base lists of the category, or of its closest parent with some (none: every list).
    const owner = lineageOf(byId, categoryId).find((current) => current.baseLists.length);
    return owner ? owner.baseLists.some((list) => list.id === baseListId) : true;
  };
  const position = await nextPositionIn('shoppingProduct', { baseListId });
  const start = position;
  await prisma.$transaction(
    moved.map((product, index) =>
      prisma.shoppingProduct.update({
        where: { id: product.id },
        data: { baseListId, position: start + index, ...(product.categoryId && !offered(product.categoryId) && { categoryId: null }) },
      }),
    ),
  );
  return moved.length;
}

// Units ----------------------------------------------------------------------------------------------------------

const UNIT_TAKEN = 'Cette unité existe déjà.';

/**
 * Creates a unit of quantity, after the others.
 * @param {ShoppingStoreInput} input Name (and color, unused).
 * @returns {Promise<ShoppingUnit>} Unit.
 */
export async function createUnit(input: ShoppingStoreInput): Promise<ShoppingUnit> {
  const data = parseInput(shoppingStorageSchema, input);
  if (await prisma.shoppingUnit.findFirst({ where: { name: data.name } })) throw fieldError('name', UNIT_TAKEN);
  const position = await nextPositionIn('shoppingUnit');
  return prisma.shoppingUnit.create({ data: { ...data, position } });
}

/**
 * Renames a unit: the products and items in it follow.
 * @param {string} id Unit id.
 * @param {Partial<ShoppingStoreInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateUnit(id: string, input: Partial<ShoppingStoreInput>): Promise<void> {
  const current = await orNotFound(prisma.shoppingUnit.findUnique({ where: { id } }), 'Unité');
  await assertNotArchived('SHOPPING_UNIT', id);
  const data = parseInput(shoppingStorageSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await prisma.shoppingUnit.findFirst({ where: { name: data.name, id: { not: id } } })) throw fieldError('name', UNIT_TAKEN);
  await prisma.$transaction([
    prisma.shoppingUnit.update({ where: { id }, data }),
    ...(data.name !== current.name
      ? [prisma.shoppingProduct.updateMany({ where: { unit: current.name }, data: { unit: data.name } }), prisma.shoppingItem.updateMany({ where: { unit: current.name }, data: { unit: data.name } })]
      : []),
  ]);
}

/**
 * Deletes a unit: the products and items in it are left without one (their quantity stays).
 * @param {string} id Unit id.
 * @returns {Promise<void>}
 */
export async function deleteUnit(id: string): Promise<void> {
  const unit = await orNotFound(prisma.shoppingUnit.findUnique({ where: { id } }), 'Unité');
  await prisma.$transaction([
    prisma.shoppingProduct.updateMany({ where: { unit: unit.name }, data: { unit: null } }),
    prisma.shoppingItem.updateMany({ where: { unit: unit.name }, data: { unit: null } }),
    prisma.shoppingUnit.delete({ where: { id } }),
  ]);
}

// Lists ----------------------------------------------------------------------------------------------------------

/**
 * Item data copied from a product of a base list (or from another item).
 * @param {ShoppingProduct | ShoppingItem} source Product or item, with its people.
 * @param {string | null} productId Product the item comes from.
 * @param {number} position Position in the list.
 * @returns {object} Nested item creation.
 */
export const copyOf = (source: (ShoppingProduct | ShoppingItem) & WithPeople, productId: string | null, position: number) => ({
  productId,
  name: source.name,
  categoryId: source.categoryId,
  storeId: source.storeId,
  url: source.url,
  note: source.note,
  quantity: source.quantity,
  unit: source.unit,
  unitPrice: source.unitPrice,
  perishable: source.perishable,
  storageId: source.storageId,
  position,
  members: { connect: source.members },
  relations: { connect: source.relations },
});

/**
 * Whether the tasks of a list close it: it has some, all closed.
 * @param {{ closedAt: Date | null }[]} tasks Tasks of the list.
 * @returns {boolean} Closed along with its tasks.
 */
export const tasksClosed = (tasks: { closedAt: Date | null }[]): boolean => tasks.length > 0 && tasks.every((task) => task.closedAt !== null);

/**
 * Loads a list or throws NOT_FOUND.
 * @param {string} id List id.
 * @returns {Promise<ShoppingList>} List.
 */
export async function findList(id: string): Promise<ShoppingList> {
  const list = await orNotFound(prisma.shoppingList.findUnique({ where: { id } }), 'Liste');
  return list;
}

/**
 * Loads a list that can be changed: NOT_FOUND, or BAD_USER_INPUT when it is archived (read only).
 * @param {string} id List id.
 * @returns {Promise<ShoppingList>} List.
 */
export async function findOpenList(id: string): Promise<ShoppingList> {
  const list = await findList(id);
  await assertNotArchived('SHOPPING_LIST', id);
  return list;
}

/**
 * Refuses a change of an item whose list is archived.
 * @param {{ listId: string }} item Item.
 * @returns {Promise<void>}
 */
const assertItemOpen = (item: { listId: string }): Promise<void> => assertNotArchived('SHOPPING_LIST', item.listId);

/**
 * Checks the tasks a list is attached to.
 * @param {string[]} taskIds Tasks.
 * @param {string[]} [current] Tasks it is attached to now (still valid when archived). Optional. Default = none.
 * @returns {Promise<string[]>} Tasks, without duplicates.
 */
async function assertTasks(taskIds: string[], current: string[] = []): Promise<string[]> {
  const ids = [...new Set(taskIds)];
  await assertAllExist(prisma.task, ids, 'Tâche');
  await assertNoneArchived(
    'task',
    ids.filter((id) => !current.includes(id)),
  );
  return ids;
}

/**
 * Creates a list: empty, or with the missing products of some base lists.
 * @param {{ name: string, taskIds: string[], baseListIds: string[] }} input List.
 * @returns {Promise<ShoppingList>} List.
 */
export async function createList({ name, taskIds, baseListIds }: { name: string; taskIds: string[]; baseListIds: string[] }): Promise<ShoppingList> {
  const tasks = (await assertTasks(taskIds)).map((id) => ({ id }));
  const data = { name: parseInput(shoppingListNameSchema, name), tasks: { connect: tasks } };
  const ids = [...new Set(baseListIds)];
  await assertAllExist(prisma.shoppingBaseList, ids, 'Référence');
  await assertNoneArchived('SHOPPING_BASE_LIST', ids);
  // The archived products are not offered anymore.
  const products = ids.length ? await prisma.shoppingProduct.findMany({ where: { missing: true, archivedAt: null, baseListId: { in: ids } }, include: withPeople, orderBy: { name: 'asc' } }) : [];
  return prisma.shoppingList.create({ data: { ...data, items: { create: products.map((product, position) => copyOf(product, product.id, position)) } } });
}

/**
 * Renames a list and attaches it to some tasks (or to none).
 * @param {string} id List id.
 * @param {{ name: string, taskIds: string[] }} input List.
 * @returns {Promise<ShoppingList>} List.
 */
export async function updateList(id: string, { name, taskIds }: { name: string; taskIds: string[] }): Promise<ShoppingList> {
  await findOpenList(id);
  const current = await prisma.task.findMany({ where: { shoppingLists: { some: { id } } }, select: { id: true } });
  const tasks = (
    await assertTasks(
      taskIds,
      current.map((task) => task.id),
    )
  ).map((taskId) => ({ id: taskId }));
  return prisma.shoppingList.update({ where: { id }, data: { name: parseInput(shoppingListNameSchema, name), tasks: { set: tasks } } });
}

/**
 * Closes (archives) or reopens a list. A list whose tasks are all closed stays closed: one of them is reopened instead.
 * @param {string} id List id.
 * @param {boolean} closed Target state.
 * @returns {Promise<ShoppingList>} List.
 */
export async function setListClosed(id: string, closed: boolean): Promise<ShoppingList> {
  const list = await findOpenList(id);
  const tasks = await prisma.task.findMany({ where: { shoppingLists: { some: { id } } }, select: { closedAt: true } });
  if (!closed && tasksClosed(tasks)) {
    throw clientError('BAD_USER_INPUT', tasks.length > 1 ? 'Les tâches de cette liste sont fermées : rouvrez-en une.' : 'La tâche de cette liste est fermée : rouvrez la tâche.');
  }
  return prisma.shoppingList.update({ where: { id }, data: { closedAt: closed ? (list.closedAt ?? new Date()) : null } });
}

/**
 * Copies a list, open, with its items not bought yet, attached to no task and no treasury entry.
 * @param {string} id List id.
 * @returns {Promise<ShoppingList>} Copy.
 */
export async function duplicateList(id: string): Promise<ShoppingList> {
  const list = await orNotFound(prisma.shoppingList.findUnique({ where: { id }, include: { items: { include: withPeople, orderBy: BY_POSITION } } }), 'Liste');
  await assertNotArchived('SHOPPING_LIST', id);
  return prisma.shoppingList.create({
    data: {
      name: `${list.name} (copie)`.slice(0, 120),
      items: { create: list.items.map((item, position) => copyOf(item, item.productId, position)) },
    },
  });
}

/**
 * Deletes a list with its items (the treasury split it added stays).
 * @param {string} id List id.
 * @returns {Promise<void>}
 */
export async function deleteList(id: string): Promise<void> {
  await findList(id);
  await prisma.shoppingList.delete({ where: { id } });
}

/**
 * Attaches a list to the treasury entry paying it, or detaches it. Attaching adds to the entry one line of split
 * by person the items are for (an item for several people split evenly): in amounts, or in percentages of the
 * entry when the list costs more than it. Detaching leaves the lines.
 * @param {string} id List id.
 * @param {string | null} entryId Entry, or null to detach.
 * @returns {Promise<ShoppingList>} List.
 */
export async function attachListEntry(id: string, entryId: string | null): Promise<ShoppingList> {
  const list = await orNotFound(prisma.shoppingList.findUnique({ where: { id }, include: { items: { include: withPeople } } }), 'Liste');
  await assertNotArchived('SHOPPING_LIST', id);
  if (entryId === null) return prisma.shoppingList.update({ where: { id }, data: { entryId: null } });
  if (list.entryId === entryId) throw clientError('BAD_USER_INPUT', 'La liste est déjà rattachée à ce mouvement.');
  await assertNotArchived('TREASURY_ENTRY', entryId);
  const entry = await orNotFound(prisma.treasuryEntry.findUnique({ where: { id: entryId }, select: { amount: true, lines: { select: { position: true } } } }), 'Mouvement');
  const { members, relations, total } = shoppingShares(
    list.items.map((item) => ({
      quantity: number(item.quantity),
      unitPrice: number(item.unitPrice),
      ...peopleIds(item),
    })),
  );
  const shares = [...[...members].map(([memberId, cents]) => ({ memberId, relationId: null, cents })), ...[...relations].map(([relationId, cents]) => ({ memberId: null, relationId, cents }))];
  if (entry.lines.length + shares.length > 50) throw clientError('BAD_USER_INPUT', 'Le mouvement aurait plus de 50 lignes de répartition.');
  const amount = toCents(Number(entry.amount));
  const percent = total > Math.abs(amount);
  const start = Math.max(-1, ...entry.lines.map((line) => line.position)) + 1;
  await prisma.$transaction([
    ...shares.map((share, index) =>
      prisma.treasuryEntryLine.create({
        data: {
          entryId,
          position: start + index,
          label: list.name.slice(0, 100),
          mode: percent ? 'PERCENT' : 'AMOUNT',
          value: new Prisma.Decimal(percent ? Math.round((share.cents / total) * 1_000_000) / 10_000 : (Math.sign(amount) || -1) * fromCents(share.cents)),
          memberId: share.memberId,
          relationId: share.relationId,
        },
      }),
    ),
    prisma.shoppingList.update({ where: { id }, data: { entryId } }),
  ]);
  return findList(id);
}

// Items ----------------------------------------------------------------------------------------------------------

/**
 * Loads an item or throws NOT_FOUND.
 * @param {string} id Item id.
 * @returns {Promise<ShoppingItem>} Item.
 */
async function findItem(id: string): Promise<ShoppingItem> {
  const item = await orNotFound(prisma.shoppingItem.findUnique({ where: { id } }), 'Élément');
  return item;
}

/**
 * Next position in a list.
 * @param {string} listId List.
 * @returns {Promise<number>} Position.
 */
export async function nextPosition(listId: string): Promise<number> {
  return nextPositionIn('shoppingItem', { listId });
}

/**
 * Adds an item of this list only (not from a base list).
 * @param {string} listId List.
 * @param {ShoppingItemInput} input Item.
 * @returns {Promise<ShoppingItem>} Item.
 */
export async function addItem(listId: string, input: ShoppingItemInput): Promise<ShoppingItem> {
  await findOpenList(listId);
  const data = await parseShopping(shoppingItemSchema, input);
  return prisma.shoppingItem.create({ data: { ...fields(data), optional: data.optional, listId, position: await nextPosition(listId), ...peopleData(data, 'connect') } });
}

/**
 * Adds products of base lists to a list (copied); those already in it are left out.
 * @param {string} listId List.
 * @param {string[]} productIds Products.
 * @returns {Promise<number>} Number of items added.
 */
export async function addProducts(listId: string, productIds: string[]): Promise<number> {
  await findOpenList(listId);
  const ids = [...new Set(productIds)];
  if (ids.length > 500) throw clientError('BAD_USER_INPUT', '500 produits au plus à la fois.');
  await assertNoneArchived('SHOPPING_PRODUCT', ids);
  const products = await prisma.shoppingProduct.findMany({ where: { id: { in: ids } }, include: withPeople, orderBy: { name: 'asc' } });
  if (products.length !== ids.length) throw notFound('Produit');
  const present = new Set((await prisma.shoppingItem.findMany({ where: { listId, productId: { in: ids } }, select: { productId: true } })).map((item) => item.productId));
  const added = products.filter((product) => !present.has(product.id));
  const start = await nextPosition(listId);
  await prisma.shoppingList.update({ where: { id: listId }, data: { items: { create: added.map((product, index) => copyOf(product, product.id, start + index)) } } });
  return added.length;
}

/**
 * Updates an item (its product in the base list stays as it is).
 * @param {string} id Item id.
 * @param {ShoppingItemInput} input Item.
 * @returns {Promise<ShoppingItem>} Item.
 */
export async function updateItem(id: string, input: ShoppingItemInput): Promise<ShoppingItem> {
  const current = await findItem(id);
  await assertItemOpen(current);
  const data = await parseShopping(shoppingItemSchema, input, current);
  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingItem.update({ where: { id }, data: { ...fields(data), optional: data.optional, ...peopleData(data, 'set') } });
    if (item.productId && item.purchasedAt) await syncExpiry(tx, item.productId);
    return item;
  });
}

/**
 * Ticks an item as bought, or unticks it. Its product in the base list follows: bought, it is no longer missing
 * and keeps the date and the price; unticked, it is missing again.
 * @param {string} id Item id.
 * @param {boolean} purchased Bought.
 * @returns {Promise<ShoppingItem>} Item.
 */
export async function setItemPurchased(id: string, purchased: boolean): Promise<ShoppingItem> {
  const item = await findItem(id);
  await assertItemOpen(item);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.shoppingItem.update({ where: { id }, data: { purchasedAt: purchased ? (item.purchasedAt ?? now) : null } });
    // A reference followed in stock that goes there by itself is added (taken back when unticked).
    await syncPurchaseStock(tx, id, purchased);
    if (item.productId) {
      await tx.shoppingProduct.update({
        where: { id: item.productId },
        data: purchased ? { missing: false, lastPurchasedAt: now, ...(item.unitPrice !== null ? { lastPrice: item.unitPrice } : {}) } : { missing: true },
      });
      await syncExpiry(tx, item.productId);
    }
    return updated;
  });
}

/**
 * Sets the date of a product to the one of its last purchase: the latest date among its items bought on the list of
 * its last purchase (the same product may be there several times, with other dates).
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {string} productId Product.
 * @returns {Promise<void>}
 */
async function syncExpiry(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const last = await tx.shoppingItem.findFirst({ where: { productId, purchasedAt: { not: null } }, orderBy: { purchasedAt: 'desc' }, select: { listId: true } });
  const { _max } = last ? await tx.shoppingItem.aggregate({ where: { productId, listId: last.listId, purchasedAt: { not: null } }, _max: { expiresAt: true } }) : { _max: { expiresAt: null } };
  await tx.shoppingProduct.update({ where: { id: productId }, data: { expiresAt: _max.expiresAt } });
}

/**
 * Adds the same item again to its list, not bought, without date (the same product bought with another date).
 * @param {string} id Item id.
 * @returns {Promise<ShoppingItem>} New item.
 */
export async function duplicateItem(id: string): Promise<ShoppingItem> {
  const item = await orNotFound(prisma.shoppingItem.findUnique({ where: { id }, include: withPeople }), 'Élément');
  await assertItemOpen(item);
  return prisma.shoppingItem.create({ data: { ...copyOf(item, item.productId, await nextPosition(item.listId)), listId: item.listId } });
}

/**
 * Adds an item of a list to a base list, and links it to the new product.
 * @param {string} id Item id.
 * @param {string} baseListId Base list.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function saveItemToBase(id: string, baseListId: string): Promise<ShoppingProduct> {
  const item = await orNotFound(prisma.shoppingItem.findUnique({ where: { id }, include: withPeople }), 'Élément');
  if (item.productId) throw clientError('BAD_USER_INPUT', 'Cet élément est déjà dans une référence.');
  await assertItemOpen(item);
  await assertBaseList(baseListId);
  await assertNotArchived('SHOPPING_BASE_LIST', baseListId);
  return prisma.$transaction(async (tx) => {
    const product = await tx.shoppingProduct.create({
      data: {
        baseListId,
        name: item.name,
        categoryId: item.categoryId,
        storeId: item.storeId,
        url: item.url,
        note: item.note,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        perishable: item.perishable,
        storageId: item.storageId,
        expiresAt: item.purchasedAt ? item.expiresAt : null,
        missing: item.purchasedAt === null,
        ...(item.purchasedAt ? { lastPurchasedAt: item.purchasedAt, lastPrice: item.unitPrice } : {}),
        members: { connect: item.members },
        relations: { connect: item.relations },
      },
    });
    await tx.shoppingItem.update({ where: { id }, data: { productId: product.id } });
    return product;
  });
}

/**
 * Removes an item from its list.
 * @param {string} id Item id.
 * @returns {Promise<void>}
 */
export async function deleteItem(id: string): Promise<void> {
  await assertItemOpen(await findItem(id));
  await prisma.shoppingItem.delete({ where: { id } });
}
