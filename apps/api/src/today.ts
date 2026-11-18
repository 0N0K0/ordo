/** Time zone of France: the one the API counts days and prints instants in. */
export const PARIS = 'Europe/Paris';

/**
 * Today in France (Europe/Paris), whatever the time zone of the server: the day every « today » of the API counts
 * from (late invoices, routines due, shopping lists…).
 * @returns {string} YYYY-MM-DD.
 */
export function parisToday(): string {
  // eslint-disable-next-line no-restricted-syntax -- the day in Paris, as YYYY-MM-DD.
  return new Date().toLocaleDateString('sv-SE', { timeZone: PARIS });
}
