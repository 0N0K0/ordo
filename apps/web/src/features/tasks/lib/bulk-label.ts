import { countOf } from '../../../lib/text';

/**
 * "3 tâches" / "1 tâche".
 * @param {number} count Count.
 * @returns {string} Label.
 */
export function tasksLabel(count: number): string {
  return countOf(count, 'tâche');
}

