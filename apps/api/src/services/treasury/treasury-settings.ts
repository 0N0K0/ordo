import {
  treasuryCategorySchema,
  treasuryCounterpartySchema,
  treasuryPaymentMethodSchema,
  type TreasuryCategoryInput,
  type TreasuryCounterpartyInput,
  type TreasuryPaymentMethodInput,
} from '@ordo/shared';
import { nextPosition } from '../core/settings-lists';
import { assertTreeParent, deleteTreeNode } from '../core/trees';
import { prisma } from '../../db';
import { moveInList, nextPositionIn } from '../core/ordering';
import type { TreasuryCategory, TreasuryCounterparty, TreasuryPaymentMethod } from '../../generated/prisma/client';
import { fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { getCompanyProfile } from '../accounting/company';
import { assertNotArchived, ARCHIVED_MESSAGE } from '../core/archive';

/**
 * Validates a category: its parent exists, has the same direction and is not the category or one of its
 * sub-categories.
 * @param {TreasuryCategoryInput} input Category.
 * @param {string} [id] Category edited. Optional.
 * @returns {Promise<ReturnType<typeof treasuryCategorySchema.parse>>} Category.
 */
async function parseCategory(input: TreasuryCategoryInput, id?: string) {
  const data = parseInput(treasuryCategorySchema, input);
  if (!data.parentId) return data;
  const parent = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id: data.parentId } }), 'Catégorie parente');
  // Nothing is put under an archived category (a category already there stays).
  if (parent.archivedAt && (!id || (await prisma.treasuryCategory.findUnique({ where: { id }, select: { parentId: true } }))?.parentId !== parent.id)) {
    throw fieldError('parentId', ARCHIVED_MESSAGE);
  }
  if (parent.direction !== data.direction) {
    throw fieldError('parentId', 'La catégorie parente doit être du même sens.');
  }
  await assertTreeParent('treasuryCategory', data.parentId, id, { missing: 'Catégorie parente', loop: 'Une catégorie ne peut pas être rangée sous elle-même.' });
  return data;
}

/**
 * Creates a category.
 * @param {TreasuryCategoryInput} input Category.
 * @returns {Promise<TreasuryCategory>} Category.
 */
export async function createCategory(input: TreasuryCategoryInput): Promise<TreasuryCategory> {
  const data = await parseCategory(input);
  return prisma.treasuryCategory.create({ data: { ...data, position: await nextCategoryPosition(data.parentId) } });
}

/**
 * Updates a category. Changing its direction moves its sub-categories along and is refused while entries of
 * the other direction use it.
 * @param {string} id Category id.
 * @param {TreasuryCategoryInput} input Category.
 * @returns {Promise<TreasuryCategory>} Category.
 */
export async function updateCategory(id: string, input: TreasuryCategoryInput): Promise<TreasuryCategory> {
  const previous = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id } }), 'Catégorie');
  await assertNotArchived('TREASURY_CATEGORY', id);
  const parsed = await parseCategory(input, id);
  // Under another parent, it goes last.
  const data = { ...parsed, ...((parsed.parentId ?? null) !== previous.parentId && { position: await nextCategoryPosition(parsed.parentId) }) };
  if (data.direction === previous.direction) return prisma.treasuryCategory.update({ where: { id }, data });
  // The whole branch changes direction.
  const all = await prisma.treasuryCategory.findMany({ select: { id: true, parentId: true } });
  const branch = new Set([id]);
  for (let grown = true; grown;) {
    grown = false;
    for (const category of all) {
      if (category.parentId && branch.has(category.parentId) && !branch.has(category.id)) {
        branch.add(category.id);
        grown = true;
      }
    }
  }
  const used = await prisma.treasuryEntry.count({ where: { categoryId: { in: [...branch] } } });
  if (used) throw fieldError('direction', 'Des mouvements utilisent cette catégorie : son sens ne peut plus changer.', 'Des mouvements l’utilisent.');
  return prisma.$transaction(async (tx) => {
    await tx.treasuryCategory.updateMany({ where: { id: { in: [...branch] } }, data: { direction: data.direction } });
    return tx.treasuryCategory.update({ where: { id }, data });
  });
}

/**
 * Moves a category under another one of the same direction (or to the top level), at an index among its new siblings.
 * @param {string} id Category id.
 * @param {string | null} parentId New parent.
 * @param {number | null} [index] Index among the siblings; last when omitted. Optional.
 * @returns {Promise<void>}
 */
export async function moveCategory(id: string, parentId: string | null, index?: number | null): Promise<void> {
  const category = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id } }), 'Catégorie');
  await assertNotArchived('TREASURY_CATEGORY', id);
  if (parentId !== category.parentId) await updateCategory(id, { name: category.name, color: category.color, direction: category.direction, parentId });
  if (index === null || index === undefined) return;
  await moveInList('treasuryCategory', id, index, { parentId, direction: category.direction });
}

/**
 * Next position among the sub-categories of a parent.
 * @param {string | null | undefined} parentId Parent, null for the top level.
 * @returns {Promise<number>} Position.
 */
async function nextCategoryPosition(parentId: string | null | undefined): Promise<number> {
  return nextPositionIn('treasuryCategory', { parentId: parentId ?? null });
}

/**
 * Deletes a category: its sub-categories move up to its parent, its entries lose their category.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await orNotFound(prisma.treasuryCategory.findUnique({ where: { id } }), 'Catégorie');
  await deleteTreeNode('treasuryCategory', category);
}

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
  await orNotFound(prisma.treasuryPaymentMethod.findUnique({ where: { id }, select: { id: true } }), 'Moyen de paiement');
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
  const { count } = await prisma.treasuryPaymentMethod.deleteMany({ where: { id } });
  if (!count) throw notFound('Moyen de paiement');
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
 * Updates (or archives) a counterparty; an archived one is only changed when restored by it.
 * @param {string} id Counterparty id.
 * @param {TreasuryCounterpartyInput} input Counterparty.
 * @returns {Promise<TreasuryCounterparty>} Counterparty.
 */
export async function updateCounterparty(id: string, input: TreasuryCounterpartyInput): Promise<TreasuryCounterparty> {
  const data = parseInput(treasuryCounterpartySchema, input);
  const current = await orNotFound(prisma.treasuryCounterparty.findUnique({ where: { id }, select: { archived: true } }), 'Tiers');
  if (current.archived && data.archived) await assertNotArchived('TREASURY_COUNTERPARTY', id);
  return prisma.treasuryCounterparty.update({ where: { id }, data });
}

/**
 * Deletes a counterparty; its entries lose their payer or payee.
 * @param {string} id Counterparty id.
 * @returns {Promise<void>}
 */
export async function deleteCounterparty(id: string): Promise<void> {
  const { count } = await prisma.treasuryCounterparty.deleteMany({ where: { id } });
  if (!count) throw notFound('Tiers');
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
