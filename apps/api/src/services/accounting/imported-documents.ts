import { type ImportedDocumentInput, importedDocumentSchema as importSchema, parseDay, parseOptionalDay } from '@ordo/shared';
import { prisma } from '../../db';
import { type ImportedDocument } from '../../generated/prisma/client';
import { parseInput, rethrowUnique } from '../../graphql/errors';
import { deleteAttachment, storeAttachment } from '../core/attachments';
import { scopedStatus } from './document-statuses';
import { sendingData, sentStatus } from './document-tracking';
import { requirePro } from '../workspaces/workspaces';
import { findOrNotFound } from '../core/lookup';
import { assertNotArchived, assertActive, findActive } from '../core/archive';
import { toDecimal } from '../core/decimal';

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
    dueDate: parseOptionalDay(input.dueDate),
    totalNet: toDecimal(input.totalNet),
    totalVat: toDecimal(input.totalVat),
    totalGross: toDecimal(input.totalGross),
  };
}

/** Client and project of an imported document. */
type DocumentRefs = { clientId: string | null; projectId: string | null };

/**
 * Checks the client and project of an imported document (an archived one is refused, unless the document already has it).
 * @param {DocumentRefs} refs References.
 * @param {DocumentRefs | null} [kept] Client and project already there. Optional. Default = none.
 * @returns {Promise<void>}
 */
async function assertRefs({ clientId, projectId }: DocumentRefs, kept: DocumentRefs | null = null): Promise<void> {
  await assertActive(prisma.client, clientId, 'Client', { keep: kept?.clientId, field: 'clientId' });
  await assertActive(prisma.project, projectId, 'Projet', { keep: kept?.projectId, field: 'projectId' });
}

/**
 * Stores a PDF (or any file) for an imported document.
 * @param {File} file File.
 * @returns {Promise<string>} Attachment id.
 */
async function storeFile(file: File): Promise<string> {
  return (await storeAttachment(file)).id;
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
    await deleteAttachment(attachmentId, true);
    return rethrowUnique(error, 'Un document importé de ce type porte déjà ce numéro.', 'number');
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
  const current = await findActive(prisma.importedDocument, id, 'Document importé');
  const data = parseInput(importSchema, input);
  await assertRefs(data, current);
  const attachmentId = file ? await storeFile(file) : current.attachmentId;
  let updated: ImportedDocument;
  try {
    updated = await prisma.importedDocument.update({ where: { id }, data: { ...importData(data), attachmentId } });
  } catch (error) {
    if (file) await deleteAttachment(attachmentId, true);
    return rethrowUnique(error, 'Un document importé de ce type porte déjà ce numéro.', 'number');
  }
  // The new file is in place: the old one left over, its failure never takes the new one with it.
  if (file) await deleteAttachment(current.attachmentId, true);
  return updated;
}

/**
 * Moves an imported document to a project, or out of any.
 * @param {string} id Document id.
 * @param {string | null} projectId Project, null for none.
 * @returns {Promise<ImportedDocument>} Document.
 */
export async function setImportedProject(id: string, projectId: string | null): Promise<ImportedDocument> {
  const current = await findActive(prisma.importedDocument, id, 'Document importé');
  await assertActive(prisma.project, projectId, 'Projet', { keep: current.projectId });
  return prisma.importedDocument.update({ where: { id }, data: { projectId } });
}

/**
 * Deletes an imported document and its file.
 * @param {string} id Imported document.
 * @returns {Promise<void>}
 */
export async function deleteImportedDocument(id: string): Promise<void> {
  const document = await findOrNotFound(prisma.importedDocument, id, 'Document importé');
  await prisma.importedDocument.delete({ where: { id } });
  await deleteAttachment(document.attachmentId, true);
}

/**
 * Sets the tracking status of an imported document by hand (accepted, sent, credit note to make…), or clears it.
 * @param {string} id Imported document.
 * @param {string | null} statusId Status of the scope of the document, or null.
 * @returns {Promise<ImportedDocument>} Document.
 */
export async function setImportedTrackingStatus(id: string, statusId: string | null): Promise<ImportedDocument> {
  requirePro('facturation');
  const document = await findActive(prisma.importedDocument, id, 'Document importé');
  if (statusId) {
    await scopedStatus(statusId, document.type);
    // An archived status stays the one of its documents, but is not given any more.
    await assertNotArchived('DOCUMENT_STATUS', statusId, { keep: document.trackingStatusId, field: 'statusId' });
  }
  return prisma.importedDocument.update({ where: { id }, data: { trackingStatusId: statusId } });
}

/**
 * Notes that an imported document was sent (deposited on Chorus Pro, posted…), on a day and how, with the "sent"
 * status chosen.
 * @param {string} id Imported document.
 * @param {{ date?: string | null, via?: string | null, statusId: string }} options Day (none: now), way and status.
 * @returns {Promise<ImportedDocument>} Document.
 */
export async function markImportedSent(id: string, options: { date?: string | null; via?: string | null; statusId: string }): Promise<ImportedDocument> {
  requirePro('facturation');
  const document = await findActive(prisma.importedDocument, id, 'Document importé');
  const status = await sentStatus(options.statusId, document.type);
  await assertNotArchived('DOCUMENT_STATUS', status.id, { keep: document.trackingStatusId, field: 'statusId' });
  return prisma.importedDocument.update({ where: { id }, data: { ...sendingData(options), trackingStatusId: status.id } });
}
