import { catalogItemSchema, type CatalogItemInput } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type CatalogItem } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { requirePro } from '../workspace/workspaces';
import { assertNotArchived } from '../core/archive';
import { assertExists, deleteOrNotFound } from '../core/lookup';

/**
 * Prisma data of a validated catalogue item.
 * @param {CatalogItemInput} input Item.
 * @returns {object} Prisma data.
 */
function itemData(input: CatalogItemInput) {
  const data = parseInput(catalogItemSchema, input);
  return {
    ...data,
    unitPrice: new Prisma.Decimal(data.unitPrice),
    // A disbursement is re-invoiced without VAT.
    vatRate: new Prisma.Decimal(data.kind === 'DISBURSEMENT' ? 0 : data.vatRate),
  };
}

/**
 * Adds a product or service to the catalogue.
 * @param {CatalogItemInput} input Item.
 * @returns {Promise<CatalogItem>} Item.
 */
export function createCatalogItem(input: CatalogItemInput): Promise<CatalogItem> {
  requirePro('catalogue');
  return prisma.catalogItem.create({ data: itemData(input) });
}

/**
 * Updates a catalogue item (not an archived one: restore it first); the documents already written keep their lines.
 * @param {string} id Item id.
 * @param {CatalogItemInput} input Item.
 * @returns {Promise<CatalogItem>} Item.
 */
export async function updateCatalogItem(id: string, input: CatalogItemInput): Promise<CatalogItem> {
  await assertExists(prisma.catalogItem, id, 'Article');
  await assertNotArchived('CATALOG_ITEM', id);
  return prisma.catalogItem.update({ where: { id }, data: itemData(input) });
}

/**
 * Deletes a catalogue item (lines are copies: documents are not changed).
 * @param {string} id Item id.
 * @returns {Promise<void>}
 */
export async function deleteCatalogItem(id: string): Promise<void> {
  await deleteOrNotFound(prisma.catalogItem, id, 'Article');
}
