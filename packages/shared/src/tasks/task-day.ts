import { addDays, dayIn } from '../dates/days';
import { parisInstant, taskRemindsOn } from '../dates/reminders';
import type { TaskStatusCategory } from './task-columns';
import { entryMeets, type TimeSpanEntry } from './time';

/**
 * Whether a task is overdue: the « Échéance » it goes by (its own, else its parent's, its milestone's or its first sprint's:
 * `effectiveDeadline`, computed with `effectiveTask`) is past and it is not closed. The same rule everywhere: the table,
 * the side panel, the home page, the calendar and « Ma journée ».
 * @param {{ effectiveDeadline: string | null, closed?: boolean }} task Task: the « Échéance » it goes by (YYYY-MM-DD) and whether it is closed.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {boolean} Overdue.
 */
export function isTaskOverdue(task: { effectiveDeadline: string | null; closed?: boolean }, today: string): boolean {
  return task.effectiveDeadline !== null && task.effectiveDeadline < today && !task.closed;
}

/** Dates of a task that place it in the calendar (YYYY-MM-DD). */
export interface TaskDates {
  startDate: string | null;
  endDate: string | null;
  /** « Échéance » it goes by (its own, else its parent's, milestone's or first sprint's: `effectiveTask`). */
  effectiveDeadline: string | null;
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
 * whether it is late (`isTaskOverdue`: latest acceptable date past, not closed).
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
 * - latest acceptable date: that day too, unless the span already ends on it; past (and the task not closed): late,
 *   shown today (carried by its span when it reaches today).
 * @param {TaskDates & { closed?: boolean }} task Dates of the task, and whether it is closed.
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {TaskPlacement} Span, latest acceptable date and lateness.
 */
export function taskPlacement({ startDate, endDate, effectiveDeadline: deadline, closed = false }: TaskDates & { closed?: boolean }, today: string): TaskPlacement {
  let span: TaskSpan | null = null;
  if (startDate && endDate) span = { start: startDate, end: endDate >= startDate ? endDate : startDate, kind: 'dates' };
  else if (startDate && startDate < today) span = { start: startDate, end: today, kind: 'open' };
  else if (startDate) span = { start: startDate, end: startDate, kind: 'dates' };
  else if (endDate) span = { start: endDate, end: endDate, kind: 'dates' };
  const overdue = isTaskOverdue({ effectiveDeadline: deadline, closed }, today);
  if (overdue) {
    // Late: today, on its span when it reaches today, else on its own.
    const reachesToday = span !== null && span.start <= today && span.end >= today;
    return { span, deadline: reachesToday ? null : today, overdue };
  }
  return { span, deadline: deadline && deadline !== span?.end ? deadline : null, overdue };
}

/**
 * Why a task shows on a day of « Ma journée », in the order they are told: late (today only), its « Échéance » is that
 * day, its status is « en cours », its dates (« Début » – « Fin ») place it that day, its period « Ouverture » –
 * « Échéance » covers that day, done that day, cancelled that day.
 */
export const TASK_DAY_REASONS = ['late', 'due', 'inProgress', 'planned', 'open', 'done', 'cancelled'] as const;
export type TaskDayReason = (typeof TASK_DAY_REASONS)[number];

/** A task as « Ma journée » reads it. */
export interface DayTask extends TaskDates {
  /** « Ouverture » it goes by (`effectiveTask`), YYYY-MM-DD. */
  effectiveMinDate: string | null;
  /** Category of its status; null: no status. */
  statusCategory: TaskStatusCategory | null;
  /** When it was closed (done or cancelled): an instant (a Date, or an ISO text with its zone); null: open. */
  closedAt: Date | string | null;
  /** Closed as cancelled (`NOT_PLANNED`). Optional. Default = false. */
  cancelled?: boolean;
  /** Its times (chronos and times added by hand): « en cours » on a past day only with one that day. Optional. Default = none. */
  times?: readonly TimeSpanEntry[];
}

/**
 * Why a task shows on a day of « Ma journée » (`TASK_DAY_REASONS`, in that order; none: it does not show). An open
 * task: late (`isTaskOverdue`) when the day is today, due when its « Échéance » (the one it goes by) is that day, in
 * progress when its status is of the category « En cours », today, or a past day when one of its times (`entryMeets`)
 * ran that day in Paris (never a day to come), planned when its dates place it that day in the calendar
 * (`taskPlacement`), open when it has both an « Ouverture » and an « Échéance » (those it goes by) and the period from the one to the
 * other covers the day (`taskRemindsOn`). A closed task only on the day it was closed, in Paris:
 * done, or cancelled when closed as cancelled.
 * @param {DayTask} task Task.
 * @param {string} day Day shown (YYYY-MM-DD).
 * @param {string} today Today in Paris (YYYY-MM-DD).
 * @param {number} [now] Now (ms): a running timer runs until it. Optional. Default = Date.now().
 * @returns {TaskDayReason[]} Reasons, in the order of `TASK_DAY_REASONS`.
 */
export function taskDayReasons(task: DayTask, day: string, today: string, now: number = Date.now()): TaskDayReason[] {
  if (task.closedAt !== null) {
    const closedOn = dayIn(typeof task.closedAt === 'string' ? new Date(task.closedAt) : task.closedAt);
    if (closedOn !== day) return [];
    return [task.cancelled ? 'cancelled' : 'done'];
  }
  const { span } = taskPlacement(task, today);
  const [from, to] = [parisInstant(day).getTime(), parisInstant(addDays(day, 1)).getTime()];
  const reasons: Record<Exclude<TaskDayReason, 'done' | 'cancelled'>, boolean> = {
    late: day === today && isTaskOverdue(task, today),
    due: task.effectiveDeadline === day,
    inProgress: task.statusCategory === 'IN_PROGRESS' && (day === today || (day < today && (task.times ?? []).some((time) => entryMeets(time, from, to, now)))),
    planned: span !== null && span.start <= day && day <= span.end,
    open: task.effectiveMinDate !== null && taskRemindsOn({ minDate: task.effectiveMinDate, deadline: task.effectiveDeadline }, day),
  };
  return TASK_DAY_REASONS.filter((reason): reason is keyof typeof reasons => reason in reasons && reasons[reason as keyof typeof reasons]);
}
