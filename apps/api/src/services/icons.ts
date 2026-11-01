import { MAX_ICON_BYTES } from '@ordo/shared';
import DOMPurify from 'isomorphic-dompurify';
import sharp from 'sharp';
import { prisma } from '../db';
import { clientError } from '../graphql/errors';

/** Raster icons are resized to fit in this square (px). */
const ICON_SIZE = 256;

type IconKind = 'png' | 'jpeg' | 'webp' | 'svg';

/**
 * Error raised for an unusable icon file, attached to the `icon` field.
 * @param {string} message Human-readable reason.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
function invalidIcon(message: string) {
  return clientError('BAD_USER_INPUT', message, { fields: { icon: message } });
}

/**
 * Detects the real file type from its first bytes (the extension and declared type are not trusted).
 * @param {Buffer} buffer File content.
 * @returns {IconKind | null} Detected kind, or null when unsupported.
 */
function sniff(buffer: Buffer): IconKind | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';

  const head = buffer.toString('utf8', 0, 2048).replace(/^﻿/, '');
  const withoutProlog = head.replace(/^\s*(<\?xml[^>]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|\s)*/i, '');
  return withoutProlog.startsWith('<svg') ? 'svg' : null;
}

/**
 * Validates an uploaded icon and normalizes it: rasters become a 256 px WebP, SVGs are sanitized.
 * @param {File} file Uploaded file.
 * @returns {Promise<{ mimeType: string, data: Buffer }>} Icon ready to be stored.
 */
async function processIcon(file: File): Promise<{ mimeType: string; data: Buffer }> {
  if (file.size > MAX_ICON_BYTES) throw invalidIcon('Image trop lourde (1 Mo maximum).');

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buffer);
  if (!kind) throw invalidIcon('Format non pris en charge (JPG, PNG, WebP ou SVG).');

  if (kind === 'svg') {
    // Strips scripts, event handlers and external references.
    const clean = DOMPurify.sanitize(buffer.toString('utf8'), {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
    if (!clean.includes('<svg')) throw invalidIcon('Ce fichier SVG est invalide.');
    return { mimeType: 'image/svg+xml', data: Buffer.from(clean) };
  }

  try {
    const data = await sharp(buffer)
      .rotate()
      .resize(ICON_SIZE, ICON_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    return { mimeType: 'image/webp', data };
  } catch {
    throw invalidIcon('Cette image est illisible.');
  }
}

/**
 * Validates and stores an uploaded icon.
 * @param {File} file Uploaded file.
 * @returns {Promise<string>} Id of the stored icon.
 */
export async function storeIcon(file: File): Promise<string> {
  const { mimeType, data } = await processIcon(file);
  // Prisma expects a Uint8Array backed by a plain ArrayBuffer.
  const icon = await prisma.icon.create({ data: { mimeType, data: new Uint8Array(data) }, select: { id: true } });
  return icon.id;
}

/**
 * Deletes icons no longer used by any client or project.
 * @param {(string | null | undefined)[]} iconIds Candidate icon ids.
 * @returns {Promise<void>}
 */
export async function deleteOrphanIcons(iconIds: (string | null | undefined)[]): Promise<void> {
  const ids = iconIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  await prisma.icon.deleteMany({
    where: { id: { in: ids }, clients: { none: {} }, projects: { none: {} } },
  });
}

/**
 * Resolves the new icon id of an update: replaced, removed or unchanged.
 * @param {string | null} currentIconId Icon currently attached.
 * @param {object} input Update input.
 * @param {File | null} [input.icon] New icon file. Optional.
 * @param {boolean | null} [input.removeIcon] Whether to remove the current icon. Optional.
 * @returns {Promise<string | null | undefined>} New icon id, null to remove it, undefined to keep it.
 */
export async function resolveIconUpdate(
  currentIconId: string | null,
  input: { icon?: File | null; removeIcon?: boolean | null },
): Promise<string | null | undefined> {
  if (input.icon) return storeIcon(input.icon);
  if (input.removeIcon && currentIconId) return null;
  return undefined;
}

/**
 * Builds the URL serving an icon.
 * @param {string | null} iconId Icon id.
 * @returns {string | null} URL, or null without icon.
 */
export function iconUrl(iconId: string | null): string | null {
  return iconId ? `/api/icons/${iconId}` : null;
}
