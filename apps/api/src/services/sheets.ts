import {
  addQuantities,
  sheetItemKey,
  sheetLinkSchema,
  checklistItemSchema,
  sheetMultiplierSchema,
  sheetCategorySchema,
  sheetItemSchema,
  sheetSchema,
  readSheetSources,
  timesSheet,
  type SheetCategoryInput,
  type SheetInput,
  type SheetItemInput,
  type SheetLinkInput,
  type SheetSource,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type Sheet, type SheetCategory, type SheetItem, type Checklist, type ChecklistItem } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { saveSiblingOrder } from './ordering';
import { copyOf, findList, nextPosition, withPeople } from './shopping';
import { syncChecklistStock } from './stock';

/** What a checklist belongs to: a routine or an event (one occurrence), or a task. */
export type SheetOwner = { routineId: string; occurrenceDate: string } | { eventId: string; occurrenceDate: string } | { taskId: string };

/** Item of a sheet, as it is summed into a list. */
interface SheetPart {
  sheetId: string;
  sheetName: string;
  productId: string | null;
  label: string;
  categoryId: string | null;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  consumable: boolean;
}

/**
 * Number of a decimal column.
 * @param {Prisma.Decimal | null} value Value.
 * @returns {number | null} Number.
 */
const num = (value: Prisma.Decimal | null) => (value === null ? null : value.toNumber());

/**
 * Checks the products and categories items refer to.
 * @param {SheetItemInput[]} items Items.
 * @returns {Promise<void>}
 */
async function assertProducts(items: SheetItemInput[]): Promise<void> {
  const ids = [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))];
  if (ids.length && (await prisma.shoppingProduct.count({ where: { id: { in: ids } } })) !== ids.length) throw notFound('Produit');
  const categories = [...new Set(items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))];
  if (categories.length && (await prisma.shoppingCategory.count({ where: { id: { in: categories } } })) !== categories.length) throw notFound('Catégorie');
}

/**
 * Checks the project a sheet belongs to.
 * @param {string | null} projectId Project.
 * @returns {Promise<void>}
 */
async function assertProject(projectId: string | null): Promise<void> {
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw notFound('Projet');
}

/**
 * Loads a sheet or throws NOT_FOUND.
 * @param {string} id Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
async function findSheet(id: string): Promise<Sheet> {
  const sheet = await prisma.sheet.findUnique({ where: { id } });
  if (!sheet) throw notFound('Fiche');
  return sheet;
}

/**
 * Fields of an item of a sheet or of a checklist.
 * @param {SheetItemInput} item Item.
 * @returns {object} Fields.
 */
const itemFields = (item: SheetItemInput) => ({
  productId: item.productId,
  label: item.label,
  categoryId: item.categoryId,
  quantity: item.quantity === null ? null : new Prisma.Decimal(item.quantity),
  unit: item.unit || null,
  note: item.note?.trim() || null,
  consumable: item.consumable,
});

/**
 * Checks the categories of a sheet.
 * @param {string[]} ids Categories.
 * @returns {Promise<string[]>} Categories, without duplicates.
 */
async function assertCategories(ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length && (await prisma.sheetCategory.count({ where: { id: { in: unique } } })) !== unique.length) throw notFound('Catégorie');
  return unique;
}

/**
 * Creates a sheet, last of the list (its items are added on its page).
 * @param {SheetInput} input Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
export async function createSheet(input: SheetInput): Promise<Sheet> {
  const data = parseInput(sheetSchema, input);
  await assertProject(data.projectId);
  const categories = await assertCategories(data.categoryIds);
  const { _max } = await prisma.sheet.aggregate({ _max: { position: true } });
  return prisma.sheet.create({
    data: { name: data.name, note: data.note || null, projectId: data.projectId, position: (_max.position ?? -1) + 1, categories: { connect: categories.map((id) => ({ id })) } },
  });
}

/**
 * Changes a sheet: its name, note, project and categories.
 * @param {string} id Sheet.
 * @param {SheetInput} input Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
export async function updateSheet(id: string, input: SheetInput): Promise<Sheet> {
  await findSheet(id);
  const data = parseInput(sheetSchema, input);
  await assertProject(data.projectId);
  const categories = await assertCategories(data.categoryIds);
  return prisma.sheet.update({ where: { id }, data: { name: data.name, note: data.note || null, projectId: data.projectId, categories: { set: categories.map((category) => ({ id: category })) } } });
}

/**
 * Copies a sheet (« (copie) ») with its items, last of the list.
 * @param {string} id Sheet.
 * @returns {Promise<Sheet>} Copy.
 */
