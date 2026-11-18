import { z } from 'zod';

/** A time of the day, HH:MM (00:00 to 23:59). */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A day written YYYY-MM-DD (its form only, not whether it exists). */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Time of the day field (HH:MM). */
export const timeOfDaySchema = z.string().regex(TIME_OF_DAY_PATTERN, 'Heure attendue (HH:MM).');

/**
 * Day field written YYYY-MM-DD (its form only).
 * @param {string} [message] Error message. Optional. Default = « Date invalide. ».
 * @returns {z.ZodString} Schema.
 */
export function daySchema(message = 'Date invalide.') {
  return z.string({ error: message }).regex(DAY_PATTERN, message);
}

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
