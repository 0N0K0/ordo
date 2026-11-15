import {
  newStockItemSchema,
  productStockSchema,
  sheetMultiplierSchema,
  shoppingDeliverySchema,
  shoppingOrderSchema,
  stockCountSchema,
  stockItemSchema,
  stockLocationSchema,
  stockMoveSchema,
  stockPurchaseSchema,
  type NewStockItemInput,
  type ProductStockInput,
  type ShoppingDeliveryInput,
  type ShoppingOrderInput,
  type StockCountInput,
  type StockItemInput,
  type StockLocationInput,
  type StockMoveInput,
  type StockPurchaseInput,
} from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type ShoppingDelivery, type StockCount, type StockItem, type StockLocation, type StockMovementKind } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { saveSiblingOrder } from './ordering';

type Tx = Prisma.TransactionClient;

/**
 * Number of a decimal column.
 * @param {Prisma.Decimal | null} value Value.
 * @returns {number} Number (0 when none).
 */
const num = (value: Prisma.Decimal | null) => (value === null ? 0 : value.toNumber());

/**
 * Quantity rounded to the thousandth.
 * @param {number} value Quantity.
 * @returns {number} Rounded.
 */
const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Calendar date of a day.
 * @param {string | null} day YYYY-MM-DD.
 * @returns {Date | null} Date.
 */
const dayOf = (day: string | null) => (day ? new Date(`${day}T00:00:00.000Z`) : null);

// Places ---------------------------------------------------------------------------------------------------------

/**
 * Validates a place and its parent (not itself nor one of its sub-places).
 * @param {StockLocationInput} input Place.
 * @param {string} [id] Place changed. Optional.
 * @returns {Promise<StockLocationInput>} Place.
 */
async function parseLocation(input: StockLocationInput, id?: string): Promise<StockLocationInput> {
  const data = parseInput(stockLocationSchema, input);
  if (!data.parentId) return data;
  if (!(await prisma.stockLocation.findUnique({ where: { id: data.parentId }, select: { id: true } }))) throw notFound('Emplacement parent');
  if (id) {
    const parentOf = new Map((await prisma.stockLocation.findMany({ select: { id: true, parentId: true } })).map((place) => [place.id, place.parentId]));
    for (let current: string | null | undefined = data.parentId; current; current = parentOf.get(current)) {
      if (current === id) throw clientError('BAD_USER_INPUT', 'Un emplacement ne peut pas être rangé sous lui-même.', { fields: { parentId: 'Choisissez un autre emplacement parent.' } });
    }
  }
  return data;
}

/**
 * Creates a place, last among its siblings.
 * @param {StockLocationInput} input Place.
 * @returns {Promise<StockLocation>} Place.
 */
export async function createLocation(input: StockLocationInput): Promise<StockLocation> {
  const data = await parseLocation(input);
  const { _max } = await prisma.stockLocation.aggregate({ where: { parentId: data.parentId }, _max: { position: true } });
  return prisma.stockLocation.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
}

/**
 * Renames a place, changes its color or its parent.
 * @param {string} id Place.
 * @param {StockLocationInput} input Place.
 * @returns {Promise<StockLocation>} Place.
 */
