import { countOf, plural } from '../../../lib/text';

/**
 * "3 tâches" / "1 tâche".
 * @param {number} count Count.
 * @returns {string} Label.
 */
export function tasksLabel(count: number): string {
  return countOf(count, 'tâche');
}

/**
 * End of the message of a transfer that removed links: " 2 liens retirés." (nothing without any).
 * @param {number} count Links removed.
 * @returns {string} Note.
 */
export function removedLinksNote(count: number): string {
  return count > 0 ? ` ${countOf(count, 'lien')} ${plural(count, 'retiré')}.` : '';
}
