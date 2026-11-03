import { catalogItemSchema, type CatalogItemInput } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type CatalogItem } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';

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
  return prisma.catalogItem.create({ data: itemData(input) });
}

/**
 * Updates (or archives) a catalogue item; the documents already written keep their lines.
 * @param {string} id Item id.
 * @param {CatalogItemInput} input Item.
 * @returns {Promise<CatalogItem>} Item.
 */
export async function updateCatalogItem(id: string, input: CatalogItemInput): Promise<CatalogItem> {
  if (!(await prisma.catalogItem.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Article');
  return prisma.catalogItem.update({ where: { id }, data: itemData(input) });
}

/**
 * Deletes a catalogue item (lines are copies: documents are not changed).
 * @param {string} id Item id.
 * @returns {Promise<void>}
 */
export async function deleteCatalogItem(id: string): Promise<void> {
  if (!(await prisma.catalogItem.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Article');
  await prisma.catalogItem.delete({ where: { id } });
}
