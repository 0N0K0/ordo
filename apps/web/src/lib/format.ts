/**
 * Formats shown in the app: one per role. On screen, the readable form (« 13 nov. 2026 »); the numeric one
 * (« 13/11/2026 ») only in the exports (CSV, PDF tables).
 *
 * Dates take a calendar day (YYYY-MM-DD, shown as it is, whatever the time zone) or an instant (Date, ISO string with
 * a time, timestamp), shown in the user's time zone.
 */

import {
  capitalize as capitalizeText,
  countOf,
  dateStyle,
  daysBetween,
  dayText,
  // eslint-disable-next-line no-restricted-imports -- fmt.moneyCents is the shared formatMoney.
  formatMoney,
  formatNumber,
  formatPercent,
  LOCALE,
  longDayText,
  moneyFormat,
  monthText,
  weekdayText,
  type DateValue,
} from '@ordo/shared';

/** « 13 nov. 2026 »: a date in a table, a list, a text. */
export const day = dayText;

/** « 13 novembre 2026 », « 1er juin 2026 »: a date in a sentence, its weekday left out (the end of a repetition…). */
export const dayInWords = longDayText;

/** « 13 nov. »: a date of the year around, a chart axis. */
export const dayShort = dateStyle({ day: 'numeric', month: 'short' });

/** « ven. 13 nov. »: a day to plan, when its weekday matters (agenda, routines, home). */
export const weekday = weekdayText;

/** « vendredi 13 novembre 2026 »: a day heading, a day in a sentence. */
export const dayLong = dateStyle({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** « 13 nov. 2026, 14:05 »: an instant (created, sent, synchronized…). */
export const dateTime = dateStyle({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « ven. 13 nov., 14:05 »: an instant to come (alarm, sending). */
export const dateTimeShort = dateStyle({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « 14:05 ». */
export const time = dateStyle({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « novembre 2026 » (a month YYYY-MM is accepted). */
export const month = monthText;

/** « nov. 2026 »: a month on a chart axis. */
export const monthShort = dateStyle({ month: 'short', year: 'numeric' });

/** « 13/11/2026 »: a date in an export only. */
export const exportDay = dateStyle({ day: '2-digit', month: '2-digit', year: 'numeric' });

/** « 13/11/2026 14:05 »: an instant in an export only. */
export const exportDateTime = (value: DateValue) => `${exportDay(value)} ${time(value)}`;

/**
 * Text with its first letter in capital (« Novembre 2026 » as a heading).
 * @param {string} text Text.
 * @returns {string} Text.
 */
export const capitalize = capitalizeText;

/**
 * « 1 234,50 € »: an amount in units of its currency (euros, not cents).
 * @param {number} amount Amount.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const money = (amount: number, currency = 'EUR') => moneyFormat(currency).format(amount);

/**
 * « 1 234,50 € »: an amount in cents of its currency (accounting documents), as the API and the PDF write it.
 * @param {number} cents Amount in cents.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyCents = (cents: number, currency = 'EUR') => formatMoney(cents, currency);

/**
 * « € »: the symbol of a currency after an amount typed (its ISO code for the others).
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Symbol.
 */
export const currencySymbol = (currency = 'EUR') => (currency === 'EUR' ? '€' : currency);

/**
 * « 1,2 k€ »: an amount where room is short (badge, chart axis).
 * @param {number} amount Amount in units.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyCompact = (amount: number, currency = 'EUR') => moneyFormat(currency, { notation: 'compact', maximumFractionDigits: 1 }).format(amount);

/**
 * « 1 235 € »: an amount without cents (chart).
 * @param {number} amount Amount in units.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyRound = (amount: number, currency = 'EUR') => moneyFormat(currency, { maximumFractionDigits: 0 }).format(amount);

/**
 * A count in a column or an export: its number, blank for none (decision DH; an amount of 0 stays « 0,00 € »).
 * @param {number} value Count.
 * @returns {string} Text.
 */
// eslint-disable-next-line no-restricted-syntax -- fmt.count itself.
export const count = (value: number): string => (value ? String(value) : '');

/**
 * « 1 234,5 »: a number, with at most some decimals.
 * @param {number} value Number.
 * @param {number} [decimals=2] Most decimals. Optional. Default = 2.
 * @returns {string} Text.
 */
export const number = formatNumber;

/**
 * « 6 », « 250 g », « 1,5 kg »: a quantity (3 decimals at most) and its unit; the unit alone without quantity, nothing
 * without either.
 * @param {{ quantity?: number | null, unit?: string | null }} item Product, item, lot…
 * @returns {string} Text.
 */
export const quantity = ({ quantity: value, unit }: { quantity?: number | null; unit?: string | null }) => (value == null ? (unit ?? '') : `${number(value, 3)}${unit ? ` ${unit}` : ''}`);

/**
 * « 12,5 % »: a rate given in percent (12.5, not 0.125).
 * @param {number} value Rate.
 * @param {number} [decimals=2] Most decimals. Optional. Default = 2.
 * @returns {string} Text.
 */
export const percent = formatPercent;

/**
 * « 12 Ko » / « 1,5 Mo »: a file size (1 Ko at least).
 * @param {number} bytes Size.
 * @returns {string} Text.
 */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${number(bytes / 1024 / 1024, 1)} Mo`;
}

/** Display formats of the date pickers (Mantine): the readable form, as on screen. */
export const PICKER_FORMATS = {
  day: 'D MMM YYYY',
  weekday: 'ddd D MMM YYYY',
  dateTime: 'D MMM YYYY HH:mm',
  month: 'MMMM YYYY',
  year: 'YYYY',
} as const;

/** Relative times, the nearest unit first. */
// eslint-disable-next-line no-restricted-syntax -- the relative time format of lib/format.
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/**
 * « aujourd’hui », « il y a 3 jours »: how many days ago (a sending, a reminder).
 * @param {number} days Days since.
 * @returns {string} Text.
 */
export function daysAgo(days: number): string {
  return days === 0 ? 'aujourd’hui' : `il y a ${countOf(days, 'jour')}`;
}

/**
 * « 3 j de retard »: how late something due is.
 * @param {string} due Day it was due (YYYY-MM-DD).
 * @param {string} today Today (YYYY-MM-DD).
 * @returns {string} Text.
 */
export function daysLate(due: string, today: string): string {
  // eslint-disable-next-line no-restricted-syntax -- fmt.daysLate itself.
  return `${daysBetween(due, today)} j de retard`;
}

/**
 * « il y a 3 heures », « hier »…: how long ago (a comment), or how soon.
 * @param {string} date ISO instant.
 * @returns {string} Relative time.
 */
export function fromNow(date: string): string {
  const seconds = (Date.parse(date) - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'à l’instant';
}