export async function duplicateSheet(id: string): Promise<Sheet> {
  const sheet = await prisma.sheet.findUnique({ where: { id }, include: { items: { orderBy: { position: 'asc' } }, categories: { select: { id: true } } } });
  if (!sheet) throw notFound('Fiche');
  const copy = await createSheet({ name: `${sheet.name} (copie)`.slice(0, 100), note: sheet.note, projectId: sheet.projectId, categoryIds: sheet.categories.map((category) => category.id) });
  await prisma.sheetItem.createMany({
    data: sheet.items.map((item) => ({
      sheetId: copy.id,
      productId: item.productId,
      label: item.label,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      consumable: item.consumable,
      position: item.position,
    })),
  });
  return copy;
}

/**
 * Deletes a sheet (its links to routines, events and tasks with it; the lists made of it stay).
 * @param {string} id Sheet.
 * @returns {Promise<void>}
 */
export async function deleteSheet(id: string): Promise<void> {
  const { count } = await prisma.sheet.deleteMany({ where: { id } });
  if (!count) throw notFound('Fiche');
}

/**
 * Adds an item to a sheet, last.
 * @param {string} sheetId Sheet.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<SheetItem>} Item.
 */
export async function addSheetItem(sheetId: string, input: SheetItemInput): Promise<SheetItem> {
  await findSheet(sheetId);
  const data = parseInput(sheetItemSchema, input);
  await assertProducts([data]);
  const { _max } = await prisma.sheetItem.aggregate({ where: { sheetId }, _max: { position: true } });
  return prisma.sheetItem.create({ data: { ...itemFields(data), sheetId, position: (_max.position ?? -1) + 1 } });
}

/**
 * Adds products of the references to a sheet (their category and unit), last.
 * @param {string} sheetId Sheet.
 * @param {string[]} productIds References.
 * @returns {Promise<number>} Items added.
 */
export async function addSheetProducts(sheetId: string, productIds: string[]): Promise<number> {
  await findSheet(sheetId);
  const products = await prisma.shoppingProduct.findMany({ where: { id: { in: [...new Set(productIds)] } }, orderBy: { name: 'asc' } });
  const { _max } = await prisma.sheetItem.aggregate({ where: { sheetId }, _max: { position: true } });
  const start = (_max.position ?? -1) + 1;
  await prisma.sheetItem.createMany({
    data: products.map((product, index) => ({
      sheetId,
      productId: product.id,
      label: product.name,
      categoryId: product.categoryId,
      quantity: product.quantity,
      unit: product.unit,
      consumable: product.consumable,
      position: start + index,
    })),
  });
  return products.length;
}

/**
 * Changes an item of a sheet.
 * @param {string} id Item.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<SheetItem>} Item.
 */
export async function updateSheetItem(id: string, input: SheetItemInput): Promise<SheetItem> {
  if (!(await prisma.sheetItem.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Élément');
  const data = parseInput(sheetItemSchema, input);
  await assertProducts([data]);
  return prisma.sheetItem.update({ where: { id }, data: itemFields(data) });
}

/**
 * Removes items of a sheet (their comments with them).
 * @param {string[]} ids Items.
 * @returns {Promise<void>}
 */
export async function deleteSheetItems(ids: string[]): Promise<void> {
  await prisma.sheetItem.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Creates a category of the sheets, last.
 * @param {SheetCategoryInput} input Category.
 * @returns {Promise<SheetCategory>} Category.
 */
export async function createSheetCategory(input: SheetCategoryInput): Promise<SheetCategory> {
  const data = parseInput(sheetCategorySchema, input);
  const { _max } = await prisma.sheetCategory.aggregate({ _max: { position: true } });
  try {
    return await prisma.sheetCategory.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw clientError('BAD_USER_INPUT', 'Cette catégorie existe déjà.', { fields: { name: 'Cette catégorie existe déjà.' } });
    throw error;
  }
}

/**
 * Renames a category of the sheets or changes its color.
 * @param {string} id Category.
 * @param {Partial<SheetCategoryInput>} input Changes.
 * @returns {Promise<void>}
 */
export async function updateSheetCategory(id: string, input: Partial<SheetCategoryInput>): Promise<void> {
  const category = await prisma.sheetCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  const data = parseInput(sheetCategorySchema, { name: category.name, color: category.color, ...input });
  try {
    await prisma.sheetCategory.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw clientError('BAD_USER_INPUT', 'Cette catégorie existe déjà.', { fields: { name: 'Cette catégorie existe déjà.' } });
    throw error;
  }
}

/**
 * Deletes a category of the sheets (its sheets stay, without it).
 * @param {string} id Category.
 * @returns {Promise<void>}
 */
export async function deleteSheetCategory(id: string): Promise<void> {
  const { count } = await prisma.sheetCategory.deleteMany({ where: { id } });
  if (!count) throw notFound('Catégorie');
}

/**
 * Moves a category of the sheets in their order.
 * @param {string} id Category.
 * @param {number} index New index.
 * @returns {Promise<void>}
 */
export async function moveSheetCategory(id: string, index: number): Promise<void> {
  const all = await prisma.sheetCategory.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true } });
  if (!all.some((category) => category.id === id)) throw notFound('Catégorie');
  await saveSiblingOrder(
    all.map((category) => category.id),
    id,
    index,
    (categoryId, position) => prisma.sheetCategory.update({ where: { id: categoryId }, data: { position } }),
  );
}

