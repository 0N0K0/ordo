/** Dates of a task that place it in the calendar (YYYY-MM-DD). */
export interface TaskDates {
  startDate: string | null;
  endDate: string | null;
  deadline: string | null;
}

/**
 * How a span of a task was set: its dates (start and end, or end alone), or up to a date it does not hold (today,
 * or its latest acceptable date): moving it then only moves its start.
 */
export type TaskSpanKind = 'dates' | 'open';

/** Span of a task in the calendar, days included. */
export interface TaskSpan {
  start: string;
  end: string;
  kind: TaskSpanKind;
}

/**
 * Where a task shows in the calendar: its span, its latest acceptable date on its own when apart from it, and
 * whether it is late (latest acceptable date past, no end, not closed).
 */
export interface TaskPlacement {
  span: TaskSpan | null;
  deadline: string | null;
  overdue: boolean;
}

/**
 * Where a task shows in the calendar, from its dates and today:
 * - start and end: every day from the one to the other;
 * - start up to today without end: from the start to today (the task goes on), whatever its latest acceptable date;
 * - start after today without end: its start alone;
 * - end alone: that day;
 * - latest acceptable date: that day too, unless the span already ends on it; past without end (and the task not
 *   closed): late, shown today (carried by its span when it reaches today).
 * @param {TaskDates & { closed?: boolean }} task Dates of the task, and whether it is closed.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {TaskPlacement} Span, latest acceptable date and lateness.
 */
export function taskPlacement({ startDate, endDate, deadline, closed = false }: TaskDates & { closed?: boolean }, today: string): TaskPlacement {
  let span: TaskSpan | null = null;
  if (startDate && endDate) span = { start: startDate, end: endDate >= startDate ? endDate : startDate, kind: 'dates' };
  else if (startDate && startDate < today) span = { start: startDate, end: today, kind: 'open' };
  else if (startDate) span = { start: startDate, end: startDate, kind: 'dates' };
  else if (endDate) span = { start: endDate, end: endDate, kind: 'dates' };
  const overdue = Boolean(deadline && deadline < today && !endDate && !closed);
  if (overdue) {
    // Late: today, on its span when it reaches today, else on its own.
    const reachesToday = span !== null && span.start <= today && span.end >= today;
    return { span, deadline: reachesToday ? null : today, overdue };
  }
  return { span, deadline: deadline && deadline !== span?.end ? deadline : null, overdue };
}
