import {
  addDays,
  caseSpans,
  caseStart,
  changedList,
  conditionConstrains,
  conditionWindows,
  daysBetween,
  dayIn,
  daySchema,
  formatDay,
  isUnderOrSelf,
  mapById,
  MAX_ROUTINE_MOVES,
  movedFrom,
  movedOccurrences,
  occurrenceDates,
  occurrencesBefore,
  opensReach,
  parseDay,
  reaches,
  readOpens,
  readSlotCondition,
  type Recurrence,
  type RoutineBulkChanges as SharedBulkChanges,
  type RoutineCase,
  routineCaseOn,
  routineCaseSchema,
  routineCaseSpans,
  type RoutineCategoryInput,
  routineCategorySchema,
  type RoutineInput,
  type RoutineInheritableField,
  type InheritingRoutine,
  emptyRoutineFields,
  effectiveRoutineTiming,
  inheritsTiming,
  OPENS_MISFIT,
  opensMisfits,
  ROUTINE_INHERITABLE_FIELDS,
  timingHeirs,
  marksInherited,
  type RoutineMove,
  routineMoveSchema,
  type RoutineMoveTimes,
  routineMoveTimesSchema,
  routineOpenDate,
  routineSchema,
  type RoutineSlot,
  routineSlotSchema,
  type SlotCondition,
  type SlotsOn,
  type TimeWindow,
  weekdayOf,
  windowsAllowed,
  withMove,
  withMovedTimes,
  joinedKey,
  normalizedReminders,
  REMINDER_LOOKAHEAD_DAYS,
  readReminders,
  readDeadTimes,
  storedDeadTimes,
  conditionKinds,
  conditionScheduleIds,
  foreignSlotKindWorkspace,
  conditionCitesBirthdays,
  type RemindedRoutineSlot,
  reminderKey,
  reminderKindOf,
  routineHasHours,
} from '@ordo/shared';
import { z } from 'zod';
import { deleteTreeItems, subtreeIds, topmostIds, treeListService } from '../core/trees';
import { releaseSubjectTime } from '../tasks/time-entries';
import { prisma, unscopedPrisma } from '../../db';
import { currentWorkspaceId, runInWorkspace } from '../../workspace-context';
import { assertBeneficiaries } from '../core/beneficiaries';
import { BY_POSITION, moveBefore, nextPositionIn } from '../core/ordering';
import { Prisma, type Routine, type RoutineCategory } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { storedRecurrence } from '../calendar/calendar-events';
import { assertConditionSchedules, loadSlotsOn, type ScheduleChange, type ScheduleEdit } from '../calendar/slot-conditions';
import type { PeopleChangeSettler } from '../calendar/birthdays';
import { assertProjectContributors, followProject } from '../projects/contributors';
import { PARIS, parisToday } from '../../today';
import { assertAllExist, findOrNotFound } from '../core/lookup';
import { archivedOn, archiveTree, assertActive, assertNoneArchived, assertNotArchived, refuseArchived, findActive } from '../core/archive';
import { connectIds, orderedPair } from '../core/relations';
import { loadProjectRootOf, outsideMovedTree } from '../projects/project-tree';
import { toJson } from '../core/json';
import { readLinks } from '../core/links';
import { storedLocation } from '../core/geo';
import { deleteGoneComments, placeLegacyComments, restoreComments, type CommentSnapshot } from '../core/comments';
import { assertLossConfirmed, lostOccurrences, remapOccurrenceRows, type LostOccurrences } from '../core/occurrence-rows';
import { changedRoutineInheritance, clearedRoutineInput, effectiveRoutineOf, freezeRoutineInheritance, loadRoutineInheritance, syncInheritedRoutineProjects, withOwnMoves, type StoredInheritingRoutine } from './routine-inheritance';

/**
 * Routine with what its occurrences are computed from; with its parent and inherited list, the fields of its « quand »
 * and its condition it inherits are those of the routine it goes by (`occurrenceTiming`).
 */
export type RoutineTiming = Pick<Routine, 'startDate' | 'recurrence' | 'cases' | 'moves' | 'fromTime' | 'dueTime' | 'scheduleIds' | 'excludedScheduleIds' | 'moments' | 'slotCondition'> &
  Partial<Pick<Routine, 'opensOn' | 'archivedAt' | 'id' | 'parentId' | 'inheritedFields'>>;

/** Calendar schedules of the workspace, for the routines following them or done out of them. */
export interface ScheduleContext {
  /** Slots of some schedules (by id or kind) on a day. */
  slotsOn: SlotsOn;
  /** What was computed for the routines of the request, by routine and computation. Optional. */
  memo?: Map<string, unknown>;
  /**
   * Occurrences with at least one time of the day ticked (`joinedKey(routine, due day)`): one its condition no longer
   * leaves any moment to is still there. Optional. Default = none.
   */
  checked?: ReadonlySet<string>;
  /**
   * Routines of the workspace by id, whose « quand » and condition the sub-routines inheriting them go by. Optional.
   * Default = each routine computed on its own columns.
   */
  routines?: ReadonlyMap<string, StoredInheritingRoutine>;
}

/** Without schedules: no slot anywhere. */
const NO_SCHEDULES: ScheduleContext = { slotsOn: () => [] };

/**
 * Occurrences ticked (at least one time of the day) of the routines whose occurrences depend on calendar schedules
 * (a condition, or cases): those stay even when their condition no longer leaves them any moment.
 * @returns {Promise<Set<string>>} `joinedKey(routine, due day)`.
 */
async function loadCheckedOccurrences(): Promise<Set<string>> {
  const checks = await prisma.routineCheck.findMany({
    where: {
      routine: {
        OR: [
          { slotCondition: { not: Prisma.DbNull } },
          { NOT: { cases: { equals: [] } } },
          { scheduleIds: { isEmpty: false } },
          { excludedScheduleIds: { isEmpty: false } },
          // Its condition or cases may be its parent's.
          { inheritedFields: { hasSome: ['SLOT_CONDITION', 'CASES'] } },
        ],
      },
    },
    distinct: ['routineId', 'date'],
    select: { routineId: true, date: true },
  });
  return new Set(checks.map((check) => joinedKey(check.routineId, formatDay(check.date))));
}

/**
 * Schedules of the current workspace, loaded once, the slots of each day computed when first asked, with the
 * occurrences ticked of the routines following them, and the routines whose « quand » sub-routines inherit.
 * @param {ScheduleChange} [change] The schedules of a workspace (this one or another one of the user) as a change
 * would leave them (to compare the occurrences before and after it). Optional. Default = as they are.
 * @returns {Promise<ScheduleContext>} Context.
 */
export async function loadScheduleContext(change?: ScheduleChange): Promise<ScheduleContext> {
  const [slotsOn, checked, routines] = await Promise.all([loadSlotsOn(undefined, change), loadCheckedOccurrences(), loadRoutineInheritance()]);
  return { memo: new Map(), slotsOn, checked, routines };
}

/**
 * Routine as its occurrences go (`effectiveRoutineTiming`): the fields of its « quand » and its condition it inherits
 * taken from the routine it goes by, among the routines of the context; itself when it inherits none of them.
 * @param {T} routine Routine (stored, or as a change would leave it).
 * @param {ScheduleContext} schedules Schedules, with the routines of the workspace.
 * @returns {T} Routine.
 */
export function occurrenceTiming<T extends RoutineTiming>(routine: T, schedules: ScheduleContext): T {
  return schedules.routines ? effectiveRoutineTiming(routine, schedules.routines) : routine;
}

/**
 * Condition on calendar schedules of a routine following its rule: its own, else the one of its former form (on one
 * of the schedules it followed, and out of those it was done out of); null: any time.
 * @param {Pick<RoutineTiming, 'slotCondition' | 'scheduleIds' | 'excludedScheduleIds'>} routine Routine.
 * @returns {SlotCondition | null} Condition.
 */
export function storedCondition(routine: Pick<RoutineTiming, 'slotCondition' | 'scheduleIds' | 'excludedScheduleIds'>): SlotCondition | null {
  const own = readSlotCondition(routine.slotCondition);
  if (own) return own;
  const children: SlotCondition['children'] = [
    ...(routine.scheduleIds.length ? [{ type: 'condition' as const, id: 'on', field: 'schedules' as const, operator: 'in', value: routine.scheduleIds }] : []),
    ...(routine.excludedScheduleIds.length ? [{ type: 'condition' as const, id: 'out', field: 'schedules' as const, operator: 'notIn', value: routine.excludedScheduleIds }] : []),
  ];
  return children.length ? { type: 'group', id: 'root', combinator: 'and', children } : null;
}

/**
 * Rule of a routine: its own; every day for one following schedules saved before conditions (their slots were its
 * days).
 * @param {Pick<RoutineTiming, 'recurrence' | 'scheduleIds' | 'slotCondition'>} routine Routine.
 * @returns {Recurrence | null} Rule.
 */
export function storedRule(routine: Pick<RoutineTiming, 'recurrence' | 'scheduleIds' | 'slotCondition'>): Recurrence | null {
  const rule = storedRecurrence(routine.recurrence);
  if (routine.scheduleIds.length && routine.slotCondition === null && rule) return { ...rule, frequency: 'DAILY', interval: 1, weekdays: [], duration: null };
  return rule;
}

/**
 * Whether a condition constrains the hours.
 * @param {SlotCondition | null | undefined} condition Condition.
 * @returns {boolean} Some.
 */
const constrains = (condition: SlotCondition | null | undefined) => conditionConstrains(condition);

/** Days looked at before and after a day to find the occurrences around it (a year and a little more). */
const LOOK_DAYS = 400;
/** Days looked at first (enough for the daily and weekly rules): the longer look only when they hold none. */
const NEAR_DAYS = 35;

/** What was computed for a routine, by its schedules (a request loads them once): its occurrences, times… */
const memo = new WeakMap<object, WeakMap<ScheduleContext, Map<string, unknown>>>();

/**
 * Result computed once for a routine row and its schedules (the fields of a routine in a request ask the same).
 * @template T
 * @param {object} routine Routine row.
 * @param {ScheduleContext} schedules Schedules.
 * @param {string} key What is computed, with its arguments.
 * @param {() => T} run Computation.
 * @returns {T} Result.
 */
function remember<T>(routine: object, schedules: ScheduleContext, key: string, run: () => T): T {
  // In a request: by routine id (its fields may get rows of their own).
  const id = (routine as { id?: unknown }).id;
  if (schedules.memo && typeof id === 'string') {
    const own = joinedKey(id, key);
    if (!schedules.memo.has(own)) schedules.memo.set(own, run());
    return schedules.memo.get(own) as T;
  }
  let bySchedules = memo.get(routine);
  if (!bySchedules) memo.set(routine, (bySchedules = new WeakMap()));
  let results = bySchedules.get(schedules);
  if (!results) bySchedules.set(schedules, (results = new Map()));
  if (!results.has(key)) results.set(key, run());
  return results.get(key) as T;
}

/** Time of the day of an occurrence, with the windows it can be done in (one, or several where slots cut it). */
interface RoutineDaySlot extends RoutineSlot {
  windows: TimeWindow[];
}

/** Occurrence of a routine: from its first day to its due (last) day. */
interface RoutineSpan {
  start: string;
  end: string;
}

/**
 * Stored cases of a routine (invalid ones left out).
 * @param {unknown} value Stored JSON.
 * @returns {RoutineCase[]} Cases.
 */
