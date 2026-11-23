import { linkInputs } from '../../../lib/links';
import { addDays, type CalendarEventInput, daysBetween, occurrenceKey, readOccurrenceKey } from '@ordo/shared';
import type { CalendarEventScope, EventOccurrence } from '../api';

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

/**
 * Fields of an occurrence as « Toutes les occurrences » and « Celle-ci et les suivantes » edit them: an occurrence
 * changed on its own gives those of its series on its date (never its own label, place, hours or day), its routine
 * links moved with it to its day in the series; another one, its own.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {CalendarEventInput} Input.
 */
export function seriesInput(occurrence: EventOccurrence): CalendarEventInput {
  const own = occurrenceInput(occurrence);
  const { series } = occurrence;
  if (!series) return own;
  const fields: CalendarEventInput = {
    ...own,
    label: series.label,
    description: series.description ?? '',
    location: series.location ?? '',
    links: linkInputs(series.links),
    allDay: series.allDay,
    startTime: series.startTime,
    endTime: series.endTime,
    travelBefore: series.travelBefore,
    travelAfter: series.travelAfter,
  };
  return withDays(fields, series.startDate, series.endDate);
}

/**
 * Event input moved to other days: its routine links move with it (as many days later or earlier), those then out of
 * its days are left out.
 * @param {CalendarEventInput} input Input.
 * @param {string} startDate New first day.
 * @param {string} endDate New last day.
 * @returns {CalendarEventInput} Input.
 */
export function withDays(input: CalendarEventInput, startDate: string, endDate: string): CalendarEventInput {
  const shift = daysBetween(input.startDate, startDate);
  const routineLinks = (input.routineLinks ?? []).map((link) => ({ ...link, date: addDays(link.date, shift) })).filter((link) => link.date >= startDate && link.date <= endDate);
  return { ...input, startDate, endDate, routineLinks };
}

/**
 * Input of a change of an occurrence for the occurrences asked: itself (`THIS`, its own fields), or with its series
 * (`seriesInput`); new days given are those of the occurrence as shown, the series moving by as many days from its
 * day in it, its routine links with it (`withDays`).
 * @param {EventOccurrence} occurrence Occurrence edited.
 * @param {CalendarEventScope} scope Occurrences changed.
 * @param {Partial<CalendarEventInput>} [change] Fields changed. Optional. Default = none.
 * @returns {CalendarEventInput} Input.
 */
export function scopedInput(occurrence: EventOccurrence, scope: CalendarEventScope, change: Partial<CalendarEventInput> = {}): CalendarEventInput {
  const base = scope === 'THIS' ? occurrenceInput(occurrence) : seriesInput(occurrence);
  const { startDate, endDate, ...rest } = change;
  if (startDate === undefined && endDate === undefined) return { ...base, ...rest };
  const start = startDate ?? occurrence.startDate;
  const firstDay = addDays(base.startDate, daysBetween(occurrence.startDate, start));
  const lastDay = addDays(firstDay, Math.max(0, daysBetween(start, endDate ?? occurrence.endDate)));
  return { ...withDays(base, firstDay, lastDay), ...rest };
}
