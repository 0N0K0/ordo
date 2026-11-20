/**
 * Whether a task is overdue (decision DD): the « Échéance » it goes by (its own, else that of its single sprint:
 * `effectiveDeadline`, computed by the API with `taskDueDates`) is past and it is not closed. The same rule for the
 * table, the side panel, the home page and the calendar.
 * @param {{ effectiveDeadline: string | null, closed?: boolean }} task Task: the « Échéance » it goes by (YYYY-MM-DD) and whether it is closed.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {boolean} Overdue.
 */
export function isTaskOverdue(task: { effectiveDeadline: string | null; closed?: boolean }, today: string): boolean {
  // eslint-disable-next-line no-restricted-syntax -- isTaskOverdue itself.
  return task.effectiveDeadline !== null && task.effectiveDeadline < today && !task.closed;
}
