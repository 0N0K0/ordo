/** Files the app shows itself. */
export type ViewableKind = 'pdf' | 'image';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/**
 * How the app can show a file: as a PDF, as an image, or not (downloaded), from its type or else the extension of
 * its filename or URL.
 * @param {{ filename?: string | null, url: string, mimeType?: string | null }} file File.
 * @returns {ViewableKind | null} Kind, none when it is downloaded.
 */
export function viewableKind(file: { filename?: string | null; url: string; mimeType?: string | null }): ViewableKind | null {
  if (file.mimeType === 'application/pdf') return 'pdf';
  if (file.mimeType && IMAGE_TYPES.includes(file.mimeType)) return 'image';
  if (file.mimeType) return null;
  const path = decodeURIComponent(file.url.split(/[?#]/)[0]);
  const extension = (/\.([a-z0-9]+)$/i.exec(file.filename ?? '')?.[1] ?? /\.([a-z0-9]+)$/i.exec(path)?.[1] ?? '').toLowerCase();
  if (extension === 'pdf') return 'pdf';
  return IMAGE_EXTENSIONS.includes(extension) ? 'image' : null;
}

/**
 * URL of a file that downloads it (the files of the app take ?download=1).
 * @param {string} url URL.
 * @returns {string} URL.
 */
export function downloadUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}download=1`;
}
