import { emptyTableFilter, slotSchedules, type CalendarFilterKind, type CalendarViewConfig, type TableFilterGroup } from '@ordo/shared';
import { useMemo } from 'react';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { filterRows, tableFilterFields } from '../../../components/data-table/table/table-engine';
import type { FilterFields } from '../../../components/filters/FilterBuilder';
import { parisToday } from '../../../lib/dates';
import { useNow } from '../../../lib/use-now';
import type { Routine, RoutineCategory } from '../../routines/api';
import { useRoutineColumns } from '../../routines/hooks/use-routine-columns';
import { useTaskColumns } from '../../tasks/hooks/use-task-columns';
import type { TaskContext } from '../../tasks/hooks/use-task-context';
import { filterUses, matchTasks } from '../../tasks/lib/task-columns';
import type { TimeEntry } from '../../time/api';
import { useTimeColumns } from '../../time/hooks/use-time-columns';
import type { Calendar, CalendarCategory, EventOccurrence, WorkSchedule } from '../api';
import { eventFilterColumns, eventRow } from '../lib/event-filter-columns';
import { EPHEMERIDES_TITLE, schedulesTitle } from '../lib/schedule-text';
import { scheduleRows, useScheduleColumns } from './use-schedule-columns';

/** Section of the filter editor of the calendar: the filter of a kind of items, in the words of its table. */
export interface CalendarFilterSection {
  kind: CalendarFilterKind;
  /** Name of the section (« Évènements », « Tâches »…). */
  title: string;
  /** Fields of the filter: the columns of the table of that kind. */
  fields: FilterFields<string>;
  filter: TableFilterGroup;
}

/** What the calendar shows of each kind of items of the workspace, once filtered by the view. */
export interface CalendarKept {
  /** Whether an event of the workspace is kept (its occurrence key). */
  event: (key: string) => boolean;
  /** Whether a task is kept. */
  task: (id: string) => boolean;
  /** Whether a routine (its occurrences) is kept. */
  routine: (id: string) => boolean;
  /** Whether a tracked time is kept. */
  timer: (id: string) => boolean;
  /** Whether a schedule of the workspace (créneau or éphéméride) is kept. */
  schedule: (id: string) => boolean;
}

/** Items of the workspace the calendar filters (those of other workspaces are not filtered). */
interface CalendarItems {
  context: TaskContext | null;
  events: readonly EventOccurrence[];
  routines: readonly Routine[];
  routineCategories: RoutineCategory[];
  entries: readonly TimeEntry[] | undefined;
  /** Schedules of the workspace, créneaux and éphémérides. */
  schedules: readonly WorkSchedule[];
  calendars: readonly Calendar[];
  categories: readonly CalendarCategory[];
  perso: boolean;
}

/**
 * Ids of the rows a filter keeps, null when it has no condition (every row kept).
 * @param {readonly R[]} rows Rows.
 * @param {readonly DataColumn<R>[]} columns Columns of their table.
 * @param {TableFilterGroup} filter Filter.
 * @param {(row: R) => string} key Id of a row.
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {ReadonlySet<string> | null} Ids kept.
 */
function keptIds<R>(rows: readonly R[], columns: readonly DataColumn<R>[], filter: TableFilterGroup, key: (row: R) => string, today: string): ReadonlySet<string> | null {
  if (filter.children.length === 0) return null;
  return new Set(filterRows(rows, columns, { search: '', filter }, today).map(key));
}

/**
 * Test of the ids kept (all without a filter).
 * @param {ReadonlySet<string> | null} ids Ids kept, null for all.
 * @returns {(id: string) => boolean} Test.
 */
const keeps =
  (ids: ReadonlySet<string> | null) =>
  (id: string): boolean =>
    ids === null || ids.has(id);

/**
 * Filters of a view of the calendar: one section per kind of items the view shows, each with the fields of the table of
 * that kind (tasks: the task table; routines: the routine table; chronos: the time table; créneaux and éphémérides:
 * their tables; events: the columns of the task table an event fills, with its calendar, categories, tasks, state…),
 * and what each filter keeps, by the same rules as these tables (`filterRows`). Items of other workspaces are not
 * filtered.
 * @param {CalendarViewConfig} config View.
 * @param {CalendarItems} items Items of the workspace.
 * @returns {{ sections: CalendarFilterSection[], kept: CalendarKept }} Sections of the editor, items kept.
 */