export async function updateLocation(id: string, input: StockLocationInput): Promise<StockLocation> {
  if (!(await prisma.stockLocation.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Emplacement');
  return prisma.stockLocation.update({ where: { id }, data: await parseLocation(input, id) });
}

/**
 * Moves a place under another (or to the top) and among its siblings.
 * @param {string} id Place.
 * @param {string | null} parentId New parent.
 * @param {number | null} [index] Index among its siblings. Optional.
 * @returns {Promise<void>}
 */
export async function moveLocation(id: string, parentId: string | null, index?: number | null): Promise<void> {
  const place = await prisma.stockLocation.findUnique({ where: { id } });
  if (!place) throw notFound('Emplacement');
  if (parentId !== place.parentId) await updateLocation(id, { name: place.name, color: place.color, parentId });
  if (index === null || index === undefined) return;
  const siblings = await prisma.stockLocation.findMany({ where: { parentId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true } });
  await saveSiblingOrder(
    siblings.map((sibling) => sibling.id),
    id,
    index,
    (siblingId, position) => prisma.stockLocation.update({ where: { id: siblingId }, data: { position } }),
  );
}

/**
 * Deletes a place: its sub-places go up a level, its items are left without place.
 * @param {string} id Place.
 * @returns {Promise<void>}
 */
export async function deleteLocation(id: string): Promise<void> {
  const place = await prisma.stockLocation.findUnique({ where: { id } });
  if (!place) throw notFound('Emplacement');
  await prisma.$transaction([prisma.stockLocation.updateMany({ where: { parentId: id }, data: { parentId: place.parentId } }), prisma.stockLocation.delete({ where: { id } })]);
}

// Items ----------------------------------------------------------------------------------------------------------

/**
 * Checks what an item refers to: its reference, category, place and people.
 * @param {StockItemInput} data Item.
 * @returns {Promise<void>}
 */
async function assertItemRefs(data: StockItemInput): Promise<void> {
  if (data.productId && !(await prisma.shoppingProduct.findUnique({ where: { id: data.productId }, select: { id: true } }))) throw notFound('Référence');
  if (data.categoryId && !(await prisma.shoppingCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } }))) throw notFound('Catégorie');
  if (data.locationId && !(await prisma.stockLocation.findUnique({ where: { id: data.locationId }, select: { id: true } }))) throw notFound('Emplacement');
  const members = [...new Set(data.memberIds)];
  const relations = [...new Set(data.relationIds)];
  if (members.length && (await prisma.contributor.count({ where: { id: { in: members } } })) !== members.length) throw notFound('Membre');
  if (relations.length && (await prisma.treasuryRelation.count({ where: { id: { in: relations } } })) !== relations.length) throw notFound('Relation');
}

/**
 * Row fields of an item (people apart).
 * @param {StockItemInput} data Item.
 * @returns {object} Fields.
 */
const itemFields = (data: StockItemInput) => ({
  productId: data.productId,
  label: data.label,
  categoryId: data.categoryId,
  unit: data.unit || null,
  locationId: data.locationId,
  note: data.note?.trim() || null,
  perishable: data.perishable,
});

/**
 * People of an item, connected on creation or replacing the previous ones.
 * @param {StockItemInput} data Item.
 * @param {'connect' | 'set'} mode Creation or update.
 * @returns {object} Relation data.
 */
const people = (data: StockItemInput, mode: 'connect' | 'set') => ({
  members: { [mode]: [...new Set(data.memberIds)].map((id) => ({ id })) },
  relations: { [mode]: [...new Set(data.relationIds)].map((id) => ({ id })) },
});

/**
 * Loads an item or throws NOT_FOUND.
 * @param {string} id Item.
 * @returns {Promise<StockItem>} Item.
 */
async function findItem(id: string): Promise<StockItem> {
  const item = await prisma.stockItem.findUnique({ where: { id } });
  if (!item) throw notFound('Article');
  return item;
}

/**
 * Creates an item of the stock, with what it starts with (counted).
 * @param {NewStockItemInput} input Item.
 * @returns {Promise<StockItem>} Item.
 */
export async function createStockItem(input: NewStockItemInput): Promise<StockItem> {
  const data = parseInput(newStockItemSchema, input);
  await assertItemRefs(data);
  const { _max } = await prisma.stockItem.aggregate({ _max: { position: true } });
  return prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.create({ data: { ...itemFields(data), position: (_max.position ?? -1) + 1, ...people(data, 'connect') } });
    if (data.quantity) await addIn(tx, item, data.quantity, data.perishable ? data.expiresAt : null, null, { kind: 'COUNT', note: 'Quantité de départ' });
    return item;
  });
}

/**
 * Changes an item of the stock (its quantities stay as they are).
 * @param {string} id Item.
 * @param {StockItemInput} input Item.
 * @returns {Promise<StockItem>} Item.
 */
export async function updateStockItem(id: string, input: StockItemInput): Promise<StockItem> {
  await findItem(id);
  const data = parseInput(stockItemSchema, input);
  await assertItemRefs(data);
  return prisma.stockItem.update({ where: { id }, data: { ...itemFields(data), ...people(data, 'set') } });
}

/**
 * Deletes an item of the stock, its lots and its history.
 * @param {string} id Item.
 * @returns {Promise<void>}
 */
export async function deleteStockItem(id: string): Promise<void> {
  await findItem(id);
  await prisma.stockItem.delete({ where: { id } });
}

// Quantities -------------------------------------------------------------------------------------------------------

