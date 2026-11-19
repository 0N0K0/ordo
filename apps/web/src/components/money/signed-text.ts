import * as fmt from '../../lib/format';

/**
 * Text of a signed amount (or quantity): « + » before money in, the minus of the format before money out.
 * @param {number} value Signed value.
 * @param {(value: number) => string} [format] Text of the value. Optional. Default = an amount in euros.
 * @returns {string} « +12,00 € », « -3,50 € ».
 */
export function signedText(value: number, format: (value: number) => string = fmt.money): string {
  // eslint-disable-next-line no-restricted-syntax -- signedText itself.
  return `${value > 0 ? '+' : ''}${format(value)}`;
}
