export { collator, copyName, normalize } from '@ordo/shared';

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
 * A text cut to a length, an ellipsis replacing its end: « rapport-annuel-2026-ver… ».
 * @param {string} text Text.
 * @param {number} max Most characters kept, the ellipsis included.
 * @returns {string} Text, whole when short enough.
 */
export function ellipsis(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
