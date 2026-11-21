import { INHERIT_SOURCE_LABELS, type InheritSource } from '@ordo/shared';
import * as fmt from '../../../lib/format';

/** Dates of a task as the API gives them: those it goes by, and where each comes from when not its own (`effectiveTask`). */
interface TaskDueFields {
  effectiveMinDate: string | null;
  effectiveDeadline: string | null;
  minDateSource?: InheritSource | null;
  deadlineSource?: InheritSource | null;
}

/**
 * Date a task without its own « Ouverture » or « Échéance » goes by, shown in place of the empty field:
 * « 12 nov. 2026 (parent) », « (jalon) », « (projet) », « (sprint) »; null when it has its own (a date typed wins) or
 * none at all.
 * @param {TaskDueFields} task Task.
 * @param {'minDate' | 'deadline'} field Field.
 * @returns {string | null} Text shown.
 */
export function inheritedDateHint(task: TaskDueFields, field: 'minDate' | 'deadline'): string | null {
  const [date, source] = field === 'deadline' ? [task.effectiveDeadline, task.deadlineSource] : [task.effectiveMinDate, task.minDateSource];
  return date && source && source !== 'OWN' ? `${fmt.day(date)} (${INHERIT_SOURCE_LABELS[source]})` : null;
}
