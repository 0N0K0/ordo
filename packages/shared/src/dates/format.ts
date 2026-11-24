import { LOCALE } from '../core/numbers';
import { CALENDAR_DAY, PARIS_ZONE } from './days';
import { dayOfMonthText } from './months';

/**
 * Day and month formats shared by the app and the API's PDFs: a calendar day (YYYY-MM-DD, or a month YYYY-MM) is shown as
 * it is, whatever the time zone; an instant (Date, ISO text with a time, timestamp) in Paris time, whatever the zone of
 * the browser or of the server.
 */

/** A calendar day (YYYY-MM-DD) or month (YYYY-MM), or an instant. */
export type DateValue = string | number | Date;

/**
 * Formatter of a style for calendar days (UTC) and one for instants (Paris time).
 * @param {Intl.DateTimeFormatOptions} options Style.
 * @returns {(value: DateValue) => string} Formatter.
 */
export function dateStyle(options: Intl.DateTimeFormatOptions): (value: DateValue) => string {
  // eslint-disable-next-line no-restricted-syntax -- the date formats themselves.
  const calendar = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' });
  // eslint-disable-next-line no-restricted-syntax -- the date formats themselves.
  const instant = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: PARIS_ZONE });
  return (value) => {
    // eslint-disable-next-line no-restricted-syntax -- a day or a month read at midnight UTC, as parseDay.
    if (typeof value === 'string' && CALENDAR_DAY.test(value)) return calendar.format(new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`));
    return instant.format(value instanceof Date ? value : new Date(value));
  };
}

/** « 13 nov. 2026 »: a date in a table, a list, a text (the app's `fmt.day`, the rings pushed by the API). */
export const dayText = dateStyle({ day: 'numeric', month: 'short', year: 'numeric' });

/** « ven. 13 nov. »: a day to plan, when its weekday matters (agenda, routines, home, the calendar PDF). */
export const weekdayText = dateStyle({ weekday: 'short', day: 'numeric', month: 'short' });

/** « novembre 2026 » (a month YYYY-MM is accepted). */
export const monthText = dateStyle({ month: 'long', year: 'numeric' });

const longDay = dateStyle({ day: 'numeric', month: 'long', year: 'numeric' });

/**
 * « 13 novembre 2026 », « 1er juin 2026 »: a day in a sentence (the period of a PDF statement, the end of a
 * repetition…), its weekday left out.
 * @param {DateValue} value Day or instant.
 * @returns {string} Text.
 */
export const longDayText = (value: DateValue): string => longDay(value).replace(/^1 /, `${dayOfMonthText(1)} `);
