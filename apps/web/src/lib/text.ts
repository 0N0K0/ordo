export { collator, normalize } from '@ordo/shared';

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
 * Name of a copy: « Nom (copie) », cut to a length when there is one.
 * @param {string} name Name of the original.
 * @param {number} [max] Longest name. Optional.
 * @returns {string} Name of the copy.
 */
export function copyName(name: string, max?: number): string {
  const copy = `${name} (copie)`;
  return max === undefined ? copy : copy.slice(0, max);
}
