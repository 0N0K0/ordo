/** Locale of every text the app and the API write (dates, numbers, amounts). */
export const LOCALE = 'fr-FR';

/** Formats of the numbers made so far, by most decimals (making one is slow). */
const numberFormats = new Map<number, Intl.NumberFormat>();

/**
 * « 1 234,5 »: a number, with at most some decimals.
 * @param {number} value Number.
 * @param {number} [decimals=2] Most decimals. Optional. Default = 2.
 * @returns {string} Text.
 */
export function formatNumber(value: number, decimals = 2): string {
  let format = numberFormats.get(decimals);
  if (!format) {
    // eslint-disable-next-line no-restricted-syntax -- the number format itself.
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
export const formatPercent = (value: number, decimals = 2): string => `${formatNumber(value, decimals)} %`;

/**
 * A number on two digits at least, a zero before (« 07 »): hours, minutes, days and months written by hand, hex channels.
 * @param {number | string} value Number, or its digits (« 7 », « a »).
 * @returns {string} Text.
 */
export function twoDigits(value: number | string): string {
  // eslint-disable-next-line no-restricted-syntax -- twoDigits itself.
  return String(value).padStart(2, '0');
}
