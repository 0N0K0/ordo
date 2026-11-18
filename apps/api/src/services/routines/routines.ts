import {
  addDays,
  ALL_SCHEDULES,
  caseSpans,
  caseStart,
  changedList,
  conditionConstrains,
  conditionScheduleIds,
  conditionWindows,
  daysBetween,
  daySchema,
  formatDay,
  isUnderOrSelf,
  MAX_ROUTINE_MOVES,
  movedFrom,
  movedOccurrences,
  occurrenceDates,
  occurrencesBefore,
  opensReach,
  parseDay,
  type PlannedSlot,
  plannedSlots,
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
  type RoutineMove,
  routineMoveSchema,
  type RoutineMoveTimes,
  routineMoveTimesSchema,
  routineOpenDate,
  routineSchema,
  type RoutineSlot,
  routineSlotSchema,
  type SlotCondition,
  type TimeWindow,
  weekdayOf,
  windowsAllowed,
  withMove,
  withMovedTimes,
} from '@ordo/shared';
import { z } from 'zod';
import { deleteTreeNode, treeListService } from '../core/trees';
import { prisma } from '../../db';
import { BY_POSITION, nextPositionIn, saveSiblingOrder } from '../core/ordering';
import { Prisma, type Routine, type RoutineCategory } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound, parseInput } from '../../graphql/errors';
import { storedRecurrence } from '../calendar/calendar-events';
import { scheduleRule } from '../calendar/work-schedules';
import { assertProjectContributors } from '../workspace/contributors';
import { parisToday } from '../../today';
import { assertAllExist, assertExists } from '../core/lookup';
import { ARCHIVED_MESSAGE, assertNoneArchived, assertNotArchived } from '../core/archive';
import { connectIds } from '../core/relations';

/**
 * Error attached to a form field.
 * @param {string} field Field name.
 * @param {string} message Human-readable reason.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */

/** Routine with what its occurrences are computed from. */
export type RoutineTiming = Pick<Routine, 'startDate' | 'recurrence' | 'cases' | 'moves' | 'fromTime' | 'dueTime' | 'scheduleIds' | 'excludedScheduleIds' | 'moments' | 'slotCondition'> &
  Partial<Pick<Routine, 'opensOn' | 'archivedAt'>>;

/** Calendar schedules of the workspace, for the routines following them or done out of them. */
export interface ScheduleContext {
  /** Slots of some schedules on a day. */
  slotsOn: (ids: readonly string[], date: string) => PlannedSlot[];
  /** What was computed for the routines of the request, by routine and computation. Optional. */
  memo?: Map<string, unknown>;
}

/** Without schedules: no slot anywhere. */
const NO_SCHEDULES: ScheduleContext = { slotsOn: () => [] };

/**
 * Schedules of the current workspace, loaded once, the slots of each day computed when first asked.
 * @returns {Promise<ScheduleContext>} Context.
 */
export async function loadScheduleContext(): Promise<ScheduleContext> {
  const rules = (await prisma.workSchedule.findMany()).map(scheduleRule);
  const byDay = new Map<string, PlannedSlot[]>();
  return {
    memo: new Map(),
    slotsOn: (ids, date) => {
      if (!ids.length) return [];
      let slots = byDay.get(date);
      if (!slots) byDay.set(date, (slots = plannedSlots(rules, date, date)));
      // Every schedule (the free time) or those named.
      return ids.includes(ALL_SCHEDULES) ? slots : slots.filter((slot) => ids.includes(slot.scheduleId));
    },
  };
}

