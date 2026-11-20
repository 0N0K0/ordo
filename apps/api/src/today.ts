import { dayIn, PARIS_ZONE } from '@ordo/shared';

/** Time zone of France: the one the API counts days and prints instants in. */
export const PARIS = PARIS_ZONE;

/**
 * Today in France (Europe/Paris), whatever the time zone of the server: the day every « today » of the API counts
 * from (late invoices, routines due, shopping lists…).
 * @returns {string} YYYY-MM-DD.
 */
export function parisToday(): string {
  return dayIn(new Date(), PARIS);
}
