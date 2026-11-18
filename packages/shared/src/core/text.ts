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
 * Whether two names are the same, as a search sees them: spaces around, case and accents aside (« eleve » is « Élève »).
 * @param {string} a Name.
 * @param {string} b Other name.
 * @returns {boolean} Same name.
 */
export function sameName(a: string, b: string): boolean {
  return normalize(a.trim()) === normalize(b.trim());
}

/**
 * File name without the characters file systems refuse (each replaced by a dash).
 * @param {string} name Name to clean.
 * @returns {string} The cleaned name.
 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\0]/g, '-');
}

/**
 * Text cut to a length, so that it passes its rule (a title from elsewhere: GitHub, an old sheet…): trimmed, then cut.
 * @param {string} text Text.
 * @param {number} max Most characters.
 * @returns {string} Cut text.
 */
export function clipText(text: string, max: number): string {
  return text.trim().slice(0, max).trimEnd();
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