/**
 * Items of sheets times their multipliers, as they are summed into a list (in the order of the sheets).
 * @param {SheetLinkInput[]} links Sheets and multipliers.
 * @returns {Promise<SheetPart[]>} Parts.
 */
async function partsOf(links: SheetLinkInput[]): Promise<SheetPart[]> {
  const sheets = await prisma.sheet.findMany({ where: { id: { in: [...new Set(links.map((link) => link.sheetId))] } }, include: { items: { orderBy: { position: 'asc' } } } });
  const byId = new Map(sheets.map((sheet) => [sheet.id, sheet]));
  return links.flatMap((link) => {
    const sheet = byId.get(link.sheetId);
    if (!sheet) throw notFound('Fiche');
    return sheet.items.map((item) => ({
      sheetId: sheet.id,
      sheetName: sheet.name,
      productId: item.productId,
      label: item.label,
      categoryId: item.categoryId,
      quantity: timesSheet(num(item.quantity), link.multiplier),
      unit: item.unit,
      note: item.note,
      consumable: item.consumable,
    }));
  });
}

/**
 * Sources of an item once a part is added: its sheet's share grows (or appears).
 * @param {SheetSource[]} sources Sources.
 * @param {SheetPart} part Part.
 * @returns {SheetSource[]} Sources.
 */
function withSource(sources: SheetSource[], part: SheetPart): SheetSource[] {
  const own = sources.find((source) => source.sheetId === part.sheetId);
  return own
    ? sources.map((source) => (source === own ? { ...source, quantity: addQuantities(source.quantity, part.quantity) } : source))
    : [...sources, { sheetId: part.sheetId, name: part.sheetName, quantity: part.quantity }];
}

// Shopping lists ----------------------------------------------------------------------------------------------------

/**
 * Adds a sheet (times a multiplier) to a shopping list: each of its items is summed with the item of the list not
 * bought yet of the same product (or same label and unit), else added (a product with its fields); the sheet is noted
 * on the items, with its share.
 * @param {string} listId Shopping list.
 * @param {string} sheetId Sheet.
 * @param {number} multiplier Times.
 * @returns {Promise<number>} Items changed or added.
 */
export async function addSheetToShoppingList(listId: string, sheetId: string, multiplier: number): Promise<number> {
  await findList(listId);
  const times = parseInput(sheetMultiplierSchema, multiplier);
  const parts = await partsOf([{ sheetId, multiplier: times }]);
  const products = await prisma.shoppingProduct.findMany({ where: { id: { in: parts.flatMap((part) => (part.productId ? [part.productId] : [])) } }, include: withPeople });
  const productById = new Map(products.map((product) => [product.id, product]));
  return prisma.$transaction(async (tx) => {
    const items = await tx.shoppingItem.findMany({ where: { listId, purchasedAt: null } });
    const byKey = new Map(items.map((item) => [sheetItemKey({ productId: item.productId, label: item.name, unit: item.unit }), item]));
    let position = await nextPosition(listId);
    for (const part of parts) {
      const key = sheetItemKey(part);
      const item = byKey.get(key);
      if (item) {
        const updated = await tx.shoppingItem.update({
          where: { id: item.id },
          data: { quantity: toDecimal(addQuantities(num(item.quantity), part.quantity)), sheetSources: withSource(readSheetSources(item.sheetSources), part) as unknown as Prisma.InputJsonValue },
        });
        byKey.set(key, updated);
        continue;
      }
      const product = part.productId ? productById.get(part.productId) : undefined;
      const sources = withSource([], part) as unknown as Prisma.InputJsonValue;
      const created = product
        ? await tx.shoppingItem.create({
            data: {
              ...copyOf(product, product.id, position),
              listId,
              categoryId: part.categoryId ?? product.categoryId,
              note: part.note ?? product.note,
              quantity: toDecimal(part.quantity),
              unit: part.unit ?? product.unit,
              sheetSources: sources,
            },
          })
        : await tx.shoppingItem.create({
            data: { listId, name: part.label, categoryId: part.categoryId, note: part.note, quantity: toDecimal(part.quantity), unit: part.unit, position, sheetSources: sources },
          });
      position += 1;
      byKey.set(key, created);
    }
    return parts.length;
  });
}