/** How a routine repeats: its rule, or its cases. */
export type RoutineMode = 'RULE' | 'CASES';

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
    const own = `${id}|${key}`;
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
function storedCases(value: unknown): RoutineCase[] {
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
  const allowed = constrains(condition) ? conditionWindows(condition, (ids) => schedules.slotsOn(ids, day)) : null;
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
 * ones: each from its first day (its « à partir du ») to its due day.
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
  // Its cases, else its rule: each with its « à partir du ».
  const sources = cases.length
    ? cases.map((item) => ({ frequency: item.recurrence.frequency, opens: item.opens, spans: (last: string) => routineCaseSpans(item, start, first, last) }))
    : rule
      ? [{ frequency: rule.frequency, opens: readOpens(routine.opensOn), spans: (last: string) => caseSpans({ since: null, until: null, anchor: null, rule, times: null }, start, first, last) }]
      : [];
  for (const { frequency, opens, spans: spansTo } of sources) {
    // An occurrence opening (« à partir du ») within the period may be due after it.
    for (const span of spansTo(addDays(to, opensReach(opens)))) {
      const opened = routineOpenDate(span.end, opens, frequency);
      const open = opened < span.start ? opened : span.start;
      // A day due in several cases follows the first one.
      if (open <= to && span.end >= first && !spans.has(span.end)) spans.set(span.end, { start: open < start ? start : open, end: span.end });
    }
  }
  return [...spans.values()].filter((span) => doable(routine, span, schedules)).sort((a, b) => a.end.localeCompare(b.end));
}

/**
 * Current and next occurrences of a routine today (by due day): the current one is the last started on or before
 * today, the next one the first starting after; then its exceptions (occurrences moved to another day or deleted).
 * @param {RoutineTiming} routine Routine.
 * @param {string} [today] Today. Optional. Default = today in Paris.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {{ current: string | null, next: string | null }} Due days.
 */
