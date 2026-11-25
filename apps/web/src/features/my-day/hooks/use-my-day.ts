import {
  addDays,
  birthdayLabel,
  birthdaysBetween,
  countedSchedules,
  foreignSlotKind,
  inRoutineHistoryOn,
  itemWindowsOn,
  joinedKey,
  mapById,
  myDayRows,
  myDayShows,
  myDayShowsSlot,
  plannedSlots,
  readBirthDate,
  readMyDaySettings,
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
import { useBirthdays, useCalendarEvents, useForeignScheduleKinds, useScheduleSources, type EventOccurrence, type PersonBirthday } from '../../calendar/api';
import { useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { scheduleSources } from '../../calendar/lib/calendar-events';
import { useRoutineOccurrences, useRoutinesData, type Routine, type RoutineOccurrence } from '../../routines/api';
import type { RoutineMenuOccurrence } from '../../routines/hooks/use-routine-occurrence-menu';
import { isDone } from '../../routines/lib/routine-format';
import type { Task } from '../../tasks/api';
import { useTaskContext, type TaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeEntriesSince } from '../../time/api';
import { useMyDaySettings } from '../api';

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
  /** Settings of the page, the ids of projects, slots and kinds deleted since left out. */
  settings: MyDaySettings;
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
 * by the settings of the page and placed in blocks (`myDayRows`):
 * - tasks: those `taskDayReasons` gives a reason that day (their times of that day loaded on a past day, for « en
 *   cours »), placed by their windows (`itemWindowsOn`: their hours, their condition, the slots « Indisponible »);
 * - routines: each time of the day of an occurrence open that day (done: on the day it was done; on a past day, not
 *   done: « non faite »), cancelled on its due day, and today the late ones (their current occurrence past due); a
 *   parent routine through its sub-routines only, archived ones left out;
 * - event occurrences of the workspace (cancelled ones struck through, those over several days on each of their
 *   days), éphémérides and birthdays of the day;
 * - the slots of the hours: the créneaux of the workspace and of the kinds of other workspaces it subscribes to,
 *   neither archived nor hidden by the settings.
 * Linked tasks and routines go under their event. « À moi / sans assigné » is not applied yet.
 * @param {string} day Day shown (YYYY-MM-DD).
 * @returns {MyDay} Day.
 */
export function useMyDay(day: string): MyDay {
  const now = useNow(true, 60_000);
  const today = parisToday();
  const past = day < today;
  const { context } = useTaskContext();
  const storedSettings = useMyDaySettings();
  const events = useCalendarEvents({ from: day, to: day });
  const routinesData = useRoutinesData();
  const occurrences = useRoutineOccurrences({ from: day, to: day, doneInPeriod: true });
  const { schedules, foreign, types, defaultKind } = useScheduleSources();
  const { data: foreignKinds } = useForeignScheduleKinds();
  const { data: birthdays } = useBirthdays();
  const { slotsOn } = useSlotRules();
  // Times of that day, for the tasks « en cours » a past day (today, their status is enough).
  const entries = useTimeEntriesSince(parisMidnight(day), past, parisMidnight(addDays(day, 1)));

  const settings = useMemo(
    () =>
      readMyDaySettings(storedSettings.data ?? null, {
        projectIds: context?.projects.map((project) => project.id),
        slotIds: schedules && foreign ? [...schedules, ...foreign].map((schedule) => schedule.id) : undefined,
        slotKinds: foreignKinds?.filter((kind) => kind.subscribed).map((kind) => foreignSlotKind(kind.workspaceId, kind.typeId)),
      }),
    [storedSettings.data, context, schedules, foreign, foreignKinds],
  );

  const error = storedSettings.isError || events.isError || routinesData.isError || occurrences.isError || entries.isError;
  const loading =
    !context || storedSettings.isPending || events.isPending || events.isPlaceholderData || routinesData.isPending || occurrences.isPending || !schedules || !foreign || !types || !defaultKind || (past && entries.isPending);

  const layout = useMemo(() => {
    if (loading || !context || !schedules || !foreign || !types || !defaultKind) return null;
    const dayOccurrences = events.data ?? NONE;
    const items: MyDayEntry[] = [];
    // Events of the workspace, those over several days on each of their days.
    for (const occurrence of dayOccurrences) {
      if (!myDayShows(settings, { kind: 'event', projectId: occurrence.projectId ?? null, cancelled: occurrence.calledOff })) continue;
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
    // Éphémérides and the slots of the hours: neither archived nor of an archived kind.
    const archivedKinds = archivedIds(types);
    const sources = scheduleSources(schedules, foreign, types, defaultKind).filter(({ rule }) => countedSchedules([{ ...rule, kindArchived: Boolean(rule.typeId && archivedKinds.has(rule.typeId)) }]).length);
    const slots: MyDayHourSlot[] = [];
    for (const { schedule, rule, color, label, foreign: subscribed, ephemeris } of sources) {
      const planned = plannedSlots([rule], day, day);
      if (!planned.length) continue;
      if (ephemeris) {
        if (myDayShows(settings, { kind: 'ephemeris' })) items.push({ kind: 'ephemeris', key: joinedKey('ephemeris', rule.id), label, color });
        continue;
      }
      const kind = subscribed && 'workspaceId' in schedule ? foreignSlotKind(schedule.workspaceId, schedule.typeId) : null;
      if (!myDayShowsSlot(settings, { scheduleId: rule.id, kind })) continue;
      slots.push(...planned.map((slot) => ({ scheduleId: slot.scheduleId, start: slot.start, end: slot.end, allDay: slot.allDay, unavailable: Boolean(rule.unavailable), label, color })));
    }
    // Birthdays of the people of the workspace (archived people left out).
    if (myDayShows(settings, { kind: 'birthday' })) {
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
      if (routineKeys.has(key) || !myDayShows(settings, { kind: 'routine', projectId: routine.projectId ?? null, done, cancelled: occurrence.cancelled })) return;
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
    for (const occurrence of occurrences.data ?? NONE) {
      const routine = routineById.get(occurrence.routineId);
      if (!routine || parents.has(routine.id) || occurrence.archived) continue;
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
        if (parents.has(routine.id) || !routine.currentDate || !routine.currentDueDate || routine.currentDueDate >= today || isDone(routine)) continue;
        const occurrence: RoutineMenuOccurrence = { date: routine.currentDate, dueDate: routine.currentDueDate, cancelled: false, archived: false, slots: routine.slots };
        const allowed = itemWindowsOn(readSlotCondition(routine.slotCondition), slotsOn, today);
        for (const slot of routine.slots) {
          if (slot.done || slot.optional) continue;
          const windows = windowsAllowed({ fromTime: slot.fromTime ?? null, dueTime: slot.dueTime ?? null }, allowed);
          if (windows.length) addRoutine(routine, occurrence, slot, true, windows);
        }
      }
    }
    // Tasks: every task of the workspace with a reason that day.
    const times = entries.data ?? NONE;
    for (const task of context.tasks) {
      if (task.archived) continue;
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
      if (!myDayShows(settings, { kind: 'task', projectId: task.projectId ?? null, done, cancelled })) continue;
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
  }, [loading, context, schedules, foreign, types, defaultKind, events.data, settings, birthdays, routinesData.data, occurrences.data, entries.data, slotsOn, day, today, past, now]);

  return { layout, settings, context: context ?? null, today, loading: loading && !error, error };
}