/** Where a movement comes from. */
interface MoveSource {
  kind: StockMovementKind;
  note?: string | null;
  shoppingItemId?: string | null;
  sheetId?: string | null;
  checklistItemId?: string | null;
  countId?: string | null;
}

/**
 * Puts a quantity in an item: into a lot given, else into the lot of the same date (a perishable item), else into its
 * single lot (one that is not), else a new lot.
 * @param {Tx} tx Transaction.
 * @param {StockItem} item Item.
 * @param {number} quantity Positive.
 * @param {string | null} expiresAt Date of the lot (perishable).
 * @param {string | null} lotId Lot given.
 * @param {MoveSource} source Movement.
 * @returns {Promise<void>}
 */
async function addIn(tx: Tx, item: StockItem, quantity: number, expiresAt: string | null, lotId: string | null, source: MoveSource): Promise<void> {
  const date = item.perishable ? dayOf(expiresAt) : null;
  const lot = lotId
    ? await tx.stockLot.findFirst({ where: { id: lotId, itemId: item.id } })
    : await tx.stockLot.findFirst({ where: { itemId: item.id, ...(item.perishable ? { expiresAt: date } : {}) }, orderBy: { createdAt: 'asc' } });
  if (lotId && !lot) throw notFound('Lot');
  const target = lot
    ? await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: new Prisma.Decimal(round(num(lot.quantity) + quantity)) } })
    : await tx.stockLot.create({ data: { itemId: item.id, quantity: new Prisma.Decimal(round(quantity)), expiresAt: date } });
  await tx.stockMovement.create({ data: { ...source, itemId: item.id, lotId: target.id, quantity: new Prisma.Decimal(round(quantity)) } });
}

/**
 * Takes a quantity out of an item: from a lot given, else from the lots that expire first (those without date last);
 * empty lots are removed. Takes what there is.
 * @param {Tx} tx Transaction.
 * @param {string} itemId Item.
 * @param {number} quantity Positive.
 * @param {string | null} lotId Lot given.
 * @param {MoveSource} source Movement.
 * @returns {Promise<number>} Quantity taken.
 */
