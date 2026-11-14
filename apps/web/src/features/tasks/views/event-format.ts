import type { EventOccurrence } from '../../calendar/api';
import * as fmt from '../../../lib/format';

/**
 * Start or end of an event: its day for an all-day event (the end day included), else its local date and time.
 * @param {EventOccurrence} event Occurrence.
 * @param {'start' | 'end'} side Start or end.
 * @param {boolean} [numeric] Numeric format (01/02/2026 09:30), for exports. Optional.
 * @returns {string} Text.
 */
export function eventWhen(event: EventOccurrence, side: 'start' | 'end', numeric = false): string {
  if (event.allDay) {
    const day = String(side === 'start' ? event.startDate : event.endDate);
    return numeric ? fmt.exportDay(day) : fmt.day(day);
  }
  const at = new Date(String(side === 'start' ? event.start : event.end));
  return numeric ? fmt.exportDateTime(at) : fmt.dateTime(at);
}

/** Where an event stands: to come, ongoing, over, cancelled or postponed. */
export type EventState = 'upcoming' | 'ongoing' | 'over' | 'cancelled' | 'postponed';

export const EVENT_STATES: Record<EventState, { label: string; color: string }> = {
  upcoming: { label: 'À venir', color: 'blue' },
  ongoing: { label: 'En cours', color: 'green' },
  over: { label: 'Terminé', color: 'gray' },
  cancelled: { label: 'Annulé', color: 'red' },
  postponed: { label: 'Reporté', color: 'orange' },
};

/**
 * Where an event stands now.
 * @param {EventOccurrence} event Occurrence.
 * @param {number} now Now (ms).
 * @returns {EventState} State.
 */
export function eventState(event: EventOccurrence, now: number): EventState {
  if (event.calledOff) return 'cancelled';
  if (event.postponedTo.length > 0) return 'postponed';
  if (now < new Date(String(event.start)).getTime()) return 'upcoming';
  return now < new Date(String(event.end)).getTime() ? 'ongoing' : 'over';
}