export function occurrencesOf(routine: RoutineTiming, today = parisToday(), schedules: ScheduleContext = NO_SCHEDULES): { current: string | null; next: string | null } {
  // An archived routine has nothing due: nothing computed.
  if (routine.archivedAt) return { current: null, next: null };
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
 * schedules, without those moved away or deleted, with those moved in (a day long).
 * @param {RoutineTiming} routine Routine.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @param {ScheduleContext} [schedules] Schedules. Optional. Default = none.
 * @returns {RoutineSpan[]} Occurrences, by due day.
 */
export function occurrenceSpansBetween(routine: RoutineTiming, from: string, to: string, schedules: ScheduleContext = NO_SCHEDULES): RoutineSpan[] {
  const spans = new Map(ruleSpans(routine, from, to, schedules).map((span) => [span.end, span]));
  for (const move of storedMoves(routine.moves)) {
    spans.delete(move.from);
    if (move.to && move.to >= from && move.to <= to) spans.set(move.to, { start: move.to, end: move.to });
  }
  return [...spans.values()].sort((a, b) => a.end.localeCompare(b.end));
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
export function firstOccurrence(routine: RoutineTiming, schedules: ScheduleContext = NO_SCHEDULES): string | null {
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
export function slotsOf(routine: RoutineTiming, occurrence: string | null, schedules: ScheduleContext = NO_SCHEDULES): RoutineDaySlot[] {
  if (!occurrence) return [];
  return remember(routine, schedules, `slots|${occurrence}`, () => slotsOn(routine, occurrence, schedules));
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
 * Validates a routine and what it points to: category, parent (not itself nor one of its sub-routines), project,
 * assignees and required routines (no cycle).
 * @param {RoutineInput} input Routine.
 * @param {string} [id] Routine edited. Optional.
 * @param {boolean} [restoring] Undo giving back former values: archived ones accepted (only that check is skipped). Optional. Default = false.
 * @returns {Promise<ReturnType<typeof routineSchema.parse>>} Routine.
 */
async function parseRoutine(input: RoutineInput, id?: string, restoring = false) {
  const data = parseInput(routineSchema, input);
  data.assigneeIds = [...new Set(data.assigneeIds)];
  data.beneficiaryIds = [...new Set(data.beneficiaryIds)];
  data.beneficiaryRelationIds = [...new Set(data.beneficiaryRelationIds)];
  data.categoryIds = [...new Set(data.categoryIds)];
  data.requiredIds = [...new Set(data.requiredIds)];
  if (data.recurrence.until && data.recurrence.until < data.startDate) throw fieldError('recurrence', 'La fin de la répétition doit suivre la date de début.');
  await assertAllExist(prisma.routineCategory, data.categoryIds, 'Catégorie', { field: 'categoryIds' });
  // The former schedules (sent by former clients) become its condition; its cases have theirs.
  if (!data.slotCondition) data.slotCondition = storedCondition({ slotCondition: null, scheduleIds: data.scheduleIds, excludedScheduleIds: data.excludedScheduleIds });
  const scheduleIds = [...new Set([...conditionScheduleIds(data.slotCondition), ...data.cases.flatMap((item) => conditionScheduleIds(item.condition))])];
  await assertAllExist(prisma.workSchedule, scheduleIds, 'Plage', { field: 'slotCondition' });
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
          beneficiaries: { select: { id: true } },
          beneficiaryRelations: { select: { id: true } },
          requires: { select: { requiredId: true } },
        },
      })
    : null;
  // Undo: everything counts as kept.
  const keptCategoryIds = restoring ? data.categoryIds : (current?.categories.map((category) => category.id) ?? []);
  await assertNoneArchived('routineCategory', data.categoryIds, { keep: keptCategoryIds, field: 'categoryIds' });
  const keptScheduleIds = restoring
    ? scheduleIds
    : current
      ? [...conditionScheduleIds(storedCondition(current)), ...storedCases(current.cases).flatMap((item) => conditionScheduleIds(item.condition))]
      : [];
  await assertNoneArchived('workSchedule', scheduleIds, { keep: keptScheduleIds });
  // A window alone (former clients, imports): its single moment.
  if (!data.moments.length && !data.cases.length && (data.fromTime || data.dueTime)) data.moments = [{ fromTime: data.fromTime, dueTime: data.dueTime, optional: false }];
  // With cases, their days, times and conditions; else its rule, moments and condition. The former fields are dropped.
  if (data.cases.length) Object.assign(data, { moments: [], slotCondition: null });
  Object.assign(data, {
    scheduleIds: [],
    excludedScheduleIds: [],
    scheduleId: null,
    scheduleAnchor: null,
    slotRule: null,
    fromTime: data.moments[0]?.fromTime ?? null,
    dueTime: data.moments[0]?.dueTime ?? null,
  });
  await assertExists(prisma.project, data.projectId, 'Projet', { field: 'projectId' });
  await assertAllExist(prisma.contributor, data.assigneeIds, 'Assigné', { field: 'assigneeIds' });
  await assertAllExist(prisma.contributor, data.beneficiaryIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  await assertAllExist(prisma.treasuryRelation, data.beneficiaryRelationIds, 'Bénéficiaire', { field: 'beneficiaryIds' });
  // Archived beneficiaries, parent and required routines: no longer chosen, those already there stay.
  if (!restoring) await assertNoneArchived('contributor', data.beneficiaryIds, { keep: current?.beneficiaries.map((beneficiary) => beneficiary.id) ?? [], field: 'beneficiaryIds' });
  if (!restoring) await assertNoneArchived('treasuryRelation', data.beneficiaryRelationIds, { keep: current?.beneficiaryRelations.map((relation) => relation.id) ?? [], field: 'beneficiaryIds' });
  if (!restoring) await assertNotArchived('routine', data.parentId, { keep: current?.parentId, field: 'parentId' });
  const keptRequiredIds = restoring ? data.requiredIds : (current?.requires.map((dependency) => dependency.requiredId) ?? []);
  await assertNoneArchived('routine', data.requiredIds, { keep: keptRequiredIds, field: 'requiredIds' });
  // Of a project: its contributors only (those already assigned stay).
  const assigned = id ? (await prisma.routine.findUnique({ where: { id }, select: { assignees: { select: { id: true } } } }))?.assignees.map((assignee) => assignee.id) : [];
  await assertProjectContributors(data.projectId ?? null, data.assigneeIds, assigned ?? [], 'assigneeIds', restoring);

  const all = await prisma.routine.findMany({ select: { id: true, parentId: true, requires: { select: { requiredId: true } } } });
  const known = new Set(all.map((routine) => routine.id));
  if (data.parentId) {
    if (!known.has(data.parentId)) throw fieldError('parentId', 'Routine parente introuvable.');
    if (id && isUnderOrSelf(new Map(all.map((routine) => [routine.id, routine.parentId])), data.parentId, id)) {
      throw fieldError('parentId', 'Une routine ne peut pas être rangée sous elle-même.');
    }
  }
  if (data.requiredIds.some((requiredId) => !known.has(requiredId))) throw fieldError('requiredIds', 'Routine introuvable.');
  if (id && data.requiredIds.includes(id)) throw fieldError('requiredIds', 'Une routine ne peut pas dépendre d’elle-même.');
  if (id && data.requiredIds.length) {
    // No cycle: none of the required routines may (indirectly) require this one.
    const requires = new Map(all.map((routine) => [routine.id, routine.requires.map((dependency) => dependency.requiredId)]));
    if (reaches((current) => requires.get(current) ?? [], data.requiredIds, id)) throw fieldError('requiredIds', 'Ces dépendances forment une boucle.');
  }
  return data;
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
  slotCondition: data.slotCondition ? (data.slotCondition as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
  reminders: [...new Set(data.reminders)].sort((a, b) => a - b),
  opensOn: data.opensOn ?? Prisma.DbNull,
  slotRule: data.slotRule ?? Prisma.DbNull,
  cases: data.cases as Prisma.InputJsonValue,
  location: data.location,
  locationLat: data.location ? data.locationLat : null,
  locationLon: data.location ? data.locationLon : null,
  travelBefore: data.travelBefore,
  travelAfter: data.travelAfter,
  projectId: data.projectId,
});

/**
 * Creates a routine, last of its siblings.
 * @param {RoutineInput} input Routine.
 * @returns {Promise<Routine>} Routine.
 */
export async function createRoutine(input: RoutineInput): Promise<Routine> {
  const data = await parseRoutine(input);
  const position = await nextPositionIn('routine', { parentId: data.parentId });
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
    return routine;
  });
}