export function storedCases(value: unknown): RoutineCase[] {
  const parsed = z.array(routineCaseSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Times of the day of a routine following its rule: its moments, else its former window.
 * @param {RoutineTiming} routine Routine.
 * @returns {RoutineSlot[]} Moments.
 */
export function storedMoments(routine: RoutineTiming): RoutineSlot[] {
  const parsed = z.array(routineSlotSchema).safeParse(routine.moments);
  if (parsed.success && parsed.data.length) return parsed.data;
  return [{ fromTime: routine.fromTime, dueTime: routine.dueTime, optional: false }];
}

/**
 * Stored exceptions of a routine (invalid ones left out).
 * @param {unknown} value Stored JSON.
 * @returns {RoutineMove[]} Occurrences moved.
 */
export function storedMoves(value: unknown): RoutineMove[] {
  const parsed = z.array(routineMoveSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Times of the day of an occurrence of a routine on one of its days: those of its rule (or of its case), kept to the
 * hours its condition on calendar schedules allows that day (several windows where slots cut them).
 * @param {RoutineTiming} routine Routine.
 * @param {string} due Due day of the occurrence (its case).
 * @param {string} day Day.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {RoutineDaySlot[]} Times (none: not doable that day).
 */
function dayMoments(routine: RoutineTiming, due: string, day: string, schedules: ScheduleContext): RoutineDaySlot[] {
  const cases = storedCases(routine.cases);
  const item = cases.length ? routineCaseOn(cases, formatDay(routine.startDate), due) : null;
  const base = cases.length ? (item?.slots ?? []) : storedMoments(routine);
  const condition = cases.length ? (item?.condition ?? null) : storedCondition(routine);
  const allowed = constrains(condition) ? conditionWindows(condition, (query) => schedules.slotsOn(query, day)) : null;
  return base.flatMap((moment) => {
    const windows = windowsAllowed(moment, allowed);
    return windows.length ? [{ ...moment, fromTime: windows[0].fromTime, dueTime: windows.at(-1)!.dueTime, windows }] : [];
  });
}

/**
 * Whether an occurrence has a time of the day on one of its days.
 * @param {RoutineTiming} routine Routine.
 * @param {RoutineSpan} span Occurrence.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {boolean} Doable.
 */
function doable(routine: RoutineTiming, span: RoutineSpan, schedules: ScheduleContext): boolean {
  const cases = storedCases(routine.cases);
  if (cases.length ? !cases.some((item) => constrains(item.condition)) : !constrains(storedCondition(routine))) return true;
  for (let day = span.start; day <= span.end; day = addDays(day, 1)) if (dayMoments(routine, span.end, day, schedules).length) return true;
  return false;
}

/**
 * Occurrences of the rule, cases or schedules of a routine (its exceptions aside) overlapping a period, the doable
 * ones: each from its first day (its « Ouverture ») to its due day.
 * @param {RoutineTiming} routine Routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {RoutineSpan[]} Occurrences, by due day.
 */
function ruleSpans(routine: RoutineTiming, from: string, to: string, schedules: ScheduleContext): RoutineSpan[] {
  const start = formatDay(routine.startDate);
  const first = from < start ? start : from;
  if (first > to) return [];
  const spans = new Map<string, RoutineSpan>();
  const cases = storedCases(routine.cases);
  const rule = cases.length ? null : storedRule(routine);
  // Its cases, else its rule: each with its « Ouverture ».
  const sources = cases.length
    ? cases.map((item) => ({ frequency: item.recurrence.frequency, opens: item.opens, spans: (last: string) => routineCaseSpans(item, start, first, last) }))
    : rule
      ? [{ frequency: rule.frequency, opens: readOpens(routine.opensOn), spans: (last: string) => caseSpans({ since: null, until: null, anchor: null, rule, times: null }, start, first, last) }]
      : [];
  for (const { frequency, opens, spans: spansTo } of sources) {
    // An occurrence opening (« Ouverture ») within the period may be due after it.
    for (const span of spansTo(addDays(to, opensReach(opens)))) {
      const opened = routineOpenDate(span.end, opens, frequency);
      const open = opened < span.start ? opened : span.start;
      // A day due in several cases follows the first one.
      if (open <= to && span.end >= first && !spans.has(span.end)) spans.set(span.end, { start: open < start ? start : open, end: span.end });
    }
  }
  // One its condition leaves no moment to is not scheduled, unless already done (a time of the day ticked).
  const ticked = (span: RoutineSpan) => routine.id !== undefined && Boolean(schedules.checked?.has(joinedKey(routine.id, span.end)));
  return [...spans.values()].filter((span) => doable(routine, span, schedules) || ticked(span)).sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * Current and next occurrences of a routine today (by due day): the current one is the last started on or before
 * today, the next one the first starting after; then its exceptions (occurrences moved to another day or deleted).
 * @param {RoutineTiming} routine Routine.
 * @param {string} [today] Today. Optional. Default = today in Paris.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {{ current: string | null, next: string | null }} Due days.
 */
export function occurrencesOf(given: RoutineTiming, today = parisToday(), schedules: ScheduleContext = NO_SCHEDULES): { current: string | null; next: string | null } {
  // An archived routine has nothing due: nothing computed.
  if (given.archivedAt) return { current: null, next: null };
  const routine = occurrenceTiming(given, schedules);
  return remember(routine, schedules, `occurrences|${today}`, () => {
    const start = formatDay(routine.startDate);
    /**
     * Occurrences of the rule alone around a day: looked for close to it first, further when none is there.
     * @param {string} day Day.
     * @returns {{ current: string | null, next: string | null }} Due days.
     */
    const compute = (day: string) => {
      const around = (days: number) => {
        const spans = ruleSpans(routine, addDays(day, -days), addDays(day, days), schedules);
        return { current: spans.filter((span) => span.start <= day).at(-1)?.end ?? null, next: spans.find((span) => span.start > day)?.end ?? null };
      };
      let found = around(NEAR_DAYS);
      // None close (a monthly or yearly rule, a pause…), unless the routine starts within those days: further.
      if (found.next === null || (found.current === null && start < addDays(day, -NEAR_DAYS))) found = around(LOOK_DAYS);
      // Once the rule has ended, a past last occurrence is no longer due.
      if (found.next === null && found.current !== null && found.current < day) found = { ...found, current: null };
      return found;
    };
    return movedOccurrences(compute, storedMoves(routine.moves), today);
  });
}

/**
 * Occurrences of a routine overlapping a period (both days included), by due day: those of its rule, cases or
 * schedules, without those moved away or cancelled (unless asked: then flagged), with those moved in (a day long). An
 * archived routine keeps those started (opened) before the day it was archived, even due after it; none starting on
 * or after it.
 * @param {RoutineTiming} routine Routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @param {boolean} [withCancelled] The occurrences cancelled are kept, flagged (shown struck through). Optional. Default = left out.
 * @returns {(RoutineSpan & { cancelled?: boolean })[]} Occurrences, by due day.
 */
export function occurrenceSpansBetween(
  given: RoutineTiming,
  from: string,
  to: string,
  schedules: ScheduleContext = NO_SCHEDULES,
  withCancelled = false,
): (RoutineSpan & { cancelled?: boolean })[] {
  const routine = occurrenceTiming(given, schedules);
  const archived = archivedOn(routine);
  const last = archived && archived <= to ? addDays(archived, -1) : to;
  if (last < from) return [];
  const spans = new Map<string, RoutineSpan & { cancelled?: boolean }>(ruleSpans(routine, from, last, schedules).map((span) => [span.end, span]));
  for (const move of storedMoves(routine.moves)) {
    const span = spans.get(move.from);
    spans.delete(move.from);
    if (move.to && move.to >= from && move.to <= last) spans.set(move.to, { start: move.to, end: move.to });
    else if (!move.to && withCancelled && span) spans.set(move.from, { ...span, cancelled: true });
  }
  // Archived: those started (opened) before the day it was archived stay, even due after it.
  return [...spans.values()].filter((span) => !archived || span.start < archived).sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * Due days of the occurrences of a routine overlapping a period (both days included).
 * @param {RoutineTiming} routine Routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {string[]} Days, in order.
 */
export function occurrencesBetween(routine: RoutineTiming, from: string, to: string, schedules: ScheduleContext = NO_SCHEDULES): string[] {
  return occurrenceSpansBetween(routine, from, to, schedules).map((span) => span.end);
}

/**
 * Day an occurrence shows on: its due day once past, today while it runs, its first day before.
 * @param {RoutineSpan} span Occurrence.
 * @param {string} today Today.
 * @returns {string} Day.
 */
export const shownDay = (span: RoutineSpan, today: string) => (span.end < today ? span.end : span.start <= today ? today : span.start);

/**
 * First occurrence of a routine (looked for over ten years from its start; moves included), by due day.
 * @param {RoutineTiming} routine Routine.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {string | null} Day, null without any.
 */
export function firstOccurrence(given: RoutineTiming, schedules: ScheduleContext = NO_SCHEDULES): string | null {
  const routine = occurrenceTiming(given, schedules);
  return remember(routine, schedules, 'first', () => firstOccurrenceOf(routine, schedules));
}

/**
 * First occurrence of a routine: within its first days, else year by year (over ten years).
 * @param {RoutineTiming} routine Routine with its schedule.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {string | null} Day, null without any.
 */
function firstOccurrenceOf(routine: RoutineTiming, schedules: ScheduleContext): string | null {
  let from = formatDay(routine.startDate);
  const [soon] = occurrencesBetween(routine, from, addDays(from, NEAR_DAYS), schedules);
  if (soon) return soon;
  for (let year = 0; year < 10; year += 1) {
    const to = addDays(from, 365);
    const [first] = occurrencesBetween(routine, from, to, schedules);
    if (first) return first;
    from = addDays(to, 1);
  }
  return null;
}

/**
 * Last occurrence of a routine due on or before a day (looked for year by year, over ten years back; moves included).
 * @param {RoutineTiming} routine Routine.
 * @param {string} day Day.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {string | null} Day, null without any.
 */
export function lastOccurrenceBefore(given: RoutineTiming, day: string, schedules: ScheduleContext = NO_SCHEDULES): string | null {
  const routine = occurrenceTiming(given, schedules);
  const start = formatDay(routine.startDate);
  let to = day;
  for (let year = 0; year < 10 && to >= start; year += 1) {
    const from = addDays(to, -365);
    const last = occurrencesBetween(routine, from, to, schedules).filter((due) => due <= day).at(-1);
    if (last) return last;
    to = addDays(from, -1);
  }
  return null;
}

/**
 * Times of the day of a routine on an occurrence (by due day of its rule), on the day it shows (today while it
 * runs; else its first doable day).
 * @param {RoutineTiming} routine Routine.
 * @param {string} due Due day of the occurrence.
 * @param {ScheduleContext} schedules Schedules.
 * @param {string} today Today.
 * @returns {RoutineDaySlot[]} Times (none: not on that day).
 */
function ruleSlotsOn(routine: RoutineTiming, due: string, schedules: ScheduleContext, today = parisToday()): RoutineDaySlot[] {
  const span = ruleSpans(routine, due, due, schedules).find((item) => item.end === due) ?? { start: due, end: due };
  const preferred = shownDay(span, today);
  const own = dayMoments(routine, due, preferred, schedules);
  if (own.length) return own;
  for (let day = span.start; day <= span.end; day = addDays(day, 1)) {
    const moments = dayMoments(routine, due, day, schedules);
    if (moments.length) return moments;
  }
  return [];
}

/**
 * Times of the day of a routine on an occurrence: those of its rule on its own due day (a moved occurrence keeps
 * them, on the day it goes to), with those its exception changes.
 * @param {RoutineTiming} routine Routine.
 * @param {string | null} occurrence Due day of the occurrence.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {RoutineDaySlot[]} Times (none: not on that day).
 */
export function slotsOf(given: RoutineTiming, occurrence: string | null, schedules: ScheduleContext = NO_SCHEDULES): RoutineDaySlot[] {
  if (!occurrence) return [];
  const routine = occurrenceTiming(given, schedules);
  return remember(routine, schedules, `slots|${occurrence}`, () => slotsOn(routine, occurrence, schedules));
}

/** Occurrence of a routine its reminders ring for. */
export interface RoutineReminderOccurrence {
  /** Due day of the occurrence. */
  date: string;
  /** Its first day (« Ouverture »): the day of its reminders « À HH:MM ». */
  day: string;
  /**
   * Its times of the day not ticked, with their hours (« dès », « jusqu'à »): the shared `routineSlotAnchors` gives the
   * moments their reminders « N min avant » count from.
   */
  slots: RemindedRoutineSlot[];
}

/**
 * Occurrences the reminders of a routine ring for: its current one while not done and its next one (a reminder up to 24
 * hours before may ring before it opens), each with its first day (« Ouverture ») and its times of the day not ticked,
 * with their hours (a time without any hour too: from 00:00 to midnight).
 * With reminders « N jours avant » (`ahead` days at most), also the later occurrences that open within those days.
 * An archived routine has none (no occurrence).
 * @param {RoutineTiming & { checks: { date: Date, slot: number }[] }} routine Routine with its latest checks.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @param {number} [ahead] Most days before of its reminders « N jours avant ». Optional. Default = 0.
 * @returns {RoutineReminderOccurrence[]} Occurrences.
 */
export function reminderOccurrences(routine: RoutineTiming & { checks: { date: Date; slot: number }[] }, schedules: ScheduleContext = NO_SCHEDULES, ahead = 0): RoutineReminderOccurrence[] {
  const { current, next } = occurrencesOf(routine, undefined, schedules);
  const today = parisToday();
  const last = addDays(today, ahead);
  // Later occurrences opening within the days of the reminders « N jours avant ».
  const later =
    ahead > 0 && next
      ? occurrenceSpansBetween(routine, addDays(next, 1), addDays(last, REMINDER_LOOKAHEAD_DAYS), schedules)
          .filter((span) => span.start <= last)
          .map((span) => span.end)
      : [];
  return [current, next, ...later].flatMap((due) => {
    if (!due) return [];
    const ticked = new Set(due === current ? routine.checks.filter((check) => formatDay(check.date) === due).map((check) => check.slot) : []);
    const slots = slotsOf(routine, due, schedules);
    // A done occurrence (every required time ticked) rings no more.
    if (slots.every((slot, index) => ticked.has(index) || slot.optional)) return [];
    const day = occurrenceSpansBetween(routine, due, due, schedules).find((span) => span.end === due)?.start ?? due;
    return [{ date: due, day, slots: slots.flatMap((slot, index) => (ticked.has(index) ? [] : [{ slot: index, fromTime: slot.fromTime, dueTime: slot.dueTime }])) }];
  });
}

/**
 * Times of the day of a routine on an occurrence, computed.
 * @param {RoutineTiming} routine Routine.
 * @param {string} occurrence Due day of the occurrence.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {RoutineDaySlot[]} Times.
 */
function slotsOn(routine: RoutineTiming, occurrence: string, schedules: ScheduleContext): RoutineDaySlot[] {
  const moves = storedMoves(routine.moves);
  const date = movedFrom(moves, occurrence);
  const move = moves.find((item) => item.from === date && item.to === occurrence);
  const base = date === occurrence ? ruleSlotsOn(routine, date, schedules) : dayMoments(routine, date, occurrence, schedules);
  return withMovedTimes(base, move?.times ?? null).map((slot, index) =>
    slot.fromTime === base[index]?.fromTime && slot.dueTime === base[index]?.dueTime ? slot : { ...slot, windows: [{ fromTime: slot.fromTime, dueTime: slot.dueTime }] },
  );
}

// Categories ------------------------------------------------------------------------------------------------------

/** Categories of the routines, in a tree; a deleted one's sub-categories go one level up, its routines lose it. */
const categories = treeListService<RoutineCategory, RoutineCategoryInput, RoutineCategoryInput>(
  'routineCategory',
  { notFound: 'Catégorie', missingParent: 'Catégorie parente', loop: 'Une catégorie ne peut pas être rangée sous elle-même.' },
  {
    parse: (input) => parseInput(routineCategorySchema, input),
    moveInput: (category, parentId) => ({ label: category.label, color: category.color, parentId }),
  },
);

/**
 * A category: created last among its siblings, updated (under another parent, it goes last), moved under another one
 * or to the top level at an index (last when omitted), deleted (its routines lose it, its sub-categories go one level up).
 */
export const { create: createCategory, update: updateCategory, move: moveCategory, remove: deleteCategory } = categories;

// Routines --------------------------------------------------------------------------------------------------------

/**
 * Routines related to a routine (« Relative à », both ways).
 * @param {{ relationsA: { routineBId: string }[], relationsB: { routineAId: string }[] }} routine Routine with its relations.
 * @returns {string[]} Ids.
 */
const relatedOf = (routine: { relationsA: { routineBId: string }[]; relationsB: { routineAId: string }[] }) => [
  ...routine.relationsA.map((relation) => relation.routineBId),
  ...routine.relationsB.map((relation) => relation.routineAId),
];

/** Relations of a routine, as loaded for `relatedOf`. */
const RELATIONS = { relationsA: { select: { routineBId: true } }, relationsB: { select: { routineAId: true } } } as const;

/**
 * Keeps the links of a routine (required or related routines) inside its project tree, as those of a task: a link newly
 * given to a routine of another tree is refused; one it had already stays while its tree does not change, and is
 * dropped when it moves to another tree (as a task transferred).
 * @param {string[]} ids Routines linked.
 * @param {readonly string[]} previous Those it had (an undo: all those given).
 * @param {boolean} moved Its project tree changes.
 * @param {(id: string) => boolean} outside Whether a routine is out of its new tree.
 * @param {string} field Field of the error.
 * @param {boolean} withProject It has a project (for the message).
 * @returns {string[]} Links kept.
 */
function keptInTree(ids: string[], previous: readonly string[], moved: boolean, outside: (id: string) => boolean, field: string, withProject: boolean): string[] {
  if (ids.some((other) => outside(other) && !previous.includes(other))) {
    throw fieldError(field, withProject ? 'Les routines liées doivent appartenir au même projet ou à l’un de ses sous-projets.' : 'Une routine sans projet ne se lie qu’à des routines sans projet.');
  }
  return moved ? ids.filter((other) => !outside(other)) : ids;
}

/** How a routine is saved, beyond its input. */
export interface RoutineSaveOptions {
  /** Undo giving back former values: archived ones accepted (only that check is skipped). Optional. Default = false. */
  restoring?: boolean;
  /**
   * Routines moved to its new project along with it (a selection changed at once): counted in that project, so the
   * links with them stay, as in a transfer of tasks. Optional. Default = none.
   */
  movedWith?: readonly string[];
  /**
   * Occurrences its new rule makes disappear, with comments, confirmed (`settleLostOccurrences`): false
   * refuses while some would be lost, true deletes those comments. Optional. Default = not checked (internal changes).
   */
  confirmLoss?: boolean;
  /**
   * Routine a new one is a copy of: the former links of that routine out of the project tree of the copy (kept by it
   * until it moves) are left out of the copy instead of refused. Optional. Default = not a copy.
   */
  copyOf?: string | null;
}

/** Id given to a routine not created yet, to compute what it inherits. */
const UNSAVED_ID = 'unsaved';

/**
 * Timing of a routine as an input gives it (`timingOf`): its parent and inherited list those of the input.
 * @param {ReturnType<typeof routineSchema.parse>} data Routine (validated input).
 * @param {string} [id] Routine edited. Optional. Default = a routine not created yet.
 * @returns {RoutineTiming & { id: string }} Timing.
 */
function timingFromInput(data: ReturnType<typeof routineSchema.parse>, id?: string): RoutineTiming & { id: string } {
  return { ...timingOf({ moves: [] } as unknown as Routine, data), id: id ?? UNSAVED_ID };
}

/**
 * Conditions on calendar schedules of a routine: that of its rule and those of its cases.
 * @param {Pick<RoutineTiming, 'slotCondition' | 'scheduleIds' | 'excludedScheduleIds' | 'cases'>} routine Routine.
 * @returns {(SlotCondition | null)[]} Conditions.
 */
const conditionsOf = (routine: Pick<RoutineTiming, 'slotCondition' | 'scheduleIds' | 'excludedScheduleIds' | 'cases'>) => [
  storedCondition(routine),
  ...storedCases(routine.cases).map((item) => item.condition),
];

/**
 * Whether the « Ouverture » of the rule of a routine does not fit the repetition it has (`opensMisfits`).
 * @param {RoutineTiming} routine Routine.
 * @returns {boolean} It does not fit.
 */
const opensMisfitOf = (routine: RoutineTiming) => opensMisfits({ opensOn: readOpens(routine.opensOn), cases: storedCases(routine.cases), recurrence: storedRule(routine) });

/** Refusal of a reminder « avant » of a routine without any hour. */
const HOURLESS_REMINDERS = 'Sans heure « dès » ni « jusqu’à » (ni créneau), une routine n’a que des rappels à une heure : le jour J ou quelques jours avant.';

/**
 * Validates a routine and what it points to: category, parent (not itself nor one of its sub-routines), project,
 * assignees, required routines (no cycle) and related ones (both in its project tree).
 * @param {RoutineInput} input Routine.
 * @param {string} [id] Routine edited. Optional.
 * @param {RoutineSaveOptions} [options] Undo, routines moved along, routine copied. Optional.
 * @returns {Promise<ReturnType<typeof routineSchema.parse> & { droppedLinks: number }>} Routine, with the links it loses
 * moving to another project tree.
 */
async function parseRoutine(input: RoutineInput, id?: string, { restoring = false, movedWith = [], copyOf = null }: RoutineSaveOptions = {}) {
  const data = parseInput(routineSchema, input);
  data.assigneeIds = [...new Set(data.assigneeIds)];
  data.beneficiaryIds = [...new Set(data.beneficiaryIds)];
  data.beneficiaryRelationIds = [...new Set(data.beneficiaryRelationIds)];
  data.categoryIds = [...new Set(data.categoryIds)];
  data.requiredIds = [...new Set(data.requiredIds)];
  data.relatedIds = [...new Set(data.relatedIds)];
  await assertAllExist(prisma.routineCategory, data.categoryIds, 'Catégorie', { field: 'categoryIds' });
  // The former schedules (sent by former clients) become its condition; its cases have theirs.
  if (!data.slotCondition) data.slotCondition = storedCondition({ slotCondition: null, scheduleIds: data.scheduleIds, excludedScheduleIds: data.excludedScheduleIds });
  // Archived categories and schedules: no longer chosen, those already there stay.
  const current = id
    ? await prisma.routine.findUnique({
        where: { id },
        select: {
          categories: { select: { id: true } },
          slotCondition: true,
          cases: true,
          scheduleIds: true,
          excludedScheduleIds: true,
          parentId: true,
          projectId: true,
          assignees: { select: { id: true } },
          beneficiaries: { select: { id: true } },
          beneficiaryRelations: { select: { id: true } },
          requires: { select: { requiredId: true } },
          reminders: true,
          inheritedFields: true,
          ...RELATIONS,
        },
      })
    : null;
  // Fields it inherits: those given, else those it had; none without parent. Its project inherited is
  // stored too: that of its parent.
  // A copy under the same parent inherits what its routine inherits (every field copied).
  const copied = copyOf && !data.inheritedFields ? await prisma.routine.findUnique({ where: { id: copyOf }, select: { parentId: true, inheritedFields: true } }) : null;
  const kept = current?.parentId ? current.inheritedFields : copied && copied.parentId === data.parentId ? copied.inheritedFields : [];
  const inheritedFields = data.parentId ? (data.inheritedFields ?? (kept as RoutineInheritableField[])) : [];
  data.inheritedFields = inheritedFields;
  const inherits = (field: RoutineInheritableField) => inheritedFields.includes(field);
  if (data.parentId && inherits('PROJECT')) data.projectId = (await orNotFound(prisma.routine.findUnique({ where: { id: data.parentId }, select: { projectId: true } }), 'Routine parente', 'parentId')).projectId;
  // Its « quand » and its condition checked as they go: those it inherits are those of the routine it goes by, before
  // the change as after it.
  const routines =
    inheritsTiming({ id: id ?? UNSAVED_ID, parentId: data.parentId, inheritedFields }) || (id && current && inheritsTiming({ id, ...current })) ? await loadRoutineInheritance() : null;
  const next = routines ? effectiveRoutineTiming(timingFromInput(data, id), routines) : timingFromInput(data, id);
  const stored = id ? routines?.get(id) : undefined;
  const wasTiming = stored && routines ? effectiveRoutineTiming(stored, routines) : null;
  const was = wasTiming ?? current;
  const rule = storedRule(next);
  if (rule?.until && rule.until < formatDay(next.startDate)) throw fieldError('recurrence', 'La fin de la répétition doit suivre la date de début.');
  // Its own « Ouverture » fits the repetition it goes by (an inherited one, its parent's, is checked there); one that no
  // longer fits after a change of its parent stays.
  if (routines && !inherits('OPENS_ON') && opensMisfitOf(next) && !(wasTiming && opensMisfitOf(wasTiming))) throw fieldError('opensOn', OPENS_MISFIT);
  // Undo: everything counts as kept.
  const keptCategoryIds = restoring ? data.categoryIds : (current?.categories.map((category) => category.id) ?? []);
  await assertNoneArchived('routineCategory', data.categoryIds, { keep: keptCategoryIds, field: 'categoryIds' });
  // Only the conditions it sets itself: one it inherits is its parent's, already checked there (restoring the inheritance
  // of a condition that cites an archived créneau chooses nothing).
  const ownConditions = conditionsOf({
    ...next,
    ...(inherits('SLOT_CONDITION') && { slotCondition: null, scheduleIds: [], excludedScheduleIds: [] }),
    ...(inherits('CASES') && { cases: [] }),
  });
  await assertConditionSchedules(ownConditions, restoring || (was ? conditionsOf(was) : []));
  // A window alone (former clients, imports): its single moment.
  if (!data.moments.length && !data.cases.length && (data.fromTime || data.dueTime)) data.moments = [{ fromTime: data.fromTime, dueTime: data.dueTime, optional: false }];
  // With cases, their days, times and conditions; else its rule, moments and condition. The former fields are dropped.
  if (data.cases.length) Object.assign(data, { moments: [], slotCondition: null });
  Object.assign(data, {
    scheduleIds: [],
    excludedScheduleIds: [],
    scheduleId: null,
    scheduleAnchor: null,
    fromTime: data.moments[0]?.fromTime ?? null,
    dueTime: data.moments[0]?.dueTime ?? null,
  });
  await assertActive(prisma.project, data.projectId, 'Projet', { keep: restoring ? data.projectId : current?.projectId, field: 'projectId', missingField: 'projectId' });
  await assertAllExist(prisma.contributor, data.assigneeIds, 'Assigné', { field: 'assigneeIds' });
  // Archived beneficiaries, parent and required routines: no longer chosen, those already there stay.
  await assertBeneficiaries(
    { contributorIds: data.beneficiaryIds, relationIds: data.beneficiaryRelationIds },
    { keep: restoring ? 'all' : { contributorIds: current?.beneficiaries.map((beneficiary) => beneficiary.id), relationIds: current?.beneficiaryRelations.map((relation) => relation.id) } },
  );
  if (!restoring) await assertNotArchived('routine', data.parentId, { keep: current?.parentId, field: 'parentId' });
  const keptRequiredIds = restoring ? data.requiredIds : (current?.requires.map((dependency) => dependency.requiredId) ?? []);
  await assertNoneArchived('routine', data.requiredIds, { keep: keptRequiredIds, field: 'requiredIds' });
  const keptRelatedIds = restoring ? data.relatedIds : current ? relatedOf(current) : [];
  await assertNoneArchived('routine', data.relatedIds, { keep: keptRelatedIds, field: 'relatedIds' });
  // Of a project: its contributors only (those already assigned stay).
  const assigned = current?.assignees.map((assignee) => assignee.id) ?? [];
  // Inherited, they are its parent's (its own, unused, are not checked).
  if (!inherits('ASSIGNEES')) await assertProjectContributors(data.projectId ?? null, data.assigneeIds, assigned, 'assigneeIds', restoring);

  const all = await prisma.routine.findMany({ select: { id: true, parentId: true, projectId: true, requires: { select: { requiredId: true } } } });
  const known = new Set(all.map((routine) => routine.id));
  if (data.parentId) {
    if (!known.has(data.parentId)) throw notFound('Routine parente', 'parentId');
    if (id && isUnderOrSelf(new Map(all.map((routine) => [routine.id, routine.parentId])), data.parentId, id)) {
      throw fieldError('parentId', 'Une routine ne peut pas être rangée sous elle-même.');
    }
  }
  if (data.requiredIds.some((requiredId) => !known.has(requiredId))) throw notFound('Routine', 'requiredIds');
  if (id && data.requiredIds.includes(id)) throw fieldError('requiredIds', 'Une routine ne peut pas dépendre d’elle-même.');
  if (id && data.requiredIds.length) {
    // No cycle: none of the required routines may (indirectly) require this one.
    const requires = new Map(all.map((routine) => [routine.id, routine.requires.map((dependency) => dependency.requiredId)]));
    if (reaches((current) => requires.get(current) ?? [], data.requiredIds, id)) throw fieldError('requiredIds', 'Ces dépendances forment une boucle.');
  }
  if (data.relatedIds.some((relatedId) => !known.has(relatedId))) throw notFound('Routine', 'relatedIds');
  if (id && data.relatedIds.includes(id)) throw fieldError('relatedIds', 'Une routine ne peut pas être liée à elle-même.');
  // Links inside its project tree (none: with the routines of no project), those moved along counted in it.
  const rootOf = await loadProjectRootOf();
  const outsideSet = outsideMovedTree(rootOf, all, movedWith, data.projectId ?? null);
  const outside = (other: string) => outsideSet.has(other);
  // A copy leaves out the former links of its routine out of its tree, as a routine moved loses its own.
  const source = copyOf ? await inputOf(copyOf) : null;
  // Without any hour, no reminder « avant »: those it already had (or its copy) stay stored, never rung.
  if (!restoring && !routineHasHours({ moments: storedMoments(next), slotCondition: storedCondition(next), cases: storedCases(next.cases) })) {
    const kept = new Set(readReminders(current?.reminders ?? source?.reminders ?? []).map(reminderKey));
    if (data.reminders.some((reminder) => reminderKindOf(reminder) === 'before' && !kept.has(reminderKey(reminder)))) throw fieldError('reminders', HOURLESS_REMINDERS);
  }
  const moved = source !== null || (current !== null && rootOf(current.projectId) !== rootOf(data.projectId ?? null));
  const linked = data.requiredIds.length + data.relatedIds.length;
  data.requiredIds = keptInTree(data.requiredIds, source?.requiredIds ?? keptRequiredIds, moved, outside, 'requiredIds', Boolean(data.projectId));
  data.relatedIds = keptInTree(data.relatedIds, source?.relatedIds ?? keptRelatedIds, moved, outside, 'relatedIds', Boolean(data.projectId));
  // Links dropped as it moves to another tree (told to the user, as for a task transferred).
  return { ...data, droppedLinks: linked - data.requiredIds.length - data.relatedIds.length };
}

/**
 * Saves the related routines of a routine (« Relative à »): its relations become those given.
 * @param {Prisma.TransactionClient} tx Transaction.
 * @param {string} id Routine.
 * @param {readonly string[]} relatedIds Routines related to it.
 * @returns {Promise<void>}
 */
async function saveRelations(tx: Prisma.TransactionClient, id: string, relatedIds: readonly string[]): Promise<void> {
  await tx.routineRelation.deleteMany({ where: { OR: [{ routineAId: id }, { routineBId: id }] } });
  if (!relatedIds.length) return;
  await tx.routineRelation.createMany({
    data: relatedIds.map((other) => {
      const [routineAId, routineBId] = orderedPair(id, other);
      return { routineAId, routineBId };
    }),
    skipDuplicates: true,
  });
}

/**
 * Prisma data of a validated routine.
 * @param {ReturnType<typeof routineSchema.parse>} data Routine.
 * @returns {object} Scalar fields.
 */
const scalars = (data: ReturnType<typeof routineSchema.parse>) => ({
  label: data.label,
  description: data.description,
  parentId: data.parentId,
  startDate: parseDay(data.startDate),
  recurrence: data.recurrence,
  estimate: data.estimate,
  fromTime: data.fromTime,
  dueTime: data.dueTime,
  scheduleId: data.scheduleId,
  scheduleAnchor: data.scheduleAnchor,
  scheduleIds: data.scheduleIds,
  excludedScheduleIds: data.excludedScheduleIds,
  moments: data.moments,
  slotCondition: data.slotCondition ? toJson(data.slotCondition) : Prisma.DbNull,
  reminders: toJson(normalizedReminders(data.reminders)),
  deadTimes: toJson(storedDeadTimes(data.deadTimes)),
  opensOn: data.opensOn ?? Prisma.DbNull,
  cases: toJson(data.cases),
  ...storedLocation(data),
  links: toJson(data.links),
  travelBefore: data.travelBefore,
  travelAfter: data.travelAfter,
  projectId: data.projectId,
  inheritedFields: data.inheritedFields ?? [],
});

/**
 * Creates a routine, last of the global manual order; a copy of a routine leaves out its former links out of the
 * project tree of the copy.
 * @param {RoutineInput} input Routine.
 * @param {string | null} [copyOf] Routine it is a copy of. Optional. Default = not a copy.
 * @returns {Promise<Routine>} Routine.
 */
export async function createRoutine(input: RoutineInput, copyOf: string | null = null): Promise<Routine> {
  const data = await parseRoutine(input, undefined, { copyOf });
  const position = await nextPositionIn('routine');
  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.create({
      data: {
        ...scalars(data),
        position,
        assignees: { connect: connectIds(data.assigneeIds) },
        beneficiaries: { connect: connectIds(data.beneficiaryIds) },
        beneficiaryRelations: { connect: connectIds(data.beneficiaryRelationIds) },
        categories: { connect: connectIds(data.categoryIds) },
      },
    });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: routine.id, requiredId })) });
    await saveRelations(tx, routine.id, data.relatedIds);
    return routine;
  });
}

