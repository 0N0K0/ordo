import {
  addDays,
  caseSpans,
  conditionConstrains,
  conditionWindows,
  effectiveRoutineTiming,
  formatDay,
  groupBy,
  joinedKey,
  moveKey,
  opensReach,
  parseDay,
  readOpens,
  readSlotCondition,
  type Recurrence,
  type RoutineCase,
  routineCaseOn,
  routineCaseSchema,
  routineCaseSpans,
  type RoutineMove,
  routineMoveSchema,
  routineOpenDate,
  type RoutineSlot,
  routineSlotSchema,
  type SlotCondition,
  type SlotsOn,
  storedRecurrence,
  type TimeWindow,
  windowsAllowed,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { Prisma, type Routine } from '../../generated/prisma/client';
import { archivedOn } from '../core/archive';
import { hasUnavailableSlots, loadSlotsOn, type ScheduleChange } from '../calendar/slot-conditions';
import { loadRoutineInheritance, type StoredInheritingRoutine } from './routine-inheritance';

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
  /**
   * Ticks of the occurrences kept apart, by routine: identified by the day of their rule, maybe long before the latest
   * ticks a routine is loaded with. Optional. Default = none.
   */
  apartTicks?: ReadonlyMap<string, readonly RoutineTick[]>;
}

/**
 * Latest ticks of a routine, as it is loaded with them to tell its current occurrence (with those of its occurrences
 * kept apart, from the context: `ticksOf`).
 */
export const LATEST_CHECKS = { orderBy: { date: 'desc' }, take: 20, select: { date: true, slot: true, doneAt: true } } as const;

/** A time of the day of an occurrence ticked, by the day that identifies the occurrence, and when it was done (optional). */
export interface RoutineTick {
  date: Date;
  slot: number;
  doneAt?: Date;
}

/** Without schedules: no slot anywhere. */
export const NO_SCHEDULES: ScheduleContext = { slotsOn: () => [] };

/**
 * Occurrences ticked (at least one time of the day) of the routines whose occurrences depend on calendar schedules
 * (a condition, or cases; every routine when slots « Indisponible » may count): those stay even when their condition,
 * or the slots « Indisponible », no longer leave them any moment.
 * @param {boolean} every Of every routine.
 * @returns {Promise<Set<string>>} `joinedKey(routine, due day)`.
 */
