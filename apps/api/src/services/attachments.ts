import { MAX_ATTACHMENT_BYTES } from '@ordo/shared';
import { prisma } from '../db';
import type { Attachment } from '../generated/prisma/client';
import { clientError } from '../graphql/errors';

/** Types shown in place (images in markdown); every other file is downloaded. */
export const INLINE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/**
 * Detects the image types shown in place from their first bytes (the declared type is not trusted).
 * @param {Buffer} buffer File content.
 * @returns {string | null} Image type, or null for any other file.
 */
function sniffImage(buffer: Buffer): string | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Stored form of a file: recognized images and PDFs keep their type, the rest is served as a plain download.
 * @param {string} name File name.
 * @param {Buffer} buffer Content.
 * @returns {{ name: string, mimeType: string, size: number, data: Uint8Array<ArrayBuffer> }} Attachment data.
 */
export function attachmentData(name: string, buffer: Buffer) {
  return {
    name: name.replace(/[\\/\0]/g, '_').slice(0, 200) || 'fichier',
    mimeType: sniffImage(buffer) ?? (buffer.toString('ascii', 0, 5) === '%PDF-' ? 'application/pdf' : 'application/octet-stream'),
    size: buffer.length,
    data: new Uint8Array(buffer),
  };
}

/**
 * Stores a file attached to a markdown text.
 * @param {File} file Uploaded file.
 * @returns {Promise<Attachment>} Stored attachment.
 */
export async function storeAttachment(file: File): Promise<Attachment> {
  if (file.size === 0) throw clientError('BAD_USER_INPUT', 'Ce fichier est vide.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw clientError('BAD_USER_INPUT', `« ${file.name} » est trop lourd (10 Mo maximum).`);
  return prisma.attachment.create({ data: attachmentData(file.name, Buffer.from(await file.arrayBuffer())) });
}
