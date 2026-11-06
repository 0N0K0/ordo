import { parseDay, type AccountingDocumentType } from '@ordo/shared';
import { prisma } from '../db';
import { clientError } from '../graphql/errors';
import { documentPdf } from './accounting-pdf';
import { zipFiles } from './zip';

/** Folder of each type in the archive. */
const FOLDERS: Record<AccountingDocumentType, string> = {
  QUOTE: 'Devis',
  INVOICE: 'Factures',
  DEPOSIT_INVOICE: 'Factures d’acompte',
  CREDIT_NOTE: 'Avoirs',
};
const TYPES = Object.keys(FOLDERS) as AccountingDocumentType[];

/**
 * Name safe in an archive.
 * @param {string} name Name.
 * @returns {string} Name.
 */
const safe = (name: string) => name.replace(/[\\/:*?"<>|\0]/g, '-').trim() || 'sans-nom';

/**
 * ZIP of the documents issued over a period, one folder per type: the final documents of Ordo as printed
 * (PDF with their Factur-X), and optionally the files of the imported ones.
 * @param {{ from: string, to: string, types: string[], imported: boolean }} input Period (days included), types, imported documents.
 * @returns {Promise<{ name: string, content: Buffer }>} Archive and its name.
 */
export async function documentsZip(input: { from: string; to: string; types: string[]; imported: boolean }): Promise<{ name: string; content: Buffer }> {
  if (![input.from, input.to].every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))) throw clientError('BAD_USER_INPUT', 'Période invalide.');
  const from = parseDay(input.from);
  const to = parseDay(input.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) throw clientError('BAD_USER_INPUT', 'Période invalide.');
  const types = TYPES.filter((type) => input.types.includes(type));
  if (types.length === 0) throw clientError('BAD_USER_INPUT', 'Choisissez au moins un type de document.');

  const documents = await prisma.accountingDocument.findMany({
    where: { status: 'FINAL', type: { in: types }, issueDate: { gte: from, lte: to } },
    select: { id: true, type: true, finalizedAt: true, issueDate: true },
    orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
  });
  const files: { name: string; data: Uint8Array; date: Date }[] = [];
  // One at a time: each PDF is built in memory.
  for (const document of documents) {
    const pdf = await documentPdf(document.id);
    files.push({ name: `${FOLDERS[document.type]}/${safe(pdf.filename)}`, data: new Uint8Array(pdf.content), date: document.finalizedAt ?? document.issueDate });
  }
  if (input.imported) {
    const imported = await prisma.importedDocument.findMany({
      where: { type: { in: types }, issueDate: { gte: from, lte: to }, attachmentId: { not: null } },
      include: { attachment: true },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    });
    for (const document of imported) {
      if (!document.attachment) continue;
      const extension = /\.[^.]{1,8}$/.exec(document.attachment.name)?.[0] ?? '';
      files.push({ name: `${FOLDERS[document.type]}/${safe(`${document.number} (importé)`)}${extension}`, data: document.attachment.data, date: document.issueDate });
    }
  }
  if (files.length === 0) throw clientError('BAD_USER_INPUT', 'Aucun document sur cette période.');
  return { name: `Documents comptables du ${input.from} au ${input.to}.zip`, content: zipFiles(files) };
}
