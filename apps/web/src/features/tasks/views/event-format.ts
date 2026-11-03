import type { EventOccurrence } from '../../calendar/api';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const numericDay = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const numericDateTime = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Start or end of an event: its day for an all-day event (the end day included), else its local date and time.
 * @param {EventOccurrence} event Occurrence.
 * @param {'start' | 'end'} side Start or end.
 * @param {boolean} [numeric] Numeric format (01/02/2026 09:30), for exports. Optional.
 * @returns {string} Text.
 */
export function eventWhen(event: EventOccurrence, side: 'start' | 'end', numeric = false): string {
  if (event.allDay) {
    const day = new Date(`${side === 'start' ? event.startDate : event.endDate}T00:00:00Z`);
    return (numeric ? numericDay : dayFormat).format(day);
  }
  return (numeric ? numericDateTime : dateTimeFormat).format(new Date(String(side === 'start' ? event.start : event.end)));
}
