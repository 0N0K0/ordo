/**
 * Whether a task is overdue (decision DD): its « Date max » is past and it is not closed. The same rule for the table,
 * the side panel, the home page and the calendar.
 * @param {{ deadline: string | null, closed?: boolean }} task Task: its « Date max » (YYYY-MM-DD) and whether it is closed.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {boolean} Overdue.
 */
export function isTaskOverdue(task: { deadline: string | null; closed?: boolean }, today: string): boolean {
  // eslint-disable-next-line no-restricted-syntax -- isTaskOverdue itself.
  return task.deadline !== null && task.deadline < today && !task.closed;
}
