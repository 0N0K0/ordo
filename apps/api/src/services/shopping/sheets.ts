import {
  addQuantities,
  checklistItemSchema,
  clipText,
  copyName,
  ITEM_NOTE_MAX,
  itemNoteSchema,
  mapById,
  parseDay,
  productKey,
  quantitySchema,
  readSheetSources,
  roundQuantity,
  sheetCategorySchema,
  type SheetInput,
  type SheetItemInput,
  sheetItemSchema,
  type SheetLinkInput,
  sheetLinkSchema,
  sheetMultiplierSchema,
  sheetSchema,
  type SheetSource,
  SHOPPING_NAME_MAX,
  shoppingItemSchema,
  timesSheet,
  UNIT_MAX,
  unitSchema,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { Prisma, type Sheet, type SheetCategory, type SheetItem, type Checklist, type ChecklistItem } from '../../generated/prisma/client';
import { clientError, isUniqueConflict, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { nextPositionIn } from '../core/ordering';
import { copyOf, findOpenList, nextPosition } from './shopping';
import { assertPeople, peopleData, peopleIds, withPeople } from './people';
import { syncChecklistStock } from './stock';
import { assertAllExist, assertExists, deleteOrNotFound } from '../core/lookup';
import { assertNoneArchived, assertNotArchived } from '../core/archive';
import { assertActiveRefs, type ShoppingRefs } from './refs';
import { createLabelService } from '../core/labels';
import { connectIds } from '../core/relations';
import { fromDecimal, toDecimal } from '../core/decimal';

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
  /** As the items of the shopping lists. */
  storeId: string | null;
  url: string | null;
  perishable: boolean;
  storageId: string | null;
  optional: boolean;
  memberIds: string[];
  relationIds: string[];
}

/**
 * Checks the products and categories items refer to, and refuses the archived ones (and archived store, storage mode,
 * unit) newly given.
 * @param {SheetItemInput[]} items Items.
 * @param {ShoppingRefs | null} [current] What the item changed has now (still valid when archived). Optional. Default = new items.
 * @returns {Promise<void>}
 */
async function assertProducts(items: SheetItemInput[], current?: ShoppingRefs | null): Promise<void> {
  const ids = [...new Set(items.flatMap((item) => (item.productId ? [item.productId] : [])))];
  await assertAllExist(prisma.shoppingProduct, ids, 'Produit');
  const categories = [...new Set(items.flatMap((item) => (item.categoryId ? [item.categoryId] : [])))];
  await assertAllExist(prisma.shoppingCategory, categories, 'Catégorie');
  for (const item of items)
    await assertActiveRefs({ productId: item.productId, categoryId: item.categoryId, storeId: item.storeId, storageId: item.perishable ? item.storageId : null, unit: item.unit || null }, current);
}

/**
 * Loads a sheet that can be changed: NOT_FOUND, or BAD_USER_INPUT when it is archived (read only).
 * @param {string} id Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
async function findOpenSheet(id: string): Promise<Sheet> {
  const sheet = await findSheet(id);
  await assertNotArchived('SHEET', id);
  return sheet;
}

/**
 * Refuses the archived sheets used to fill a list (BAD_USER_INPUT).
 * @param {string[]} ids Sheets.
 * @returns {Promise<void>}
 */
const assertSheetsUsable = (ids: string[]): Promise<void> => assertNoneArchived('SHEET', ids);

/**
 * Loads a sheet or throws NOT_FOUND.
 * @param {string} id Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
async function findSheet(id: string): Promise<Sheet> {
  const sheet = await orNotFound(prisma.sheet.findUnique({ where: { id } }), 'Fiche');
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
  quantity: toDecimal(item.quantity),
  unit: item.unit || null,
  note: item.note?.trim() || null,
  consumable: item.consumable,
});
/**
 * Fields of an item of a sheet: those of a checklist item, and those of the shopping items (store, link, conservation,
 * whom it is for, optional).
 * @param {SheetItemInput} item Item.
 * @param {'connect' | 'set'} mode People connected on creation, or replacing the previous ones.
 * @returns {object} Fields.
 */
const sheetItemFields = (item: SheetItemInput, mode: 'connect' | 'set') => ({
  ...itemFields(item),
  storeId: item.storeId ?? null,
  url: item.url ?? null,
  perishable: item.perishable ?? false,
  // A storage mode only for what is perishable.
  storageId: item.perishable ? (item.storageId ?? null) : null,
  optional: item.optional ?? false,
  ...peopleData(item, mode),
});

/**
 * Checks the categories of a sheet.
 * @param {string[]} ids Categories.
 * @param {string[]} [current] Categories it has now (still valid when archived). Optional. Default = none.
 * @returns {Promise<string[]>} Categories, without duplicates.
 */
async function assertCategories(ids: string[], current: string[] = []): Promise<string[]> {
  const unique = [...new Set(ids)];
  await assertAllExist(prisma.sheetCategory, unique, 'Catégorie');
  await assertNoneArchived(
    'SHEET_CATEGORY',
    unique.filter((id) => !current.includes(id)),
  );
  return unique;
}

/**
 * Creates a sheet, last of the list (its items are added on its page).
 * @param {SheetInput} input Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
export async function createSheet(input: SheetInput): Promise<Sheet> {
  const data = parseInput(sheetSchema, input);
  await assertExists(prisma.project, data.projectId, 'Projet');
  await assertNotArchived('project', data.projectId);
  const categories = await assertCategories(data.categoryIds);
  const position = await nextPositionIn('sheet');
  return prisma.sheet.create({
    data: { name: data.name, note: data.note || null, projectId: data.projectId, position, categories: { connect: connectIds(categories) } },
  });
}

/**
 * Changes a sheet: its name, note, project and categories.
 * @param {string} id Sheet.
 * @param {SheetInput} input Sheet.
 * @returns {Promise<Sheet>} Sheet.
 */
export async function updateSheet(id: string, input: SheetInput): Promise<Sheet> {
  const sheet = await orNotFound(prisma.sheet.findUnique({ where: { id }, include: { categories: { select: { id: true } } } }), 'Fiche');
  await assertNotArchived('SHEET', id);
  const data = parseInput(sheetSchema, input);
  await assertExists(prisma.project, data.projectId, 'Projet');
  if (data.projectId !== sheet.projectId) await assertNotArchived('project', data.projectId);
  const categories = await assertCategories(
    data.categoryIds,
    sheet.categories.map((category) => category.id),
  );
  return prisma.sheet.update({ where: { id }, data: { name: data.name, note: data.note || null, projectId: data.projectId, categories: { set: connectIds(categories) } } });
}

/**
 * Copies a sheet (« (copie) ») with its items, last of the list.
 * @param {string} id Sheet.
 * @returns {Promise<Sheet>} Copy.
 */
export async function duplicateSheet(id: string): Promise<Sheet> {
  const sheet = await orNotFound(prisma.sheet.findUnique({ where: { id }, include: { items: { orderBy: { position: 'asc' }, include: withPeople }, categories: { select: { id: true } } } }), 'Fiche');
  await assertNotArchived('SHEET', id);
  const copy = await createSheet({ name: copyName(sheet.name, 100), note: sheet.note, projectId: sheet.projectId, categoryIds: sheet.categories.map((category) => category.id) });
  await prisma.$transaction(
    sheet.items.map((item) =>
      prisma.sheetItem.create({
        data: {
          sheetId: copy.id,
          productId: item.productId,
          label: item.label,
          categoryId: item.categoryId,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          consumable: item.consumable,
          storeId: item.storeId,
          url: item.url,
          perishable: item.perishable,
          storageId: item.storageId,
          optional: item.optional,
          position: item.position,
          members: { connect: item.members },
          relations: { connect: item.relations },
        },
      }),
    ),
  );
  return copy;
}

/**
 * Deletes a sheet (its links to routines, events and tasks with it; the lists made of it stay).
 * @param {string} id Sheet.
 * @returns {Promise<void>}
 */
export async function deleteSheet(id: string): Promise<void> {
  await deleteOrNotFound(prisma.sheet, id, 'Fiche');
}

/**
 * Adds an item to a sheet, last.
 * @param {string} sheetId Sheet.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<SheetItem>} Item.
 */
export async function addSheetItem(sheetId: string, input: SheetItemInput): Promise<SheetItem> {
  await findOpenSheet(sheetId);
  const data = parseInput(sheetItemSchema, input);
  await assertProducts([data]);
  await assertPeople(data);
  const position = await nextPositionIn('sheetItem', { sheetId });
  return prisma.sheetItem.create({ data: { ...sheetItemFields(data, 'connect'), sheetId, position } });
}

/**
 * Adds products of the references to a sheet (their category and unit), last.
 * @param {string} sheetId Sheet.
 * @param {string[]} productIds References.
 * @returns {Promise<number>} Items added.
 */
export async function addSheetProducts(sheetId: string, productIds: string[]): Promise<number> {
  await findOpenSheet(sheetId);
  await assertNoneArchived('SHOPPING_PRODUCT', productIds);
  const products = await prisma.shoppingProduct.findMany({ where: { id: { in: [...new Set(productIds)] } }, orderBy: { name: 'asc' }, include: withPeople });
  const position = await nextPositionIn('sheetItem', { sheetId });
  const start = position;
  // Each with its people (many-to-many: created one by one).
  await prisma.$transaction(
    products.map((product, index) =>
      prisma.sheetItem.create({
        data: {
          sheetId,
          productId: product.id,
          label: product.name,
          categoryId: product.categoryId,
          quantity: product.quantity,
          unit: product.unit,
          consumable: product.consumable,
          storeId: product.storeId,
          url: product.url,
          perishable: product.perishable,
          storageId: product.storageId,
          position: start + index,
          members: { connect: product.members },
          relations: { connect: product.relations },
        },
      }),
    ),
  );
  return products.length;
}

/**
 * Changes an item of a sheet.
 * @param {string} id Item.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<SheetItem>} Item.
 */
export async function updateSheetItem(id: string, input: SheetItemInput): Promise<SheetItem> {
  const current = await orNotFound(prisma.sheetItem.findUnique({ where: { id } }), 'Élément');
  await assertNotArchived('SHEET', current.sheetId);
  const data = parseInput(sheetItemSchema, input);
  await assertProducts([data], current);
  await assertPeople(data);
  return prisma.sheetItem.update({ where: { id }, data: sheetItemFields(data, 'set') });
}

/**
 * Removes items of a sheet (their comments with them).
 * @param {string[]} ids Items.
 * @returns {Promise<void>}
 */
export async function deleteSheetItems(ids: string[]): Promise<void> {
  const items = await prisma.sheetItem.findMany({ where: { id: { in: ids } }, select: { sheetId: true } });
  await assertNoneArchived('SHEET', [...new Set(items.map((item) => item.sheetId))]);
  await prisma.sheetItem.deleteMany({ where: { id: { in: ids } } });
}

/** Categories of the sheets; the sheets of a deleted one stay, without it. */
export const sheetCategories = createLabelService<SheetCategory>('sheetCategory', { notFound: 'Catégorie', conflict: 'Cette catégorie existe déjà.' }, { schema: sheetCategorySchema });

/**
 * Items of sheets times their multipliers, as they are summed into a list (in the order of the sheets).
 * @param {SheetLinkInput[]} links Sheets and multipliers.
 * @returns {Promise<SheetPart[]>} Parts.
 */
async function partsOf(links: SheetLinkInput[]): Promise<SheetPart[]> {
  const sheets = await prisma.sheet.findMany({ where: { id: { in: [...new Set(links.map((link) => link.sheetId))] } }, include: { items: { orderBy: { position: 'asc' }, include: withPeople } } });
  const byId = mapById(sheets);
  return links.flatMap((link) => {
    const sheet = byId.get(link.sheetId);
    if (!sheet) throw notFound('Fiche');
    return sheet.items.map((item) => ({
      sheetId: sheet.id,
      sheetName: sheet.name,
      productId: item.productId,
      label: item.label,
      categoryId: item.categoryId,
      quantity: timesSheet(fromDecimal(item.quantity), link.multiplier),
      unit: item.unit,
      note: item.note,
      consumable: item.consumable,
      storeId: item.storeId,
      url: item.url,
      perishable: item.perishable,
      storageId: item.storageId,
      optional: item.optional,
      ...peopleIds(item),
    }));
  });
}

/** Largest quantity of a shopping item. */
const QUANTITY_MAX = 999_999;

/**
 * Part as a shopping item takes it: its label, note and unit cut to the limits of the shopping items (sheets saved
 * before the shared limits may hold longer texts), its quantity capped, then checked by the shopping item schemas.
 * @param {SheetPart} part Part.
 * @returns {SheetPart} Part that fits a shopping item.
 */
function fitForShopping(part: SheetPart): SheetPart {
  /**
   * Text cut to a length (clipText), none kept as none.
   * @param {string | null} text Text.
   * @param {number} max Most characters.
   * @returns {string | null} Cut text.
   */
  const cut = (text: string | null, max: number): string | null => (text === null ? null : clipText(text, max));
  return {
    ...part,
    label: parseInput(shoppingItemSchema.shape.name, cut(part.label, SHOPPING_NAME_MAX)),
    note: parseInput(itemNoteSchema, cut(part.note, ITEM_NOTE_MAX)),
    unit: parseInput(unitSchema, cut(part.unit, UNIT_MAX)),
    quantity: part.quantity === null ? null : parseInput(quantitySchema, Math.min(part.quantity, QUANTITY_MAX)),
  };
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
  await findOpenList(listId);
  await assertSheetsUsable([sheetId]);
  const times = parseInput(sheetMultiplierSchema, multiplier);
  const parts = (await partsOf([{ sheetId, multiplier: times }])).map(fitForShopping);
  const products = await prisma.shoppingProduct.findMany({ where: { id: { in: parts.flatMap((part) => (part.productId ? [part.productId] : [])) } }, include: withPeople });
  const productById = mapById(products);
  return prisma.$transaction(async (tx) => {
    const items = await tx.shoppingItem.findMany({ where: { listId, purchasedAt: null } });
    const byKey = new Map(items.map((item) => [productKey({ productId: item.productId, label: item.name, unit: item.unit }), item]));
    let position = await nextPosition(listId);
    for (const part of parts) {
      const key = productKey(part);
      const item = byKey.get(key);
      if (item) {
        const updated = await tx.shoppingItem.update({
          where: { id: item.id },
          data: {
            quantity: toDecimal(addQuantities(fromDecimal(item.quantity), part.quantity)),
            sheetSources: withSource(readSheetSources(item.sheetSources), part) as unknown as Prisma.InputJsonValue,
            // Optional only while every sheet it comes from says so.
            optional: item.optional && part.optional,
          },
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
              // The fields of the sheet item, those of the product without them.
              storeId: part.storeId ?? product.storeId,
              url: part.url ?? product.url,
              perishable: part.perishable || product.perishable,
              storageId: part.storageId ?? product.storageId,
              optional: part.optional,
              ...(part.memberIds.length || part.relationIds.length ? { members: { connect: connectIds(part.memberIds) }, relations: { connect: connectIds(part.relationIds) } } : {}),
              sheetSources: sources,
            },
          })
        : await tx.shoppingItem.create({
            data: {
              listId,
              name: part.label,
              categoryId: part.categoryId,
              note: part.note,
              quantity: toDecimal(part.quantity),
              unit: part.unit,
              storeId: part.storeId,
              url: part.url,
              perishable: part.perishable,
              storageId: part.storageId,
              optional: part.optional,
              members: { connect: connectIds(part.memberIds) },
              relations: { connect: connectIds(part.relationIds) },
              position,
              sheetSources: sources,
            },
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
  await findOpenList(listId);
  const items = await prisma.shoppingItem.findMany({ where: { listId } });
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const sources = readSheetSources(item.sheetSources);
      const own = sources.find((source) => source.sheetId === sheetId);
      if (!own) continue;
      const rest = sources.filter((source) => source !== own);
      const quantity = fromDecimal(item.quantity);
      const left = quantity === null || own.quantity === null ? quantity : roundQuantity(quantity - own.quantity);
      if (!rest.length && !item.purchasedAt && (left === null || left <= 0)) await tx.shoppingItem.delete({ where: { id: item.id } });
      else await tx.shoppingItem.update({ where: { id: item.id }, data: { quantity: toDecimal(left !== null && left < 0 ? 0 : left), sheetSources: rest as unknown as Prisma.InputJsonValue } });
    }
  });
}

// Sheets of routines, events and tasks ---------------------------------------------------------------------------------

/** Ids of what may own sheets (one of them is set). */
type OwnerIds = { routineId?: string | null; eventId?: string | null; taskId?: string | null };

/** Where clause of what owns sheets: a routine, an event or a task. */
export type OwnerScope = { routineId: string } | { eventId: string } | { taskId: string };

/**
 * Where clause of what owns sheets: a routine, an event or a task, exactly one.
 * @param {OwnerIds} owner Owner (one of them; an occurrence date is left out).
 * @returns {OwnerScope} Where clause.
 */
export function ownerScope(owner: OwnerIds): OwnerScope {
  const set: OwnerScope[] = [];
  if (owner.routineId) set.push({ routineId: owner.routineId });
  if (owner.eventId) set.push({ eventId: owner.eventId });
  if (owner.taskId) set.push({ taskId: owner.taskId });
  if (set.length !== 1) throw clientError('BAD_USER_INPUT', 'Une routine, un évènement ou une tâche, un seul.');
  return set[0];
}

/**
 * Checks that what owns sheets exists.
 * @param {OwnerScope} scope Owner.
 * @returns {Promise<void>}
 */
async function assertOwner(scope: OwnerScope): Promise<void> {
  if ('routineId' in scope) await assertExists(prisma.routine, scope.routineId, 'Routine');
  else if ('eventId' in scope) await assertExists(prisma.calendarEvent, scope.eventId, 'Évènement');
  else await assertExists(prisma.task, scope.taskId, 'Tâche');
}

/**
 * Items of the sheets of an owner times their multipliers, the archived sheets left out.
 * @param {OwnerScope} scope Owner.
 * @returns {Promise<SheetPart[] | null>} Parts, or null when it has no sheets.
 */
async function sheetPartsOf(scope: OwnerScope): Promise<SheetPart[] | null> {
  const links = await prisma.sheetLink.findMany({ where: { ...scope, sheet: { archivedAt: null } }, orderBy: { position: 'asc' } });
  return links.length ? partsOf(links.map((link) => ({ sheetId: link.sheetId, multiplier: link.multiplier.toNumber() }))) : null;
}

/**
 * Sets the sheets of a routine, an event or a task (its checklists made later follow them; those made stay).
 * @param {OwnerIds} owner Owner.
 * @param {SheetLinkInput[]} links Sheets and multipliers, in order.
 * @returns {Promise<void>}
 */
export async function setSheetLinks(owner: OwnerIds, links: SheetLinkInput[]): Promise<void> {
  const where = ownerScope(owner);
  await assertOwner(where);
  const data = parseInput(z.array(sheetLinkSchema).max(50, '50 fiches au plus.'), links);
  const ids = [...new Set(data.map((link) => link.sheetId))];
  await assertAllExist(prisma.sheet, ids, 'Fiche');
  // An archived sheet linked already stays; it is not added anew.
  const linked = await prisma.sheetLink.findMany({ where, select: { sheetId: true } });
  await assertSheetsUsable(ids.filter((id) => !linked.some((link) => link.sheetId === id)));
  await prisma.$transaction([
    prisma.sheetLink.deleteMany({ where }),
    prisma.sheetLink.createMany({ data: data.map((link, position) => ({ ...where, sheetId: link.sheetId, multiplier: toDecimal(link.multiplier), position })) }),
  ]);
}

// Checklists -----------------------------------------------------------------------------------------------------

/**
 * Where clause of the checklist of an owner (and its occurrence).
 * @param {SheetOwner} owner Owner.
 * @returns {Prisma.ChecklistWhereInput} Where clause.
 */
const listWhere = (owner: SheetOwner): Prisma.ChecklistWhereInput => ({ ...ownerScope(owner), ...('occurrenceDate' in owner ? { occurrenceDate: parseDay(owner.occurrenceDate) } : {}) });

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
    const key = productKey(part);
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
  const ownerOnly = ownerScope(owner);
  await assertOwner(ownerOnly);
  // The archived sheets do not fill checklists anymore.
  const parts = await sheetPartsOf(ownerOnly);
  if (!parts) return null;
  const occurrence = 'occurrenceDate' in owner ? parseDay(owner.occurrenceDate) : null;
  try {
    return await prisma.checklist.create({ data: { ...ownerOnly, occurrenceDate: occurrence, items: { create: summedRows(parts) } } });
  } catch (error) {
    // Made at the same time by another request: that one.
    if (isUniqueConflict(error)) return prisma.checklist.findFirst({ where: listWhere(owner) });
    throw error;
  }
}

/**
 * Makes a checklist again from the sheets of its owner (ticks and changes lost).
 * @param {string} id Checklist.
 * @returns {Promise<Checklist>} Checklist.
 */
export async function resetChecklist(id: string): Promise<Checklist> {
  const list = await orNotFound(prisma.checklist.findUnique({ where: { id } }), 'Liste');
  const parts = (await sheetPartsOf(ownerScope(list))) ?? [];
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
  await assertExists(prisma.checklist, id, 'Liste');
  await assertSheetsUsable([sheetId]);
  const parts = await partsOf([{ sheetId, multiplier: parseInput(sheetMultiplierSchema, multiplier) }]);
  await prisma.$transaction(async (tx) => {
    const items = await tx.checklistItem.findMany({ where: { listId: id } });
    const byKey = new Map(items.map((item) => [productKey(item), item]));
    let position = items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    for (const part of parts) {
      const key = productKey(part);
      const item = byKey.get(key);
      if (item) {
        byKey.set(
          key,
          await tx.checklistItem.update({
            where: { id: item.id },
            data: { quantity: toDecimal(addQuantities(fromDecimal(item.quantity), part.quantity)), sources: withSource(readSheetSources(item.sources), part) as unknown as Prisma.InputJsonValue },
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
  const item = await orNotFound(prisma.checklistItem.findUnique({ where: { id } }), 'Élément');
  return item;
}

/**
 * Adds an item of its own to a checklist, last.
 * @param {string} listId Checklist.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<ChecklistItem>} Item.
 */
export async function addChecklistItem(listId: string, input: SheetItemInput): Promise<ChecklistItem> {
  await assertExists(prisma.checklist, listId, 'Liste');
  const data = parseInput(checklistItemSchema, input);
  await assertProducts([data]);
  const position = await nextPositionIn('checklistItem', { listId });
  return prisma.checklistItem.create({ data: { ...itemFields(data), listId, position } });
}

/**
 * Changes an item of a checklist.
 * @param {string} id Item.
 * @param {SheetItemInput} input Item.
 * @returns {Promise<ChecklistItem>} Item.
 */
export async function updateChecklistItem(id: string, input: SheetItemInput): Promise<ChecklistItem> {
  const current = await findListItem(id);
  const data = parseInput(checklistItemSchema, input);
  await assertProducts([data], current);
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
  await deleteOrNotFound(prisma.checklistItem, id, 'Élément');
}
