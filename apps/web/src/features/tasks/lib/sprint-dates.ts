import * as fmt from '../../../lib/format';

/** Dates of a task as the API gives them: its own, and those it goes by (from its single sprint, `taskDueDates`). */
interface TaskDueFields {
  effectiveMinDate: string | null;
  effectiveDeadline: string | null;
  minDateFromSprint: boolean;
  deadlineFromSprint: boolean;
}

/**
 * Date a task takes from its sprint for « Ouverture » or « Échéance », shown in place of an empty field: « 12 nov.
 * 2026 (sprint) »; null when it has its own (a date typed wins) or is not in exactly one sprint.
 * @param {TaskDueFields} task Task.
 * @param {'minDate' | 'deadline'} field Field.
 * @returns {string | null} Text shown.
 */
export function sprintDateHint(task: TaskDueFields, field: 'minDate' | 'deadline'): string | null {
  const inherited = field === 'deadline' ? task.deadlineFromSprint && task.effectiveDeadline : task.minDateFromSprint && task.effectiveMinDate;
  return inherited ? `${fmt.day(inherited)} (sprint)` : null;
}
