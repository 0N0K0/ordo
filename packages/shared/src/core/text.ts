/** Order of names in French: case and accents aside, numbers by their value (« 2 » before « 10 »). */
export const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Text compared by a search: lower case, without accents.
 * @param {string} text Text.
 * @returns {string} Normalized text.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * File name without the characters file systems refuse (each replaced by a dash).
 * @param {string} name Name to clean.
 * @returns {string} The cleaned name.
 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\0]/g, '-');
}
