import {
  treasuryCategorySchema,
  treasuryCounterpartySchema,
  treasuryPaymentMethodSchema,
  type TreasuryCategoryInput,
  type TreasuryCounterpartyInput,
  type TreasuryPaymentMethodInput,
} from '@ordo/shared';
import { nextPosition } from '../core/settings-lists';
import { subtreeIds, treeListService } from '../core/trees';
import { prisma } from '../../db';
import type { TreasuryCategory, TreasuryCounterparty, TreasuryPaymentMethod } from '../../generated/prisma/client';
import { fieldError, orNotFound, parseInput } from '../../graphql/errors';
import { getCompanyProfile } from '../accounting/company';
import { assertNotArchived, ARCHIVED_MESSAGE } from '../core/archive';
import { assertExists, deleteOrNotFound } from '../core/lookup';

/** Category of the treasury as validated. */
type ParsedCategory = ReturnType<typeof treasuryCategorySchema.parse>;

/**
 * Categories of the treasury, in a tree of one direction each; a deleted one's sub-categories move up to its parent,
 * its entries lose their category.
 */
const categories = treeListService<TreasuryCategory, ParsedCategory, TreasuryCategoryInput>(
  'treasuryCategory',
  { notFound: 'Catégorie', missingParent: 'Catégorie parente', loop: 'Une catégorie ne peut pas être rangée sous elle-même.' },
  {
    async parse(input, current) {
      const data = parseInput(treasuryCategorySchema, input);
      if (!data.parentId) return data;
      const parent = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id: data.parentId } }), 'Catégorie parente');
      // Nothing is put under an archived category (a category already there stays).
      if (parent.archivedAt && current?.parentId !== parent.id) throw fieldError('parentId', ARCHIVED_MESSAGE);
      if (parent.direction !== data.direction) throw fieldError('parentId', 'La catégorie parente doit être du même sens.');
      return data;
    },
    moveInput: (category, parentId) => ({ name: category.name, color: category.color, direction: category.direction, parentId }),
    siblings: (category) => ({ direction: category.direction }),
    async save(id, data, current, parsed) {
      if (parsed.direction === current.direction) return prisma.treasuryCategory.update({ where: { id }, data });
      // The whole branch changes direction.
      const branch = await subtreeIds('treasuryCategory', id);
      const used = await prisma.treasuryEntry.count({ where: { categoryId: { in: branch } } });
      if (used) throw fieldError('direction', 'Des mouvements utilisent cette catégorie : son sens ne peut plus changer.', 'Des mouvements l’utilisent.');
      return prisma.$transaction(async (tx) => {
        await tx.treasuryCategory.updateMany({ where: { id: { in: branch } }, data: { direction: parsed.direction } });
        return tx.treasuryCategory.update({ where: { id }, data });
      });
    },
  },
);

/**
 * A category: created last among its siblings, updated (under another parent, it goes last; changing its direction
 * moves its sub-categories along and is refused while entries of the other direction use it), moved under another one
 * of the same direction (or to the top level) at an index, deleted (its sub-categories move up to its parent, its
 * entries lose their category).
 */
export const { create: createCategory, update: updateCategory, move: moveCategory, remove: deleteCategory } = categories;

/**
 * Creates a payment method.
 * @param {TreasuryPaymentMethodInput} input Method.
 * @returns {Promise<TreasuryPaymentMethod>} Method.
 */
export async function createPaymentMethod(input: TreasuryPaymentMethodInput): Promise<TreasuryPaymentMethod> {
  return prisma.treasuryPaymentMethod.create({ data: { ...parseInput(treasuryPaymentMethodSchema, input), position: await nextPosition('TREASURY_PAYMENT_METHOD') } });
}

/**
 * Updates a payment method; a direction used by entries cannot be removed.
 * @param {string} id Method id.
 * @param {TreasuryPaymentMethodInput} input Method.
 * @returns {Promise<TreasuryPaymentMethod>} Method.
 */
