import type { CalendarEventInput } from '@ordo/shared';
import type { EventOccurrence } from './api';

/** Time zone of the user's device: times of new events are local to it. */
export const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Reminder presets, in minutes before the start. */
export const REMINDER_PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Au début' },
  { value: 5, label: '5 min avant' },
  { value: 10, label: '10 min avant' },
  { value: 15, label: '15 min avant' },
  { value: 30, label: '30 min avant' },
  { value: 60, label: '1 h avant' },
  { value: 120, label: '2 h avant' },
  { value: 360, label: '6 h avant (la veille à 18 h pour une journée entière)' },
  { value: 1440, label: '1 jour avant' },
  { value: 2880, label: '2 jours avant' },
  { value: 10080, label: '1 semaine avant' },
];

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
    categoryIds: occurrence.categoryIds,
    taskIds: occurrence.taskIds,
  };
}

/**
 * Local "YYYY-MM-DD" and "HH:MM" of an instant.
 * @param {Date} date Instant.
 * @returns {{ date: string, time: string }} Local parts.
 */
export function localParts(date: Date): { date: string; time: string } {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}
