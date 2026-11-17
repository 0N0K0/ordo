/**
 * Today in France (Europe/Paris), whatever the time zone of the server: the day every « today » of the API counts
 * from (late invoices, routines due, shopping lists…).
 * @returns {string} YYYY-MM-DD.
 */
export function parisToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}
