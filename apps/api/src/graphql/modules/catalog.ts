import { done } from '../errors';
import type { CatalogItemInput as CatalogItemInputData } from '@ordo/shared';
import { prisma } from '../../db';
import * as catalog from '../../services/accounting/catalog';
import { builder } from '../builder';
import { LineKindEnum, UnitEnum } from './accounting-documents';
import { fromDecimal } from '../../services/core/decimal';

builder.prismaObject('CatalogItem', {
  description: 'Product or service of the catalogue: default fields of a document line.',
  fields: (t) => ({
    id: t.exposeID('id'),
    kind: t.field({ type: LineKindEnum, resolve: (item) => item.kind }),
    label: t.exposeString('label'),
    description: t.exposeString('description', { nullable: true }),
    unit: t.field({ type: UnitEnum, resolve: (item) => item.unit }),
    unitPrice: t.float({ resolve: (item) => fromDecimal(item.unitPrice) }),
    vatRate: t.float({ resolve: (item) => fromDecimal(item.vatRate) }),
  }),
});

const CatalogItemInput = builder.inputType('CatalogItemInput', {
  fields: (t) => ({
    kind: t.field({ type: LineKindEnum, required: true, description: 'ITEM or DISBURSEMENT.' }),
    label: t.string({ required: true }),
    description: t.string(),
    unit: t.field({ type: UnitEnum, required: true }),
    unitPrice: t.float({ required: true }),
    vatRate: t.float({ required: true }),
  }),
});

/**
 * Catalogue item input with omitted optional fields as null (the kind is checked by the service).
 * @param {typeof CatalogItemInput.$inferInput} input GraphQL input.
 * @returns {CatalogItemInput} Service input.
 */
const itemInput = (input: typeof CatalogItemInput.$inferInput) => ({ ...input, description: input.description ?? null }) as CatalogItemInputData;

builder.queryFields((t) => ({
  catalogItems: t.prismaField({
    type: ['CatalogItem'],
    description: 'Catalogue, by label.',
    resolve: (query) => prisma.catalogItem.findMany({ ...query, orderBy: { label: 'asc' } }),
  }),
}));

builder.mutationFields((t) => ({
  createCatalogItem: t.id({
    args: { input: t.arg({ type: CatalogItemInput, required: true }) },
    resolve: async (_root, { input }) => (await catalog.createCatalogItem(itemInput(input))).id,
  }),
  updateCatalogItem: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CatalogItemInput, required: true }) },
    resolve: (_root, { id, input }) => done(catalog.updateCatalogItem(id, itemInput(input))),
  }),
  deleteCatalogItem: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(catalog.deleteCatalogItem(id)),
  }),
}));