/**
 * Copies the sub-routines of a routine under another one (its copy), their own sub-routines too, in their order; a
 * dependency on a routine copied with them points to its copy.
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
      const input = await inputOf(child.id);
      const copy = await createRoutine({ ...input, parentId: copies.get(source)! });
      copies.set(child.id, copy.id);
      queue.push(child.id);
    }
  }
  // Dependencies within the copied routines: on their copies.
  for (const [sourceId, copyId] of copies) {
    if (sourceId === fromId) continue;
    const { requiredIds } = await inputOf(copyId);
    if (requiredIds.some((id) => copies.has(id))) await patchRoutine(copyId, { requiredIds: requiredIds.map((id) => copies.get(id) ?? id) });
  }
  return copies.size - 1;
}

/**
 * Loads a routine or throws NOT_FOUND.
 * @param {string} id Routine id.
 * @returns {Promise<Routine>} Routine.
 */
async function findRoutine(id: string): Promise<Routine> {
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id } }), 'Routine');
  return routine;
}

/**
 * Updates a routine (its ticked occurrences stay).
 * @param {string} id Routine id.
 * @param {RoutineInput} input Routine.
 * @param {boolean} [restoring] Undo putting it back as it was: archived values given back are accepted. Optional. Default = false.
 * @returns {Promise<Routine>} Routine.
 */
export async function updateRoutine(id: string, input: RoutineInput, restoring = false): Promise<Routine> {
  await findRoutine(id);
  await assertNotArchived('routine', id);
  const data = await parseRoutine(input, id, restoring);
  return prisma.$transaction(async (tx) => {
    await tx.routineDependency.deleteMany({ where: { routineId: id } });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: id, requiredId })) });
    return tx.routine.update({
      where: { id },
      data: {
        ...scalars(data),
        assignees: { set: connectIds(data.assigneeIds) },
        beneficiaries: { set: connectIds(data.beneficiaryIds) },
        beneficiaryRelations: { set: connectIds(data.beneficiaryRelationIds) },
        categories: { set: connectIds(data.categoryIds) },
      },
    });
  });
}

/**
 * Current form of a routine as an input.
 * @param {string} id Routine id.
 * @returns {Promise<RoutineInput>} Input.
 */
