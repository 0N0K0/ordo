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
 * Key of a name, as a search sees it (decision CB): spaces around left out, inner runs of spaces as one, case and
 * accents aside (« eleve » is « Élève »). Two names of the same key are the same name.
 * @param {string | null | undefined} name Name. Optional.
 * @returns {string} Key (empty for no name).
 */
export function nameKey(name: string | null | undefined): string {
  // eslint-disable-next-line no-restricted-syntax -- nameKey itself.
  return normalize((name ?? '').trim()).replace(/\s+/g, ' ');
}

/**
 * Whether two names are the same (same `nameKey`).
 * @param {string} a Name.
 * @param {string} b Other name.
 * @returns {boolean} Same name.
 */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** Name of a file that has none, or whose name is empty once cleaned (attachments, links, exports). */
// eslint-disable-next-line no-restricted-syntax -- the name itself.
export const UNNAMED_FILE = 'sans-nom';

/**
 * File name without the characters file systems refuse (each replaced by a dash), trimmed; « sans-nom » when nothing is left.
 * @param {string} name Name to clean.
 * @returns {string} The cleaned name.
 */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|\0]/g, '-').trim() || UNNAMED_FILE;
}

/**
 * File name of an export or a download: its title cleaned (see `safeFilename`), then its extension.
 * @param {string} title Title.
 * @param {string} extension Extension, without its dot (« pdf »).
 * @returns {string} File name.
 */
export function fileName(title: string, extension: string): string {
  return `${safeFilename(title)}.${extension}`;
}

/**
 * Text cut to a length, so that it passes its rule (a title from elsewhere: GitHub, an old sheet…): trimmed, then cut.
 * @param {string} text Text.
 * @param {number} max Most characters.
 * @returns {string} Cut text.
 */
export function clipText(text: string, max: number): string {
  // eslint-disable-next-line no-restricted-syntax -- clipText itself.
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
  // eslint-disable-next-line no-restricted-syntax -- the name of a copy, cut so that its suffix stays.
  return `${name.slice(0, Math.max(0, max - COPY_SUFFIX.length)).trimEnd()}${COPY_SUFFIX}`;
}

/**
 * A word in the plural beyond one (« tâches »), in the singular for one or none (« tâche »), as French counts.
 * @param {number} count Count.
 * @param {string} word Word, in the singular.
 * @param {string} [many] Its plural, when not with an « s » (« travaux »). Optional.
 * @returns {string} Word.
 */
export function plural(count: number, word: string, many = `${word}s`): string {
  return count > 1 ? many : word;
}

/**
 * A count and its word: « 1 tâche », « 3 tâches ».
 * @param {number} count Count.
 * @param {string} word Word, in the singular.
 * @param {string} [many] Its plural, when not with an « s ». Optional.
 * @returns {string} Text.
 */
export function countOf(count: number, word: string, many?: string): string {
  return `${count} ${plural(count, word, many)}`;
}

/**
 * A count and its word after their determiner, the count dropped for one: « ses 3 tâches » but « sa tâche », « des 2
 * tâches » but « de la tâche ».
 * @param {number} count Count.
 * @param {string} word Word, in the singular.
 * @param {[string, string]} determiners Determiner of one (« sa », « son », « de la ») and of several (« ses », « des »).
 * @param {string} [many] Plural of the word, when not with an « s ». Optional.
 * @returns {string} Text.
 */
export function countWith(count: number, word: string, [one, several]: [string, string], many?: string): string {
  return count === 1 ? `${one} ${word}` : `${several} ${countOf(count, word, many)}`;
}

/**
 * A text cut to a length, an ellipsis replacing its end: « rapport-annuel-2026-ver… ».
 * @param {string} text Text.
 * @param {number} max Most characters kept, the ellipsis included.
 * @returns {string} Text, whole when short enough.
 */
export function ellipsis(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Text with its first letter in capital (« Novembre 2026 » as a heading).
 * @param {string} text Text.
 * @returns {string} Text.
 */
export const capitalize = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase());
