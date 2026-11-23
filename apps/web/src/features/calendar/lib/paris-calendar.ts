import type { CalendarOptions, PluginDef } from '@fullcalendar/core';
import frLocale from '@fullcalendar/core/locales/fr';
import luxonPlugin from '@fullcalendar/luxon3';
import { PARIS_ZONE } from '@ordo/shared';

/**
 * Options shared by every FullCalendar of the app: in French, its days and hours those of Paris (shown and read so,
 * whatever the zone of the browser, through the Luxon plugin).
 * @param {PluginDef[]} plugins Views and interactions of the calendar.
 * @returns {Pick<CalendarOptions, 'plugins' | 'timeZone' | 'locale'>} Options, spread on `FullCalendar`.
 */
export function parisCalendarOptions(plugins: PluginDef[]): Pick<CalendarOptions, 'plugins' | 'timeZone' | 'locale'> {
  return { plugins: [...plugins, luxonPlugin], timeZone: PARIS_ZONE, locale: frLocale };
}
