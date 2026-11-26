import {
  addDays,
  birthdayLabel,
  birthdaysBetween,
  countedSchedules,
  inRoutineHistoryOn,
  itemWindowsOn,
  joinedKey,
  mapById,
  myDayRows,
  plannedSlots,
  readBirthDate,
  readSlotCondition,
  readTaskHours,
  taskDayReasons,
  type MyDayItem,
  type MyDayLayout,
  type MyDaySettings,
  type MyDaySlot,
  type TaskStatusCategory,
  type TimeWindow,
  windowsAllowed,
} from '@ordo/shared';
import { useMemo } from 'react';
import { archivedIds, unarchived } from '../../../lib/archive';
import { parisMidnight, parisParts, parisToday } from '../../../lib/dates';
import { useNow } from '../../../lib/use-now';
import { useBirthdays, useCalendarCategories, useCalendarEvents, useCalendars, useScheduleSources, type EventOccurrence, type PersonBirthday } from '../../calendar/api';
import { useCalendarFilters, type CalendarFilterSection } from '../../calendar/hooks/use-calendar-filters';
import { useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { scheduleSources } from '../../calendar/lib/calendar-events';
import { useRoutineOccurrences, useRoutinesData, type Routine, type RoutineOccurrence } from '../../routines/api';
import type { RoutineMenuOccurrence } from '../../routines/hooks/use-routine-occurrence-menu';
import { isDone } from '../../routines/lib/routine-format';
import type { Task } from '../../tasks/api';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeEntriesSince } from '../../time/api';
import { useActiveWorkspace } from '../../workspaces/api';
import { useMyDaySettingsState, type MyDaySettingsChange } from '../api';

/** Time of the day of an occurrence of a routine, as the routines give it. */
type RoutineSlot = RoutineOccurrence['slots'][number];

/** An event of the day: one of its occurrences. */
export interface MyDayEvent extends MyDayItem {
  kind: 'event';
  occurrence: EventOccurrence;
}

/** A task of the day. */
export interface MyDayTask extends MyDayItem {
  kind: 'task';
  task: Task;
}

/** A time of the day of an occurrence of a routine. */
export interface MyDayRoutine extends MyDayItem {
  kind: 'routine';
  routine: Routine;
  /** Its occurrence (the day that identifies it, its due day, cancelled, archived, its times of the day). */
  occurrence: RoutineMenuOccurrence;
  slot: RoutineSlot;
  /** Not done, on a day already past (« non faite »). */
  missed: boolean;
}

/** An éphéméride of the day (of the workspace, or of a kind of another workspace it subscribes to). */
export interface MyDayEphemeris extends MyDayItem {
  kind: 'ephemeris';
  label: string;
  /** Colour of its kind; null: none. */
  color: string | null;
}

/** A birthday of the day. */
export interface MyDayBirthday extends MyDayItem {
  kind: 'birthday';
  birthday: PersonBirthday;
  /** « Anniversaire de … (n ans) ». */
  label: string;
}

/** What « Ma journée » lists. */
export type MyDayEntry = MyDayEvent | MyDayTask | MyDayRoutine | MyDayEphemeris | MyDayBirthday;

/** A slot of the day on the hours: its schedule, its name and colour. */
export interface MyDayHourSlot extends MyDaySlot {
  label: string;
  /** Colour of its kind; null: the working hours. */
  color: string | null;
}

/** The day of « Ma journée »: its blocks, read with the settings, and what its rows need. */
export interface MyDay {
  /** Blocks of the day (`myDayRows`); null while loading. */
  layout: MyDayLayout<MyDayEntry, MyDayHourSlot> | null;
  /** Settings of the page as shown (the defaults while loading, a change shown at once). */
  settings: MyDaySettings;
  /** The saved settings are loaded: they can be changed. */
  settingsReady: boolean;
  /** Changes the settings and saves them (`useMyDaySettingsState`). */
  changeSettings: (change: MyDaySettingsChange) => void;
  /** Sections of « Filtrer », one per kind of items the settings show (`useCalendarFilters`). */
  filterSections: CalendarFilterSection[];
  context: TaskContext | null;
  /** Today in Paris. */
  today: string;
  loading: boolean;
  /** One of the data of the day could not be loaded. */
  error: boolean;
}