/**
 * Copies the sub-routines of a routine under another one (its copy), their own sub-routines too, in their order; a
 * dependency on a routine copied with them points to its copy, and a former link out of the project tree of a
 * sub-routine is not copied (the copy is made without it rather than refused).
 * @param {string} fromId Routine copied.
 * @param {string} toId Its copy.
 * @returns {Promise<number>} Sub-routines copied.
 */
export async function copySubRoutines(fromId: string, toId: string): Promise<number> {
  await assertNotArchived('routine', toId);
  const copies = new Map<string, string>([[fromId, toId]]);
  const queue: string[] = [fromId];
  while (queue.length) {
    const source = queue.shift()!;
    const children = await prisma.routine.findMany({ where: { parentId: source }, orderBy: BY_POSITION, select: { id: true } });
    for (const child of children) {
      // Former links out of the project tree of a routine (kept until it moves) are not copied: the copy obeys the rule.
      const copy = await createRoutine({ ...(await inputOf(child.id)), parentId: copies.get(source)! }, child.id);
      copies.set(child.id, copy.id);
      queue.push(child.id);
    }
  }
  // Dependencies and relations within the copied routines: on their copies.
  for (const [sourceId, copyId] of copies) {
    if (sourceId === fromId) continue;
    const { requiredIds, relatedIds } = await inputOf(copyId);
    if ([...requiredIds, ...relatedIds].some((id) => copies.has(id))) {
      await patchRoutine(copyId, { requiredIds: requiredIds.map((id) => copies.get(id) ?? id), relatedIds: relatedIds.map((id) => copies.get(id) ?? id) });
    }
  }
  return copies.size - 1;
}

