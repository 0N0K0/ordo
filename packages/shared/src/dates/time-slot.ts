import { timeToMinutes, minutesToTime } from './times';

/** Minutes in a day. */
export const DAY_MINUTES = 1440;

/** End of a time slot: its time of the day and the days after its start day (0: the same day). */
export interface TimeSlotEnd {
  time: string;
  days: number;
}

/**
 * End of a time slot from its start and its duration, with no 24 h limit: « 22:00 » for 3 h ends « 01:00 » the next
 * day.
 * @param {string} start Start, HH:MM.
 * @param {number} minutes Duration in minutes (0 or more).
 * @returns {TimeSlotEnd} End.
 */
export function timeSlotEnd(start: string, minutes: number): TimeSlotEnd {
  const total = timeToMinutes(start) + Math.max(0, minutes);
  return { time: minutesToTime(total % DAY_MINUTES), days: Math.floor(total / DAY_MINUTES) };
}

/**
 * Duration of a time slot from its start and its end: an end before the start on the same day (or equal to it) moves
 * to the next day (« 22:00 » to « 01:00 » lasts 3 h).
 * @param {string} start Start, HH:MM.
 * @param {TimeSlotEnd} end End.
 * @returns {{ minutes: number, days: number }} Duration in minutes, and the days of its end once moved.
 */
export function timeSlotDuration(start: string, end: TimeSlotEnd): { minutes: number; days: number } {
  const from = timeToMinutes(start);
  const to = timeToMinutes(end.time);
  const days = end.days === 0 && to <= from ? 1 : end.days;
  return { minutes: days * DAY_MINUTES + to - from, days };
}

/**
 * Duration in days, hours and minutes.
 * @param {number} minutes Duration in minutes.
 * @returns {{ days: number, hours: number, minutes: number }} Parts.
 */
export function durationParts(minutes: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { days: Math.floor(total / DAY_MINUTES), hours: Math.floor((total % DAY_MINUTES) / 60), minutes: total % 60 };
}

/**
 * Day of the end of a time slot in words: « le jour même », « le lendemain », « J+2 »…
 * @param {number} days Days after its start day.
 * @returns {string} Text.
 */
export function endDayText(days: number): string {
  if (days <= 0) return 'le jour même';
  if (days === 1) return 'le lendemain';
  return `J+${days}`;
}