/**
 * Takes a sheet out of a shopping list: its share is taken from the quantities of its items, and the items it alone
 * brought (not bought yet) are removed.
 * @param {string} listId Shopping list.
 * @param {string} sheetId Sheet.
 * @returns {Promise<void>}
 */
export async function removeSheetFromShoppingList(listId: string, sheetId: string): Promise<void> {
  await findList(listId);
  const items = await prisma.shoppingItem.findMany({ where: { listId } });
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const sources = readSheetSources(item.sheetSources);
      const own = sources.find((source) => source.sheetId === sheetId);
      if (!own) continue;
      const rest = sources.filter((source) => source !== own);
      const quantity = num(item.quantity);
      const left = quantity === null || own.quantity === null ? quantity : Math.round((quantity - own.quantity) * 1000) / 1000;
      if (!rest.length && !item.purchasedAt && (left === null || left <= 0)) await tx.shoppingItem.delete({ where: { id: item.id } });
      else await tx.shoppingItem.update({ where: { id: item.id }, data: { quantity: toDecimal(left !== null && left < 0 ? 0 : left), sheetSources: rest as unknown as Prisma.InputJsonValue } });
    }
  });
}

/**
 * Decimal of a quantity.
 * @param {number | null} value Quantity.
 * @returns {Prisma.Decimal | null} Decimal.
 */
const toDecimal = (value: number | null) => (value === null ? null : new Prisma.Decimal(value));

// Sheets of routines, events and tasks ---------------------------------------------------------------------------------

/**
 * Where clause of what owns sheets: a routine, an event or a task.
 * @param {{ routineId?: string | null, eventId?: string | null, taskId?: string | null }} owner Owner (one of them).
 * @returns {{ routineId?: string, eventId?: string, taskId?: string }} Where clause.
 */
function ownerWhere(owner: { routineId?: string | null; eventId?: string | null; taskId?: string | null }) {
  const set = [owner.routineId && { routineId: owner.routineId }, owner.eventId && { eventId: owner.eventId }, owner.taskId && { taskId: owner.taskId }].filter(Boolean);
  if (set.length !== 1) throw clientError('BAD_USER_INPUT', 'Une routine, un évènement ou une tâche, un seul.');
  return set[0] as { routineId?: string; eventId?: string; taskId?: string };
}

/**
 * Checks that what owns sheets exists.
 * @param {{ routineId?: string, eventId?: string, taskId?: string }} where Owner.
 * @returns {Promise<void>}
 */
async function assertOwner(where: { routineId?: string; eventId?: string; taskId?: string }): Promise<void> {
  const found = where.routineId
    ? await prisma.routine.findUnique({ where: { id: where.routineId }, select: { id: true } })
    : where.eventId
      ? await prisma.calendarEvent.findUnique({ where: { id: where.eventId }, select: { id: true } })
      : await prisma.task.findUnique({ where: { id: where.taskId! }, select: { id: true } });
  if (!found) throw notFound(where.routineId ? 'Routine' : where.eventId ? 'Évènement' : 'Tâche');
}

/**
 * Sets the sheets of a routine, an event or a task (its checklists made later follow them; those made stay).
 * @param {{ routineId?: string | null, eventId?: string | null, taskId?: string | null }} owner Owner.
 * @param {SheetLinkInput[]} links Sheets and multipliers, in order.
 * @returns {Promise<void>}
 */
