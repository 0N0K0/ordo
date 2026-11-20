import { formatDay, formatOptionalDay, taskDueDates, type TaskDueDates } from '@ordo/shared';

/** What the dates a task goes by are computed from: its sprints with their days (a Prisma selection). */
export const DUE_DATES_SELECT = { minDate: true, deadline: true, sprints: { select: { id: true, startDate: true, endDate: true } } } as const;

/** Task row with what its dates are computed from. */
export interface DueDatesRow {
  minDate: Date | null;
  deadline: Date | null;
  sprints: { id: string; startDate: Date; endDate: Date }[];
}

/**
 * « Ouverture » / « Échéance » a stored task goes by: its own, else those of its single sprint (`taskDueDates`, the
 * only computation of the inheritance).
 * @param {DueDatesRow} task Task with its sprints.
 * @returns {TaskDueDates} Dates.
 */
export function storedDueDates(task: DueDatesRow): TaskDueDates {
  return taskDueDates({ minDate: formatOptionalDay(task.minDate), deadline: formatOptionalDay(task.deadline), sprintIds: task.sprints.map((sprint) => sprint.id) }, (id) => {
    const sprint = task.sprints.find((item) => item.id === id);
    return sprint && { startDate: formatDay(sprint.startDate), endDate: formatDay(sprint.endDate) };
  });
}
