import { linkInputs } from '../../../lib/links';
import { unarchived } from '../../../lib/archive';
import { addDays, type CalendarEventInput, daysBetween, minutesToTime, occurrenceKey, readOccurrenceKey, shiftedRoutineLink, timeToMinutes } from '@ordo/shared';
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
    locationLat: occurrence.locationLat ?? null,
    locationLon: occurrence.locationLon ?? null,
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
    // The day each occurrence shows on: they move with the event from it (`withDays`).
    routineLinks: occurrence.routineLinks.map(({ routineId, date, shownDate }) => ({ routineId, date, shownDate })),
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
    locationLat: series.locationLat ?? null,
    locationLon: series.locationLon ?? null,
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
 * Event input moved to other days: its routine links move with it, as many days later or earlier from the day each
 * occurrence shows on (`shownDate`, else the day that identifies it; the API links the occurrence of that routine shown
 * that day, none there: the link is dropped), those then out of its days are left out.
 * @param {CalendarEventInput} input Input.
 * @param {string} startDate New first day.
 * @param {string} endDate New last day.
 * @returns {CalendarEventInput} Input.
 */
export function withDays(input: CalendarEventInput, startDate: string, endDate: string): CalendarEventInput {
  const shift = daysBetween(input.startDate, startDate);
  const routineLinks = (input.routineLinks ?? [])
    // Kept apart (identified by the day of its rule): the API finds the occurrence shown on its new day.
    .map((link) => shiftedRoutineLink(link, link.shownDate ?? link.date, shift))
    .filter((link) => link.shownDate >= startDate && link.shownDate <= endDate);
  return { ...input, startDate, endDate, routineLinks };
}

/**
 * Minutes from a moment to another one.
 * @param {string} fromDay First day (YYYY-MM-DD).
 * @param {string} fromTime First time (HH:MM).
 * @param {string} toDay Second day.
 * @param {string} toTime Second time.
 * @returns {number} Minutes (negative: earlier).
 */
const minutesBetween = (fromDay: string, fromTime: string, toDay: string, toTime: string): number => daysBetween(fromDay, toDay) * 1440 + timeToMinutes(toTime) - timeToMinutes(fromTime);

/**
 * Moment moved by minutes, its day following when it crosses midnight.
 * @param {string} day Day (YYYY-MM-DD).
 * @param {string} time Time (HH:MM).
 * @param {number} minutes Minutes moved.
 * @returns {{ date: string, time: string }} Moment.
 */
function movedBy(day: string, time: string, minutes: number): { date: string; time: string } {
  const total = timeToMinutes(time) + minutes;
  const days = Math.floor(total / 1440);
  return { date: addDays(day, days), time: minutesToTime(total - days * 1440) };
}

/**
 * Input of a change of an occurrence for the occurrences asked: itself (`THIS`, its own fields), or with its series
 * (`seriesInput`); new days given are those of the occurrence as shown, the series moving by as many days from its
 * day in it, its routine links with it (`withDays`). An occurrence changed on its own, dragged or resized with its
 * series, moves the series by its own move only: the series keeps its hours, moved by as many minutes.
 * @param {EventOccurrence} occurrence Occurrence edited.
 * @param {CalendarEventScope} scope Occurrences changed.
 * @param {Partial<CalendarEventInput>} [change] Fields changed. Optional. Default = none.
 * @returns {CalendarEventInput} Input.
 */
export function scopedInput(occurrence: EventOccurrence, scope: CalendarEventScope, change: Partial<CalendarEventInput> = {}): CalendarEventInput {
  const base = scope === 'THIS' ? occurrenceInput(occurrence) : seriesInput(occurrence);
  const { startDate, endDate, ...rest } = change;
  const timed = change.startTime && change.endTime && occurrence.startTime && occurrence.endTime && base.startTime && base.endTime;
  if (scope !== 'THIS' && occurrence.series && timed && !change.allDay) {
    const start = movedBy(base.startDate, base.startTime!, minutesBetween(occurrence.startDate, occurrence.startTime!, startDate ?? occurrence.startDate, change.startTime!));
    const end = movedBy(base.endDate, base.endTime!, minutesBetween(occurrence.endDate, occurrence.endTime!, endDate ?? occurrence.endDate, change.endTime!));
    return { ...withDays(base, start.date, end.date < start.date ? start.date : end.date), ...rest, startTime: start.time, endTime: end.time };
  }
  if (startDate === undefined && endDate === undefined) return { ...base, ...rest };
  const start = startDate ?? occurrence.startDate;
  const firstDay = addDays(base.startDate, daysBetween(occurrence.startDate, start));
  const lastDay = addDays(firstDay, Math.max(0, daysBetween(start, endDate ?? occurrence.endDate)));
  return { ...withDays(base, firstDay, lastDay), ...rest };
}

/** Days and times of a new event: all day without a start time. */
export interface NewEventPeriod {
  startDate: string;
  endDate: string;
  /** HH:MM; none: all day. */
  startTime?: string | null;
  endTime?: string | null;
}

/**
 * Fields of a new event on a period picked (a day, a time span): in the first calendar shown (not archived, not hidden),
 * all day when no time is given.
 * @param {readonly { id: string, archived?: boolean | null }[]} calendars Calendars of the workspace, in their order.
 * @param {ReadonlySet<string>} hidden Ids of the calendars hidden.
 * @param {NewEventPeriod} period Days and times.
 * @returns {Partial<CalendarEventInput>} Defaults of the event form.
 */
export function newEventDefaults(calendars: readonly { id: string; archived?: boolean | null }[], hidden: ReadonlySet<string>, period: NewEventPeriod): Partial<CalendarEventInput> {
  const calendarId = unarchived(calendars).find((calendar) => !hidden.has(calendar.id))?.id ?? null;
  const allDay = !period.startTime;
  return {
    calendarId,
    allDay,
    startDate: period.startDate,
    startTime: allDay ? null : (period.startTime ?? null),
    endDate: period.endDate,
    endTime: allDay ? null : (period.endTime ?? null),
  };
}
