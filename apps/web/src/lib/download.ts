/**
 * Saves a file in the browser.
 * @param {Blob} blob Content.
 * @param {string} filename File name.
 * @returns {void}
 */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * File name of an export (characters forbidden in file names replaced).
 * @param {string} title Title.
 * @param {string} extension Extension.
 * @returns {string} File name.
 */
export const fileName = (title: string, extension: string) => `${title.replace(/[\\/:*?"<>|]/g, '-')}.${extension}`;
