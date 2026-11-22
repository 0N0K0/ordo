import { calendarRingPage } from '@ordo/shared';
import type { CountdownItem } from '../../countdowns/lib/countdowns';

/**
 * An event (its occurrence, for a recurring one) as the timers launched for it (its saved timers) keep it: its ring
 * links to the calendar, as its reminders.
 * @param {{ eventId: string, label: string }} event Event.
 * @param {string | null} occurrenceDate Occurrence of a recurring event; null: a one-off event.
 * @returns {CountdownItem} Item.
 */
export const eventCountdownItem = (event: { eventId: string; label: string }, occurrenceDate: string | null): CountdownItem => {
  const page = calendarRingPage();
  return { eventId: event.eventId, occurrenceDate, subject: event.label, path: page.path, linkLabel: page.label };
};