/**
 * Loads a routine or throws NOT_FOUND.
 * @param {string} id Routine id.
 * @returns {Promise<Routine>} Routine.
 */
function findRoutine(id: string): Promise<Routine> {
  return findOrNotFound(prisma.routine, id, 'Routine');
}

/**
 * Updates a routine (its ticked occurrences stay). Moved to another project tree, it loses its links with the routines
 * left out of it (dependencies both ways, relations), as a task transferred; those moved along keep theirs.
 * @param {string} id Routine id.
 * @param {RoutineInput} input Routine.
 * @param {RoutineSaveOptions} [options] Undo (archived values given back accepted), routines moved along. Optional.
 * @returns {Promise<number>} Links removed because they left its project tree.
 */
export async function updateRoutine(id: string, given: RoutineInput, options: Omit<RoutineSaveOptions, 'copyOf'> = {}): Promise<number> {
  const found = await findRoutine(id);
  refuseArchived(found);
  // Made top-level: what it inherited becomes its own, whatever the input holds for those fields.
  const unparented = found.parentId !== null && !given.parentId;
  // Placed under a parent after the fact: its empty fields inherit, as at its creation.
  const adopted = found.parentId === null && given.parentId ? emptyRoutineFields(given as unknown as InheritingRoutine) : [];
  const input = unparented
    ? { ...given, ...(await inheritedInputOf(id)), inheritedFields: [] }
    : adopted.length
      ? { ...given, inheritedFields: ROUTINE_INHERITABLE_FIELDS.filter((field) => adopted.includes(field) || new Set(given.inheritedFields ?? []).has(field)) }
      : given;
  if (unparented) await freezeRoutineInheritance([id]);
  const current = unparented ? await findRoutine(id) : found;
  const data = await parseRoutine(input, id, options);
  // Its occurrences and those of the sub-routines going by its « quand »: asked once for them all.
  if (options.confirmLoss !== undefined) {
    const { losses } = await occurrenceChange([timingOf(current, data)]);
    assertLossConfirmed(losses, options.confirmLoss);
    for (const lost of losses) await lost.settle();
  }
  const outside = await outsideTree(id, current.projectId, data.projectId ?? null, options.movedWith);
  const waiting = await prisma.$transaction(async (tx) => {
    await tx.routineDependency.deleteMany({ where: { routineId: id } });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: id, requiredId })) });
    // Those waiting for it out of its new tree no longer do.
    const dropped = outside.length ? (await tx.routineDependency.deleteMany({ where: { requiredId: id, routineId: { in: outside } } })).count : 0;
    await saveRelations(tx, id, data.relatedIds);
    await tx.routine.update({
      where: { id },
      data: {
        ...scalars(data),
        // Exceptions given (an undo, « Vider »): saved; omitted, kept.
        ...(data.moves && { moves: toJson(data.moves) }),
        assignees: { set: connectIds(data.assigneeIds) },
        beneficiaries: { set: connectIds(data.beneficiaryIds) },
        beneficiaryRelations: { set: connectIds(data.beneficiaryRelationIds) },
        categories: { set: connectIds(data.categoryIds) },
      },
    });
    return dropped;
  });
  // A new project: the assignees follow the routine into it (its sub-routines keep theirs); inherited, they are its
  // parent's, attached with it.
  if (!marksInherited({ parentId: data.parentId, inheritedFields: data.inheritedFields ?? [] }, 'ASSIGNEES')) await followProject(current.projectId, data.projectId ?? null, data.assigneeIds);
  // Its sub-routines inheriting the project follow it, as it does.
  const followed = current.projectId !== (data.projectId ?? null) ? await followInheritedProject(id, options.movedWith ?? []) : 0;
  return data.droppedLinks + waiting + followed;
}

