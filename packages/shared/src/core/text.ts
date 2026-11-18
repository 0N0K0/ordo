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

/** Suffix of the name of a copy. */
const COPY_SUFFIX = ' (copie)';

/**
 * Name of a copy: « Nom (copie) »; with a length, the name is cut so that the suffix stays.
 * @param {string} name Name of the original.
 * @param {number} [max] Longest name. Optional.
 * @returns {string} Name of the copy.
 */
export function copyName(name: string, max?: number): string {
  if (max === undefined || name.length + COPY_SUFFIX.length <= max) return `${name}${COPY_SUFFIX}`;
  return `${name.slice(0, Math.max(0, max - COPY_SUFFIX.length)).trimEnd()}${COPY_SUFFIX}`;
}
