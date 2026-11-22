import { linkInputs } from '../../../lib/links';
import { type CalendarEventInput, occurrenceKey, readOccurrenceKey } from '@ordo/shared';
import type { EventOccurrence } from '../api';

/** A routine done during an event, on one of its days. */
interface RoutineLink {
  routineId: string;
  date: string;
}

/**
 * Key of a routine link, the value of its option (« routineId|date »).
 * @param {RoutineLink} link Routine and day.
 * @returns {string} Key.
 */
export const routineLinkKey = (link: RoutineLink): string => occurrenceKey(link.routineId, link.date);

/**
 * Routine link of a key made by `routineLinkKey`.
 * @param {string} key Key.
 * @returns {RoutineLink} Routine and day.
 */
export function routineLinkOf(key: string): RoutineLink {
  const { id, date } = readOccurrenceKey(key);
  return { routineId: id, date: date ?? '' };
}

/**
 * Fields of an occurrence, as the input of a change.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {CalendarEventInput} Input.
 */
export function occurrenceInput(occurrence: EventOccurrence): CalendarEventInput {
  return {
    label: occurrence.label,
    description: occurrence.description ?? '',
    location: occurrence.location ?? '',
    links: linkInputs(occurrence.links),
    allDay: occurrence.allDay,
    startDate: occurrence.startDate,
    startTime: occurrence.startTime,
    endDate: occurrence.endDate,
    endTime: occurrence.endTime,
    recurrence: (occurrence.recurrence as CalendarEventInput['recurrence']) ?? null,
    reminders: occurrence.reminders,
    travelBefore: occurrence.travelBefore,
    travelAfter: occurrence.travelAfter,
    projectId: occurrence.projectId,
    calendarId: occurrence.calendarId,
    contributorIds: occurrence.contributorIds,
    relationIds: occurrence.relationIds,
    beneficiaryIds: occurrence.beneficiaryIds,
    beneficiaryRelationIds: occurrence.beneficiaryRelationIds,
    categoryIds: occurrence.categoryIds,
    taskIds: occurrence.taskIds,
    libraryDocumentIds: occurrence.libraryDocumentIds,
    projectResourceIds: occurrence.projectResourceIds,
    routineLinks: occurrence.routineLinks.map(({ routineId, date }) => ({ routineId, date })),
  };
}