/**
 * After a routine changed project: its sub-routines inheriting the project get the same treatment as a routine moved
 * to it: their own assignees attached to it, their links out of its project tree cut (those moved
 * along keep theirs), theirs in turn; archived ones (read only) just follow (`syncInheritedRoutineProjects`).
 * @param {string} id Routine whose project changed.
 * @param {readonly string[]} movedWith Routines moved along with it.
 * @returns {Promise<number>} Links removed because they left the project tree.
 */
async function followInheritedProject(id: string, movedWith: readonly string[]): Promise<number> {
  const children = await prisma.routine.findMany({ where: { parentId: id, archivedAt: null, inheritedFields: { has: 'PROJECT' } }, orderBy: BY_POSITION, select: { id: true } });
  const moved = [...new Set([...movedWith, ...(await subtreeIds('routine', id))])];
  let dropped = 0;
  for (const child of children) dropped += await updateRoutine(child.id, await inputOf(child.id), { movedWith: moved });
  await syncInheritedRoutineProjects();
  return dropped;
}

/**
 * Timing of a routine once saved with new fields (as `parseRoutine` gives them), its exceptions given or kept; its
 * parent and inherited list those of the input when given (the fields it inherits then are its parent's).
 * @param {Routine} current Routine now.
 * @param {Pick<RoutineInput, 'startDate' | 'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn' | 'fromTime' | 'dueTime' | 'parentId' | 'inheritedFields' | 'moves'>} input New fields.
 * @param {unknown} [moves] Its exceptions then. Optional. Default = those of the input, else those it has.
 * @returns {Routine} Routine as it will be (to compute its occurrences).
 */
function timingOf(
  current: Routine,
  input: Pick<RoutineInput, 'startDate' | 'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn' | 'fromTime' | 'dueTime' | 'parentId' | 'inheritedFields' | 'moves'>,
  moves: unknown = input.moves ?? current.moves,
): Routine {
  const json = (value: unknown) => value as Routine['cases'];
  const cases = input.cases ?? [];
  return {
    ...current,
    archivedAt: null,
    startDate: parseDay(input.startDate),
    recurrence: json(input.recurrence),
    cases: json(cases),
    moments: json(cases.length ? [] : input.moments),
    slotCondition: cases.length ? null : json(input.slotCondition ?? null),
    opensOn: json(input.opensOn ?? null),
    fromTime: input.fromTime ?? null,
    dueTime: input.dueTime ?? null,
    scheduleIds: [],
    excludedScheduleIds: [],
    moves: json(moves),
    parentId: input.parentId === undefined ? current.parentId : input.parentId,
    inheritedFields: input.inheritedFields ?? current.inheritedFields,
  };
}

/** What a change of the « quand » of routines does to their occurrences and to those of the sub-routines going by it. */
interface OccurrenceChange {
  /** Comments of the occurrences that disappear, routine by routine (asked once for all: `assertLossConfirmed`). */
  losses: LostOccurrences[];
  /** Moves the comments of the occurrence moved by the change, on the sub-routines it moves too. */
  follow: () => Promise<void>;
}

/**
 * What a change of the rule of routines takes: the comments of their occurrences that disappear with it (an
 * occurrence now that the new rule does not have), and of those of every sub-routine going by their « quand » or
 * condition (inherited, up the chain), whose occurrences change with them; a routine's times are not on its
 * occurrences. An occurrence moved by the change keeps its comments: on the routines changed, and on the sub-routines
 * it moves along (`follow`).
 * @param {readonly Routine[]} nexts Routines once changed (`timingOf`).
 * @param {{ from: string, to: string | null }} [moved] Occurrence moved by the change (its day now, its new day). Optional.
 * @returns {Promise<OccurrenceChange>} Comments lost, their deletion, the comments following the occurrence moved.
 */
async function occurrenceChange(nexts: readonly Routine[], moved?: { from: string; to: string | null }): Promise<OccurrenceChange> {
  const before = await loadScheduleContext();
  const stored = before.routines!;
  const changed = new Map(nexts.map((next) => [next.id, next]));
  const afterRoutines = new Map(stored);
  for (const next of nexts) afterRoutines.set(next.id, { ...stored.get(next.id)!, ...next });
  const after: ScheduleContext = { ...before, memo: new Map(), routines: afterRoutines };
  const ids = [...new Set([...timingHeirs([...changed.keys()], stored), ...timingHeirs([...changed.keys()], afterRoutines)])].filter((id) => stored.has(id));
  const on = (routine: Routine, schedules: ScheduleContext, day: string) => occurrencesBetween(routine, day, day, schedules).includes(day);
  const following: string[] = [];
  const losses = await Promise.all(
    ids.map((id) => {
      // A routine changed is computed as active (its occurrences after an undo of its archiving); a sub-routine as it is.
      const now = changed.has(id) ? { ...stored.get(id)!, archivedAt: null } : stored.get(id)!;
      const then = changed.get(id) ?? afterRoutines.get(id)!;
      const follows = moved !== undefined && (changed.has(id) || (on(now, before, moved.from) && moved.to !== null && on(then, after, moved.to) && !on(then, after, moved.from)));
      if (follows && !changed.has(id)) following.push(id);
      return lostOccurrences('routineId', id, (day) => !(follows && day === moved!.from) && on(now, before, day) && !on(then, after, day));
    }),
  );
  return {
    losses,
    follow: async () => {
      if (moved) for (const id of following) await followOccurrence(id, moved.from, moved.to);
    },
  };
}

/**
 * Before a change of the calendar schedules of the workspace (one created, changed, archived, restored or deleted, a
 * kind archived or restored) or of its people (a birthday changed, moved or gone: birth date, archiving, link of a
 * relation to a contributor, creation, deletion), the occurrences of the routines that it makes disappear
 * (their condition no longer leaves them any moment; those ticked stay) lose their comments, as with a change of their
 * rule. Without `confirmLoss: true` while some would be lost, nothing changes
 * (CONFIRMATION_REQUIRED, asked once for all the routines); confirmed, those comments are deleted. Only the routines of
 * the workspace are looked at (not archived, with a condition or cases), and, for a change of schedules, those of the
 * other workspaces naming them.
 * @param {ScheduleEdit} edit Schedules and people of the workspace once changed.
 * @param {boolean} [confirmLoss] Loss confirmed (true), to confirm (false). Optional. Default = no question.
 * @returns {Promise<void>}
 */
export async function settleScheduleChange(edit: ScheduleEdit, confirmLoss?: boolean): Promise<void> {
  const change: ScheduleChange = { workspaceId: currentWorkspaceId(), ...edit };
  // Here: every routine following schedules (the free time counts them all); only those naming birthdays for a change
  // of the people alone. Elsewhere: those naming one of these schedules, or a kind of this workspace (birthdays are
  // never named elsewhere).
  const here = await routinesLosing(change, edit.apply ? () => true : conditionCitesBirthdays);
  const own = edit.apply ? new Set((await prisma.workSchedule.findMany({ select: { id: true } })).map((schedule) => schedule.id)) : null;
  const others = own ? await unscopedPrisma.workspace.findMany({ where: { id: { not: change.workspaceId } }, select: { id: true, kind: true } }) : [];
  const elsewhere = await Promise.all(
    others.map((workspace) =>
      runInWorkspace(workspace, async () => {
        const lost = await routinesLosing(change, (condition) => conditionScheduleIds(condition).some((id) => own!.has(id)) || conditionKinds(condition).some((kind) => foreignSlotKindWorkspace(kind) === change.workspaceId));
        // Its deletions run in its workspace.
        return lost.map((item) => ({ ...item, settle: () => runInWorkspace(workspace, item.settle) }));
      }),
    ),
  );
  const losses = [...here, ...elsewhere.flat()];
  assertLossConfirmed(losses, confirmLoss);
  for (const lost of losses) await lost.settle();
}

/**
 * Settling of a change of the people (`settleScheduleChange`): the mutations of contributors and relations
 * give it to their services.
 * @param {boolean | null} [confirmLoss] Loss confirmed. Optional. Default = to confirm.
 * @returns {PeopleChangeSettler} Settler.
 */
export const peopleSettler =
  (confirmLoss?: boolean | null): PeopleChangeSettler =>
  (people) =>
    settleScheduleChange({ people }, confirmLoss ?? false);

/**
 * What a change of schedules takes from the routines of the current workspace whose conditions are concerned: the
 * comments of their occurrences it makes disappear.
 * @param {ScheduleChange} change Schedules once changed.
 * @param {(condition: SlotCondition) => boolean} concerned Whether a condition (of a routine or a case) is concerned.
 * @returns {Promise<LostOccurrences[]>} Losses, by routine.
 */
