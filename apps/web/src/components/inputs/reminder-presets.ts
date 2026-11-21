import { countOf, formatDuration, minutesToTime, reminderAnchorOf, type ReminderValue } from '@ordo/shared';

/** A reminder offered: minutes before the moment, and its label. */
export interface ReminderPreset {
  value: number;
  label: string;
}

/**
 * Reminders « avant » offered to an event or a routine, in minutes before its moment (decision D16: the same list for
 * both, « Au début » included, 24 hours at most, so no « 1 jour avant » nor longer).
 */
export const REMINDER_PRESETS: ReminderPreset[] = [
  { value: 0, label: 'Au début' },
  { value: 5, label: '5 min avant' },
  { value: 10, label: '10 min avant' },
  { value: 15, label: '15 min avant' },
  { value: 30, label: '30 min avant' },
  { value: 60, label: '1 h avant' },
  { value: 120, label: '2 h avant' },
  { value: 360, label: '6 h avant' },
];

/** Days of the reminders « N jours avant, à HH:MM » offered (decision FO), at `REMINDER_DAYS_TIME` (others can be typed). */
export const REMINDER_DAYS_PRESETS: number[] = [1, 2, 3, 7, 14, 30];

/** Time of the reminders « N jours avant » offered, and of one typed without hour. */
export const REMINDER_DAYS_TIME = '09:00';

/** Reminders « À HH:MM » offered (tasks, routines, events): every half hour of the day (another one can be typed). */
export const REMINDER_TIME_PRESETS: string[] = Array.from({ length: 48 }, (_, index) => minutesToTime(index * 30));

/** Day of a reminder « À HH:MM » of an event or a routine, in its label. */
export const REMINDER_DAY = 'le jour J';

/**
 * Label of a reminder: « Au début », its preset (« 15 min avant »), else its duration (« 24 h 00 avant », a value kept
 * from before); « À 08:00 le jour J » for a time of the day (`day` empty: « À 08:00 », a task); « 3 jours avant, à
 * 08:00 » some days before. From the end (decision FS): « À la fin », « 15 min avant la fin », « À 18:00 le jour de la
 * fin », « 3 jours avant la fin, à 08:00 ».
 * @param {ReminderValue} reminder Reminder.
 * @param {string} [day] Day of a time of the day. Optional. Default = « le jour J ».
 * @returns {string} Label.
 */
export function reminderLabel(reminder: ReminderValue, day = REMINDER_DAY): string {
  const end = reminderAnchorOf(reminder) === 'end';
  if (reminder.at !== null && reminder.days) return `${countOf(reminder.days, 'jour')} avant${end ? ' la fin' : ''}, à ${reminder.at}`;
  if (reminder.at !== null) return end ? `À ${reminder.at} le jour de la fin` : `À ${reminder.at}${day ? ` ${day}` : ''}`;
  const minutes = reminder.before ?? 0;
  if (end && minutes === 0) return 'À la fin';
  const label = REMINDER_PRESETS.find((preset) => preset.value === minutes)?.label ?? `${formatDuration(minutes * 60)} avant`;
  return end ? `${label} la fin` : label;
}
