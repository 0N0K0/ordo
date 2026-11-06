import {
  treasuryCategorySchema,
  treasuryCounterpartySchema,
  treasuryPaymentMethodSchema,
  type TreasuryCategoryInput,
  type TreasuryCounterpartyInput,
  type TreasuryPaymentMethodInput,
} from '@ordo/shared';
import { prisma } from '../db';
import type { TreasuryCategory, TreasuryCounterparty, TreasuryPaymentMethod } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

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
  const parent = await prisma.treasuryCategory.findUnique({ where: { id: data.parentId } });
  if (!parent) throw notFound('Catégorie parente');
  if (parent.direction !== data.direction) {
    throw clientError('BAD_USER_INPUT', 'La catégorie parente doit être du même sens.', { fields: { parentId: 'La catégorie parente doit être du même sens.' } });
  }
  if (id) {
    const all = await prisma.treasuryCategory.findMany({ select: { id: true, parentId: true } });
    const parentOf = new Map(all.map((category) => [category.id, category.parentId]));
    for (let current: string | null | undefined = data.parentId; current; current = parentOf.get(current)) {
      if (current === id) throw clientError('BAD_USER_INPUT', 'Une catégorie ne peut pas être rangée sous elle-même.', { fields: { parentId: 'Choisissez une autre catégorie parente.' } });
    }
  }
  return data;
}

/**
 * Creates a category.
 * @param {TreasuryCategoryInput} input Category.
 * @returns {Promise<TreasuryCategory>} Category.
 */
export async function createCategory(input: TreasuryCategoryInput): Promise<TreasuryCategory> {
  return prisma.treasuryCategory.create({ data: await parseCategory(input) });
}

/**
 * Updates a category. Changing its direction moves its sub-categories along and is refused while entries of
 * the other direction use it.
 * @param {string} id Category id.
 * @param {TreasuryCategoryInput} input Category.
 * @returns {Promise<TreasuryCategory>} Category.
 */
export async function updateCategory(id: string, input: TreasuryCategoryInput): Promise<TreasuryCategory> {
  const previous = await prisma.treasuryCategory.findUnique({ where: { id } });
  if (!previous) throw notFound('Catégorie');
  const data = await parseCategory(input, id);
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
  if (used) throw clientError('BAD_USER_INPUT', 'Des mouvements utilisent cette catégorie : son sens ne peut plus changer.', { fields: { direction: 'Des mouvements l’utilisent.' } });
  return prisma.$transaction(async (tx) => {
    await tx.treasuryCategory.updateMany({ where: { id: { in: [...branch] } }, data: { direction: data.direction } });
    return tx.treasuryCategory.update({ where: { id }, data });
  });
}

/**
 * Deletes a category: its sub-categories move up to its parent, its entries lose their category.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.treasuryCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  await prisma.$transaction([prisma.treasuryCategory.updateMany({ where: { parentId: id }, data: { parentId: category.parentId } }), prisma.treasuryCategory.delete({ where: { id } })]);
}

/**
 * Creates a payment method.
 * @param {TreasuryPaymentMethodInput} input Method.
 * @returns {Promise<TreasuryPaymentMethod>} Method.
 */
export async function createPaymentMethod(input: TreasuryPaymentMethodInput): Promise<TreasuryPaymentMethod> {
  return prisma.treasuryPaymentMethod.create({ data: parseInput(treasuryPaymentMethodSchema, input) });
}

/**
 * Updates a payment method; a direction used by entries cannot be removed.
 * @param {string} id Method id.
 * @param {TreasuryPaymentMethodInput} input Method.
 * @returns {Promise<TreasuryPaymentMethod>} Method.
 */
export async function updatePaymentMethod(id: string, input: TreasuryPaymentMethodInput): Promise<TreasuryPaymentMethod> {
  const data = parseInput(treasuryPaymentMethodSchema, input);
  if (!(await prisma.treasuryPaymentMethod.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Moyen de paiement');
  if (!data.incoming && (await prisma.treasuryEntry.count({ where: { methodId: id, amount: { gt: 0 } } }))) {
    throw clientError('BAD_USER_INPUT', 'Des entrées utilisent ce moyen de paiement.', { fields: { incoming: 'Des entrées l’utilisent.' } });
  }
  if (!data.outgoing && (await prisma.treasuryEntry.count({ where: { methodId: id, amount: { lt: 0 } } }))) {
    throw clientError('BAD_USER_INPUT', 'Des sorties utilisent ce moyen de paiement.', { fields: { outgoing: 'Des sorties l’utilisent.' } });
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
  return prisma.treasuryCounterparty.create({ data: parseInput(treasuryCounterpartySchema, input) });
}

/**
 * Updates (or archives) a counterparty.
 * @param {string} id Counterparty id.
 * @param {TreasuryCounterpartyInput} input Counterparty.
 * @returns {Promise<TreasuryCounterparty>} Counterparty.
 */
export async function updateCounterparty(id: string, input: TreasuryCounterpartyInput): Promise<TreasuryCounterparty> {
  const data = parseInput(treasuryCounterpartySchema, input);
  if (!(await prisma.treasuryCounterparty.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Tiers');
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
