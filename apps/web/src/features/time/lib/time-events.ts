import { occurrenceKey, readOccurrenceKey } from '@ordo/shared';
import type { EventOccurrence } from '../../calendar/api';
import type { TimeEntry, TimeEventLink } from '../api';

/**
 * Keys of the events (occurrences) a time was spent on.
 * @param {Pick<TimeEntry, 'events'>} entry Time.
 * @returns {string[]} Keys.
 */
export const entryEventKeys = (entry: Pick<TimeEntry, 'events'>): string[] => entry.events.map((link) => occurrenceKey(link.eventId, link.occurrenceDate || null));

/**
 * Events of keys, as the API takes them.
 * @param {readonly string[]} keys Keys.
 * @returns {TimeEventLink[]} Events.
 */
export function parseEventKeys(keys: readonly string[]): TimeEventLink[] {
  return keys.map((key) => {
    const { id, date } = readOccurrenceKey(key);
    return { eventId: id, occurrenceDate: date };
  });
}

/**
 * Events of a day a time can be spent on, as select options: « 09:00–10:00 · Title » (« Journée » all day), a cancelled
 * one marked « (annulé) »; all-day events starting after the day left out. The events the time already has stay
 * listed (under their label) when they are not among them.
 * @param {readonly EventOccurrence[]} events Events of the day.
 * @param {string} day Day (YYYY-MM-DD).
 * @param {Pick<TimeEntry, 'events'>} [entry] Time whose events stay listed. Optional.
 * @returns {{ value: string, label: string }[]} Options.
 */
export function dayEventOptions(events: readonly EventOccurrence[], day: string, entry?: Pick<TimeEntry, 'events'>): { value: string; label: string }[] {
  const options = events
    .filter((occurrence) => !occurrence.allDay || occurrence.startDate <= day)
    .map((occurrence) => ({
      value: occurrenceKey(occurrence.eventId, occurrence.occurrenceDate),
      label: `${occurrence.allDay ? 'Journée' : `${occurrence.startTime}–${occurrence.endTime}`} · ${occurrence.label}${occurrence.calledOff ? ' (annulé)' : ''}`,
    }));
  for (const link of entry?.events ?? []) {
    const value = occurrenceKey(link.eventId, link.occurrenceDate || null);
    if (!options.some((option) => option.value === value)) options.unshift({ value, label: link.label });
  }
  return options;
}
