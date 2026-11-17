/**
 * "3 tâches" / "1 tâche".
 * @param {number} count Count.
 * @returns {string} Label.
 */
export function tasksLabel(count: number): string {
  return `${count} tâche${count > 1 ? 's' : ''}`;
}