async function inputOf(id: string): Promise<RoutineInput> {
  const routine = await orNotFound(
    prisma.routine.findUnique({
      where: { id },
      include: {
        assignees: { select: { id: true } },
        beneficiaries: { select: { id: true } },
        beneficiaryRelations: { select: { id: true } },
        categories: { select: { id: true } },
        requires: { select: { requiredId: true } },
      },
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
    reminders: routine.reminders,
    opensOn: readOpens(routine.opensOn),
    slotRule: null,
    cases: storedCases(routine.cases),
    location: routine.location,
    locationLat: routine.locationLat,
    locationLon: routine.locationLon,
    travelBefore: routine.travelBefore,
    travelAfter: routine.travelAfter,
    projectId: routine.projectId,
    assigneeIds: routine.assignees.map((assignee) => assignee.id),
    beneficiaryIds: routine.beneficiaries.map((beneficiary) => beneficiary.id),
    beneficiaryRelationIds: routine.beneficiaryRelations.map((relation) => relation.id),
    requiredIds: routine.requires.map((dependency) => dependency.requiredId),
  };
}

/**
 * First time of the day of a routine following its rule (its window, for inline edits).
 * @param {string} id Routine id.
 * @returns {Promise<RoutineSlot>} Moment.
 */
export async function momentOf(id: string): Promise<RoutineSlot> {
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id } }), 'Routine');
  return storedMoments(routine)[0] ?? { fromTime: null, dueTime: null, optional: false };
}

/**
 * Current form of a routine as an input, with some fields changed.
 * @param {string} id Routine id.
 * @param {Partial<RoutineInput>} changes Changes.
 * @returns {Promise<Routine>} Routine.
 */
export async function patchRoutine(id: string, changes: Partial<RoutineInput>): Promise<Routine> {
  return updateRoutine(id, { ...(await inputOf(id)), ...changes });
}

/** Same changes for several routines, their repetition as GraphQL gives it (JSON, checked by the routine schema). */
export type RoutineBulkChanges = Omit<SharedBulkChanges, 'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn'> &
  Partial<Record<'recurrence' | 'cases' | 'moments' | 'slotCondition' | 'opensOn', unknown>>;

/**
 * Applies the same changes to several routines; every routine is checked before any is saved.
 * @param {string[]} ids Routine ids.
 * @param {RoutineBulkChanges} changes Changes.
 * @returns {Promise<number>} Number of routines changed.
 */
export async function bulkUpdateRoutines(ids: string[], changes: RoutineBulkChanges): Promise<number> {
  // Archived ones are read only: nothing changed when the selection has one.
  await assertNoneArchived('routine', ids);
  const inputs = await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const current = await inputOf(id);
      const input: RoutineInput = {
        ...current,
        categoryIds: changedList(current.categoryIds, changes.addCategoryIds, changes.removeCategoryIds),
        assigneeIds: changedList(current.assigneeIds, changes.addAssigneeIds, changes.removeAssigneeIds),
        // A routine never depends on itself, even when the selection does.
        requiredIds: changedList(current.requiredIds, changes.addRequiredIds, changes.removeRequiredIds).filter((requiredId) => requiredId !== id),
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
      };
      return { id, input };
    }),
  );
  for (const { id, input } of inputs) await parseRoutine(input, id);
  for (const { id, input } of inputs) await updateRoutine(id, input);
  return inputs.length;
}

/**
 * Archives or restores routines (an archived one is no longer due), all at once: each must exist (an id given twice
 * counts once); archiving keeps the date of those archived already.
 * @param {string[]} ids Routine ids.
 * @param {boolean} archived Target state.
 * @returns {Promise<number>} Number of routines changed.
 */
export async function bulkSetRoutinesArchived(ids: string[], archived: boolean): Promise<number> {
  const unique = [...new Set(ids)];
  await assertAllExist(prisma.routine, unique, 'Routine');
  if (!unique.length) return 0;
  return (await prisma.routine.updateMany({ where: { id: { in: unique }, archivedAt: archived ? null : { not: null } }, data: { archivedAt: archived ? new Date() : null } })).count;
}

/**
 * Deletes several routines (see deleteRoutine).
 * @param {string[]} ids Routine ids.
 * @returns {Promise<number>} Number of routines deleted.
 */