export async function setSheetLinks(owner: { routineId?: string | null; eventId?: string | null; taskId?: string | null }, links: SheetLinkInput[]): Promise<void> {
  const where = ownerWhere(owner);
  await assertOwner(where);
  const data = parseInput(z.array(sheetLinkSchema).max(50, '50 fiches au plus.'), links);
  const ids = [...new Set(data.map((link) => link.sheetId))];
  if ((await prisma.sheet.count({ where: { id: { in: ids } } })) !== ids.length) throw notFound('Fiche');
  await prisma.$transaction([
    prisma.sheetLink.deleteMany({ where }),
    prisma.sheetLink.createMany({ data: data.map((link, position) => ({ ...where, sheetId: link.sheetId, multiplier: new Prisma.Decimal(link.multiplier), position })) }),
  ]);
}

// Checklists -----------------------------------------------------------------------------------------------------

/**
 * Where clause of the checklist of an owner (and its occurrence).
 * @param {SheetOwner} owner Owner.
 * @returns {Prisma.ChecklistWhereInput} Where clause.
 */
const listWhere = (owner: SheetOwner): Prisma.ChecklistWhereInput =>
  'taskId' in owner
    ? { taskId: owner.taskId }
    : { ...('routineId' in owner ? { routineId: owner.routineId } : { eventId: owner.eventId }), occurrenceDate: new Date(`${owner.occurrenceDate}T00:00:00.000Z`) };

/**
 * Items of sheets summed into rows of a checklist (same product, or same label and unit, make one row).
 * @param {SheetPart[]} parts Parts.
 * @returns {object[]} Rows.
 */
function summedRows(parts: SheetPart[]) {
  const rows = new Map<
    string,
    { productId: string | null; label: string; categoryId: string | null; quantity: number | null; unit: string | null; note: string | null; consumable: boolean; sources: SheetSource[] }
  >();
  for (const part of parts) {
    const key = sheetItemKey(part);
    const row = rows.get(key);
    if (row) {
      row.quantity = addQuantities(row.quantity, part.quantity);
      row.sources = withSource(row.sources, part);
      row.consumable ||= part.consumable;
    } else
      rows.set(key, {
        productId: part.productId,
        label: part.label,
        categoryId: part.categoryId,
        quantity: part.quantity,
        unit: part.unit,
        note: part.note,
        consumable: part.consumable,
        sources: withSource([], part),
      });
  }
  return [...rows.values()].map((row, position) => ({
    productId: row.productId,
    label: row.label,
    categoryId: row.categoryId,
    quantity: toDecimal(row.quantity),
    unit: row.unit,
    note: row.note,
    consumable: row.consumable,
    sources: row.sources as unknown as Prisma.InputJsonValue,
    position,
  }));
}

/**
 * Checklist of a routine or an event occurrence, or of a task: the one made already, else made now of its sheets
 * (none without sheets).
 * @param {SheetOwner} owner Owner.
 * @returns {Promise<Checklist | null>} Checklist.
 */
export async function checklist(owner: SheetOwner): Promise<Checklist | null> {
  const existing = await prisma.checklist.findFirst({ where: listWhere(owner) });
  if (existing) return existing;
  const ownerOnly = 'taskId' in owner ? { taskId: owner.taskId } : 'routineId' in owner ? { routineId: owner.routineId } : { eventId: owner.eventId };
  await assertOwner(ownerOnly);
  const links = await prisma.sheetLink.findMany({ where: ownerOnly, orderBy: { position: 'asc' } });
  if (!links.length) return null;
  const parts = await partsOf(links.map((link) => ({ sheetId: link.sheetId, multiplier: link.multiplier.toNumber() })));
  const occurrence = 'occurrenceDate' in owner ? new Date(`${owner.occurrenceDate}T00:00:00.000Z`) : null;
  try {
    return await prisma.checklist.create({ data: { ...ownerOnly, occurrenceDate: occurrence, items: { create: summedRows(parts) } } });
  } catch (error) {
    // Made at the same time by another request: that one.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.checklist.findFirst({ where: listWhere(owner) });
    throw error;
  }
}

/**
 * Makes a checklist again from the sheets of its owner (ticks and changes lost).
 * @param {string} id Checklist.
 * @returns {Promise<Checklist>} Checklist.
 */
