import { clipText, fileTooLarge, MAX_ATTACHMENT_BYTES, safeFilename, UNNAMED_FILE } from '@ordo/shared';
import { prisma } from '../../db';
import type { Attachment } from '../../generated/prisma/client';
import { clientError } from '../../graphql/errors';

/** Types shown in place (images in markdown); every other file is downloaded. */
export const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/**
 * Whether a file is a PDF, by its first bytes (the declared type is not trusted).
 * @param {Uint8Array} data File content.
 * @returns {boolean} PDF.
 */
export function isPdf(data: Uint8Array): boolean {
  return Buffer.from(data.subarray(0, 5)).toString('latin1') === '%PDF-';
}

/**
 * Link of a stored file, the same everywhere: its name encoded, parentheses included (markdown links need it).
 * @param {{ id: string, filename?: string | null } | null | undefined} attachment Stored file (its name: `UNNAMED_FILE` without one).
 * @returns {string} Link « /api/attachments/{id}/{name} ».
 */
export function attachmentUrl(attachment: { id: string; filename?: string | null } | null | undefined): string {
  const name = encodeURIComponent(attachment?.filename || UNNAMED_FILE)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return `/api/attachments/${attachment?.id ?? ''}/${name}`;
}

/**
 * Address of a project resource or a treasury document: its link, or the link of its stored file.
 * @param {{ kind: string, url: string | null, attachment: { id: string, filename?: string | null } | null }} resource Link or file.
 * @returns {string} URL (empty for a link without one).
 */
export function resourceUrl(resource: { kind: string; url: string | null; attachment: { id: string; filename?: string | null } | null }): string {
  // eslint-disable-next-line no-restricted-syntax -- the helpers themselves.
  return resource.kind === 'LINK' ? (resource.url ?? '') : attachmentUrl(resource.attachment);
}

/**
 * Security policy of a file served by the app: none of its content runs, and a PDF shown in place may be framed
 * by the app (browsers do not show PDFs in a sandboxed frame; their viewer isolates them).
 * @param {boolean} pdfInPlace A PDF shown in place.
 * @returns {string} Content-Security-Policy.
 */
export function fileSecurityPolicy(pdfInPlace: boolean): string {
  return pdfInPlace ? "default-src 'none'; frame-ancestors 'self'" : "default-src 'none'; sandbox";
}

/** Raster image kinds recognized from their first bytes. */
export type ImageKind = 'png' | 'jpeg' | 'gif' | 'webp';

/**
 * Raster image kind of a file from its first bytes (the extension and declared type are not trusted).
 * @param {Buffer} buffer File content.
 * @returns {ImageKind | null} Kind, or null for any other file.
 */
export function imageKind(buffer: Buffer): ImageKind | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  // eslint-disable-next-line no-restricted-syntax -- the helpers themselves.
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'gif';
  // eslint-disable-next-line no-restricted-syntax -- the helpers themselves.
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Detects the image types shown in place from their first bytes (the declared type is not trusted).
 * @param {Buffer} buffer File content.
 * @returns {string | null} Image type, or null for any other file.
 */
export function sniffImage(buffer: Buffer): string | null {
  const kind = imageKind(buffer);
  return kind ? `image/${kind}` : null;
}

/**
 * Type of a file by its first bytes (the declared type is not trusted): recognized images and PDFs keep theirs, the rest is a plain download.
 * @param {Buffer} buffer File content.
 * @returns {string} Image type, `application/pdf` or `application/octet-stream`.
 */
export function sniffedType(buffer: Buffer): string {
  // eslint-disable-next-line no-restricted-syntax -- sniffedType itself.
  return sniffImage(buffer) ?? (isPdf(buffer) ? 'application/pdf' : 'application/octet-stream');
}

/**
 * Stored form of a file: recognized images and PDFs keep their type, the rest is served as a plain download.
 * @param {string} name File name.
 * @param {Buffer} buffer Content.
 * @returns {{ filename: string, mimeType: string, size: number, data: Uint8Array<ArrayBuffer> }} Attachment data.
 */
export function attachmentData(name: string, buffer: Buffer) {
  return {
    filename: safeFilename(clipText(name, 200)),
    mimeType: sniffedType(buffer),
    size: buffer.length,
    data: new Uint8Array(buffer),
  };
}

/**
 * Stores an uploaded file (attached to a markdown text, a document, a project…), the same checks everywhere: not empty,
 * 10 MB at most.
 * @param {File} file Uploaded file.
 * @param {{ accountingDocumentId?: string }} [owner] Element the file belongs to, when stored on the attachment. Optional.
 * @returns {Promise<Attachment>} Stored attachment.
 */
export async function storeAttachment(file: File, owner: { accountingDocumentId?: string } = {}): Promise<Attachment> {
  if (file.size === 0) throw clientError('BAD_USER_INPUT', 'Ce fichier est vide.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw clientError('BAD_USER_INPUT', fileTooLarge(file.name));
  // eslint-disable-next-line no-restricted-syntax -- storeAttachment itself.
  return prisma.attachment.create({ data: { ...attachmentData(file.name, Buffer.from(await file.arrayBuffer())), ...owner } });
}

/**
 * Deletes a stored file, the same everywhere: a file already gone is no error. A leftover (the old file of a
 * replacement, the file of an element deleted, the new file of a change refused) never fails the change it follows:
 * its failure is only logged.
 * @param {string | null | undefined} id File, none: nothing to do.
 * @param {boolean} [leftover] Cleanup after the change itself. Optional. Default = false (a failure is thrown).
 * @returns {Promise<void>}
 */
export async function deleteAttachment(id: string | null | undefined, leftover = false): Promise<void> {
  if (!id) return;
  // eslint-disable-next-line no-restricted-syntax -- deleteAttachment itself.
  const removal = prisma.attachment.deleteMany({ where: { id } });
  if (!leftover) {
    await removal;
    return;
  }
  await removal.catch((error: unknown) => console.warn('Fichier non supprimé.', error));
}
