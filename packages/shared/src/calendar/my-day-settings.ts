import type { z } from 'zod';
import { calendarViewConfigSchema } from './calendar-views';

/**
 * Settings of the page « Ma journée » of a user in a workspace, as sent and as stored: those of a view of the agenda
 * that a list of the day uses, read and checked the same way (`calendarViewConfigSchema`): the kinds of items shown
 * (tasks, routines, créneaux and éphémérides with the birthdays), the calendars and schedules left out, and the filter
 * of each kind of items. Unknown keys (the settings of an older page) are dropped; a field missing or invalid takes its
 * default.
 */
export const myDaySettingsSchema = calendarViewConfigSchema.pick({
  tasks: true,
  routines: true,
  schedules: true,
  hiddenCalendarIds: true,
  hiddenScheduleIds: true,
  filters: true,
});

/**
 * Settings of the page « Ma journée » of a user in a workspace: one set, saved on the server, the same in every tab and
 * device. Filters of the page, not rules: what the day holds is told by `taskDayReasons` and `myDayRows`.
 */
export type MyDaySettings = z.infer<typeof myDaySettingsSchema>;

/**
 * Settings of « Ma journée » read from a stored value: the defaults for what is missing or invalid (tasks, routines,
 * créneaux and éphémérides shown, nothing left out, no filter), unknown keys dropped, as a view of the agenda is read.
 * @param {unknown} value Stored JSON (null: none chosen).
 * @returns {MyDaySettings} Settings.
 */
export function readMyDaySettings(value: unknown): MyDaySettings {
  const stored = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return myDaySettingsSchema.parse(stored);
}