export async function resetChecklist(id: string): Promise<Checklist> {
  const list = await prisma.checklist.findUnique({ where: { id } });
  if (!list) throw notFound('Liste');
  const ownerOnly = list.taskId ? { taskId: list.taskId } : list.routineId ? { routineId: list.routineId } : { eventId: list.eventId! };
  const links = await prisma.sheetLink.findMany({ where: ownerOnly, orderBy: { position: 'asc' } });
  const parts = await partsOf(links.map((link) => ({ sheetId: link.sheetId, multiplier: link.multiplier.toNumber() })));
  return prisma.$transaction(async (tx) => {
    await tx.checklistItem.deleteMany({ where: { listId: id } });
    return tx.checklist.update({ where: { id }, data: { items: { create: summedRows(parts) } } });
  });
}

/**
 * Adds a sheet (times a multiplier) to a checklist, summed with its items.
 * @param {string} id Checklist.
 * @param {string} sheetId Sheet.
 * @param {number} multiplier Times.
 * @returns {Promise<void>}
 */
export async function addSheetToChecklist(id: string, sheetId: string, multiplier: number): Promise<void> {
  if (!(await prisma.checklist.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Liste');
  const parts = await partsOf([{ sheetId, multiplier: parseInput(sheetMultiplierSchema, multiplier) }]);
  await prisma.$transaction(async (tx) => {
    const items = await tx.checklistItem.findMany({ where: { listId: id } });
    const byKey = new Map(items.map((item) => [sheetItemKey(item), item]));
    let position = items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    for (const part of parts) {
      const key = sheetItemKey(part);
      const item = byKey.get(key);
      if (item) {
        byKey.set(
          key,
          await tx.checklistItem.update({
            where: { id: item.id },
            data: { quantity: toDecimal(addQuantities(num(item.quantity), part.quantity)), sources: withSource(readSheetSources(item.sources), part) as unknown as Prisma.InputJsonValue },
          }),
        );
      } else {
        byKey.set(
          key,
          await tx.checklistItem.create({
            data: {
              listId: id,
              productId: part.productId,
              label: part.label,
              categoryId: part.categoryId,
              quantity: toDecimal(part.quantity),
              unit: part.unit,
              note: part.note,
              consumable: part.consumable,
              sources: withSource([], part) as unknown as Prisma.InputJsonValue,
              position,
            },
          }),
        );
        position += 1;
      }
    }
  });
}

/**
 * Loads an item of a checklist or throws NOT_FOUND.
 * @param {string} id Item.
 * @returns {Promise<ChecklistItem>} Item.
 */
async function findListItem(id: string): Promise<ChecklistItem> {
  const item = await prisma.checklistItem.findUnique({ where: { id } });
  if (!item) throw notFound('Élément');
  return item;
}

/**
 * Adds an item of its own to a checklist, last.
 * @param {string} listId Checklist.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<ChecklistItem>} Item.
 */
export async function addChecklistItem(listId: string, input: SheetItemInput): Promise<ChecklistItem> {
  if (!(await prisma.checklist.findUnique({ where: { id: listId }, select: { id: true } }))) throw notFound('Liste');
  const data = parseInput(checklistItemSchema, input);
  await assertProducts([data]);
  const { _max } = await prisma.checklistItem.aggregate({ where: { listId }, _max: { position: true } });
  return prisma.checklistItem.create({ data: { ...itemFields(data), listId, position: (_max.position ?? -1) + 1 } });
}

/**
 * Changes an item of a checklist.
 * @param {string} id Item.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<ChecklistItem>} Item.
 */
export async function updateChecklistItem(id: string, input: SheetItemInput): Promise<ChecklistItem> {
  await findListItem(id);
  const data = parseInput(checklistItemSchema, input);
  await assertProducts([data]);
  return prisma.checklistItem.update({ where: { id }, data: itemFields(data) });
}

/**
 * Ticks or unticks items of checklists.
 * @param {string[]} ids Items.
 * @param {boolean} checked Ticked.
 * @returns {Promise<void>}
 */
export async function setChecklistItemsChecked(ids: string[], checked: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.checklistItem.updateMany({ where: { id: { in: ids } }, data: { checkedAt: checked ? new Date() : null } });
    // Ticked, what is used up is taken from the stock (given back when unticked).
    await syncChecklistStock(tx, ids, checked);
  });
}

/**
 * Removes an item of a checklist.
 * @param {string} id Item.
 * @returns {Promise<void>}
 */
export async function deleteChecklistItem(id: string): Promise<void> {
  await findListItem(id);
  await prisma.checklistItem.delete({ where: { id } });
}