async function takeOut(tx: Tx, itemId: string, quantity: number, lotId: string | null, source: MoveSource): Promise<number> {
  const lots = await tx.stockLot.findMany({ where: { itemId, ...(lotId ? { id: lotId } : {}) }, orderBy: [{ expiresAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] });
  if (lotId && !lots.length) throw notFound('Lot');
  let left = quantity;
  for (const lot of lots) {
    if (left <= 0) break;
    const available = num(lot.quantity);
    const taken = round(Math.min(available, left));
    if (taken <= 0) continue;
    left = round(left - taken);
    if (round(available - taken) <= 0) await tx.stockLot.delete({ where: { id: lot.id } });
    else await tx.stockLot.update({ where: { id: lot.id }, data: { quantity: new Prisma.Decimal(round(available - taken)) } });
    await tx.stockMovement.create({ data: { ...source, itemId, lotId: round(available - taken) <= 0 ? null : lot.id, quantity: new Prisma.Decimal(-taken) } });
  }
  return round(quantity - left);
}

/**
 * Quantity in or out of an item by hand: bought, used up, lost, corrected.
 * @param {StockMoveInput} input Movement.
 * @returns {Promise<number>} Quantity moved (signed).
 */
export async function moveStock(input: StockMoveInput): Promise<number> {
  const data = parseInput(stockMoveSchema, input);
  const item = await findItem(data.itemId);
  const source: MoveSource = { kind: data.kind, note: data.note?.trim() || null };
  return prisma.$transaction(async (tx) => {
    if (data.quantity > 0 && (data.kind === 'PURCHASE' || data.kind === 'CORRECTION')) {
      await addIn(tx, item, data.quantity, data.expiresAt, data.lotId, source);
      return data.quantity;
    }
    const taken = await takeOut(tx, item.id, Math.abs(data.quantity), data.lotId, source);
    if (!taken) throw clientError('BAD_USER_INPUT', 'Il n’y en a plus en stock.');
    return -taken;
  });
}

/**
 * Changes the date of a lot.
 * @param {string} id Lot.
 * @param {string | null} expiresAt Date.
 * @returns {Promise<void>}
 */
export async function setLotExpiry(id: string, expiresAt: string | null): Promise<void> {
  if (!(await prisma.stockLot.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Lot');
  await prisma.stockLot.update({ where: { id }, data: { expiresAt: dayOf(expiresAt) } });
}

/**
 * Records an inventory: each item counted is set to its count (the difference in, or out of the lots that expire
 * first), noted as counted.
 * @param {StockCountInput} input Counts.
 * @returns {Promise<StockCount>} Inventory.
 */
export async function recordCount(input: StockCountInput): Promise<StockCount> {
  const data = parseInput(stockCountSchema, input);
  if (data.locationId && !(await prisma.stockLocation.findUnique({ where: { id: data.locationId }, select: { id: true } }))) throw notFound('Emplacement');
  const items = await prisma.stockItem.findMany({ where: { id: { in: data.lines.map((line) => line.itemId) } }, include: { lots: true } });
  if (items.length !== new Set(data.lines.map((line) => line.itemId)).size) throw notFound('Article');
  const byId = new Map(items.map((item) => [item.id, item]));
  return prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.create({ data: { locationId: data.locationId, note: data.note?.trim() || null } });
    for (const line of data.lines) {
      const item = byId.get(line.itemId)!;
      const current = round(item.lots.reduce((sum, lot) => sum + num(lot.quantity), 0));
      const difference = round(line.counted - current);
      const source: MoveSource = { kind: 'COUNT', countId: count.id };
      // More than expected: into the latest lot (a new one without date when there is none).
      if (difference > 0) {
        const latest = [...item.lots].sort((a, b) => (b.expiresAt?.getTime() ?? Infinity) - (a.expiresAt?.getTime() ?? Infinity))[0];
        await addIn(tx, item, difference, latest?.expiresAt ? latest.expiresAt.toISOString().slice(0, 10) : null, latest?.id ?? null, source);
      } else if (difference < 0) await takeOut(tx, item.id, -difference, null, source);
    }
    return count;
  });
}

// References -------------------------------------------------------------------------------------------------------

/**
 * Sets the stock settings of a reference: followed in stock, used up, added by itself once bought, and where.
 * @param {string} id Reference.
 * @param {ProductStockInput} input Settings.
 * @returns {Promise<void>}
 */
export async function setProductStock(id: string, input: ProductStockInput): Promise<void> {
  const data = parseInput(productStockSchema, input);
  if (!(await prisma.shoppingProduct.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Référence');
  if (data.stockLocationId && !(await prisma.stockLocation.findUnique({ where: { id: data.stockLocationId }, select: { id: true } }))) throw notFound('Emplacement');
  await prisma.shoppingProduct.update({ where: { id }, data: { ...data, autoStock: data.stockTracked && data.autoStock } });
}

/**
 * Item of the stock a reference (or a label and unit) goes to: the one at the place asked, else the first one, else a
 * new one made of it.
 * @param {Tx} tx Transaction.
 * @param {{ productId: string | null, label: string, unit: string | null, categoryId: string | null, perishable: boolean, memberIds: string[], relationIds: string[] }} source What is stored.
 * @param {string | null} locationId Place asked.
 * @returns {Promise<StockItem>} Item.
 */
async function itemFor(
  tx: Tx,
  source: { productId: string | null; label: string; unit: string | null; categoryId: string | null; perishable: boolean; memberIds: string[]; relationIds: string[] },
  locationId: string | null,
): Promise<StockItem> {
  const same = source.productId
    ? await tx.stockItem.findMany({ where: { productId: source.productId }, orderBy: { position: 'asc' } })
    : (await tx.stockItem.findMany({ where: { productId: null }, orderBy: { position: 'asc' } })).filter(
        (item) =>
          item.label.trim().toLocaleLowerCase('fr') === source.label.trim().toLocaleLowerCase('fr') && (item.unit ?? '').toLocaleLowerCase('fr') === (source.unit ?? '').toLocaleLowerCase('fr'),
      );
  const found = same.find((item) => item.locationId === locationId) ?? (locationId ? undefined : same[0]);
  if (found) return found;
  const { _max } = await tx.stockItem.aggregate({ _max: { position: true } });
  return tx.stockItem.create({
    data: {
      productId: source.productId,
      label: source.label,
      unit: source.unit,
      categoryId: source.categoryId,
      locationId,
      perishable: source.perishable,
      position: (_max.position ?? -1) + 1,
      members: { connect: source.memberIds.map((id) => ({ id })) },
      relations: { connect: source.relationIds.map((id) => ({ id })) },
    },
  });
}

/**
 * Adds what was bought (an item of a shopping list) to the stock: its quantity, at a place, until a date.
 * @param {StockPurchaseInput} input Purchase.
 * @returns {Promise<void>}
 */
export async function addPurchase(input: StockPurchaseInput): Promise<void> {
  const data = parseInput(stockPurchaseSchema, input);
  if (data.locationId && !(await prisma.stockLocation.findUnique({ where: { id: data.locationId }, select: { id: true } }))) throw notFound('Emplacement');
  await prisma.$transaction((tx) => storePurchase(tx, data.shoppingItemId, data.quantity, data.locationId, data.expiresAt));
}

/**
 * Puts an item of a shopping list in the stock.
 * @param {Tx} tx Transaction.
 * @param {string} shoppingItemId Item of the list.
 * @param {number} quantity Quantity.
 * @param {string | null} locationId Place.
 * @param {string | null} expiresAt Date.
 * @returns {Promise<void>}
 */
async function storePurchase(tx: Tx, shoppingItemId: string, quantity: number, locationId: string | null, expiresAt: string | null): Promise<void> {
  const bought = await tx.shoppingItem.findUnique({ where: { id: shoppingItemId }, include: { members: { select: { id: true } }, relations: { select: { id: true } } } });
  if (!bought) throw notFound('Élément');
  const item = await itemFor(
    tx,
    {
      productId: bought.productId,
      label: bought.name,
      unit: bought.unit,
      categoryId: bought.categoryId,
      perishable: bought.perishable,
      memberIds: bought.members.map((member) => member.id),
      relationIds: bought.relations.map((relation) => relation.id),
    },
    locationId,
  );
  await addIn(tx, item, quantity, expiresAt ?? (bought.expiresAt ? bought.expiresAt.toISOString().slice(0, 10) : null), null, { kind: 'PURCHASE', shoppingItemId });
}

/**
 * Once an item of a shopping list is ticked as bought: a reference followed in stock that goes there by itself is
 * added (its quantity, at its place, until its date); unticked, what it put in the stock is taken back.
 * @param {Tx} tx Transaction.
 * @param {string} shoppingItemId Item of the list.
 * @param {boolean} purchased Ticked or not.
 * @returns {Promise<void>}
 */
export async function syncPurchaseStock(tx: Tx, shoppingItemId: string, purchased: boolean): Promise<void> {
  if (!purchased) {
    await takeBack(tx, { shoppingItemId });
    return;
  }
  const bought = await tx.shoppingItem.findUnique({ where: { id: shoppingItemId }, include: { product: true } });
  if (!bought?.product?.stockTracked || !bought.product.autoStock) return;
  if (await tx.stockMovement.count({ where: { shoppingItemId } })) return;
  await storePurchase(tx, shoppingItemId, num(bought.quantity) || 1, bought.product.stockLocationId, null);
}

/**
 * Takes back what movements of a source did (an item unticked): their quantities given back (or taken back) to their
 * lots, the movements removed.
 * @param {Tx} tx Transaction.
 * @param {{ shoppingItemId?: string, checklistItemId?: string }} where Source.
 * @returns {Promise<void>}
 */
async function takeBack(tx: Tx, where: { shoppingItemId?: string; checklistItemId?: string }): Promise<void> {
  const movements = await tx.stockMovement.findMany({ where, include: { item: true } });
  for (const movement of movements) {
    const quantity = num(movement.quantity);
    if (quantity > 0) await takeOut(tx, movement.itemId, quantity, null, { kind: 'CORRECTION', note: 'Annulé' });
    else await addIn(tx, movement.item, -quantity, null, movement.lotId, { kind: 'CORRECTION', note: 'Annulé' });
  }
  await tx.stockMovement.deleteMany({ where: { id: { in: movements.map((movement) => movement.id) }, ...where } });
  // The corrections of the take-back are not kept: what was never done leaves no trace.
  await tx.stockMovement.deleteMany({ where: { kind: 'CORRECTION', note: 'Annulé', itemId: { in: movements.map((movement) => movement.itemId) }, date: { gte: new Date(Date.now() - 60_000) } } });
}

/**
 * Quantities in stock of the references, for the shopping lists.
 * @returns {Promise<{ productId: string, quantity: number }[]>} Quantities.
 */
export async function stockByProduct(): Promise<{ productId: string; quantity: number }[]> {
  const lots = await prisma.stockLot.findMany({ where: { item: { productId: { not: null } } }, select: { quantity: true, item: { select: { productId: true } } } });
  const sums = new Map<string, number>();
  for (const lot of lots) sums.set(lot.item.productId!, round((sums.get(lot.item.productId!) ?? 0) + num(lot.quantity)));
  return [...sums].map(([productId, quantity]) => ({ productId, quantity }));
}

// Sheets and checklists ------------------------------------------------------------------------------------------

/**
 * Takes a quantity of a reference out of the stock, from all its items (the lots that expire first first).
 * @param {Tx} tx Transaction.
 * @param {string} productId Reference.
 * @param {number} quantity Quantity.
 * @param {MoveSource} source Movement.
 * @returns {Promise<number>} Quantity taken.
 */
async function consumeProduct(tx: Tx, productId: string, quantity: number, source: MoveSource): Promise<number> {
  const items = await tx.stockItem.findMany({ where: { productId }, include: { lots: { select: { expiresAt: true } } }, orderBy: { position: 'asc' } });
  // The items whose lots expire first first.
  const first = (item: (typeof items)[number]) => Math.min(...item.lots.map((lot) => lot.expiresAt?.getTime() ?? Infinity), Infinity);
  let left = quantity;
  for (const item of [...items].sort((a, b) => first(a) - first(b))) {
    if (left <= 0) break;
    left = round(left - (await takeOut(tx, item.id, left, null, source)));
  }
  return round(quantity - left);
}

/**
 * Uses a sheet (times a multiplier): its items used up that are references take their quantities out of the stock.
 * @param {string} sheetId Sheet.
 * @param {number} multiplier Times.
 * @returns {Promise<{ taken: number, short: string[] }>} Items taken, and those short of stock.
 */
export async function useSheet(sheetId: string, multiplier: number): Promise<{ taken: number; short: string[] }> {
  const times = parseInput(sheetMultiplierSchema, multiplier);
  const sheet = await prisma.sheet.findUnique({ where: { id: sheetId }, include: { items: { orderBy: { position: 'asc' } } } });
  if (!sheet) throw notFound('Fiche');
  return prisma.$transaction(async (tx) => {
    let taken = 0;
    const short: string[] = [];
    for (const item of sheet.items) {
      if (!item.consumable || !item.productId || item.quantity === null) continue;
      const wanted = round(num(item.quantity) * times);
      const done = await consumeProduct(tx, item.productId, wanted, { kind: 'CONSUMPTION', sheetId });
      if (done > 0) taken += 1;
      if (done < wanted) short.push(item.label);
    }
    return { taken, short };
  });
}

/**
 * Once items of a checklist are ticked: those used up that are references take their quantities out of the stock;
 * unticked, it is given back.
 * @param {Tx} tx Transaction.
 * @param {string[]} ids Items of checklists.
 * @param {boolean} checked Ticked or not.
 * @returns {Promise<void>}
 */
export async function syncChecklistStock(tx: Tx, ids: string[], checked: boolean): Promise<void> {
  const items = await tx.checklistItem.findMany({ where: { id: { in: ids }, consumable: true, productId: { not: null }, quantity: { not: null } } });
  for (const item of items) {
    if (!checked) await takeBack(tx, { checklistItemId: item.id });
    else if (!(await tx.stockMovement.count({ where: { checklistItemId: item.id } }))) await consumeProduct(tx, item.productId!, num(item.quantity), { kind: 'CONSUMPTION', checklistItemId: item.id });
  }
}

// Remote orders ----------------------------------------------------------------------------------------------------

/**
 * Makes a shopping list a remote order (or not), delivered at a place.
 * @param {string} listId List.
 * @param {ShoppingOrderInput} input Order.
 * @returns {Promise<void>}
 */
export async function setShoppingOrder(listId: string, input: ShoppingOrderInput): Promise<void> {
  const data = parseInput(shoppingOrderSchema, input);
  if (!(await prisma.shoppingList.findUnique({ where: { id: listId }, select: { id: true } }))) throw notFound('Liste');
  await prisma.shoppingList.update({ where: { id: listId }, data: { ...data, deliveryAddress: data.deliveryAddress || null } });
}

/**
 * Fields of a delivery.
 * @param {ShoppingDeliveryInput} data Delivery.
 * @returns {object} Fields.
 */
const deliveryFields = (data: ShoppingDeliveryInput) => ({
  label: data.label || null,
  trackingUrl: data.trackingUrl || null,
  pickup: data.pickup,
  windowFrom: dayOf(data.windowFrom),
  windowTo: dayOf(data.windowTo),
  address: data.address || null,
  lat: data.address ? data.lat : null,
  lon: data.address ? data.lon : null,
});

/**
 * Items of a list a delivery brings (those of other lists refused).
 * @param {Tx} tx Transaction.
 * @param {string} listId List.
 * @param {string} deliveryId Delivery.
 * @param {string[]} itemIds Items.
 * @returns {Promise<void>}
 */
async function assignItems(tx: Tx, listId: string, deliveryId: string, itemIds: string[]): Promise<void> {
  const ids = [...new Set(itemIds)];
  if (ids.length && (await tx.shoppingItem.count({ where: { id: { in: ids }, listId } })) !== ids.length) throw notFound('Élément');
  await tx.shoppingItem.updateMany({ where: { deliveryId, id: { notIn: ids } }, data: { deliveryId: null } });
  await tx.shoppingItem.updateMany({ where: { id: { in: ids } }, data: { deliveryId } });
}

/**
 * Adds a delivery to a remote order, with the items it brings.
 * @param {string} listId List.
 * @param {ShoppingDeliveryInput} input Delivery.
 * @returns {Promise<ShoppingDelivery>} Delivery.
 */
export async function createDelivery(listId: string, input: ShoppingDeliveryInput): Promise<ShoppingDelivery> {
  const data = parseInput(shoppingDeliverySchema, input);
  if (!(await prisma.shoppingList.findUnique({ where: { id: listId }, select: { id: true } }))) throw notFound('Liste');
  const { _max } = await prisma.shoppingDelivery.aggregate({ where: { listId }, _max: { position: true } });
  return prisma.$transaction(async (tx) => {
    const delivery = await tx.shoppingDelivery.create({ data: { ...deliveryFields(data), listId, position: (_max.position ?? -1) + 1 } });
    await assignItems(tx, listId, delivery.id, data.itemIds);
    return delivery;
  });
}

/**
 * Changes a delivery and the items it brings.
 * @param {string} id Delivery.
 * @param {ShoppingDeliveryInput} input Delivery.
 * @returns {Promise<ShoppingDelivery>} Delivery.
 */
export async function updateDelivery(id: string, input: ShoppingDeliveryInput): Promise<ShoppingDelivery> {
  const delivery = await prisma.shoppingDelivery.findUnique({ where: { id } });
  if (!delivery) throw notFound('Livraison');
  const data = parseInput(shoppingDeliverySchema, input);
  return prisma.$transaction(async (tx) => {
    await assignItems(tx, delivery.listId, id, data.itemIds);
    return tx.shoppingDelivery.update({ where: { id }, data: deliveryFields(data) });
  });
}

/**
 * Deletes a delivery (its items stay on the list).
 * @param {string} id Delivery.
 * @returns {Promise<void>}
 */
export async function deleteDelivery(id: string): Promise<void> {
  const { count } = await prisma.shoppingDelivery.deleteMany({ where: { id } });
  if (!count) throw notFound('Livraison');
}

/**
 * Marks a delivery received (or not): received, its items are ticked as bought.
 * @param {string} id Delivery.
 * @param {boolean} received Received or not.
 * @returns {Promise<string[]>} Items ticked now (to propose adding them to the stock).
 */
export async function setDeliveryReceived(id: string, received: boolean): Promise<string[]> {
  const delivery = await prisma.shoppingDelivery.findUnique({ where: { id }, include: { items: { where: { purchasedAt: null }, select: { id: true } } } });
  if (!delivery) throw notFound('Livraison');
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.shoppingDelivery.update({ where: { id }, data: { receivedAt: received ? (delivery.receivedAt ?? now) : null } });
    if (!received) return [];
    const ids = delivery.items.map((item) => item.id);
    for (const itemId of ids) {
      const item = await tx.shoppingItem.update({ where: { id: itemId }, data: { purchasedAt: now } });
      if (item.productId)
        await tx.shoppingProduct.update({ where: { id: item.productId }, data: { missing: false, lastPurchasedAt: now, ...(item.unitPrice !== null ? { lastPrice: item.unitPrice } : {}) } });
      await syncPurchaseStock(tx, itemId, true);
    }
    return ids;
  });
}
