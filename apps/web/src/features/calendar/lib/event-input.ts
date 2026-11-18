import type { CalendarEventInput } from '@ordo/shared';
import type { EventOccurrence } from '../api';

/** Time zone of the user's device: times of new events are local to it. */
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Fields of an occurrence, as the input of a change.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {CalendarEventInput} Input.
 */
export function occurrenceInput(occurrence: EventOccurrence): CalendarEventInput {
  return {
    title: occurrence.title,
    description: occurrence.description ?? '',
    location: occurrence.location ?? '',
    links: occurrence.links.map(({ url, label }) => ({ url, label })),
    allDay: occurrence.allDay,
    startDate: occurrence.startDate,
    startTime: occurrence.startTime,
    endDate: occurrence.endDate,
    endTime: occurrence.endTime,
    timeZone: occurrence.timeZone,
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
    routineLinks: occurrence.routineLinks.map(({ routineId, date }) => ({ routineId, date })),
  };
}
