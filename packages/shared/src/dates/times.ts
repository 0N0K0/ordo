/**
 * Minutes since midnight of a time of the day.
 * @param {string} time HH:MM (seconds ignored).
 * @returns {number} Minutes.
 */
export function timeToMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/**
 * Time of the day of minutes since midnight.
 * @param {number} minutes Minutes, within the day.
 * @returns {string} HH:MM.
 */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
