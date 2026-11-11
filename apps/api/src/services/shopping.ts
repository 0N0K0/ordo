import {
  shoppingItemSchema,
  shoppingLabelSchema,
  shoppingListNameSchema,
  shoppingProductSchema,
  shoppingShares,
  type ShoppingItemInput,
  type ShoppingLabelInput,
  type ShoppingProductInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type ShoppingItem, type ShoppingList, type ShoppingProduct } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';
import { isMember } from './treasury-team';

const decimal = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));
const number = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));

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
  await assertPeople(parsed.memberIds, parsed.relationIds);
  return parsed;
}

// Categories and stores ------------------------------------------------------------------------------------------

type LabelModel = 'shoppingCategory' | 'shoppingStore';
const LABEL_NAMES: Record<LabelModel, { what: string; taken: string }> = {
  shoppingCategory: { what: 'Catégorie', taken: 'Cette catégorie existe déjà.' },
  shoppingStore: { what: 'Magasin', taken: 'Ce magasin existe déjà.' },
};

/**
 * Delegate of a category or store model (both have the same fields).
 * @param {LabelModel} model Model.
 * @returns {typeof prisma.shoppingCategory} Delegate.
 */
const delegate = (model: LabelModel) => prisma[model] as unknown as typeof prisma.shoppingCategory;

/**
 * Creates a category or a store, after the others.
 * @param {LabelModel} model Categories or stores.
 * @param {ShoppingLabelInput} input Name and color.
 * @returns {Promise<{ id: string }>} Row.
 */
export async function createLabel(model: LabelModel, input: ShoppingLabelInput): Promise<{ id: string }> {
  const data = parseInput(shoppingLabelSchema, input);
  const rows = delegate(model);
  if (await rows.findFirst({ where: { name: data.name } })) throw clientError('BAD_USER_INPUT', LABEL_NAMES[model].taken, { fields: { name: LABEL_NAMES[model].taken } });
  const { _max } = await rows.aggregate({ _max: { position: true } });
  return rows.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
}

/**
 * Updates the name and/or the color of a category or a store.
 * @param {LabelModel} model Categories or stores.
 * @param {string} id Row id.
 * @param {Partial<ShoppingLabelInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateLabel(model: LabelModel, id: string, input: Partial<ShoppingLabelInput>): Promise<void> {
  const rows = delegate(model);
  const current = await rows.findUnique({ where: { id } });
  if (!current) throw notFound(LABEL_NAMES[model].what);
  const data = parseInput(shoppingLabelSchema, { name: input.name ?? current.name, color: input.color ?? current.color });
  if (await rows.findFirst({ where: { name: data.name, id: { not: id } } })) throw clientError('BAD_USER_INPUT', LABEL_NAMES[model].taken, { fields: { name: LABEL_NAMES[model].taken } });
  await rows.update({ where: { id }, data });
}

/**
 * Deletes a category or a store: its products and items are left without one.
 * @param {LabelModel} model Categories or stores.
 * @param {string} id Row id.
 * @returns {Promise<void>}
 */
export async function deleteLabel(model: LabelModel, id: string): Promise<void> {
  const rows = delegate(model);
  if (!(await rows.findUnique({ where: { id } }))) throw notFound(LABEL_NAMES[model].what);
  await rows.delete({ where: { id } });
}

/**
 * Moves a category (the order of the aisles) or a store.
 * @param {LabelModel} model Categories or stores.
 * @param {string} id Row id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveLabel(model: LabelModel, id: string, index: number): Promise<void> {
  const rows = delegate(model);
  const all = await rows.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  if (!all.some((row) => row.id === id)) throw notFound(LABEL_NAMES[model].what);
  const order = moveInOrder(
    all.map((row) => row.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((rowId, position) => rows.update({ where: { id: rowId }, data: { position } })));
}

// Base list ------------------------------------------------------------------------------------------------------

/**
 * Adds a product to the base list.
 * @param {ShoppingProductInput} input Product.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function createProduct(input: ShoppingProductInput): Promise<ShoppingProduct> {
  const data = await parseShopping(shoppingProductSchema, input);
  return prisma.shoppingProduct.create({ data: { ...fields(data), missing: data.missing, ...people(data, 'connect') } });
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
  return prisma.shoppingProduct.update({ where: { id }, data: { ...fields(data), missing: data.missing, ...people(data, 'set') } });
}

/**
 * Marks products as missing or not.
 * @param {string[]} ids Product ids.
 * @param {boolean} missing Missing.
 * @returns {Promise<void>}
 */
