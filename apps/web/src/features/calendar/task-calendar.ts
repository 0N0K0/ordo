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

/** Where a task shows in the calendar: its span, and its latest acceptable date on its own when apart from it. */
export interface TaskPlacement {
  span: TaskSpan | null;
  deadline: string | null;
}

/**
 * Where a task shows in the calendar, from its dates and today:
 * - start and end: every day from the one to the other;
 * - start before today without end: from the start to today (the task goes on);
 * - start from today on without end: up to its latest acceptable date when it has one, else its start alone;
 * - end alone: that day;
 * - latest acceptable date: that day too, unless the span already ends on it.
 * @param {TaskDates} task Dates of the task.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {TaskPlacement} Span and latest acceptable date.
 */
export function taskPlacement({ startDate, endDate, deadline }: TaskDates, today: string): TaskPlacement {
  let span: TaskSpan | null = null;
  if (startDate && endDate) span = { start: startDate, end: endDate >= startDate ? endDate : startDate, kind: 'dates' };
  else if (startDate && startDate < today) span = { start: startDate, end: today, kind: 'open' };
  else if (startDate) span = deadline && deadline > startDate ? { start: startDate, end: deadline, kind: 'open' } : { start: startDate, end: startDate, kind: 'dates' };
  else if (endDate) span = { start: endDate, end: endDate, kind: 'dates' };
  return { span, deadline: deadline && deadline !== span?.end ? deadline : null };
}