export async function bulkDeleteRoutines(ids: string[]): Promise<number> {
  let count = 0;
  for (const id of new Set(ids)) {
    if (!(await prisma.routine.findUnique({ where: { id }, select: { id: true } }))) continue;
    await deleteRoutine(id);
    count += 1;
  }
  return count;
}

/**
 * Deletes a routine: its sub-routines go one level up, its tracked time stays (without it).
 * @param {string} id Routine id.
 * @returns {Promise<void>}
 */
export async function deleteRoutine(id: string): Promise<void> {
  const routine = await findRoutine(id);
  await deleteTreeNode('routine', routine);
}

/** Where a routine is dropped, relative to another one. */
export type RoutinePlace = 'BEFORE' | 'AFTER' | 'INSIDE';

/**
 * Moves a routine next to another one (before or after it: same parent), or last under it (a sub-routine), then
 * numbers the siblings in their new order; its categories may change with it (moved from a category to another).
 * @param {string} id Routine moved.
 * @param {string} targetId Routine it is dropped on.
 * @param {RoutinePlace} place Before, after or inside the target.
 * @param {string[] | null} [categoryIds] New categories. Optional. Default = unchanged.
 * @returns {Promise<void>}
 */
export async function moveRoutine(id: string, targetId: string, place: RoutinePlace, categoryIds: string[] | null = null): Promise<void> {
  if (id === targetId) throw clientError('BAD_USER_INPUT', 'Une routine ne peut pas être déplacée sur elle-même.');
  const routine = await findRoutine(id);
  const target = await findRoutine(targetId);
  await assertNotArchived('routine', id);
  // Nothing added under an archived routine.
  if (place === 'INSIDE') await assertNotArchived('routine', targetId);
  const parentId = place === 'INSIDE' ? target.id : target.parentId;
  // The parent is checked (no loop) by the regular update.
  if (parentId !== routine.parentId || categoryIds) await patchRoutine(id, { parentId, ...(categoryIds && { categoryIds }) });
  const siblings = (await prisma.routine.findMany({ where: { parentId, id: { not: id } }, orderBy: BY_POSITION, select: { id: true } })).map((sibling) => sibling.id);
  const at = siblings.indexOf(target.id);
  const index = place === 'INSIDE' || at === -1 ? siblings.length : place === 'BEFORE' ? at : at + 1;
  await saveSiblingOrder(siblings, id, index, (siblingId, position) => prisma.routine.update({ where: { id: siblingId }, data: { position } }));
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
  const [routine, slots] = await Promise.all([orNotFound(prisma.routine.findUnique({ where: { id } }), 'Routine'), loadScheduleContext()]);
  if (routine.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
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
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id } }), 'Routine');
  if (routine.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  if (await prisma.routineCheck.count({ where: { routineId: id, date: parseDay(date) } })) {
    throw clientError('BAD_USER_INPUT', 'Cette occurrence est déjà cochée : décochez-la pour la déplacer.');
  }
  const stored = storedMoves(routine.moves);
  let changed: RoutineMoveTimes | undefined;
  if (times !== undefined) {
    // Only the times that differ from those of its rule are kept.
    const parsed = parseInput(routineMoveTimesSchema, times);
    const base = ruleSlotsOn(routine, movedFrom(stored, date), await loadScheduleContext());
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
  await prisma.routine.update({ where: { id }, data: { moves } });
}

/**
 * Removes an exception of a routine: the occurrence goes back to its own day.
 * @param {string} id Routine id.
 * @param {string} from Day of the rule the occurrence was moved from.
 * @returns {Promise<void>}
 */
export async function removeRoutineMove(id: string, from: string): Promise<void> {
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id }, select: { moves: true, archivedAt: true } }), 'Routine');
  if (routine.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  await prisma.routine.update({ where: { id }, data: { moves: storedMoves(routine.moves).filter((move) => move.from !== from) } });
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
  const routine = await orNotFound(prisma.routine.findUnique({ where: { id } }), 'Routine');
  if (routine.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
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
 * @returns {Promise<void>}
 */
export async function changeRoutineOccurrence(id: string, date: string, scope: RoutineScope, to: string, slot: number, times: { fromTime: string | null; dueTime: string | null }): Promise<void> {
  const routine = await changeableOccurrence(id, date);
  const start = formatDay(routine.startDate);
  const parsedTo = parseInput(daySchema(), to);
  const window = parseInput(routineSlotSchema, { ...times, optional: false });
  if (parsedTo < start) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
  const moves = storedMoves(routine.moves);
  const origin = movedFrom(moves, date);
  const base = ruleSlotsOn(routine, origin, await loadScheduleContext());
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
    await prisma.routine.update({ where: { id }, data: { moves: next } });
    return;
  }
  const delta = daysBetween(origin, parsedTo);
  // The exceptions of the occurrences changed no longer match.
  const keptMoves = moves.filter((move) => (scope === 'ALL' ? delta === 0 : move.from < origin));

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
    await patchRoutine(id, { cases: [...cases.slice(0, index), ...pieces, ...cases.slice(index + 1)] });
  } else {
    if (!rule) throw clientError('BAD_USER_INPUT', 'Cette routine n’a pas de répétition.');
    // Its moments, the one changed with its new times.
    const own = storedMoments(routine);
    const changedMoments = (own.length ? own : [{ fromTime: null, dueTime: null, optional: false }]).map((moment, index) =>
      index === slot ? { ...moment, fromTime: window.fromTime, dueTime: window.dueTime } : moment,
    );
    if (scope === 'FOLLOWING' && hasBefore(rule, start, origin)) {
      // Its repetition becomes two cases: the former one up to the occurrence, the new one from it.
      await patchRoutine(id, {
        cases: [
          { from: null, until: null, recurrence: endedBefore(rule, start, origin), slots: storedMoments(routine) },
          { from: parsedTo, until: null, recurrence: shiftedRule(rule, start, origin, parsedTo, true), slots: changedMoments },
        ],
      });
    } else {
      const listed = rule.frequency === 'WEEKLY' && rule.weekdays.length > 0;
      const startDate = delta === 0 || listed ? start : addDays(start, delta);
      await patchRoutine(id, { startDate, recurrence: shiftedRule(rule, start, origin, parsedTo, false), moments: changedMoments });
    }
  }
  await prisma.routine.update({ where: { id }, data: { moves: keptMoves } });
}

