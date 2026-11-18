import { colorSchema, DEFAULT_LABEL_COLOR, type DocumentStatusCategory, type DocumentStatusScope, labelNameSchema, STATUS_CATEGORIES_BY_SCOPE } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { Prisma, type AccountingDocumentType, type DocumentStatus } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { BY_POSITION, nextPositionIn } from '../core/ordering';
import { assertNotArchived, firstActive } from '../core/archive';

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
 * A tracking status of the scope of a document type, or NOT_FOUND.
 * @param {string} statusId Status.
 * @param {AccountingDocumentType} type Document type.
 * @returns {Promise<DocumentStatus>} Status.
 */
export async function scopedStatus(statusId: string, type: AccountingDocumentType): Promise<DocumentStatus> {
  const status = await prisma.documentStatus.findUnique({ where: { id: statusId } });
  if (!status || status.scope !== scopeOf(type)) throw notFound('Statut');
  return status;
}

/** Tracking statuses of the documents a professional workspace starts with: one per category of each scope. */
const DEFAULT_DOCUMENT_STATUSES = [
  { scope: 'QUOTE', name: 'À envoyer', color: DEFAULT_LABEL_COLOR, category: 'TO_SEND' },
  { scope: 'QUOTE', name: 'Envoyé', color: '#228be6', category: 'SENT' },
  { scope: 'QUOTE', name: 'Accepté', color: '#40c057', category: 'ACCEPTED' },
  { scope: 'QUOTE', name: 'Refusé', color: '#fa5252', category: 'REFUSED' },
  { scope: 'INVOICE', name: 'À envoyer', color: DEFAULT_LABEL_COLOR, category: 'TO_SEND' },
  { scope: 'INVOICE', name: 'Envoyée', color: '#228be6', category: 'SENT' },
  { scope: 'INVOICE', name: 'Payée', color: '#40c057', category: 'PAID' },
  { scope: 'INVOICE', name: 'Avoir à créer', color: '#fd7e14', category: 'CREDIT_DUE' },
] as const satisfies readonly { scope: DocumentStatusScope; name: string; color: string; category: DocumentStatusCategory }[];

/**
 * Creates the default status of a category missing from a scope, at its end (its name taken by a status of
 * another category: numbered).
 * @param {DocumentStatusScope} scope Scope.
 * @param {DocumentStatusCategory} category Category.
 * @param {Client} client Prisma client or transaction.
 * @returns {Promise<DocumentStatus>} Status.
 */
async function createDefaultStatus(scope: DocumentStatusScope, category: DocumentStatusCategory, client: Client): Promise<DocumentStatus> {
  const preset = DEFAULT_DOCUMENT_STATUSES.find((item) => item.scope === scope && item.category === category);
  const label = preset?.name ?? STATUS_CATEGORIES_BY_SCOPE[scope].find((item) => item.value === category)?.label ?? category;
  const taken = new Set((await client.documentStatus.findMany({ where: { scope }, select: { name: true } })).map((item) => item.name));
  let name = label;
  for (let index = 2; taken.has(name); index += 1) name = `${label} (${index})`;
  return client.documentStatus.create({ data: { scope, category, name, color: preset?.color ?? DEFAULT_LABEL_COLOR, position: await nextPositionIn('documentStatus', { scope }, client) } });
}

/**
 * Gives a status to every category of every scope that has none (a new workspace, or one that lost some).
 * @param {Client} [client] Prisma client or transaction. Optional.
 * @returns {Promise<void>}
 */
export async function ensureDocumentStatuses(client: Client = prisma): Promise<void> {
  const existing = await client.documentStatus.findMany({ select: { scope: true, category: true } });
  const present = new Set(existing.map((item) => `${item.scope}:${item.category}`));
  for (const scope of Object.keys(STATUS_CATEGORIES_BY_SCOPE) as DocumentStatusScope[]) {
    for (const { value } of STATUS_CATEGORIES_BY_SCOPE[scope]) {
      if (!present.has(`${scope}:${value}`)) await createDefaultStatus(scope, value, client);
    }
  }
}

/**
 * First status of a category in a scope (the one automatic changes give), an archived one only when the category has
 * no other; a category left without any gets its default status back rather than blocking the tracking.
 * @param {DocumentStatusScope} scope Scope.
 * @param {DocumentStatusCategory} category Category.
 * @param {Client} [client] Prisma client or transaction. Optional.
 * @returns {Promise<DocumentStatus>} Status.
 */
export async function statusOf(scope: DocumentStatusScope, category: DocumentStatusCategory, client: Client = prisma): Promise<DocumentStatus> {
  const status = await firstActive(client.documentStatus, { scope, category });
  return status ?? createDefaultStatus(scope, category, client);
}

/**
 * Checks that a category belongs to a scope (no "accepted" invoice, no "paid" quote).
 * @param {DocumentStatusScope} scope Scope.
 * @param {DocumentStatusCategory} category Category.
 * @returns {void}
 */
function assertCategory(scope: DocumentStatusScope, category: DocumentStatusCategory): void {
  if (!STATUS_CATEGORIES_BY_SCOPE[scope].some((item) => item.value === category)) {
    throw fieldError('category', 'Catégorie invalide pour ce type de document.', 'Catégorie invalide.');
  }
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
  const position = await nextPositionIn('documentStatus', { scope: input.scope });
  try {
    return await prisma.documentStatus.create({ data: { ...data, scope: input.scope, category: input.category, position } });
  } catch (error) {
    return rethrowUnique(error, 'Un statut porte déjà ce nom.');
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
export async function updateDocumentStatus(id: string, input: { name?: string | null; color?: string | null; category?: DocumentStatusCategory | null }): Promise<DocumentStatus> {
  const status = await orNotFound(prisma.documentStatus.findUnique({ where: { id } }), 'Statut');
  await assertNotArchived('DOCUMENT_STATUS', id);
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
    return rethrowUnique(error, 'Un statut porte déjà ce nom.');
  }
}

/**
 * Deletes a status; its documents take the first other status of the same category.
 * @param {string} id Status id.
 * @returns {Promise<void>}
 */
export async function deleteDocumentStatus(id: string): Promise<void> {
  const status = await orNotFound(prisma.documentStatus.findUnique({ where: { id } }), 'Statut');
  await assertNotLast(status);
  await prisma.$transaction(async (tx) => {
    const replacement = await tx.documentStatus.findFirstOrThrow({
      where: { scope: status.scope, category: status.category, id: { not: id } },
      orderBy: BY_POSITION,
    });
    await tx.accountingDocument.updateMany({ where: { trackingStatusId: id }, data: { trackingStatusId: replacement.id } });
    await tx.importedDocument.updateMany({ where: { trackingStatusId: id }, data: { trackingStatusId: replacement.id } });
    await tx.documentStatus.delete({ where: { id } });
  });
}