/** Nothing loaded yet. */
const NONE: never[] = [];

/**
 * Event occurrences linked to an item, in the order of the day.
 * @param {readonly EventOccurrence[]} occurrences Occurrences of the day.
 * @param {(occurrence: EventOccurrence) => boolean} linked Whether an occurrence is linked to the item.
 * @returns {string[]} Keys.
 */
const linkedKeys = (occurrences: readonly EventOccurrence[], linked: (occurrence: EventOccurrence) => boolean): string[] => occurrences.filter(linked).map((occurrence) => occurrence.key);

/**
 * Time in Paris (HH:MM) of an instant; null: none.
 * @param {string | null | undefined} instant ISO instant.
 * @returns {string | null} Time.
 */
const parisTime = (instant: string | null | undefined): string | null => (instant ? parisParts(instant).time : null);

/**
 * Windows a time of the day of a routine is placed by: several when slots cut it (the next one, its others told with
 * it), none of its own otherwise (placed at its « dès », else its « jusqu’à »).
 * @param {RoutineSlot} slot Time of the day.
 * @returns {TimeWindow[] | null} Windows.
 */
function routineWindows(slot: RoutineSlot): TimeWindow[] | null {
  const windows = Array.isArray(slot.windows) ? (slot.windows as TimeWindow[]) : [];
  return windows.length > 1 ? windows : null;
}

/**
 * Everything « Ma journée » shows on a day, gathered from the data of the agenda, the routines and the tasks, filtered
 * by the settings of the page as the agenda filters a view (kinds shown, calendars and schedules left out, the filter
 * of each kind by `useCalendarFilters`; what comes from another workspace is not filtered) and placed in blocks
 * (`myDayRows`):
 * - tasks: those `taskDayReasons` gives a reason that day (their times of that day loaded on a past day, for « en
 *   cours »), placed by their windows (`itemWindowsOn`: their hours, their condition, the slots « Indisponible »);
 * - routines: each time of the day of an occurrence open that day (done: on the day it was done; on a past day, not
 *   done: « non faite »), cancelled on its due day, and today the late ones (their current occurrence past due); a
 *   parent routine through its sub-routines only, archived ones left out;
 * - event occurrences of the workspace (cancelled ones struck through, those over several days on each of their
 *   days), éphémérides and birthdays of the day;
 * - the slots of the hours: the créneaux of the workspace and of the kinds of other workspaces it subscribes to,
 *   neither archived nor left out by the settings.
 * Linked tasks and routines go under their event.
 * @param {string} day Day shown (YYYY-MM-DD).
 * @returns {MyDay} Day.
 */