export async function updatePaymentMethod(id: string, input: TreasuryPaymentMethodInput): Promise<TreasuryPaymentMethod> {
  const data = parseInput(treasuryPaymentMethodSchema, input);
  await assertExists(prisma.treasuryPaymentMethod, id, 'Moyen de paiement');
  await assertNotArchived('TREASURY_PAYMENT_METHOD', id);
  if (!data.incoming && (await prisma.treasuryEntry.count({ where: { methodId: id, amount: { gt: 0 } } }))) {
    throw fieldError('incoming', 'Des entrées utilisent ce moyen de paiement.', 'Des entrées l’utilisent.');
  }
  if (!data.outgoing && (await prisma.treasuryEntry.count({ where: { methodId: id, amount: { lt: 0 } } }))) {
    throw fieldError('outgoing', 'Des sorties utilisent ce moyen de paiement.', 'Des sorties l’utilisent.');
  }
  return prisma.treasuryPaymentMethod.update({ where: { id }, data });
}

/**
 * Deletes a payment method; its entries lose it.
 * @param {string} id Method id.
 * @returns {Promise<void>}
 */
export async function deletePaymentMethod(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryPaymentMethod, id, 'Moyen de paiement');
}

/**
 * Creates a counterparty.
 * @param {TreasuryCounterpartyInput} input Counterparty.
 * @returns {Promise<TreasuryCounterparty>} Counterparty.
 */
export async function createCounterparty(input: TreasuryCounterpartyInput): Promise<TreasuryCounterparty> {
  return prisma.treasuryCounterparty.create({ data: { ...parseInput(treasuryCounterpartySchema, input), position: await nextPosition('TREASURY_COUNTERPARTY') } });
}

/**
 * Updates a counterparty; not an archived one (restore it first).
 * @param {string} id Counterparty id.
 * @param {TreasuryCounterpartyInput} input Counterparty.
 * @returns {Promise<TreasuryCounterparty>} Counterparty.
 */
export async function updateCounterparty(id: string, input: TreasuryCounterpartyInput): Promise<TreasuryCounterparty> {
  const data = parseInput(treasuryCounterpartySchema, input);
  await assertExists(prisma.treasuryCounterparty, id, 'Tiers');
  await assertNotArchived('TREASURY_COUNTERPARTY', id);
  return prisma.treasuryCounterparty.update({ where: { id }, data });
}

/**
 * Deletes a counterparty; its entries lose their payer or payee.
 * @param {string} id Counterparty id.
 * @returns {Promise<void>}
 */
export async function deleteCounterparty(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryCounterparty, id, 'Tiers');
}

/**
 * Treasury categories of the payments of invoices (money in) and of the refunds of credit notes (money out): the
 * budgets their expected and actual movements count in. None: no category (out of budget).
 * @param {{ invoiceCategoryId: string | null, creditNoteCategoryId: string | null }} input Categories.
 * @returns {Promise<void>}
 */
export async function setInvoiceCategories(input: { invoiceCategoryId: string | null; creditNoteCategoryId: string | null }): Promise<void> {
  for (const [id, direction, field] of [
    [input.invoiceCategoryId, 'IN', 'invoiceCategoryId'],
    [input.creditNoteCategoryId, 'OUT', 'creditNoteCategoryId'],
  ] as const) {
    if (!id) continue;
    const category = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id }, select: { direction: true, archivedAt: true } }), 'Catégorie');
    // An archived category stays the one set, but is not set any more.
    if (category.archivedAt && id !== (await getCompanyProfile())[field]) throw fieldError(field, ARCHIVED_MESSAGE);
    if (category.direction !== direction) {
      const message = direction === 'IN' ? 'Choisissez une catégorie d’entrées.' : 'Choisissez une catégorie de sorties.';
      throw fieldError(field, message);
    }
  }
  const company = await getCompanyProfile();
  await prisma.companyProfile.update({ where: { id: company.id }, data: { invoiceCategoryId: input.invoiceCategoryId, creditNoteCategoryId: input.creditNoteCategoryId } });
}
