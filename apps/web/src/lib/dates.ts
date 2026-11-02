/**
 * User's current day, YYYY-MM-DD.
 * @returns {string} Day.
 */
export function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