export function useMyDay(day: string): MyDay {
  const now = useNow(true, 60_000);
  const today = parisToday();
  const past = day < today;
  const { context } = useTaskContext();
  const { query: storedSettings, ready: settingsReady, settings, change: changeSettings } = useMyDaySettingsState();
  const events = useCalendarEvents({ from: day, to: day });
  const routinesData = useRoutinesData();
  const occurrences = useRoutineOccurrences({ from: day, to: day, doneInPeriod: true });
  const { schedules, foreign, types, defaultKind } = useScheduleSources();
  const { data: birthdays } = useBirthdays();
  const { data: calendarsData } = useCalendars();
  const { data: categories } = useCalendarCategories();
  const { perso } = useActiveWorkspace();
  const { slotsOn } = useSlotRules();
  // Times of that day, for the tasks « en cours » a past day (today, their status is enough).
  const entries = useTimeEntriesSince(parisMidnight(day), past, parisMidnight(addDays(day, 1)));

  // The filter of each kind of items of the workspace, as in the agenda; no chronos in the day.
  const { sections: filterSections, kept } = useCalendarFilters(
    { ...settings, timers: false },
    {
      context: context ?? null,
      events: events.data ?? NONE,
      routines: routinesData.data?.routines ?? NONE,
      routineCategories: routinesData.data?.routineCategories ?? NONE,
      entries: undefined,
      schedules: schedules ?? NONE,
      calendars: calendarsData?.calendars ?? NONE,
      categories: categories ?? NONE,
      perso,
    },
  );

  const error = storedSettings.isError || events.isError || routinesData.isError || occurrences.isError || entries.isError;
  const loading =
    !context || storedSettings.isPending || events.isPending || events.isPlaceholderData || routinesData.isPending || occurrences.isPending || !schedules || !foreign || !types || !defaultKind || (past && entries.isPending);

  const layout = useMemo(() => {
    if (loading || !context || !schedules || !foreign || !types || !defaultKind) return null;
    const dayOccurrences = events.data ?? NONE;
    const items: MyDayEntry[] = [];
    const hiddenCalendars = new Set(settings.hiddenCalendarIds);
    const hiddenSchedules = new Set(settings.hiddenScheduleIds);
    // Events of the workspace, those over several days on each of their days: of a calendar shown, kept by the filter.
    for (const occurrence of dayOccurrences) {
      if (hiddenCalendars.has(occurrence.calendarId) || !kept.event(occurrence.key)) continue;
      items.push({
        kind: 'event',
        key: occurrence.key,
        occurrence,
        startDate: occurrence.startDate,
        endDate: occurrence.endDate,
        allDay: occurrence.allDay,
        time: { start: occurrence.startTime ?? null, end: occurrence.endTime ?? null },
        cancelled: occurrence.calledOff,
      });
    }
    // Éphémérides and the slots of the hours: neither archived nor of an archived kind; with « Créneaux et
    // éphémérides », each one shown, kept by the filter of its kind (those of another workspace are not filtered).
    const archivedKinds = archivedIds(types);
    const sources = scheduleSources(schedules, foreign, types, defaultKind).filter(({ rule }) => countedSchedules([{ ...rule, kindArchived: Boolean(rule.typeId && archivedKinds.has(rule.typeId)) }]).length);
    const slots: MyDayHourSlot[] = [];
    for (const { schedule, rule, color, label, ephemeris } of settings.schedules ? sources : NONE) {
      if (hiddenSchedules.has(schedule.id) || !kept.schedule(schedule.id)) continue;
      const planned = plannedSlots([rule], day, day);
      if (!planned.length) continue;
      if (ephemeris) {
        items.push({ kind: 'ephemeris', key: joinedKey('ephemeris', rule.id), label, color });
        continue;
      }
      slots.push(...planned.map((slot) => ({ scheduleId: slot.scheduleId, start: slot.start, end: slot.end, allDay: slot.allDay, unavailable: Boolean(rule.unavailable), label, color })));
    }
    // Birthdays of the people of the workspace (archived people left out), with « Créneaux et éphémérides ».
    if (settings.schedules) {
      for (const birthday of birthdays ?? NONE) {
        const birth = readBirthDate(birthday.birthDate);
        for (const { age } of birth ? birthdaysBetween(birth, day, day) : []) items.push({ kind: 'birthday', key: joinedKey('birthday', birthday.id), birthday, label: birthdayLabel(birthday.name, age) });
      }
    }
    // Routines: a parent through its sub-routines only; archived ones left out.
    const routines = unarchived(routinesData.data?.routines ?? NONE);
    const parents = new Set(routines.flatMap((routine) => (routine.parentId ? [routine.parentId] : [])));
    const routineById = mapById(routines);
    const routineKeys = new Set<string>();
    /**
     * Adds a time of the day of an occurrence of a routine, once.
     * @param {Routine} routine Routine.
     * @param {RoutineMenuOccurrence} occurrence Occurrence.
     * @param {RoutineSlot} slot Time of the day.
     * @param {boolean} late Late (today, its current occurrence past due).
     * @param {TimeWindow[] | null} [windows] Windows it is placed by. Optional. Default = those of the time of the day (`routineWindows`).
     * @returns {void}
     */
    const addRoutine = (routine: Routine, occurrence: RoutineMenuOccurrence, slot: RoutineSlot, late: boolean, windows: TimeWindow[] | null = routineWindows(slot)) => {
      const key = joinedKey(routine.id, occurrence.date, slot.index);
      const done = Boolean(slot.doneAt);
      if (routineKeys.has(key)) return;
      routineKeys.add(key);
      items.push({
        kind: 'routine',
        key,
        routine,
        occurrence,
        slot,
        // As the history of the routines: missed once its due day is past, an optional one skipped.
        missed: past && !done && !occurrence.cancelled && occurrence.dueDate < today && !slot.optional,
        time: { start: slot.fromTime ?? null, end: slot.dueTime ?? null },
        windows,
        late,
        done,
        doneAt: parisTime(slot.doneAt),
        cancelled: occurrence.cancelled,
        eventKeys: linkedKeys(dayOccurrences, (event) => event.routineLinks.some((link) => link.routineId === routine.id && link.date === occurrence.date)),
      });
    };
    /**
     * Whether a routine is shown: routines shown, not a parent (seen through its sub-routines), kept by the filter of
     * the routines (with all its occurrences).
     * @param {Routine} routine Routine.
     * @returns {boolean} Shown.
     */
    const routineShown = (routine: Routine) => settings.routines && !parents.has(routine.id) && kept.routine(routine.id);
    for (const occurrence of occurrences.data ?? NONE) {
      const routine = routineById.get(occurrence.routineId);
      if (!routine || !routineShown(routine) || occurrence.archived) continue;
      for (const slot of occurrence.slots) {
        // Cancelled: on its due day; else on each day it is open, once done on the day it was done.
        const shown = occurrence.cancelled ? occurrence.dueDate === day : inRoutineHistoryOn(occurrence, slot.doneAt ?? null, day);
        if (shown) addRoutine(routine, occurrence, slot, false);
      }
    }
    // Today, the late ones: the times of the day of their current occurrence, past due, neither done nor optional,
    // kept to the hours their condition and the slots « Indisponible » allow today (none: not in the day).
    if (day === today) {
      for (const routine of routines) {
        if (!routineShown(routine) || !routine.currentDate || !routine.currentDueDate || routine.currentDueDate >= today || isDone(routine)) continue;
        const occurrence: RoutineMenuOccurrence = { date: routine.currentDate, dueDate: routine.currentDueDate, cancelled: false, archived: false, slots: routine.slots };
        const allowed = itemWindowsOn(readSlotCondition(routine.slotCondition), slotsOn, today);
        for (const slot of routine.slots) {
          if (slot.done || slot.optional) continue;
          const windows = windowsAllowed({ fromTime: slot.fromTime ?? null, dueTime: slot.dueTime ?? null }, allowed);
          if (windows.length) addRoutine(routine, occurrence, slot, true, windows);
        }
      }
    }
    // Tasks: every task of the workspace with a reason that day, kept by the filter of the tasks.
    const times = entries.data ?? NONE;
    for (const task of settings.tasks ? context.tasks : NONE) {
      if (task.archived || !kept.task(task.id)) continue;
      const statusCategory = task.statusId ? ((context.statusById.get(task.statusId)?.category as TaskStatusCategory | undefined) ?? null) : null;
      const reasons = taskDayReasons(
        {
          startDate: task.startDate ?? null,
          endDate: task.endDate ?? null,
          effectiveDeadline: task.effectiveDeadline ?? null,
          effectiveMinDate: task.effectiveMinDate ?? null,
          statusCategory,
          closedAt: task.closed ? (task.closedAt ?? null) : null,
          cancelled: task.cancelled,
          times: past ? times.filter((entry) => entry.taskIds.includes(task.id)) : undefined,
        },
        day,
        today,
        now,
      );
      if (!reasons.length) continue;
      const done = reasons.includes('done');
      const cancelled = reasons.includes('cancelled');
      items.push({
        kind: 'task',
        key: joinedKey('task', task.id),
        task,
        windows: itemWindowsOn(readSlotCondition(task.slotCondition), slotsOn, day, readTaskHours(task.hours)),
        late: reasons.includes('late'),
        done,
        doneAt: done ? parisTime(task.closedAt) : null,
        cancelled,
        eventKeys: linkedKeys(dayOccurrences, (event) => event.taskIds.includes(task.id)),
      });
    }
    return myDayRows<MyDayEntry, MyDayHourSlot>(items, { day, now: new Date(now), slots });
  }, [loading, context, schedules, foreign, types, defaultKind, events.data, settings, kept, birthdays, routinesData.data, occurrences.data, entries.data, slotsOn, day, today, past, now]);

  return { layout, settings, settingsReady, changeSettings, filterSections, context: context ?? null, today, loading: loading && !error, error };
}
