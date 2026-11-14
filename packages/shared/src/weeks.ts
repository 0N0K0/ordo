import { z } from 'zod';
import { addDays } from './recurrence';

/** Day of the week, 1 (Monday) to 7 (Sunday). */
const weekdaySchema = z.number().int().min(1).max(7);

/**
 * Week of a workspace: the day it starts on and the day it ends on, both included. From Monday to Sunday by default;
 * the same day twice (Wednesday to Wednesday) makes weeks of 8 days, overlapping on that day; a shorter span (Monday
 * to Friday) leaves days out of any week.
 */
export const weekSpanSchema = z.object({ start: weekdaySchema, end: weekdaySchema });
export type WeekSpan = z.infer<typeof weekSpanSchema>;

export const DEFAULT_WEEK: WeekSpan = { start: 1, end: 7 };

export const WEEKDAY_LABELS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

/**
 * Days of a week: from its first day to its last one included (8 from a day to the same day).
 * @param {WeekSpan} week Week.
 * @returns {number} Days.
 */
export function weekLength(week: WeekSpan): number {
  const days = (week.end - week.start + 7) % 7;
  return days === 0 ? 8 : days + 1;
}

/**
 * Day of the week of a date, 1 (Monday) to 7 (Sunday).
 * @param {string} date YYYY-MM-DD.
 * @returns {number} Day.
 */
export const weekdayOfDate = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/**
 * First day of the week of a date: its latest start on or before it (with overlapping weeks, the day they share
 * belongs to the one it starts), shifted by some weeks.
 * @param {string} date YYYY-MM-DD.
 * @param {WeekSpan} [week] Week. Optional. Default = Monday to Sunday.
 * @param {number} [shift] Weeks later (negative: earlier). Optional. Default = 0.
 * @returns {string} YYYY-MM-DD.
 */
export function weekStartOf(date: string, week: WeekSpan = DEFAULT_WEEK, shift = 0): string {
  return addDays(date, -((weekdayOfDate(date) - week.start + 7) % 7) + shift * 7);
}

/**
 * First day and the day after the last one of the week of a date.
 * @param {string} date YYYY-MM-DD.
 * @param {WeekSpan} [week] Week. Optional. Default = Monday to Sunday.
 * @param {number} [shift] Weeks later (negative: earlier). Optional. Default = 0.
 * @returns {[string, string]} [first day, day after the last one].
 */
export function weekRange(date: string, week: WeekSpan = DEFAULT_WEEK, shift = 0): [string, string] {
  const start = weekStartOf(date, week, shift);
  return [start, addDays(start, weekLength(week))];
}

/**
 * Week of a workspace from its stored days (invalid ones: Monday to Sunday).
 * @param {{ weekStart: number, weekEnd: number }} workspace Workspace.
 * @returns {WeekSpan} Week.
 */
export function readWeek(workspace: { weekStart?: number | null; weekEnd?: number | null }): WeekSpan {
  const parsed = weekSpanSchema.safeParse({ start: workspace.weekStart, end: workspace.weekEnd });
  return parsed.success ? parsed.data : DEFAULT_WEEK;
}
