import { colorSchema, labelNameSchema, STATUS_CATEGORIES_BY_SCOPE, type DocumentStatusCategory, type DocumentStatusScope } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type AccountingDocumentType, type DocumentStatus } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { moveInOrder } from './ordering';

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Status scope of a document type: quotes apart, invoices with deposit invoices and credit notes.
 * @param {AccountingDocumentType} type Document type.
 * @returns {DocumentStatusScope} Scope.
 */
export function scopeOf(type: AccountingDocumentType): DocumentStatusScope {
  return type === 'QUOTE' ? 'QUOTE' : 'INVOICE';
}

/**
 * First status of a category in a scope (the one automatic changes give).
 * @param {DocumentStatusScope} scope Scope.
 * @param {DocumentStatusCategory} category Category.
 * @param {Client} [client] Prisma client or transaction. Optional.
 * @returns {Promise<DocumentStatus>} Status.
 */
export async function statusOf(scope: DocumentStatusScope, category: DocumentStatusCategory, client: Client = prisma): Promise<DocumentStatus> {
  const status = await client.documentStatus.findFirst({ where: { scope, category }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  // Every category keeps at least one status (deletion refuses the last one).
  if (!status) throw clientError('BAD_USER_INPUT', 'Statut de suivi manquant : vérifiez les paramètres de facturation.');
  return status;
}

/**
 * Checks that a category belongs to a scope (no "accepted" invoice, no "paid" quote).
 * @param {DocumentStatusScope} scope Scope.
 * @param {DocumentStatusCategory} category Category.
 * @returns {void}
 */
function assertCategory(scope: DocumentStatusScope, category: DocumentStatusCategory): void {
  if (!STATUS_CATEGORIES_BY_SCOPE[scope].some((item) => item.value === category)) {
    throw clientError('BAD_USER_INPUT', 'Catégorie invalide pour ce type de document.', { fields: { category: 'Catégorie invalide.' } });
  }
}

/**
 * Converts a duplicate name into a field error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
function rethrowConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw clientError('CONFLICT', 'Un statut porte déjà ce nom.', { fields: { name: 'Un statut porte déjà ce nom.' } });
  }
  throw error;
}

/**
 * Checks that a status is not the last one of its category (automatic changes need one).
 * @param {DocumentStatus} status Status.
 * @returns {Promise<void>}
 */
async function assertNotLast(status: DocumentStatus): Promise<void> {
  const others = await prisma.documentStatus.count({ where: { scope: status.scope, category: status.category, id: { not: status.id } } });
  if (!others) throw clientError('BAD_USER_INPUT', 'C’est le dernier statut de sa catégorie : il est nécessaire au suivi automatique.');
}

/**
 * Creates a status at the end of its scope.
 * @param {object} input Status.
 * @param {DocumentStatusScope} input.scope Scope.
 * @param {string} input.name Name.
 * @param {string} input.color Color.
 * @param {DocumentStatusCategory} input.category Category.
 * @returns {Promise<DocumentStatus>} Status.
 */
export async function createDocumentStatus(input: { scope: DocumentStatusScope; name: string; color: string; category: DocumentStatusCategory }): Promise<DocumentStatus> {
  const data = parseInput(z.object({ name: labelNameSchema, color: colorSchema }), input);
  assertCategory(input.scope, input.category);
  const { _max } = await prisma.documentStatus.aggregate({ where: { scope: input.scope }, _max: { position: true } });
  try {
    return await prisma.documentStatus.create({ data: { ...data, scope: input.scope, category: input.category, position: (_max.position ?? -1) + 1 } });
  } catch (error) {
    return rethrowConflict(error);
  }
}

/**
 * Renames, recolors or recategorizes a status.
 * @param {string} id Status id.
 * @param {object} input Changes (null: unchanged).
 * @param {string | null} [input.name] Name.
 * @param {string | null} [input.color] Color.
 * @param {DocumentStatusCategory | null} [input.category] Category.
 * @returns {Promise<DocumentStatus>} Status.
 */
export async function updateDocumentStatus(
  id: string,
  input: { name?: string | null; color?: string | null; category?: DocumentStatusCategory | null },
): Promise<DocumentStatus> {
  const status = await prisma.documentStatus.findUnique({ where: { id } });
  if (!status) throw notFound('Statut');
  const data = parseInput(z.object({ name: labelNameSchema.optional(), color: colorSchema.optional() }), {
    name: input.name ?? undefined,
    color: input.color ?? undefined,
  });
  if (input.category && input.category !== status.category) {
    assertCategory(status.scope, input.category);
    await assertNotLast(status);
  }
  try {
    return await prisma.documentStatus.update({ where: { id }, data: { ...data, category: input.category ?? undefined } });
  } catch (error) {
    return rethrowConflict(error);
  }
}

/**
 * Deletes a status; its documents take the first other status of the same category.
 * @param {string} id Status id.
 * @returns {Promise<void>}
 */
export async function deleteDocumentStatus(id: string): Promise<void> {
  const status = await prisma.documentStatus.findUnique({ where: { id } });
  if (!status) throw notFound('Statut');
  await assertNotLast(status);
  await prisma.$transaction(async (tx) => {
    const replacement = await tx.documentStatus.findFirstOrThrow({
      where: { scope: status.scope, category: status.category, id: { not: id } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    await tx.accountingDocument.updateMany({ where: { trackingStatusId: id }, data: { trackingStatusId: replacement.id } });
    await tx.documentStatus.delete({ where: { id } });
  });
}

/**
 * Moves a status inside its scope.
 * @param {string} id Status id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveDocumentStatus(id: string, index: number): Promise<void> {
  const status = await prisma.documentStatus.findUnique({ where: { id } });
  if (!status) throw notFound('Statut');
  const siblings = await prisma.documentStatus.findMany({ where: { scope: status.scope }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
  const order = moveInOrder(
    siblings.map((item) => item.id),
    id,
    index,
  );
  await prisma.$transaction(order.map((statusId, position) => prisma.documentStatus.update({ where: { id: statusId }, data: { position } })));
}