async function routinesLosing(change: ScheduleChange, concerned: (condition: SlotCondition) => boolean): Promise<LostOccurrences[]> {
  const [before, after] = await Promise.all([loadScheduleContext(), loadScheduleContext(change)]);
  // Its conditions as it goes: those of its parent when it inherits them.
  const conditionsOf = (stored: Routine) => {
    const routine = occurrenceTiming(stored, before);
    return storedCases(routine.cases).length ? storedCases(routine.cases).map((item) => item.condition) : [storedCondition(routine)];
  };
  const following = (await prisma.routine.findMany({ where: { archivedAt: null } })).filter((routine) =>
    conditionsOf(routine).some((condition): condition is SlotCondition => constrains(condition) && concerned(condition!)),
  );
  if (!following.length) return [];
  await placeLegacyRoutineComments(following.map((routine) => routine.id));
  const on = (routine: Routine, schedules: ScheduleContext, day: string) => occurrencesBetween(routine, day, day, schedules).includes(day);
  return Promise.all(following.map((routine) => lostOccurrences('routineId', routine.id, (day) => on(routine, before, day) && !on(routine, after, day))));
}

/**
 * Routines out of the project tree a routine moves to (none when its tree does not change), those moved along aside.
 * @param {string} id Routine.
 * @param {string | null} from Its project now.
 * @param {string | null} to Its new project.
 * @param {readonly string[]} [movedWith] Routines moved to it along with it. Optional. Default = none.
 * @returns {Promise<string[]>} Ids.
 */
async function outsideTree(id: string, from: string | null, to: string | null, movedWith: readonly string[] = []): Promise<string[]> {
  const rootOf = await loadProjectRootOf();
  if (rootOf(from) === rootOf(to)) return [];
  const others = await prisma.routine.findMany({ select: { id: true, projectId: true } });
  return [...outsideMovedTree(rootOf, others, [id, ...movedWith], to)];
}

/** People, categories and links of a routine to other routines, as its input (and its conversion into a task) reads them. */
export const ROUTINE_LINKS = {
  assignees: { select: { id: true } },
  beneficiaries: { select: { id: true } },
  beneficiaryRelations: { select: { id: true } },
  categories: { select: { id: true } },
  requires: { select: { requiredId: true } },
  ...RELATIONS,
} as const;

/**
 * Current form of a routine as an input.
 * @param {string} id Routine id.
 * @returns {Promise<RoutineInput>} Input.
 */
async function inputOf(id: string): Promise<RoutineInput> {
  const routine = await orNotFound(
    prisma.routine.findUnique({
      where: { id },
      include: ROUTINE_LINKS,
    }),
    'Routine',
  );
  return {
    label: routine.label,
    description: routine.description,
    categoryIds: routine.categories.map((category) => category.id),
    parentId: routine.parentId,
    startDate: formatDay(routine.startDate),
    recurrence: storedRule(routine) ?? (routine.recurrence as RoutineInput['recurrence']),
    estimate: routine.estimate,
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    scheduleId: null,
    scheduleAnchor: null,
    scheduleIds: [],
    excludedScheduleIds: [],
    slotCondition: storedCondition(routine),
    moments: storedMoments(routine),
    reminders: readReminders(routine.reminders),
    deadTimes: readDeadTimes(routine.deadTimes),
    opensOn: readOpens(routine.opensOn),
    cases: storedCases(routine.cases),
    location: routine.location,
    locationLat: routine.locationLat,
    locationLon: routine.locationLon,
    links: readLinks(routine.links),
    travelBefore: routine.travelBefore,
    travelAfter: routine.travelAfter,
    projectId: routine.projectId,
    assigneeIds: routine.assignees.map((assignee) => assignee.id),
    beneficiaryIds: routine.beneficiaries.map((beneficiary) => beneficiary.id),
    beneficiaryRelationIds: routine.beneficiaryRelations.map((relation) => relation.id),
    requiredIds: routine.requires.map((dependency) => dependency.requiredId),
    relatedIds: relatedOf(routine),
    inheritedFields: routine.inheritedFields as RoutineInheritableField[],
  };
}

/**
 * Values a routine goes by for the fields it inherits, as its input holds them: those of the routine
 * it takes each from, up the chain.
 * @param {string} id Routine id.
 * @returns {Promise<Partial<RoutineInput>>} Input values of its inherited fields.
 */
async function inheritedInputOf(id: string): Promise<Partial<RoutineInput>> {
  const effective = effectiveRoutineOf(await loadRoutineInheritance(), id);
  if (!effective) return {};
  const routine: StoredInheritingRoutine = effective.routine;
  const has = (field: RoutineInheritableField) => marksInherited(routine, field);
  return {
    ...(has('PROJECT') && { projectId: routine.projectId }),
    ...(has('ASSIGNEES') && { assigneeIds: routine.assigneeIds }),
    ...(has('BENEFICIARIES') && { beneficiaryIds: routine.beneficiaryIds, beneficiaryRelationIds: routine.beneficiaryRelationIds }),
    ...(has('CATEGORIES') && { categoryIds: routine.categoryIds }),
    ...(has('SLOT_CONDITION') && { slotCondition: storedCondition(routine) }),
    ...(has('OPENS_ON') && { opensOn: readOpens(routine.opensOn) }),
    ...(has('LOCATION') && { location: routine.location, locationLat: routine.locationLat, locationLon: routine.locationLon }),
    ...(has('START_DATE') && { startDate: formatDay(routine.startDate) }),
    ...(has('RECURRENCE') && { recurrence: storedRule(routine) ?? (routine.recurrence as RoutineInput['recurrence']) }),
    ...(has('CASES') && { cases: storedCases(routine.cases) }),
    ...(has('MOMENTS') && { moments: storedMoments(routine), fromTime: routine.fromTime, dueTime: routine.dueTime }),
    ...(has('MOVES') && { moves: storedMoves(routine.moves) }),
  };
}

/**
 * First time of the day of a routine following its rule, as it goes (its parent's when it inherits its moments: its
 * window, for inline edits).
 * @param {string} id Routine id.
 * @returns {Promise<RoutineSlot>} Moment.
 */
export async function momentOf(id: string): Promise<RoutineSlot> {
  const routine = effectiveRoutineOf(await loadRoutineInheritance(), id)?.routine ?? (await findRoutine(id));
  return storedMoments(routine)[0] ?? { fromTime: null, dueTime: null, optional: false };
}

/**
 * Current form of a routine as an input, with some fields changed.
 * @param {string} id Routine id.
 * @param {Partial<RoutineInput>} changes Changes.
 * @param {Pick<RoutineSaveOptions, 'confirmLoss'>} [options] Occurrences made to disappear confirmed. Optional.
 * @returns {Promise<number>} Links removed because they left its project tree.
 */
export async function patchRoutine(id: string, changes: Partial<RoutineInput>, options: Pick<RoutineSaveOptions, 'confirmLoss'> & RoutineInheritanceChange = {}): Promise<number> {
  const current = await inputOf(id);
  // A repetition of its own: it no longer follows cases (its own ones may be former values while it inherited them).
  const patched = { ...current, ...(changes.recurrence !== undefined && changes.cases === undefined && { cases: [] }), ...changes, ...clearedRoutineInput(options.clear) };
  // A field given a value or emptied is its own; those set to inherit again are inherited.
  const inheritedFields = changedRoutineInheritance(current.inheritedFields ?? [], { inherit: options.inherit, clear: options.clear, input: changes, hasParent: Boolean(patched.parentId) });
  return updateRoutine(id, { ...patched, inheritedFields }, options);
}

/** Fields of routines made inherited again (« Rétablir l'héritage ») or emptied on purpose (« Vider »). */
export interface RoutineInheritanceChange {
  inherit?: RoutineInheritableField[] | null;
  clear?: RoutineInheritableField[] | null;
}

/** Same changes for several routines, their repetition as GraphQL gives it (JSON, checked by the routine schema). */
export type RoutineBulkChanges = Omit<SharedBulkChanges, 'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn'> &
  Partial<Record<'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn', unknown>>;

/**
 * Applies the same changes to several routines; every routine is checked before any is saved.
 * @param {string[]} ids Routine ids.
 * @param {RoutineBulkChanges} changes Changes.
 * @param {boolean} [confirmLoss] Occurrences made to disappear, with comments, confirmed (`RoutineSaveOptions`). Optional.
 * @returns {Promise<number>} Links removed because they left the project tree of their routine.
 */
export async function bulkUpdateRoutines(ids: string[], changes: RoutineBulkChanges, confirmLoss?: boolean): Promise<number> {
  // Archived ones are read only: nothing changed when the selection has one.
  await assertNoneArchived('routine', ids);
  const inheritance = await loadRoutineInheritance();
  const inputs = await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const current = await inputOf(id);
      // Lists inherited: added to and removed from those it goes by, now its own.
      const goesBy = effectiveRoutineOf(inheritance, id)?.routine;
      const input: RoutineInput = {
        ...current,
        categoryIds: changedList(goesBy?.categoryIds ?? current.categoryIds, changes.addCategoryIds, changes.removeCategoryIds),
        assigneeIds: changedList(goesBy?.assigneeIds ?? current.assigneeIds, changes.addAssigneeIds, changes.removeAssigneeIds),
        // A routine never depends on itself, even when the selection does.
        requiredIds: changedList(current.requiredIds, changes.addRequiredIds, changes.removeRequiredIds).filter((requiredId) => requiredId !== id),
        // Nor is it related to itself.
        relatedIds: changedList(current.relatedIds, changes.addRelatedIds, changes.removeRelatedIds).filter((relatedId) => relatedId !== id),
        ...(changes.estimate !== undefined && { estimate: changes.estimate }),
        ...(changes.projectId !== undefined && { projectId: changes.projectId }),
        // A repetition of its own: it no longer follows its cases.
        ...(changes.recurrence !== undefined && { cases: [] }),
        // Times of its own: a single moment.
        ...((changes.fromTime !== undefined || changes.dueTime !== undefined) && {
          moments: [
            {
              fromTime: changes.fromTime !== undefined ? changes.fromTime : (current.fromTime ?? null),
              dueTime: changes.dueTime !== undefined ? changes.dueTime : (current.dueTime ?? null),
              optional: false,
            },
          ],
        }),
        ...(changes.fromTime !== undefined && { fromTime: changes.fromTime }),
        ...(changes.dueTime !== undefined && { dueTime: changes.dueTime }),
        ...(changes.startDate !== undefined && { startDate: changes.startDate }),
        ...(changes.recurrence !== undefined && { recurrence: changes.recurrence as RoutineInput['recurrence'] }),
        ...(changes.cases !== undefined && { cases: changes.cases as RoutineInput['cases'] }),
        ...(changes.moments !== undefined && { moments: changes.moments as RoutineInput['moments'] }),
        ...(changes.slotCondition !== undefined && { slotCondition: changes.slotCondition as RoutineInput['slotCondition'] }),
        ...(changes.opensOn !== undefined && { opensOn: changes.opensOn as RoutineInput['opensOn'] }),
        ...clearedRoutineInput(changes.clearFields),
        inheritedFields: changedRoutineInheritance(current.inheritedFields ?? [], { inherit: changes.inheritFields, clear: changes.clearFields, input: changes, hasParent: Boolean(current.parentId) }),
      };
      return { id, input };
    }),
  );
  // A new project for all: they move together, the links between them stay (as a transfer of tasks).
  const movedWith = changes.projectId !== undefined ? inputs.map(({ id }) => id) : [];
  const nexts: Routine[] = [];
  for (const { id, input } of inputs) {
    const data = await parseRoutine(input, id, { movedWith });
    if (confirmLoss === undefined) continue;
    const current = await findRoutine(id);
    nexts.push(timingOf(current, data));
  }
  // Asked once for the whole selection and the sub-routines going by them, before any is saved.
  if (nexts.length) assertLossConfirmed((await occurrenceChange(nexts)).losses, confirmLoss);
  let removed = 0;
  for (const { id, input } of inputs) removed += await updateRoutine(id, input, { movedWith, ...(confirmLoss !== undefined && { confirmLoss: true }) });
  return removed;
}

