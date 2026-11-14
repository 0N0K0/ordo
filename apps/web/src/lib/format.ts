/**
 * Formats shown in the app: one per role. On screen, the readable form (« 13 nov. 2026 »); the numeric one
 * (« 13/11/2026 ») only in the exports (CSV, PDF tables).
 *
 * Dates take a calendar day (YYYY-MM-DD, shown as it is, whatever the time zone) or an instant (Date, ISO string with
 * a time, timestamp), shown in the user's time zone.
 */

/** A calendar day (YYYY-MM-DD) or an instant. */
export type DateValue = string | number | Date;

const LOCALE = 'fr-FR';
const CALENDAR_DAY = /^\d{4}-\d{2}(-\d{2})?$/;

/**
 * Formatter of a style for calendar days (UTC) and one for instants (local time).
 * @param {Intl.DateTimeFormatOptions} options Style.
 * @returns {(value: DateValue) => string} Formatter.
 */
function dateStyle(options: Intl.DateTimeFormatOptions): (value: DateValue) => string {
  const calendar = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' });
  const instant = new Intl.DateTimeFormat(LOCALE, options);
  return (value) => {
    if (typeof value === 'string' && CALENDAR_DAY.test(value)) return calendar.format(new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`));
    return instant.format(value instanceof Date ? value : new Date(value));
  };
}

/** « 13 nov. 2026 »: a date in a table, a list, a text. */
export const day = dateStyle({ day: 'numeric', month: 'short', year: 'numeric' });

/** « 13 nov. »: a date of the year around, a chart axis. */
export const dayShort = dateStyle({ day: 'numeric', month: 'short' });

/** « ven. 13 nov. »: a day to plan, when its weekday matters (agenda, routines, home). */
export const weekday = dateStyle({ weekday: 'short', day: 'numeric', month: 'short' });

/** « vendredi 13 novembre 2026 »: a day heading, a day in a sentence. */
export const dayLong = dateStyle({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** « 13 nov. 2026, 14:05 »: an instant (created, sent, synchronized…). */
export const dateTime = dateStyle({ day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « ven. 13 nov., 14:05 »: an instant to come (alarm, sending). */
export const dateTimeShort = dateStyle({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « 14:05 ». */
export const time = dateStyle({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** « novembre 2026 » (a month YYYY-MM is accepted). */
export const month = dateStyle({ month: 'long', year: 'numeric' });

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
export const capitalize = (text: string) => text.replace(/^./, (letter) => letter.toUpperCase());

const moneyFormats = new Map<string, Intl.NumberFormat>();
const compactMoneyFormats = new Map<string, Intl.NumberFormat>();

/**
 * Number format of a currency, made once.
 * @param {Map<string, Intl.NumberFormat>} cache Formats made.
 * @param {string} currency ISO code.
 * @param {Intl.NumberFormatOptions} options Style.
 * @returns {Intl.NumberFormat} Format.
 */
function currencyFormat(cache: Map<string, Intl.NumberFormat>, currency: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let format = cache.get(currency);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, ...options });
    cache.set(currency, format);
  }
  return format;
}

/**
 * « 1 234,50 € »: an amount in units of its currency (euros, not cents).
 * @param {number} amount Amount.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const money = (amount: number, currency = 'EUR') => currencyFormat(moneyFormats, currency, {}).format(amount);

/**
 * « 1 234,50 € »: an amount in cents of its currency (accounting documents).
 * @param {number} cents Amount in cents.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyCents = (cents: number, currency = 'EUR') => money(cents / 100, currency);

/**
 * « 1,2 k€ »: an amount where room is short (badge, chart axis).
 * @param {number} amount Amount in units.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyCompact = (amount: number, currency = 'EUR') => currencyFormat(compactMoneyFormats, currency, { notation: 'compact', maximumFractionDigits: 1 }).format(amount);

const roundMoneyFormats = new Map<string, Intl.NumberFormat>();

/**
 * « 1 235 € »: an amount without cents (chart).
 * @param {number} amount Amount in units.
 * @param {string} [currency='EUR'] ISO code. Optional. Default = EUR.
 * @returns {string} Text.
 */
export const moneyRound = (amount: number, currency = 'EUR') => currencyFormat(roundMoneyFormats, currency, { maximumFractionDigits: 0 }).format(amount);

const numberFormats = new Map<number, Intl.NumberFormat>();

/**
 * « 1 234,5 »: a number, with at most some decimals.
 * @param {number} value Number.
 * @param {number} [decimals=2] Most decimals. Optional. Default = 2.
 * @returns {string} Text.
 */
export function number(value: number, decimals = 2): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimals });
    numberFormats.set(decimals, format);
  }
  return format.format(value);
}

/**
 * « 12,5 % »: a rate given in percent (12.5, not 0.125).
 * @param {number} value Rate.
 * @param {number} [decimals=2] Most decimals. Optional. Default = 2.
 * @returns {string} Text.
 */
export const percent = (value: number, decimals = 2) => `${number(value, decimals)} %`;

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