/**
 * Deletes an occurrence of a routine from the calendar: this one alone (an exception), or it and the following ones
 * (its repetitions end before it; archived when nothing comes before). Ticked occurrences stay in the history.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @param {'THIS' | 'FOLLOWING'} scope Occurrences deleted.
 * @returns {Promise<boolean>} The routine was archived (nothing left).
 */
export async function deleteRoutineOccurrence(id: string, date: string, scope: 'THIS' | 'FOLLOWING'): Promise<boolean> {
  const routine = await changeableOccurrence(id, date);
  const moves = storedMoves(routine.moves);
  if (scope === 'THIS') {
    const next = withMove(moves, date, null);
    if (next.length > MAX_ROUTINE_MOVES) throw clientError('BAD_USER_INPUT', `${MAX_ROUTINE_MOVES} exceptions au plus.`);
    await prisma.routine.update({ where: { id }, data: { moves: next } });
    return false;
  }
  const start = formatDay(routine.startDate);
  const origin = movedFrom(moves, date);
  const cases = storedCases(routine.cases);
  const rule = storedRule(routine);
  const kept = cases
    .filter((item) => hasBefore(item.recurrence, caseStart(item, start), origin))
    .map((item) => ({ ...item, recurrence: endedBefore(item.recurrence, caseStart(item, start), origin) }));
  const nothingLeft = cases.length ? !kept.length : !rule || !hasBefore(rule, start, origin);
  if (nothingLeft) {
    await prisma.routine.update({ where: { id }, data: { archivedAt: new Date(), moves: moves.filter((move) => move.from < origin) } });
    return true;
  }
  await patchRoutine(id, cases.length ? { cases: kept } : { recurrence: endedBefore(rule!, start, origin) });
  await prisma.routine.update({ where: { id }, data: { moves: moves.filter((move) => move.from < origin) } });
  return false;
}