/**
 * Archives or restores routines (an archived one is no longer due), each with its sub-routines, as the tasks: archiving
 * archives its active sub-routines along; restoring restores those archived along and its archived parents (alone).
 * Each must exist (an id given twice counts once); archiving keeps the date of those archived already.
 * @param {string[]} ids Routine ids.
 * @param {boolean} archived Target state.
 * @returns {Promise<number>} Number of routines given that changed state (their sub-routines aside).
 */
export async function bulkSetRoutinesArchived(ids: string[], archived: boolean): Promise<number> {
  const unique = [...new Set(ids)];
  await assertAllExist(prisma.routine, unique, 'Routine');
  if (!unique.length) return 0;
  const changed = await prisma.routine.count({ where: { id: { in: unique }, archivedAt: archived ? null : { not: null } } });
  // One under another one of the selection goes with it.
  for (const id of await topmostIds('routine', unique)) await archiveTree<Routine>('routine', id, archived, 'Routine');
  return changed;
}

/**
 * Deletes routines: each with its sub-routines, or alone (its sub-routines then go one level up). Their ticks,
 * dependencies, relations, sheets and checklists go with them; their tracked time stays (without them), but the times
 * they leave with nothing attached (no project, task, other routine or event; not billed) are deleted with them.
 * Ids missing are skipped.
 * @param {string[]} ids Routine ids.
 * @param {boolean} deleteSubRoutines Their sub-routines are deleted too (else moved up a level).
 * @returns {Promise<number>} Number of routines given that were deleted.
 */
export async function bulkDeleteRoutines(ids: string[], deleteSubRoutines: boolean): Promise<number> {
  const count = await prisma.routine.count({ where: { id: { in: [...new Set(ids)] } } });
  await deleteTreeItems('routine', ids, deleteSubRoutines, async (gone) => {
    // Sub-routines left by their deleted parent keep, as their own, what they inherited.
    await freezeRoutineInheritance((await prisma.routine.findMany({ where: { parentId: { in: gone }, id: { notIn: gone } }, select: { id: true } })).map((routine) => routine.id));
    await releaseSubjectTime({ routineIds: gone });
  });
  return count;
}

/**
 * Moves a routine (not an archived one) in the global manual order, just before another routine (or at the end), and
 * optionally under another parent (not an archived one); its categories may change with it (moved from a category to
 * another). Placing relative to a neighbour works the same in a filtered view, its parent hidden.
 * @param {string} id Routine moved.
 * @param {string | null} beforeId Routine to place it before, or null for the end.
 * @param {string | null} [parentId] New parent, null for a top-level routine; undefined keeps the parent. Optional.
 * @param {string[] | null} [categoryIds] New categories. Optional. Default = unchanged.
 * @param {boolean} [confirmLoss] Occurrences a new parent makes disappear (its « quand » inherited), with comments,
 * confirmed, as in the panel (`RoutineSaveOptions`): unconfirmed, nothing moves. Optional. Default = false.
 * @returns {Promise<void>}
 */
export async function moveRoutine(id: string, beforeId: string | null, parentId?: string | null, categoryIds: string[] | null = null, confirmLoss = false): Promise<void> {
  const routine = await findRoutine(id);
  refuseArchived(routine);
  // The parent is checked (exists, not archived, no loop) by the regular update.
  const reparent = parentId !== undefined && parentId !== routine.parentId;
  if (reparent || categoryIds) await patchRoutine(id, { ...(reparent && { parentId }), ...(categoryIds && { categoryIds }) }, { confirmLoss });
  await moveBefore('routine', id, beforeId, 'Routine');
}

/**
 * Ticks or unticks a time of the day of an occurrence of a routine (by default the first time of its current one).
 * @param {string} id Routine id.
 * @param {boolean} done Target state.
 * @param {string | null} [date] Occurrence date. Optional. Default = the current occurrence.
 * @param {number | null} [slot] Time of the day (index). Optional. Default = 0.
 * @param {Date | null} [doneAt] When it was done (ticked after the fact; never in the future). Optional. Default = now.
 * @returns {Promise<string>} Occurrence date.
 */
export async function setRoutineDone(id: string, done: boolean, date?: string | null, slot?: number | null, doneAt?: Date | null): Promise<string> {
  const [routine, slots] = await Promise.all([findRoutine(id), loadScheduleContext()]);
  refuseArchived(routine);
  const occurrence = date ?? occurrencesOf(routine, undefined, slots).current;
  if (!occurrence) throw clientError('BAD_USER_INPUT', 'Cette routine n’a pas encore commencé.');
  if (occurrence > parisToday()) throw clientError('BAD_USER_INPUT', 'Une occurrence à venir ne peut pas être cochée.');
  const index = slot ?? 0;
  if (index < 0 || index >= Math.max(1, slotsOf(routine, occurrence, slots).length)) throw clientError('BAD_USER_INPUT', 'Moment introuvable ce jour-là.');
  if (doneAt && doneAt.getTime() > Date.now()) throw fieldError('doneAt', 'Une routine ne peut pas être faite dans le futur.', 'Heure à venir.');
  const key = { routineId_date_slot: { routineId: id, date: parseDay(occurrence), slot: index } };
  // When it was done: now, unless given (ticked after the fact).
  if (done) await prisma.routineCheck.upsert({ where: key, create: { routineId: id, date: parseDay(occurrence), slot: index, ...(doneAt && { doneAt }) }, update: doneAt ? { doneAt } : {} });
  else await prisma.routineCheck.deleteMany({ where: { routineId: id, date: parseDay(occurrence), slot: index } });
  return occurrence;
}

/**
 * Ticks or unticks the current occurrence of several routines (those not started yet are left aside).
 * @param {string[]} ids Routine ids.
 * @param {boolean} done Target state.
 * @returns {Promise<number>} Number of routines changed.
 */
export async function bulkSetRoutinesDone(ids: string[], done: boolean): Promise<number> {
  const today = parisToday();
  let count = 0;
  const context = await loadScheduleContext();
  // An archived routine is read only: not ticked.
  for (const routine of await prisma.routine.findMany({ where: { id: { in: ids }, archivedAt: null } })) {
    const current = occurrencesOf(routine, today, context).current;
    if (!current) continue;
    // Every time of the day, or none of them.
    const slots = Math.max(1, slotsOf(routine, current, context).length);
    for (let slot = 0; slot < slots; slot += 1) await setRoutineDone(routine.id, done, current, slot);
    count += 1;
  }
  return count;
}

/**
 * Moves an occurrence of a routine to another day (postponed or brought forward) and / or other times: an exception
 * to its rule. Back to its own day and times, the exception is removed. A ticked occurrence is not moved.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @param {string} to New day (its day: other times only).
 * @param {RoutineMoveTimes} [times] Times of each of its times of the day (null: those of its rule); none given: those it had kept. Optional.
 * @returns {Promise<void>}
 */
export async function moveRoutineOccurrence(id: string, date: string, to: string, times?: RoutineMoveTimes): Promise<void> {
  const found = await findActive(prisma.routine, id, 'Routine');
  await placeLegacyRoutineComments([id]);
  if (await prisma.routineCheck.count({ where: { routineId: id, date: parseDay(date) } })) {
    throw clientError('BAD_USER_INPUT', 'Cette occurrence est déjà cochée : décochez-la pour la déplacer.');
  }
  const schedules = await loadScheduleContext();
  // Its « quand » as it goes: its exceptions, inherited, are the base of its own from then on.
  const routine = occurrenceTiming(found, schedules);
  const stored = storedMoves(routine.moves);
  let changed: RoutineMoveTimes | undefined;
  if (times !== undefined) {
    // Only the times that differ from those of its rule are kept.
    const parsed = parseInput(routineMoveTimesSchema, times);
    const base = ruleSlotsOn(routine, movedFrom(stored, date), schedules);
    const slots = base.length ? base : [{ fromTime: null, dueTime: null }];
    for (const item of parsed ?? []) if (item) parseInput(routineSlotSchema, { ...item, optional: false });
    changed = slots.map((slot, index) => {
      const value = parsed?.[index] ?? null;
      return value && (value.fromTime !== slot.fromTime || value.dueTime !== slot.dueTime) ? value : null;
    });
  }
  const move = parseInput(routineMoveSchema, { from: date, to, times: changed?.some(Boolean) ? changed : null });
  if (move.to && move.to < formatDay(routine.startDate)) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
  const moves = withMove(stored, move.from, move.to, changed);
  if (moves.length > MAX_ROUTINE_MOVES) throw clientError('BAD_USER_INPUT', `${MAX_ROUTINE_MOVES} exceptions au plus.`);
  await saveMoves(found, moves, { from: date, to: move.to });
}

/**
 * Saves exceptions given on a routine (its own from then on: `withOwnMoves`); the comments of the occurrence moved
 * follow it, on it and on the sub-routines taking its exceptions (theirs move with it).
 * @param {Routine} routine Routine (stored).
 * @param {readonly RoutineMove[]} moves Its exceptions now.
 * @param {{ from: string, to: string | null }} moved Occurrence moved (its day before, its day now; null: cancelled).
 * @returns {Promise<void>}
 */
async function saveMoves(routine: Routine, moves: readonly RoutineMove[], moved: { from: string; to: string | null }): Promise<void> {
  const data = withOwnMoves(routine, moves);
  const { follow } = await occurrenceChange([{ ...routine, ...data, moves: data.moves as Routine['moves'] }], moved);
  await prisma.routine.update({ where: { id: routine.id }, data });
  await followOccurrence(routine.id, moved.from, moved.to);
  await follow();
}

/**
 * Places the comments of routines written before they were on occurrences on the occurrence current on
 * the day each was written (Paris time; none: the next one; none either, its repetition ended: the last one; else the
 * first one, else the first day of the routine), and
 * saves them there. Archived routines are computed as if they were not.
 * @param {readonly string[]} ids Routines read.
 * @returns {Promise<void>}
 */
export async function placeLegacyRoutineComments(ids: readonly string[]): Promise<void> {
  await placeLegacyComments('ROUTINE', ids, async (routineIds) => {
    const routines = mapById(await prisma.routine.findMany({ where: { id: { in: routineIds } } }));
    const schedules = await loadScheduleContext();
    return (routineId, createdAt) => {
      const found = routines.get(routineId);
      if (!found) return null;
      const routine = { ...found, archivedAt: null };
      const day = dayIn(createdAt, PARIS);
      const { current, next } = occurrencesOf(routine, day, schedules);
      // Written after its repetition ended: its last occurrence.
      return current ?? next ?? lastOccurrenceBefore(routine, day, schedules) ?? firstOccurrence(routine, schedules) ?? formatDay(routine.startDate);
    };
  });
}

/**
 * Comments of an occurrence of a routine moved to another day: they follow it.
 * @param {string} id Routine id.
 * @param {string} date Day it was on.
 * @param {string | null} to Day it is on now (null: none, left).
 * @returns {Promise<void>}
 */
async function followOccurrence(id: string, date: string, to: string | null): Promise<void> {
  if (to && to !== date) await remapOccurrenceRows('routineId', id, (day) => (day === date ? to : undefined));
}

/** What deleting an occurrence of a routine did: archived it (nothing left), and the comments deleted with it alone. */
export interface RoutineOccurrenceDeletion {
  archived: boolean;
  comments: CommentSnapshot[];
}

/**
 * Removes an exception of a routine: the occurrence goes back to its own day; after its deletion (« Annuler »), with
 * the comments deleted with it.
 * @param {string} id Routine id.
 * @param {string} from Day of the rule the occurrence was moved from.
 * @param {readonly CommentSnapshot[]} [comments] Comments deleted with the occurrence, given back on it. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function removeRoutineMove(id: string, from: string, comments: readonly CommentSnapshot[] = []): Promise<void> {
  const found = await findRoutine(id);
  refuseArchived(found);
  await placeLegacyRoutineComments([id]);
  // Its exceptions as it goes (its parent's, inherited): those left are its own.
  const moves = storedMoves(occurrenceTiming(found, await loadScheduleContext()).moves);
  const moved = moves.find((move) => move.from === from)?.to;
  await saveMoves(
    found,
    moves.filter((move) => move.from !== from),
    { from: moved ?? from, to: from },
  );
  await restoreComments('ROUTINE', id, from, comments);
}

/** Which occurrences a change applies to: this one (an exception), it and the following ones, or all. */
type RoutineScope = 'THIS' | 'FOLLOWING' | 'ALL';