export function useCalendarFilters(config: CalendarViewConfig, items: CalendarItems): { sections: CalendarFilterSection[]; kept: CalendarKept } {
  const { context, events, routines, routineCategories, entries, schedules, calendars, categories, perso } = items;
  const today = parisToday();
  const { filters } = config;
  const taskColumns = useTaskColumns(context, today, { doable: config.tasks && filterUses(filters.tasks, 'doableNow') });
  const { columns: routineColumns } = useRoutineColumns(routines, routineCategories, today);
  const timeColumns = useTimeColumns(entries, context);
  const { columns: slotColumns } = useScheduleColumns(false);
  const { columns: ephemerisColumns } = useScheduleColumns(true);
  // The « État » of the events (to come, ongoing, past) read again each minute while a filter uses it.
  const now = useNow(filterUses(filters.events, 'state'), 60_000);
  const eventColumns = useMemo(() => (context ? eventFilterColumns(taskColumns, context, calendars, categories, now) : []), [taskColumns, context, calendars, categories, now]);

  const sections = useMemo(() => {
    const all: (Omit<CalendarFilterSection, 'fields' | 'filter'> & { columns: readonly DataColumn<never>[]; shown: boolean; empty: string })[] = [
      { kind: 'events', title: 'Évènements', columns: eventColumns, shown: true, empty: 'Aucun filtre : tous les évènements de l’espace sont affichés.' },
      { kind: 'tasks', title: 'Tâches', columns: taskColumns, shown: config.tasks, empty: 'Aucun filtre : toutes les tâches datées sont affichées.' },
      { kind: 'routines', title: 'Routines', columns: routineColumns, shown: config.routines, empty: 'Aucun filtre : toutes les routines sont affichées.' },
      { kind: 'timers', title: 'Chronos', columns: timeColumns, shown: config.timers, empty: 'Aucun filtre : tous les temps sont affichés.' },
      { kind: 'slots', title: schedulesTitle(perso), columns: slotColumns, shown: config.schedules, empty: 'Aucun filtre : tous les créneaux de l’espace sont affichés.' },
      { kind: 'ephemerides', title: EPHEMERIDES_TITLE, columns: ephemerisColumns, shown: config.schedules, empty: 'Aucun filtre : toutes les éphémérides de l’espace sont affichées.' },
    ];
    return all
      .filter((section) => section.shown)
      .map(({ kind, title, columns, empty }) => ({ kind, title, fields: { ...tableFilterFields(columns), emptyText: empty }, filter: filters[kind] ?? emptyTableFilter() }));
  }, [eventColumns, taskColumns, routineColumns, timeColumns, slotColumns, ephemerisColumns, config.tasks, config.routines, config.timers, config.schedules, filters, perso]);

  const kept = useMemo((): CalendarKept => {
    const ephemerisOf = new Map(schedules.map((schedule) => [schedule.id, schedule.ephemeris]));
    const slots = keptIds(
      scheduleRows(slotSchedules(schedules), today),
      slotColumns,
      filters.slots,
      (row) => row.schedule.id,
      today,
    );
    const ephemerides = keptIds(
      scheduleRows(
        schedules.filter((schedule) => schedule.ephemeris),
        today,
      ),
      ephemerisColumns,
      filters.ephemerides,
      (row) => row.schedule.id,
      today,
    );
    const tasks = context && filters.tasks.children.length > 0 ? new Set(matchTasks(context.tasks, taskColumns, { filter: filters.tasks }, today).map((task) => task.id)) : null;
    return {
      event: keeps(
        keptIds(
          events.map(eventRow),
          eventColumns,
          filters.events,
          (row) => (row.kind === 'event' ? row.event.key : row.key),
          today,
        ),
      ),
      task: keeps(tasks),
      routine: keeps(keptIds(routines, routineColumns, filters.routines, (routine) => routine.id, today)),
      timer: keeps(keptIds(entries ?? [], timeColumns, filters.timers, (entry) => entry.id, today)),
      // A schedule of another workspace is not filtered.
      schedule: (id) => !ephemerisOf.has(id) || keeps(ephemerisOf.get(id) ? ephemerides : slots)(id),
    };
  }, [schedules, today, slotColumns, ephemerisColumns, filters, context, taskColumns, events, eventColumns, routines, routineColumns, entries, timeColumns]);

  return { sections, kept };
}
