import { PERIOD_STATES, periodState, type PeriodState } from '../../../lib/periods';
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
    const day = side === 'start' ? event.startDate : event.endDate;
    return numeric ? fmt.exportDay(day) : fmt.day(day);
  }
  const at = new Date(side === 'start' ? event.start : event.end);
  return numeric ? fmt.exportDateTime(at) : fmt.dateTime(at);
}

/** Where an event stands: to come, ongoing, past (its period), cancelled or postponed. */
type EventState = PeriodState | 'cancelled' | 'postponed';

export const EVENT_STATES: Record<EventState, { label: string; color: string }> = {
  ...PERIOD_STATES,
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
  return periodState(new Date(event.start).getTime(), new Date(event.end).getTime(), now, { endExclusive: true });
}
