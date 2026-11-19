import { occurrenceKey, readOccurrenceKey } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';

/** Event a time was spent on, as the API takes it. */
interface TimeEvent {
  eventId: string;
  occurrenceDate: string | null;
}

/**
 * Key of the event a time was spent on, if any.
 * @param {{ calendarEventId: string | null, calendarOccurrenceDate: string | null }} entry Time.
 * @returns {string | null} Key.
 */
export const entryEventKey = (entry: { calendarEventId?: string | null; calendarOccurrenceDate?: string | null }): string | null =>
  entry.calendarEventId ? occurrenceKey(entry.calendarEventId, entry.calendarOccurrenceDate || null) : null;

/**
 * Event of a key (none without key).
 * @param {string | null} key Key.
 * @returns {TimeEvent | null} Event.
 */
export function parseEventKey(key: string | null): TimeEvent | null {
  if (!key) return null;
  const { id, date } = readOccurrenceKey(key);
  return { eventId: id, occurrenceDate: date };
}

/**
 * Events of a day a time can be spent on, as select options: « 09:00–10:00 · Title » (« Journée » all day), a cancelled
 * one marked « (annulé) »; all-day events starting after the day left out.
 * @param {readonly EventOccurrence[]} events Events of the day.
 * @param {string} day Day (YYYY-MM-DD).
 * @returns {{ value: string, label: string }[]} Options.
 */
export function dayEventOptions(events: readonly EventOccurrence[], day: string): { value: string; label: string }[] {
  return events
    .filter((occurrence) => !occurrence.allDay || occurrence.startDate <= day)
    .map((occurrence) => ({
      value: occurrenceKey(occurrence.eventId, occurrence.occurrenceDate),
      label: `${occurrence.allDay ? 'Journée' : `${occurrence.startTime}–${occurrence.endTime}`} · ${occurrence.label}${occurrence.calledOff ? ' (annulé)' : ''}`,
    }));
}
