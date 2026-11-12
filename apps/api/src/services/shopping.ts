import {
  shoppingBaseListNameSchema,
  shoppingItemSchema,
  shoppingCategorySchema,
  shoppingListNameSchema,
  shoppingProductSchema,
  shoppingStoreSchema,
  shoppingStorageSchema,
  shoppingShares,
  type ShoppingItemInput,
  type ShoppingCategoryInput,
  type ShoppingProductInput,
  type ShoppingStoreInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type ShoppingBaseList, type ShoppingCategory, type ShoppingItem, type ShoppingList, type ShoppingProduct, type ShoppingStorage, type ShoppingStore } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';
import { isMember } from './treasury-team';

const decimal = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));
const number = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
const day = (value: string | null) => (value === null ? null : new Date(`${value}T00:00:00Z`));

/**
 * Today in France, as a date column holds it.
 * @returns {Date} Today at 00:00 UTC.
 */
const today = () => new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })}T00:00:00Z`);

/**
 * Checks the members of the team or household and the relations a product or an item is for.
 * @param {string[]} memberIds Members.
 * @param {string[]} relationIds Relations.
 * @returns {Promise<void>}
 */
async function assertPeople(memberIds: string[], relationIds: string[]): Promise<void> {
  const members = await prisma.contributor.findMany({ where: { id: { in: memberIds } }, select: { teamMember: true, userId: true } });
  if (members.length !== new Set(memberIds).size || !members.every(isMember)) throw notFound('Membre');
  if ((await prisma.treasuryRelation.count({ where: { id: { in: relationIds } } })) !== new Set(relationIds).size) throw notFound('Relation');
}

/**
 * Checks the category and the store of a product or an item.
 * @param {{ categoryId: string | null, storeId: string | null }} input Product or item.
 * @returns {Promise<void>}
 */
async function assertPlaces({ categoryId, storeId }: { categoryId: string | null; storeId: string | null }): Promise<void> {
  if (categoryId && !(await prisma.shoppingCategory.findUnique({ where: { id: categoryId }, select: { id: true } }))) throw notFound('Catégorie');
  if (storeId && !(await prisma.shoppingStore.findUnique({ where: { id: storeId }, select: { id: true } }))) throw notFound('Magasin');
}

/**
 * Checks the storage mode of a product or an item.
 * @param {string | null} storageId Storage mode.
 * @returns {Promise<void>}
 */
async function assertStorage(storageId: string | null): Promise<void> {
  if (storageId && !(await prisma.shoppingStorage.findUnique({ where: { id: storageId }, select: { id: true } }))) throw notFound('Mode de conservation');
}

type Parsed = ReturnType<typeof shoppingItemSchema.parse>;

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
 * People of a product or an item, connected on creation or replacing the previous ones.
 * @param {Parsed} input Validated input.
 * @param {'connect' | 'set'} mode Creation or update.
 * @returns {object} Relation data.
 */
const people = (input: Parsed, mode: 'connect' | 'set') => ({
  members: { [mode]: [...new Set(input.memberIds)].map((id) => ({ id })) },
  relations: { [mode]: [...new Set(input.relationIds)].map((id) => ({ id })) },
});

/**
 * Validates a product or an item and checks what it refers to.
 * @param {T} schema Schema.
 * @param {unknown} input Input.
 * @returns {Promise<z.output<T>>} Validated input.
 */
async function parseShopping<T extends typeof shoppingItemSchema | typeof shoppingProductSchema>(schema: T, input: unknown) {
  const parsed = parseInput(schema, input) as ReturnType<T['parse']>;
  await assertPlaces(parsed);
  await assertStorage(parsed.perishable ? parsed.storageId : null);
  await assertPeople(parsed.memberIds, parsed.relationIds);
  return parsed;
}

// Categories ------------------------------------------------------------------------------------------------------

/**
 * Validates a category: its parent exists and is not the category or one of its sub-categories.
 * @param {ShoppingCategoryInput} input Category.
 * @param {string} [id] Category edited. Optional.
 * @returns {Promise<ReturnType<typeof shoppingCategorySchema.parse>>} Category.
 */
async function parseCategory(input: ShoppingCategoryInput, id?: string) {
  const data = parseInput(shoppingCategorySchema, input);
  data.baseListIds = [...new Set(data.baseListIds)];
  if ((await prisma.shoppingBaseList.count({ where: { id: { in: data.baseListIds } } })) !== data.baseListIds.length) throw notFound('Liste type');
  if (!data.parentId) return data;
  if (!(await prisma.shoppingCategory.findUnique({ where: { id: data.parentId }, select: { id: true } }))) throw notFound('Catégorie parente');
  if (id) {
    const all = await prisma.shoppingCategory.findMany({ select: { id: true, parentId: true } });
    const parentOf = new Map(all.map((category) => [category.id, category.parentId]));
    for (let current: string | null | undefined = data.parentId; current; current = parentOf.get(current)) {
      if (current === id) throw clientError('BAD_USER_INPUT', 'Une catégorie ne peut pas être rangée sous elle-même.', { fields: { parentId: 'Choisissez une autre catégorie parente.' } });
    }
  }
  return data;
}

/**
 * Creates a category.
 * @param {ShoppingCategoryInput} input Category.
 * @returns {Promise<ShoppingCategory>} Category.
 */
export async function createCategory(input: ShoppingCategoryInput): Promise<ShoppingCategory> {
  const { baseListIds, ...data } = await parseCategory(input);
  return prisma.shoppingCategory.create({ data: { ...data, baseLists: { connect: baseListIds.map((baseListId) => ({ id: baseListId })) } } });
}

/**
 * Updates a category.
 * @param {string} id Category id.
 * @param {ShoppingCategoryInput} input Category.
 * @returns {Promise<ShoppingCategory>} Category.
 */
export async function updateCategory(id: string, input: ShoppingCategoryInput): Promise<ShoppingCategory> {
  if (!(await prisma.shoppingCategory.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Catégorie');
  const { baseListIds, ...data } = await parseCategory(input, id);
  return prisma.shoppingCategory.update({ where: { id }, data: { ...data, baseLists: { set: baseListIds.map((baseListId) => ({ id: baseListId })) } } });
}

/**
 * Moves a category under another one (or to the top level), keeping its name, color and base lists.
 * @param {string} id Category id.
 * @param {string | null} parentId New parent, null for the top level.
 * @returns {Promise<ShoppingCategory>} Category.
 */
export async function moveCategory(id: string, parentId: string | null): Promise<ShoppingCategory> {
  const category = await prisma.shoppingCategory.findUnique({ where: { id }, include: { baseLists: { select: { id: true } } } });
  if (!category) throw notFound('Catégorie');
  return updateCategory(id, { name: category.name, color: category.color, parentId, baseListIds: category.baseLists.map((baseList) => baseList.id) });
}

/**
 * Deletes a category: its sub-categories go up a level, its products and items are left without one.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.shoppingCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  await prisma.$transaction([prisma.shoppingCategory.updateMany({ where: { parentId: id }, data: { parentId: category.parentId } }), prisma.shoppingCategory.delete({ where: { id } })]);
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
  if (await prisma.shoppingStore.findFirst({ where: { name: data.name } })) throw clientError('BAD_USER_INPUT', STORE_TAKEN, { fields: { name: STORE_TAKEN } });
  const { _max } = await prisma.shoppingStore.aggregate({ _max: { position: true } });
  return prisma.shoppingStore.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
}

/**
 * Updates the name and/or the color of a store.
 * @param {string} id Store id.
 * @param {Partial<ShoppingStoreInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateStore(id: string, input: Partial<ShoppingStoreInput>): Promise<void> {
  const current = await prisma.shoppingStore.findUnique({ where: { id } });
  if (!current) throw notFound('Magasin');
  const data = parseInput(shoppingStoreSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await prisma.shoppingStore.findFirst({ where: { name: data.name, id: { not: id } } })) throw clientError('BAD_USER_INPUT', STORE_TAKEN, { fields: { name: STORE_TAKEN } });
  await prisma.shoppingStore.update({ where: { id }, data });
}

/**
 * Deletes a store: its products and items are left without one.
 * @param {string} id Store id.
 * @returns {Promise<void>}
 */
export async function deleteStore(id: string): Promise<void> {
  if (!(await prisma.shoppingStore.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Magasin');
  await prisma.shoppingStore.delete({ where: { id } });
}

/**
 * Moves a store among the others.
 * @param {string} id Store id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveStore(id: string, index: number): Promise<void> {
  const all = await prisma.shoppingStore.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (!all.some((store) => store.id === id)) throw notFound('Magasin');
  const order = moveInOrder(
    all.map((store) => store.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((storeId, position) => prisma.shoppingStore.update({ where: { id: storeId }, data: { position } })));
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
  if (await prisma.shoppingStorage.findFirst({ where: { name: data.name } })) throw clientError('BAD_USER_INPUT', STORAGE_TAKEN, { fields: { name: STORAGE_TAKEN } });
  const { _max } = await prisma.shoppingStorage.aggregate({ _max: { position: true } });
  return prisma.shoppingStorage.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
}

/**
 * Updates the name and/or the color of a storage mode.
 * @param {string} id Storage mode id.
 * @param {Partial<ShoppingStoreInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateStorage(id: string, input: Partial<ShoppingStoreInput>): Promise<void> {
  const current = await prisma.shoppingStorage.findUnique({ where: { id } });
  if (!current) throw notFound('Mode de conservation');
  const data = parseInput(shoppingStorageSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await prisma.shoppingStorage.findFirst({ where: { name: data.name, id: { not: id } } })) throw clientError('BAD_USER_INPUT', STORAGE_TAKEN, { fields: { name: STORAGE_TAKEN } });
  await prisma.shoppingStorage.update({ where: { id }, data });
}

/**
 * Deletes a storage mode: its products and items are left without one.
 * @param {string} id Storage mode id.
 * @returns {Promise<void>}
 */
export async function deleteStorage(id: string): Promise<void> {
  if (!(await prisma.shoppingStorage.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Mode de conservation');
  await prisma.shoppingStorage.delete({ where: { id } });
}

/**
 * Moves a storage mode among the others.
 * @param {string} id Storage mode id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveStorage(id: string, index: number): Promise<void> {
  const all = await prisma.shoppingStorage.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (!all.some((storage) => storage.id === id)) throw notFound('Mode de conservation');
  const order = moveInOrder(
    all.map((storage) => storage.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((storageId, position) => prisma.shoppingStorage.update({ where: { id: storageId }, data: { position } })));
}

// Base lists -----------------------------------------------------------------------------------------------------

/**
 * Checks a base list.
 * @param {string} id Base list id.
 * @returns {Promise<void>}
 */
async function assertBaseList(id: string): Promise<void> {
  if (!(await prisma.shoppingBaseList.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Liste type');
}

/**
 * Creates a base list, after the others.
 * @param {string} name Name.
 * @returns {Promise<ShoppingBaseList>} Base list.
 */
export async function createBaseList(name: string): Promise<ShoppingBaseList> {
  const data = { name: parseInput(shoppingBaseListNameSchema, name) };
  const { _max } = await prisma.shoppingBaseList.aggregate({ _max: { position: true } });
  return prisma.shoppingBaseList.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
}

/**
 * Renames a base list.
 * @param {string} id Base list id.
 * @param {string} name Name.
 * @returns {Promise<ShoppingBaseList>} Base list.
 */
export async function renameBaseList(id: string, name: string): Promise<ShoppingBaseList> {
  await assertBaseList(id);
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

/**
 * Moves a base list among the others.
 * @param {string} id Base list id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveBaseList(id: string, index: number): Promise<void> {
  const all = await prisma.shoppingBaseList.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (!all.some((baseList) => baseList.id === id)) throw notFound('Liste type');
  const order = moveInOrder(
    all.map((baseList) => baseList.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((baseListId, position) => prisma.shoppingBaseList.update({ where: { id: baseListId }, data: { position } })));
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
  return prisma.shoppingProduct.create({ data: { ...fields(data), baseListId: data.baseListId, missing: data.missing, ...people(data, 'connect') } });
}

/**
 * Updates a product of the base list (the lists already made keep their copy).
 * @param {string} id Product id.
 * @param {ShoppingProductInput} input Product.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function updateProduct(id: string, input: ShoppingProductInput): Promise<ShoppingProduct> {
  if (!(await prisma.shoppingProduct.findUnique({ where: { id } }))) throw notFound('Produit');
  const data = await parseShopping(shoppingProductSchema, input);
  await assertBaseList(data.baseListId);
  const row = fields(data);
  // Not missing although past its date: what was bought is still good, the date no longer holds.
  if (!data.missing && row.expiresAt && row.expiresAt < today()) row.expiresAt = null;
  return prisma.shoppingProduct.update({ where: { id }, data: { ...row, baseListId: data.baseListId, missing: data.missing, ...people(data, 'set') } });
}

/**
 * Marks products as missing or not.
 * @param {string[]} ids Product ids.
 * @param {boolean} missing Missing.
 * @returns {Promise<void>}
 */
export async function setProductsMissing(ids: string[], missing: boolean): Promise<void> {
  if ((await prisma.shoppingProduct.count({ where: { id: { in: ids } } })) !== new Set(ids).size) throw notFound('Produit');
  await prisma.$transaction([
    prisma.shoppingProduct.updateMany({ where: { id: { in: ids } }, data: { missing } }),
    // Unticked although past its date: what was bought is still good, the date no longer holds.
    ...(missing ? [] : [prisma.shoppingProduct.updateMany({ where: { id: { in: ids }, expiresAt: { lt: today() } }, data: { expiresAt: null } })]),
  ]);
}

/**
 * Marks missing the perishable products whose last purchase is past its date (done when the base lists are read).
 * @returns {Promise<void>}
 */
export async function markExpired(): Promise<void> {
  await prisma.shoppingProduct.updateMany({ where: { perishable: true, missing: false, expiresAt: { lt: today() } }, data: { missing: true } });
}

/**
 * Removes a product from the base list (the items of the lists made from it stay).
 * @param {string} id Product id.
 * @returns {Promise<void>}
 */
export async function deleteProduct(id: string): Promise<void> {
  if (!(await prisma.shoppingProduct.findUnique({ where: { id } }))) throw notFound('Produit');
  await prisma.shoppingProduct.delete({ where: { id } });
}

// Lists ----------------------------------------------------------------------------------------------------------

const withPeople = { members: { select: { id: true } }, relations: { select: { id: true } } } as const;

type WithPeople = { members: { id: string }[]; relations: { id: string }[] };

/**
 * Item data copied from a product of a base list (or from another item).
 * @param {ShoppingProduct | ShoppingItem} source Product or item, with its people.
 * @param {string | null} productId Product the item comes from.
 * @param {number} position Position in the list.
 * @returns {object} Nested item creation.
 */
const copyOf = (source: (ShoppingProduct | ShoppingItem) & WithPeople, productId: string | null, position: number) => ({
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
async function findList(id: string): Promise<ShoppingList> {
  const list = await prisma.shoppingList.findUnique({ where: { id } });
  if (!list) throw notFound('Liste');
  return list;
}

/**
 * Checks the tasks a list is attached to.
 * @param {string[]} taskIds Tasks.
 * @returns {Promise<string[]>} Tasks, without duplicates.
 */
async function assertTasks(taskIds: string[]): Promise<string[]> {
  const ids = [...new Set(taskIds)];
  if (ids.length && (await prisma.task.count({ where: { id: { in: ids } } })) !== ids.length) throw notFound('Tâche');
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
  if ((await prisma.shoppingBaseList.count({ where: { id: { in: ids } } })) !== ids.length) throw notFound('Liste type');
  await markExpired();
  const products = ids.length ? await prisma.shoppingProduct.findMany({ where: { missing: true, baseListId: { in: ids } }, include: withPeople, orderBy: { name: 'asc' } }) : [];
  return prisma.shoppingList.create({ data: { ...data, items: { create: products.map((product, position) => copyOf(product, product.id, position)) } } });
}

/**
 * Renames a list and attaches it to some tasks (or to none).
 * @param {string} id List id.
 * @param {{ name: string, taskIds: string[] }} input List.
 * @returns {Promise<ShoppingList>} List.
 */
export async function updateList(id: string, { name, taskIds }: { name: string; taskIds: string[] }): Promise<ShoppingList> {
  await findList(id);
  const tasks = (await assertTasks(taskIds)).map((taskId) => ({ id: taskId }));
  return prisma.shoppingList.update({ where: { id }, data: { name: parseInput(shoppingListNameSchema, name), tasks: { set: tasks } } });
}

/**
 * Closes (archives) or reopens a list. A list whose tasks are all closed stays closed: one of them is reopened instead.
 * @param {string} id List id.
 * @param {boolean} closed Target state.
 * @returns {Promise<ShoppingList>} List.
 */
export async function setListClosed(id: string, closed: boolean): Promise<ShoppingList> {
  const list = await findList(id);
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
  const list = await prisma.shoppingList.findUnique({ where: { id }, include: { items: { include: withPeople, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } } });
  if (!list) throw notFound('Liste');
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
  const list = await prisma.shoppingList.findUnique({ where: { id }, include: { items: { include: withPeople } } });
  if (!list) throw notFound('Liste');
  if (entryId === null) return prisma.shoppingList.update({ where: { id }, data: { entryId: null } });
  if (list.entryId === entryId) throw clientError('BAD_USER_INPUT', 'La liste est déjà rattachée à ce mouvement.');
  const entry = await prisma.treasuryEntry.findUnique({ where: { id: entryId }, select: { amount: true, lines: { select: { position: true } } } });
  if (!entry) throw notFound('Mouvement');
  const { members, relations, total } = shoppingShares(
    list.items.map((item) => ({
      quantity: number(item.quantity),
      unitPrice: number(item.unitPrice),
      memberIds: item.members.map((member) => member.id),
      relationIds: item.relations.map((relation) => relation.id),
    })),
  );
  const shares = [...[...members].map(([memberId, cents]) => ({ memberId, relationId: null, cents })), ...[...relations].map(([relationId, cents]) => ({ memberId: null, relationId, cents }))];
  if (entry.lines.length + shares.length > 50) throw clientError('BAD_USER_INPUT', 'Le mouvement aurait plus de 50 lignes de répartition.');
  const amount = Math.round(Number(entry.amount) * 100);
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
          value: new Prisma.Decimal(percent ? Math.round((share.cents / total) * 1_000_000) / 10_000 : (Math.sign(amount) || -1) * (share.cents / 100)),
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
  const item = await prisma.shoppingItem.findUnique({ where: { id } });
  if (!item) throw notFound('Élément');
  return item;
}

/**
 * Next position in a list.
 * @param {string} listId List.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(listId: string): Promise<number> {
  const { _max } = await prisma.shoppingItem.aggregate({ where: { listId }, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/**
 * Adds an item of this list only (not from a base list).
 * @param {string} listId List.
 * @param {ShoppingItemInput} input Item.
 * @returns {Promise<ShoppingItem>} Item.
 */
export async function addItem(listId: string, input: ShoppingItemInput): Promise<ShoppingItem> {
  await findList(listId);
  const data = await parseShopping(shoppingItemSchema, input);
  return prisma.shoppingItem.create({ data: { ...fields(data), listId, position: await nextPosition(listId), ...people(data, 'connect') } });
}

/**
 * Adds products of base lists to a list (copied); those already in it are left out.
 * @param {string} listId List.
 * @param {string[]} productIds Products.
 * @returns {Promise<number>} Number of items added.
 */
export async function addProducts(listId: string, productIds: string[]): Promise<number> {
  await findList(listId);
  const ids = [...new Set(productIds)];
  if (ids.length > 500) throw clientError('BAD_USER_INPUT', '500 produits au plus à la fois.');
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
  await findItem(id);
  const data = await parseShopping(shoppingItemSchema, input);
  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingItem.update({ where: { id }, data: { ...fields(data), ...people(data, 'set') } });
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
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.shoppingItem.update({ where: { id }, data: { purchasedAt: purchased ? (item.purchasedAt ?? now) : null } });
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
  const item = await prisma.shoppingItem.findUnique({ where: { id }, include: withPeople });
  if (!item) throw notFound('Élément');
  return prisma.shoppingItem.create({ data: { ...copyOf(item, item.productId, await nextPosition(item.listId)), listId: item.listId } });
}

/**
 * Adds an item of a list to a base list, and links it to the new product.
 * @param {string} id Item id.
 * @param {string} baseListId Base list.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function saveItemToBase(id: string, baseListId: string): Promise<ShoppingProduct> {
  const item = await prisma.shoppingItem.findUnique({ where: { id }, include: withPeople });
  if (!item) throw notFound('Élément');
  if (item.productId) throw clientError('BAD_USER_INPUT', 'Cet élément est déjà dans une liste type.');
  await assertBaseList(baseListId);
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
  await findItem(id);
  await prisma.shoppingItem.delete({ where: { id } });
}
