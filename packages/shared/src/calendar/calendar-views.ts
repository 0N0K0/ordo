import { z } from 'zod';
import { TABLE_KEY_MAX } from '../tables/table-layout';
import { emptyTableFilter, tableFilterSchema } from '../tables/table-views';

/** Key of the saved views of the calendar page (views of kind TABLE). */
export const CALENDAR_VIEW_KEY = 'calendar';

/** How a view of the calendar lays its days out: a month, a week (of the workspace) or a day. */
export const CALENDAR_DISPLAYS = ['MONTH', 'WEEK', 'DAY'] as const;
export type CalendarDisplay = (typeof CALENDAR_DISPLAYS)[number];

/**
 * Kinds of items a view of the calendar filters, each with its own filter in the words of its table: the events of the
 * workspace, the tasks, the routines, the tracked times, the créneaux and the éphémérides of the workspace.
 */
export const CALENDAR_FILTER_KINDS = ['events', 'tasks', 'routines', 'timers', 'slots', 'ephemerides'] as const;
export type CalendarFilterKind = (typeof CALENDAR_FILTER_KINDS)[number];

/** Most calendars or schedules a view hides (internal bound). */
const HIDDEN_MAX = 500;

/** Ids hidden by a view (calendars, schedules). */
const hiddenIdsSchema = z.array(z.string().min(1).max(TABLE_KEY_MAX)).max(HIDDEN_MAX).catch([]).default([]);

/** Filter of a kind of items: an invalid one is read as no filter. */
const kindFilterSchema = tableFilterSchema.catch(() => emptyTableFilter()).default(() => emptyTableFilter());

/** Filters of a view of the calendar, by kind of items. */
const calendarFiltersSchema = z.object(Object.fromEntries(CALENDAR_FILTER_KINDS.map((kind) => [kind, kindFilterSchema])) as Record<CalendarFilterKind, typeof kindFilterSchema>);

/**
 * Configuration of a view of the calendar: its display (month, week or day, hours by 5 minutes), what it shows (the
 * tasks, the routines, the créneaux and éphémérides, the tracked times, the archived items, the calendars and schedules
 * left out) and the filter of each kind of items.
 */
export const calendarViewConfigSchema = z.object({
  display: z.enum(CALENDAR_DISPLAYS).catch('WEEK').default('WEEK'),
  /** Dated tasks shown. */
  tasks: z.boolean().catch(true).default(true),
  /** Occurrences of the routines shown. */
  routines: z.boolean().catch(true).default(true),
  /** Créneaux, éphémérides and birthdays shown. */
  schedules: z.boolean().catch(true).default(true),
  /** Tracked times shown. */
  timers: z.boolean().catch(false).default(false),
  /** Archived events, calendars and routines shown too (read only). */
  includeArchived: z.boolean().catch(false).default(false),
  /** Hours of the week and the day by 5 minutes (instead of 30). */
  fineSlots: z.boolean().catch(false).default(false),
  /** Calendars left out (of the workspace, or of other workspaces it subscribes to). */
  hiddenCalendarIds: hiddenIdsSchema,
  /** Créneaux and éphémérides left out (of the workspace, or of other workspaces it subscribes to). */
  hiddenScheduleIds: hiddenIdsSchema,
  /** Filter of each kind of items of the workspace (those of other workspaces are not filtered). */
  filters: calendarFiltersSchema.catch(() => calendarFiltersSchema.parse({})).default(() => calendarFiltersSchema.parse({})),
});
export type CalendarViewConfig = z.infer<typeof calendarViewConfigSchema>;

/**
 * Configuration of a view of the calendar: the given settings over the defaults (a week, the tasks, routines, créneaux
 * and éphémérides shown, nothing filtered).
 * @param {unknown} [config] Settings. Optional.
 * @returns {CalendarViewConfig} Config.
 */
export function calendarViewConfig(config: unknown = {}): CalendarViewConfig {
  const parsed = calendarViewConfigSchema.safeParse(config);
  return parsed.success ? parsed.data : calendarViewConfigSchema.parse({});
}

