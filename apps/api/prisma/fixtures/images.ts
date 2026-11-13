import sharp from 'sharp';
import { storeIcon } from '../../src/services/icons';

/**
 * Initials of a name (two letters at most).
 * @param {string} name Name.
 * @returns {string} Initials.
 */
const initials = (name: string) =>
  name
    .split(/[\s'’-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

/**
 * Round badge with the initials of a name, as an SVG.
 * @param {string} name Name.
 * @param {string} color Background color.
 * @returns {string} SVG source.
 */
const badge = (name: string, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="64" fill="${color}"/><text x="64" y="80" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="700" fill="#ffffff" text-anchor="middle">${initials(name)}</text></svg>`;

/**
 * Stores an icon (logo of a client, of a project, avatar of a contributor) with the initials of a name.
 * @param {string} name Name.
 * @param {string} color Background color.
 * @returns {Promise<string>} Icon id.
 */
export async function initialsIcon(name: string, color: string): Promise<string> {
  return storeIcon(new File([badge(name, color)], 'icone.svg', { type: 'image/svg+xml' }));
}

/**
 * Logo of a company, as a PNG file (the accounting documents take PNG or JPEG only).
 * @param {string} name Company name.
 * @param {string} color Color.
 * @returns {Promise<File>} PNG file.
 */
export async function logoFile(name: string, color: string): Promise<File> {
  const png = await sharp(Buffer.from(badge(name, color)))
    .resize(256, 256)
    .png()
    .toBuffer();
  return new File([new Uint8Array(png)], 'logo.png', { type: 'image/png' });
}