export async function setProductsMissing(ids: string[], missing: boolean): Promise<void> {
  if ((await prisma.shoppingProduct.count({ where: { id: { in: ids } } })) !== new Set(ids).size) throw notFound('Produit');
  await prisma.shoppingProduct.updateMany({ where: { id: { in: ids } }, data: { missing } });
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
 * Checks the task a list is attached to.
 * @param {string | null} taskId Task.
 * @returns {Promise<void>}
 */
async function assertTask(taskId: string | null): Promise<void> {
  if (taskId && !(await prisma.task.findUnique({ where: { id: taskId }, select: { id: true } }))) throw notFound('Tâche');
}

/**
 * Creates a list: empty, or with the missing products of the base list.
 * @param {{ name: string, taskId: string | null, fromMissing: boolean }} input List.
 * @returns {Promise<ShoppingList>} List.
 */
export async function createList({ name, taskId, fromMissing }: { name: string; taskId: string | null; fromMissing: boolean }): Promise<ShoppingList> {
  const data = { name: parseInput(shoppingListNameSchema, name), taskId };
  await assertTask(taskId);
  const products = fromMissing ? await prisma.shoppingProduct.findMany({ where: { missing: true }, include: withPeople, orderBy: { name: 'asc' } }) : [];
  return prisma.shoppingList.create({
    data: {
      ...data,
      items: {
        create: products.map((product, position) => ({
          productId: product.id,
          name: product.name,
          categoryId: product.categoryId,
          storeId: product.storeId,
          url: product.url,
          note: product.note,
          quantity: product.quantity,
          unit: product.unit,
          unitPrice: product.unitPrice,
          position,
          members: { connect: product.members },
          relations: { connect: product.relations },
        })),
      },
    },
  });
}

/**
 * Renames a list and attaches it to a task (or to none).
 * @param {string} id List id.
 * @param {{ name: string, taskId: string | null }} input List.
 * @returns {Promise<ShoppingList>} List.
 */
export async function updateList(id: string, { name, taskId }: { name: string; taskId: string | null }): Promise<ShoppingList> {
  await findList(id);
  await assertTask(taskId);
  return prisma.shoppingList.update({ where: { id }, data: { name: parseInput(shoppingListNameSchema, name), taskId } });
}

/**
 * Closes (archives) or reopens a list. A list of a closed task stays closed: its task is reopened instead.
 * @param {string} id List id.
 * @param {boolean} closed Target state.
 * @returns {Promise<ShoppingList>} List.
 */
export async function setListClosed(id: string, closed: boolean): Promise<ShoppingList> {
  const list = await findList(id);
  if (!closed && list.taskId && (await prisma.task.findUnique({ where: { id: list.taskId }, select: { closedAt: true } }))?.closedAt) {
    throw clientError('BAD_USER_INPUT', 'La tâche de cette liste est fermée : rouvrez la tâche.');
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
      items: {
        create: list.items.map((item, position) => ({
          productId: item.productId,
          name: item.name,
          categoryId: item.categoryId,
          storeId: item.storeId,
          url: item.url,
          note: item.note,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          position,
          members: { connect: item.members },
          relations: { connect: item.relations },
        })),
      },
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
 * Adds an item to a list: a product of the base list (copied), or an item of this list only.
 * @param {string} listId List.
 * @param {{ productId: string | null, input: ShoppingItemInput | null }} source Product, or item.
 * @returns {Promise<ShoppingItem>} Item.
 */
export async function addItem(listId: string, source: { productId: string | null; input: ShoppingItemInput | null }): Promise<ShoppingItem> {
  await findList(listId);
  const { _max } = await prisma.shoppingItem.aggregate({ where: { listId }, _max: { position: true } });
  const position = (_max.position ?? -1) + 1;
  if (source.productId) {
    const product = await prisma.shoppingProduct.findUnique({ where: { id: source.productId }, include: withPeople });
    if (!product) throw notFound('Produit');
    return prisma.shoppingItem.create({
      data: {
        listId,
        productId: product.id,
        name: product.name,
        categoryId: product.categoryId,
        storeId: product.storeId,
        url: product.url,
        note: product.note,
        quantity: product.quantity,
        unit: product.unit,
        unitPrice: product.unitPrice,
        position,
        members: { connect: product.members },
        relations: { connect: product.relations },
      },
    });
  }
  const data = await parseShopping(shoppingItemSchema, source.input);
  return prisma.shoppingItem.create({ data: { ...fields(data), listId, position, ...people(data, 'connect') } });
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
  return prisma.shoppingItem.update({ where: { id }, data: { ...fields(data), ...people(data, 'set') } });
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
  const [updated] = await prisma.$transaction([
    prisma.shoppingItem.update({ where: { id }, data: { purchasedAt: purchased ? (item.purchasedAt ?? now) : null } }),
    ...(item.productId
      ? [
          prisma.shoppingProduct.update({
            where: { id: item.productId },
            data: purchased ? { missing: false, lastPurchasedAt: now, ...(item.unitPrice !== null ? { lastPrice: item.unitPrice } : {}) } : { missing: true },
          }),
        ]
      : []),
  ]);
  return updated;
}

/**
 * Adds an item of a list to the base list, and links it to the new product.
 * @param {string} id Item id.
 * @returns {Promise<ShoppingProduct>} Product.
 */
export async function saveItemToBase(id: string): Promise<ShoppingProduct> {
  const item = await prisma.shoppingItem.findUnique({ where: { id }, include: withPeople });
  if (!item) throw notFound('Élément');
  if (item.productId) throw clientError('BAD_USER_INPUT', 'Cet élément est déjà dans la liste de base.');
  return prisma.$transaction(async (tx) => {
    const product = await tx.shoppingProduct.create({
      data: {
        name: item.name,
        categoryId: item.categoryId,
        storeId: item.storeId,
        url: item.url,
        note: item.note,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
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
