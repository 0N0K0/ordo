import { importedDocumentSchema as importSchema, parseDay, type ImportedDocumentInput } from '@ordo/shared';
import { prisma } from '../db';
import { Prisma, type ImportedDocument } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { attachmentData } from './attachments';
import { requirePro } from './workspaces';

export type { ImportedDocumentInput } from '@ordo/shared';

/**
 * Prisma data of validated fields.
 * @param {ReturnType<typeof importSchema.parse>} input Fields.
 * @returns {object} Data.
 */
function importData(input: ReturnType<typeof importSchema.parse>) {
  return {
    ...input,
    issueDate: parseDay(input.issueDate),
    dueDate: input.dueDate ? parseDay(input.dueDate) : null,
    totalNet: new Prisma.Decimal(input.totalNet),
    totalVat: new Prisma.Decimal(input.totalVat),
    totalGross: new Prisma.Decimal(input.totalGross),
  };
}

/**
 * Checks the client and project of an imported document.
 * @param {{ clientId: string | null, projectId: string | null }} refs References.
 * @returns {Promise<void>}
 */
async function assertRefs({ clientId, projectId }: { clientId: string | null; projectId: string | null }): Promise<void> {
  if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) throw notFound('Client');
  if (projectId && !(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw notFound('Projet');
}

/**
 * Converts a duplicate number into a field error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
function rethrowDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const message = 'Un document importé de ce type porte déjà ce numéro.';
    throw clientError('CONFLICT', message, { fields: { number: message } });
  }
  throw error;
}

/**
 * Stores a PDF (or any file) for an imported document.
 * @param {File} file File.
 * @returns {Promise<string>} Attachment id.
 */
async function storeFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw clientError('BAD_USER_INPUT', `« ${file.name} » est trop lourd (10 Mo maximum).`);
  return (await prisma.attachment.create({ data: attachmentData(file.name, Buffer.from(await file.arrayBuffer())), select: { id: true } })).id;
}

/**
 * Imports a quote or an invoice issued before Ordo: main information and file.
 * @param {ImportedDocumentInput} input Fields.
 * @param {File | null} file Document (PDF). Optional.
 * @returns {Promise<ImportedDocument>} Imported document.
 */
export async function importDocument(input: ImportedDocumentInput, file: File | null): Promise<ImportedDocument> {
  requirePro('facturation');
  const data = parseInput(importSchema, input);
  await assertRefs(data);
  const attachmentId = file ? await storeFile(file) : null;
  try {
    return await prisma.importedDocument.create({ data: { ...importData(data), attachmentId } });
  } catch (error) {
    if (attachmentId) await prisma.attachment.delete({ where: { id: attachmentId } });
    return rethrowDuplicate(error);
  }
}

/**
 * Updates an imported document (and replaces its file when one is given).
 * @param {string} id Imported document.
 * @param {ImportedDocumentInput} input Fields.
 * @param {File | null} file New file. Optional.
 * @returns {Promise<ImportedDocument>} Imported document.
 */
export async function updateImportedDocument(id: string, input: ImportedDocumentInput, file: File | null): Promise<ImportedDocument> {
  const current = await prisma.importedDocument.findUnique({ where: { id } });
  if (!current) throw notFound('Document importé');
  const data = parseInput(importSchema, input);
  await assertRefs(data);
  const attachmentId = file ? await storeFile(file) : current.attachmentId;
  try {
    const updated = await prisma.importedDocument.update({ where: { id }, data: { ...importData(data), attachmentId } });
    if (file && current.attachmentId) await prisma.attachment.delete({ where: { id: current.attachmentId } });
    return updated;
  } catch (error) {
    if (file && attachmentId) await prisma.attachment.delete({ where: { id: attachmentId } });
    return rethrowDuplicate(error);
  }
}

/**
 * Deletes an imported document and its file.
 * @param {string} id Imported document.
 * @returns {Promise<void>}
 */
export async function deleteImportedDocument(id: string): Promise<void> {
  const document = await prisma.importedDocument.findUnique({ where: { id } });
  if (!document) throw notFound('Document importé');
  await prisma.importedDocument.delete({ where: { id } });
  if (document.attachmentId) await prisma.attachment.delete({ where: { id: document.attachmentId } }).catch(() => undefined);
}
