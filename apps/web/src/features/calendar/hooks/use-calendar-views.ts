import { CALENDAR_VIEW_KEY, calendarViewConfig, type CalendarDisplay, type CalendarViewConfig } from '@ordo/shared';
import { useSavedViews, viewParam } from '../../../components/data-table/views/use-saved-views';

/**
 * Settings the calendar kept in the browser before its views: they make the first view of each workspace that has
 * none (its first visit), and are never dropped (a creation that fails loses nothing; every workspace takes them).
 */
const LEGACY_KEYS = { view: 'ordo.calendar.view', filters: 'ordo.calendar.filters' } as const;

/** Displays of the former settings of the browser. */
const LEGACY_DISPLAYS: Record<string, CalendarDisplay> = { dayGridMonth: 'MONTH', timeGridWeek: 'WEEK', timeGridDay: 'DAY' };

/**
 * Value kept in the browser under a key, null without one (or when the browser refuses).
 * @param {string} key Key.
 * @returns {unknown} Value.
 */
function legacyValue(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/**
 * Configuration of the first view of the calendar: what the browser showed before the views (its display, the items
 * shown, the calendars and schedules hidden), else the defaults; the former settings stay in the browser.
 * @returns {CalendarViewConfig} Configuration.
 */
function legacyConfig(): CalendarViewConfig {
  const display = legacyValue(LEGACY_KEYS.view);
  const filters = legacyValue(LEGACY_KEYS.filters) as Record<string, unknown> | null;
  return calendarViewConfig({
    ...(typeof display === 'string' && LEGACY_DISPLAYS[display] ? { display: LEGACY_DISPLAYS[display] } : {}),
    ...(filters && typeof filters === 'object'
      ? {
          tasks: filters.tasks !== false,
          routines: filters.routines !== false,
          schedules: filters.workHours !== false,
          timers: filters.timers === true,
          includeArchived: filters.archived === true,
          fineSlots: filters.fineSlots === true,
          hiddenCalendarIds: filters.hiddenCalendarIds,
          hiddenScheduleIds: filters.hiddenScheduleIds,
        }
      : {}),
  });
}

/**
 * First views of the calendar: one, « Agenda », as the calendar showed before.
 * @returns {{ label: string, config: CalendarViewConfig }[]} Views.
 */
const firstViews = () => [{ label: 'Agenda', config: legacyConfig() }];

/**
 * Blank view of the calendar: a week, the tasks, routines, créneaux and éphémérides shown, nothing filtered.
 * @returns {CalendarViewConfig} Configuration.
 */
const blankView = () => calendarViewConfig();

/**
 * Saved views of the calendar page, as those of the tables (tabs, working copy, default view, order): each with its
 * display, what it shows and its filters. Selected one in the URL (`?calendar-view=`).
 * @returns {SavedViewsState<CalendarViewConfig>} Views.
 */
export function useCalendarViews() {
  return useSavedViews<CalendarViewConfig>({
    projectId: null,
    kind: 'TABLE',
    tableKey: CALENDAR_VIEW_KEY,
    parse: calendarViewConfig,
    blank: blankView,
    first: firstViews,
    param: viewParam(CALENDAR_VIEW_KEY),
  });
}