async function loadCheckedOccurrences(every: boolean): Promise<Set<string>> {
  const checks = await prisma.routineCheck.findMany({
    where: every
      ? {}
      : {
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
  // A change may set slots « Indisponible »: every ticked occurrence then counts.
  const every = Boolean(change) || (await hasUnavailableSlots());
  const [slotsOn, checked, routines] = await Promise.all([loadSlotsOn(undefined, change), loadCheckedOccurrences(every), loadRoutineInheritance()]);
  return { memo: new Map(), slotsOn, checked, routines, apartTicks: await loadApartTicks(routines) };
}

/**
 * Ticks of the occurrences kept apart of the routines (their own exceptions, or their parent's when they inherit
 * them), by routine.
 * @param {ReadonlyMap<string, StoredInheritingRoutine>} routines Routines of the workspace.
 * @returns {Promise<Map<string, RoutineTick[]>>} Ticks.
 */
async function loadApartTicks(routines: ReadonlyMap<string, StoredInheritingRoutine>): Promise<Map<string, RoutineTick[]>> {
  const wanted = [...routines.values()].flatMap((routine) =>
    storedMoves(effectiveRoutineTiming(routine, routines).moves)
      .filter((move) => move.apart && move.to)
      .map((move) => ({ routineId: routine.id, date: parseDay(move.from) })),
  );
  if (!wanted.length) return new Map();
  const ticks = await prisma.routineCheck.findMany({ where: { OR: wanted }, select: { routineId: true, date: true, slot: true, doneAt: true } });
  return new Map([...groupBy(ticks, (tick) => tick.routineId)].map(([id, list]) => [id, list.map(({ date, slot, doneAt }) => ({ date, slot, doneAt }))]));
}

/** Key of the routines that have sub-routines not archived, in the memo of a context. */
const GROUPS_MEMO = 'routine-groups';

/**
 * Whether a routine has sub-routines not archived (among the routines of the context): a group of them and their
 * template, never ticked (its ticks of before are not read), never late, ringing no reminder of its own.
 * @param {string | undefined} id Routine id.
 * @param {ScheduleContext} context Schedules (with the routines of the workspace).
 * @returns {boolean} It has some.
 */
export function hasSubRoutines(id: string | undefined, context: ScheduleContext): boolean {
  if (!id || !context.routines) return false;
  let groups = context.memo?.get(GROUPS_MEMO) as Set<string> | undefined;
  if (!groups) {
    groups = new Set([...context.routines.values()].flatMap((item) => (item.parentId && !item.archivedAt ? [item.parentId] : [])));
    context.memo?.set(GROUPS_MEMO, groups);
  }
  return groups.has(id);
}

/**
 * Ticks of a routine its occurrences are told done from: those it is loaded with (its latest ones), and those of its
 * occurrences kept apart (`apartTicks` of the context), each once.
 * @param {{ id?: string, checks?: readonly RoutineTick[] }} routine Routine (without ticks: none asked).
 * @param {ScheduleContext} schedules Schedules.
 * @returns {readonly RoutineTick[] | undefined} Ticks (undefined: none asked).
 */
export function ticksOf(routine: { id?: string; checks?: readonly RoutineTick[] }, schedules: ScheduleContext): readonly RoutineTick[] | undefined {
  // A group is never ticked: its ticks of before, kept, are not read.
  if (routine.checks && hasSubRoutines(routine.id, schedules)) return [];
  const apart = routine.id ? schedules.apartTicks?.get(routine.id) : undefined;
  if (!routine.checks || !apart?.length) return routine.checks;
  const key = (tick: RoutineTick) => joinedKey(formatDay(tick.date), tick.slot);
  const known = new Set(routine.checks.map(key));
  return [...routine.checks, ...apart.filter((tick) => !known.has(key(tick)))];
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
export const constrains = (condition: SlotCondition | null | undefined) => conditionConstrains(condition);

/** Days looked at before and after a day to find the occurrences around it (a year and a little more). */
export const LOOK_DAYS = 400;
/** Days looked at first (enough for the daily and weekly rules): the longer look only when they hold none. */
export const NEAR_DAYS = 35;

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
export function remember<T>(routine: object, schedules: ScheduleContext, key: string, run: () => T): T {
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
export interface RoutineDaySlot extends RoutineSlot {
  windows: TimeWindow[];
}

/** Occurrence of a routine: from its first day to its due (last) day. */
export interface RoutineSpan {
  start: string;
  end: string;
}

/** Occurrence of a routine with the day that identifies it (its ticks, comments…): its due day, or the day of its rule when kept apart. */
export interface RoutineOccurrenceSpan extends RoutineSpan {
  date: string;
  /** Cancelled (an exception without a day): shown struck through. */
  cancelled?: boolean;
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
 * hours its condition on calendar schedules allows that day, out of the slots « Indisponible » (several windows where
 * slots cut them).
 * @param {RoutineTiming} routine Routine.
 * @param {string} due Due day of the occurrence (its case).
 * @param {string} day Day.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {RoutineDaySlot[]} Times (none: not doable that day).
 */
export function dayMoments(routine: RoutineTiming, due: string, day: string, schedules: ScheduleContext): RoutineDaySlot[] {
  const cases = storedCases(routine.cases);
  const item = cases.length ? routineCaseOn(cases, formatDay(routine.startDate), due) : null;
  const base = cases.length ? (item?.slots ?? []) : storedMoments(routine);
  const condition = cases.length ? (item?.condition ?? null) : storedCondition(routine);
  const allowed = conditionWindows(condition, (query) => schedules.slotsOn(query, day));
  return base.flatMap((moment) => {
    const windows = windowsAllowed(moment, allowed);
    return windows.length ? [{ ...moment, fromTime: windows[0].fromTime, dueTime: windows.at(-1)!.dueTime, windows }] : [];
  });
}

/**
 * Whether an occurrence has a time of the day on one of its days (a day without condition nor slot « Indisponible »
 * always has).
 * @param {RoutineTiming} routine Routine.
 * @param {RoutineSpan} span Occurrence.
 * @param {ScheduleContext} schedules Schedules.
 * @returns {boolean} Doable.
 */
function doable(routine: RoutineTiming, span: RoutineSpan, schedules: ScheduleContext): boolean {
  const cases = storedCases(routine.cases);
  const limited = cases.length ? cases.some((item) => constrains(item.condition)) : constrains(storedCondition(routine));
  for (let day = span.start; day <= span.end; day = addDays(day, 1)) {
    if (!limited && !schedules.slotsOn({ unavailable: true }, day).length) return true;
    if (dayMoments(routine, span.end, day, schedules).length) return true;
  }
  return false;
}

/**
 * Occurrences of the rule, cases or schedules of a routine (its exceptions aside) overlapping a period, the doable
 * ones: each from its first day (its « Ouverture ») to its due day.
 * @param {RoutineTiming} routine Routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {ScheduleContext} schedules Schedules.
 * @param {boolean} [pattern=false] Every day of its rule or cases, doable or not (its condition left aside). Optional.
 * @returns {RoutineSpan[]} Occurrences, by due day.
 */
export function ruleSpans(routine: RoutineTiming, from: string, to: string, schedules: ScheduleContext, pattern = false): RoutineSpan[] {
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
  return [...spans.values()].filter((span) => pattern || doable(routine, span, schedules) || ticked(span)).sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * Exceptions of a routine that still apply: those whose day is one of its rule (or of its cases), doable there or not
 * (an occurrence moved away keeps its exception when its day of origin no longer has a moment: a slot removed). An
 * exception left by a change of the rule (its day no longer due) is ignored: it neither removes nor adds an
 * occurrence; the writes read them alike (and keep the ignored ones as they are).
 * @param {RoutineTiming} routine Routine (its « quand » as it goes).
 * @param {ScheduleContext} schedules Schedules.
 * @returns {RoutineMove[]} Exceptions applied.
 */
export function liveMoves(routine: RoutineTiming, schedules: ScheduleContext): RoutineMove[] {
  return remember(routine, schedules, 'liveMoves', () => storedMoves(routine.moves).filter((move) => ruleSpans(routine, move.from, move.from, schedules, true).some((span) => span.end === move.from)));
}

/**
 * Occurrences of a routine overlapping a period (both days included), by due day: those of its rule, cases or
 * schedules, without those moved away or cancelled (unless asked: then flagged), with those moved in (a day long);
 * one moved onto a day that has its own and kept apart is there besides it, identified by the day of its rule. An
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
): RoutineOccurrenceSpan[] {
  const routine = occurrenceTiming(given, schedules);
  const archived = archivedOn(routine);
  const last = archived && archived <= to ? addDays(archived, -1) : to;
  if (last < from) return [];
  // By the day that identifies each occurrence: those moved away (merged into another, cancelled) leave their day
  // first, then those moved come in (one moved onto a day another one left is not taken away with it).
  const rule = new Map<string, RoutineOccurrenceSpan>(ruleSpans(routine, from, last, schedules).map((span) => [span.end, { ...span, date: span.end }]));
  const spans = new Map(rule);
  const moves = liveMoves(routine, schedules);
  for (const move of moves) spans.delete(move.from);
  for (const move of moves) {
    // Merged into the occurrence of its new day: that one stays as it is.
    if (move.merged) continue;
    const key = moveKey(move);
    const span = rule.get(move.from);
    if (move.to && move.to >= from && move.to <= last) spans.set(key, { start: move.to, end: move.to, date: key });
    else if (!move.to && withCancelled && span) spans.set(move.from, { ...span, cancelled: true });
  }
  // Archived: those started (opened) before the day it was archived stay, even due after it.
  return [...spans.values()].filter((span) => !archived || span.start < archived).sort((a, b) => a.end.localeCompare(b.end) || a.date.localeCompare(b.date));
}