/**
 * Rule ending before a date: as many occurrences as before it, or up to the day before.
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date First occurrence left out.
 * @returns {Recurrence} Rule.
 */
const endedBefore = (rule: Recurrence, start: string, date: string): Recurrence =>
  rule.count !== null ? { ...rule, count: Math.max(1, occurrencesBefore(rule, start, date)) } : { ...rule, until: addDays(date, -1) };

/**
 * Rule going on from an occurrence moved to another day: weekly on the new weekday instead of the former one, the
 * occurrences left (when counted), and the dates left out after it.
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date Occurrence.
 * @param {string} to New day.
 * @param {boolean} split The rule goes on from the occurrence (the former one ends before it).
 * @returns {Recurrence} Rule.
 */
function shiftedRule(rule: Recurrence, start: string, date: string, to: string, split: boolean): Recurrence {
  const weekdays =
    rule.frequency === 'WEEKLY' && rule.weekdays.length && to !== date ? [...new Set(rule.weekdays.map((day) => (day === weekdayOf(date) ? weekdayOf(to) : day)))].sort() : rule.weekdays;
  const count = split && rule.count !== null ? Math.max(1, rule.count - occurrencesBefore(rule, start, date)) : rule.count;
  return { ...rule, weekdays, count, exceptions: split ? rule.exceptions.filter((day) => day >= date) : rule.exceptions };
}

/**
 * Whether a rule has occurrences before a date.
 * @param {Recurrence} rule Rule.
 * @param {string} start First day it counts from.
 * @param {string} date Day.
 * @returns {boolean} Some before.
 */
const hasBefore = (rule: Recurrence, start: string, date: string) => date > start && occurrenceDates(rule, start, start, addDays(date, -1)).length > 0;

/**
 * Loads a routine with what its occurrences are computed from, and checks an occurrence of it can change: not archived, not ticked.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @returns {Promise<Routine & { schedule: WorkSchedule | null }>} Routine.
 */
async function changeableOccurrence(id: string, date: string) {
  const routine = await findActive(prisma.routine, id, 'Routine');
  if (await prisma.routineCheck.count({ where: { routineId: id, date: parseDay(date) } })) {
    throw clientError('BAD_USER_INPUT', 'Cette occurrence est déjà cochée : décochez-la pour la changer.');
  }
  return routine;
}

/**
 * Changes an occurrence of a routine from the calendar: its day and the times of one of its times of the day. For this
 * occurrence alone (an exception), for it and the following ones (the repetition ends before it, a case follows with
 * the change), or for all (its repetition and times change; moved by as much as the occurrence). A routine following a
 * calendar schedule only changes one occurrence at a time (the schedule holds its days and times).
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @param {RoutineScope} scope Occurrences changed.
 * @param {string} to New day.
 * @param {number} slot Time of the day changed (index).
 * @param {{ fromTime: string | null, dueTime: string | null }} times Its new times.
 * @param {boolean} [confirmLoss] Other occurrences made to disappear, with comments, confirmed. Optional.
 * @returns {Promise<void>}
 */
export async function changeRoutineOccurrence(
  id: string,
  date: string,
  scope: RoutineScope,
  to: string,
  slot: number,
  times: { fromTime: string | null; dueTime: string | null },
  confirmLoss?: boolean,
): Promise<void> {
  const found = await changeableOccurrence(id, date);
  await placeLegacyRoutineComments([id]);
  const schedules = await loadScheduleContext();
  // Its « quand » as it goes (its parent's, inherited): what the change starts from, its own from then on.
  const routine = occurrenceTiming(found, schedules);
  const start = formatDay(routine.startDate);
  const parsedTo = parseInput(daySchema(), to);
  const window = parseInput(routineSlotSchema, { ...times, optional: false });
  if (parsedTo < start) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
  const moves = storedMoves(routine.moves);
  const origin = movedFrom(moves, date);
  const base = ruleSlotsOn(routine, origin, schedules);
  if (slot < 0 || slot >= Math.max(1, base.length)) throw clientError('BAD_USER_INPUT', 'Moment introuvable ce jour-là.');
  const cases = storedCases(routine.cases);
  const rule = storedRule(routine);

  if (scope === 'THIS') {
    const current = moves.find((move) => move.from === origin)?.times ?? null;
    const slots = base.length ? base : [{ fromTime: null, dueTime: null, optional: false }];
    const changed = slots.map((item, index) => {
      const value = index === slot ? { fromTime: window.fromTime, dueTime: window.dueTime } : (current?.[index] ?? null);
      return value && (value.fromTime !== item.fromTime || value.dueTime !== item.dueTime) ? value : null;
    });
    const next = withMove(moves, date, parsedTo, changed);
    if (next.length > MAX_ROUTINE_MOVES) throw clientError('BAD_USER_INPUT', `${MAX_ROUTINE_MOVES} exceptions au plus.`);
    await saveMoves(found, next, { from: date, to: parsedTo });
    return;
  }
  const delta = daysBetween(origin, parsedTo);
  // The exceptions of the occurrences changed no longer match.
  const keptMoves = moves.filter((move) => (scope === 'ALL' ? delta === 0 : move.from < origin));
  let changes: Partial<RoutineInput>;

  if (cases.length) {
    const item = routineCaseOn(cases, start, origin);
    if (!item) throw clientError('BAD_USER_INPUT', 'Occurrence introuvable.');
    const index = cases.indexOf(item);
    const own = caseStart(item, start);
    const slots = item.slots.map((other, position) => (position === slot ? { ...other, fromTime: window.fromTime, dueTime: window.dueTime } : other));
    const split = scope === 'FOLLOWING' && hasBefore(item.recurrence, own, origin);
    let pieces: RoutineCase[];
    if (split) {
      pieces = [
        { ...item, recurrence: endedBefore(item.recurrence, own, origin) },
        { ...item, from: parsedTo, recurrence: shiftedRule(item.recurrence, own, origin, parsedTo, true), slots },
      ];
    } else {
      // Weekly on listed days: the weekday changes; else its repetition counts from as much later or earlier.
      const listed = item.recurrence.frequency === 'WEEKLY' && item.recurrence.weekdays.length > 0;
      const from = delta === 0 || listed ? item.from : addDays(own, delta);
      if (from && from < start) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
      pieces = [{ ...item, from, recurrence: shiftedRule(item.recurrence, own, origin, parsedTo, false), slots }];
    }
    changes = { cases: [...cases.slice(0, index), ...pieces, ...cases.slice(index + 1)] };
  } else {
    if (!rule) throw clientError('BAD_USER_INPUT', 'Cette routine n’a pas de répétition.');
    // Its moments, the one changed with its new times.
    const own = storedMoments(routine);
    const changedMoments = (own.length ? own : [{ fromTime: null, dueTime: null, optional: false }]).map((moment, index) =>
      index === slot ? { ...moment, fromTime: window.fromTime, dueTime: window.dueTime } : moment,
    );
    if (scope === 'FOLLOWING' && hasBefore(rule, start, origin)) {
      // Its repetition becomes two cases: the former one up to the occurrence, the new one from it.
      changes = {
        cases: [
          { from: null, until: null, recurrence: endedBefore(rule, start, origin), slots: storedMoments(routine) },
          { from: parsedTo, until: null, recurrence: shiftedRule(rule, start, origin, parsedTo, true), slots: changedMoments },
        ],
      };
    } else {
      const listed = rule.frequency === 'WEEKLY' && rule.weekdays.length > 0;
      const startDate = delta === 0 || listed ? start : addDays(start, delta);
      changes = { startDate, recurrence: shiftedRule(rule, start, origin, parsedTo, false), moments: changedMoments, cases: [] };
    }
  }
  // The other occurrences the new rule no longer has lose their comments, once confirmed (the one changed keeps its
  // own), on it and on the sub-routines going by its « quand ». The fields changed and its exceptions are its own.
  const current = await inputOf(id);
  const inheritedFields = changedRoutineInheritance(current.inheritedFields ?? [], { input: changes, hasParent: Boolean(current.parentId) }).filter((field) => field !== 'MOVES');
  const change = await occurrenceChange([timingOf(found, { ...current, ...changes, inheritedFields }, keptMoves)], { from: date, to: parsedTo });
  assertLossConfirmed(change.losses, confirmLoss);
  for (const lost of change.losses) await lost.settle();
  await patchRoutine(id, changes);
  await prisma.routine.update({ where: { id }, data: withOwnMoves({ inheritedFields }, keptMoves) });
  // The occurrence changed keeps its comments (those of the other occurrences stay on their days), on the sub-routines it moves too.
  await followOccurrence(id, date, parsedTo);
  await change.follow();
}

/**
 * Cancels an occurrence of a routine from the calendar: this one alone (an exception: it stays shown, struck through,
 * with its comments), or deletes it and the following ones (its repetitions end before it, their
 * comments deleted; archived with its sub-routines when nothing comes before). Ticked occurrences stay in the history.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @param {'THIS' | 'FOLLOWING'} scope Occurrences deleted.
 * @returns {Promise<RoutineOccurrenceDeletion>} Whether the routine was archived (nothing left), and the comments
 * deleted with this occurrence alone (THIS), for « Annuler ».
 */
export async function deleteRoutineOccurrence(id: string, date: string, scope: 'THIS' | 'FOLLOWING'): Promise<RoutineOccurrenceDeletion> {
  const found = await changeableOccurrence(id, date);
  // Its « quand » as it goes (its parent's, inherited): what the deletion starts from, its own from then on.
  const routine = occurrenceTiming(found, await loadScheduleContext());
  const moves = storedMoves(routine.moves);
  const next = scope === 'THIS' ? withMove(moves, date, null) : moves;
  if (next.length > MAX_ROUTINE_MOVES) throw clientError('BAD_USER_INPUT', `${MAX_ROUTINE_MOVES} exceptions au plus.`);
  // Cancelled, it stays shown struck through with its comments: « Annuler » removes the exception.
  if (scope === 'THIS') {
    await prisma.routine.update({ where: { id }, data: withOwnMoves(found, next) });
    return { archived: false, comments: [] };
  }
  // The following ones go, with their comments, those written before being placed first.
  await placeLegacyRoutineComments([id]);
  await deleteGoneComments({ routines: [{ id, from: date }] });
  const start = formatDay(routine.startDate);
  const origin = movedFrom(moves, date);
  const cases = storedCases(routine.cases);
  const rule = storedRule(routine);
  const kept = cases
    .filter((item) => hasBefore(item.recurrence, caseStart(item, start), origin))
    .map((item) => ({ ...item, recurrence: endedBefore(item.recurrence, caseStart(item, start), origin) }));
  const nothingLeft = cases.length ? !kept.length : !rule || !hasBefore(rule, start, origin);
  const pastMoves = moves.filter((move) => move.from < origin);
  if (nothingLeft) {
    // Archived as by hand, its sub-routines with it; its past occurrences stay, archived.
    await prisma.routine.update({ where: { id }, data: withOwnMoves(found, pastMoves) });
    await archiveTree<Routine>('routine', id, true, 'Routine');
    return { archived: true, comments: [] };
  }
  // The sub-routines going by its repetition lose those occurrences too, with their comments (the deletion is confirmed).
  await patchRoutine(id, cases.length ? { cases: kept } : { recurrence: endedBefore(rule!, start, origin) }, { confirmLoss: true });
  await prisma.routine.update({ where: { id }, data: withOwnMoves(await findRoutine(id), pastMoves) });
  return { archived: false, comments: [] };
}
