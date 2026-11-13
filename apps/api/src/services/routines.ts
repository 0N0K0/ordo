import {
  formatDay,
  parseDay,
  routineCategorySchema,
  routineOccurrences,
  routineSchema,
  routineCaseSchema,
  routineCaseOn,
  casesOccurrences,
  scheduleOccurrences,
  scheduleWindow,
  movedFrom,
  movedOccurrences,
  routineMoveSchema,
  withMove,
  MAX_ROUTINE_MOVES,
  occurrenceDates,
  occurrencesBefore,
  plannedSlots,
  addDays,
  daysBetween,
  caseStart,
  routineSlotSchema,
  withMovedTimes,
  weekdayOf,
  type Recurrence,
  type RoutineAnchor,
  type RoutineMove,
  type RoutineCase,
  type RoutineSlot,
  type RoutineCategoryInput,
  type RoutineInput,
} from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { saveSiblingOrder } from './ordering';
import type { Routine, RoutineCategory, WorkSchedule } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { storedRecurrence } from './calendar-events';
import { scheduleRule } from './work-schedules';

/**
 * Today in Paris, as a calendar date.
 * @returns {string} YYYY-MM-DD.
 */
export const routineToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

/**
 * Error attached to a form field.
 * @param {string} field Field name.
 * @param {string} message Human-readable reason.
 * @returns {GraphQLError} BAD_USER_INPUT error.
 */
const fieldError = (field: string, message: string) => clientError('BAD_USER_INPUT', message, { fields: { [field]: message } });

/**
 * Whether `ancestor` is `id` or one of its parents, following a parent map.
 * @param {Map<string, string | null>} parentOf Parent of each id.
 * @param {string} start Id the walk starts from.
 * @param {string} id Id looked for.
 * @returns {boolean} Found.
 */
function reaches(parentOf: Map<string, string | null>, start: string, id: string): boolean {
  const seen = new Set<string>();
  for (let current: string | null | undefined = start; current && !seen.has(current); current = parentOf.get(current)) {
    if (current === id) return true;
    seen.add(current);
  }
  return false;
}

/** Routine with what its occurrences are computed from. */
export type RoutineTiming = Pick<Routine, 'startDate' | 'recurrence' | 'scheduleAnchor' | 'cases' | 'moves' | 'fromTime' | 'dueTime'> & { schedule: WorkSchedule | null };

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
 * Stored exceptions of a routine (invalid ones left out).
 * @param {unknown} value Stored JSON.
 * @returns {RoutineMove[]} Occurrences moved.
 */
export function storedMoves(value: unknown): RoutineMove[] {
  const parsed = z.array(routineMoveSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * Current and next occurrences of a routine today: the days of its cases, else of its calendar schedule, else of its
 * repetition; then its exceptions (occurrences moved to another day).
 * @param {RoutineTiming} routine Routine with its schedule.
 * @param {string} [today] Today. Optional. Default = today in Paris.
 * @returns {{ current: string | null, next: string | null }} Dates.
 */
export function occurrencesOf(routine: RoutineTiming, today = routineToday()): { current: string | null; next: string | null } {
  const start = formatDay(routine.startDate);
  const cases = storedCases(routine.cases);
  const rule = storedRecurrence(routine.recurrence);
  const schedule = routine.schedule ? scheduleRule(routine.schedule) : null;
  /**
   * Occurrences of the rule alone.
   * @param {string} day Day.
   * @returns {{ current: string | null, next: string | null }} Dates.
   */
  const compute = (day: string) => {
    if (cases.length) return casesOccurrences(cases, start, day);
    if (schedule) return scheduleOccurrences(schedule, start, day);
    return rule ? routineOccurrences(rule, start, day) : { current: null, next: null };
  };
  return movedOccurrences(compute, storedMoves(routine.moves), today);
}

/**
 * Occurrences of a routine in a period (both days included): the days of its cases, else of its calendar schedule,
 * else of its repetition, without those moved away and with those moved in.
 * @param {RoutineTiming} routine Routine with its schedule.
 * @param {string} from First day.
 * @param {string} to Last day.
 * @returns {string[]} Days, in order.
 */
export function occurrencesBetween(routine: RoutineTiming, from: string, to: string): string[] {
  const start = formatDay(routine.startDate);
  const first = from < start ? start : from;
  const days = new Set<string>();
  if (first <= to) {
    const cases = storedCases(routine.cases);
    const rule = storedRecurrence(routine.recurrence);
    if (cases.length) {
      for (const item of cases) {
        const own = caseStart(item, start);
        if (own <= to) for (const day of occurrenceDates(item.recurrence, own, first < own ? own : first, to)) days.add(day);
      }
    } else if (routine.schedule) for (const slot of plannedSlots([scheduleRule(routine.schedule)], first, to)) days.add(slot.date);
    else if (rule) for (const day of occurrenceDates(rule, start, first, to)) days.add(day);
  }
  for (const move of storedMoves(routine.moves)) {
    days.delete(move.from);
    if (move.to && move.to >= from && move.to <= to) days.add(move.to);
  }
  return [...days].sort();
}

/**
 * First occurrence of a routine (looked for over ten years from its start; moves included).
 * @param {RoutineTiming} routine Routine with its schedule.
 * @returns {string | null} Day, null without any.
 */
export function firstOccurrence(routine: RoutineTiming): string | null {
  let from = formatDay(routine.startDate);
  for (let year = 0; year < 10; year += 1) {
    const to = addDays(from, 365);
    const [first] = occurrencesBetween(routine, from, to);
    if (first) return first;
    from = addDays(to, 1);
  }
  return null;
}

/**
 * Times of the day of a routine on a day of its rule: those of its case that day, else the window of its calendar
 * schedule, else its own window (one time).
 * @param {RoutineTiming} routine Routine with its schedule.
 * @param {string} date Day of the rule.
 * @returns {RoutineSlot[]} Times (none: not on that day).
 */
function ruleSlotsOn(routine: RoutineTiming, date: string): RoutineSlot[] {
  const cases = storedCases(routine.cases);
  if (cases.length) return routineCaseOn(cases, formatDay(routine.startDate), date)?.slots ?? [];
  if (routine.schedule && routine.scheduleAnchor) return [{ ...scheduleWindow(scheduleRule(routine.schedule), routine.scheduleAnchor as RoutineAnchor, date), optional: false }];
  return [{ fromTime: routine.fromTime, dueTime: routine.dueTime, optional: false }];
}

/**
 * Times of the day of a routine on a date: those of its rule on its own day (a moved occurrence keeps them), with
 * those its exception changes.
 * @param {RoutineTiming} routine Routine with its schedule.
 * @param {string | null} occurrence Day of the occurrence.
 * @returns {RoutineSlot[]} Times (none: not on that day).
 */
export function slotsOf(routine: RoutineTiming, occurrence: string | null): RoutineSlot[] {
  if (!occurrence) return [];
  const moves = storedMoves(routine.moves);
  const date = movedFrom(moves, occurrence);
  const move = moves.find((item) => item.from === date && item.to === occurrence);
  return withMovedTimes(ruleSlotsOn(routine, date), move?.times ?? null);
}

// Categories ------------------------------------------------------------------------------------------------------

/**
 * Validates a category: its parent exists and is not the category or one of its sub-categories.
 * @param {RoutineCategoryInput} input Category.
 * @param {string} [id] Category edited. Optional.
 * @returns {Promise<ReturnType<typeof routineCategorySchema.parse>>} Category.
 */
async function parseCategory(input: RoutineCategoryInput, id?: string) {
  const data = parseInput(routineCategorySchema, input);
  if (!data.parentId) return data;
  const all = await prisma.routineCategory.findMany({ select: { id: true, parentId: true } });
  if (!all.some((category) => category.id === data.parentId)) throw notFound('Catégorie parente');
  if (id && reaches(new Map(all.map((category) => [category.id, category.parentId])), data.parentId, id)) {
    throw fieldError('parentId', 'Une catégorie ne peut pas être rangée sous elle-même.');
  }
  return data;
}

/**
 * Creates a category.
 * @param {RoutineCategoryInput} input Category.
 * @returns {Promise<RoutineCategory>} Category.
 */
export async function createCategory(input: RoutineCategoryInput): Promise<RoutineCategory> {
  const data = await parseCategory(input);
  return prisma.routineCategory.create({ data: { ...data, position: await nextCategoryPosition(data.parentId) } });
}

/**
 * Updates a category.
 * @param {string} id Category id.
 * @param {RoutineCategoryInput} input Category.
 * @returns {Promise<RoutineCategory>} Category.
 */
export async function updateCategory(id: string, input: RoutineCategoryInput): Promise<RoutineCategory> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  const previous = await prisma.routineCategory.findUnique({ where: { id }, select: { parentId: true } });
  if (!previous) throw notFound('Catégorie');
  const data = await parseCategory(input, id);
  // Under another parent, it goes last.
  const moved = (data.parentId ?? null) !== previous.parentId;
  return prisma.routineCategory.update({ where: { id }, data: { ...data, ...(moved && { position: await nextCategoryPosition(data.parentId) }) } });
}

/**
 * Moves a category under another one, or to the top level.
 * @param {string} id Category id.
 * @param {string | null} parentId New parent.
 * @param {number | null} [index] Index among its new siblings; last when omitted. Optional.
 * @returns {Promise<void>}
 */
export async function moveCategory(id: string, parentId: string | null, index?: number | null): Promise<void> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  if (parentId !== category.parentId) await updateCategory(id, { name: category.name, color: category.color, parentId });
  if (index === null || index === undefined) return;
  const siblings = await prisma.routineCategory.findMany({ where: { parentId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true } });
  await saveSiblingOrder(
    siblings.map((sibling) => sibling.id),
    id,
    index,
    (siblingId, position) => prisma.routineCategory.update({ where: { id: siblingId }, data: { position } }),
  );
}

/**
 * Next position among the sub-categories of a parent.
 * @param {string | null | undefined} parentId Parent, null for the top level.
 * @returns {Promise<number>} Position.
 */
async function nextCategoryPosition(parentId: string | null | undefined): Promise<number> {
  const { _max } = await prisma.routineCategory.aggregate({ where: { parentId: parentId ?? null }, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/**
 * Deletes a category: its routines lose it, its sub-categories go one level up.
 * @param {string} id Category id.
 * @returns {Promise<void>}
 */
export async function deleteCategory(id: string): Promise<void> {
  const category = await prisma.routineCategory.findUnique({ where: { id } });
  if (!category) throw notFound('Catégorie');
  await prisma.$transaction([prisma.routineCategory.updateMany({ where: { parentId: id }, data: { parentId: category.parentId } }), prisma.routineCategory.delete({ where: { id } })]);
}

// Routines --------------------------------------------------------------------------------------------------------

/**
 * Validates a routine and what it points to: category, parent (not itself nor one of its sub-routines), project,
 * assignees and required routines (no cycle).
 * @param {RoutineInput} input Routine.
 * @param {string} [id] Routine edited. Optional.
 * @returns {Promise<ReturnType<typeof routineSchema.parse>>} Routine.
 */
async function parseRoutine(input: RoutineInput, id?: string) {
  const data = parseInput(routineSchema, input);
  data.assigneeIds = [...new Set(data.assigneeIds)];
  data.categoryIds = [...new Set(data.categoryIds)];
  data.requiredIds = [...new Set(data.requiredIds)];
  if (data.recurrence.until && data.recurrence.until < data.startDate) throw fieldError('recurrence', 'La fin de la répétition doit suivre la date de début.');
  if ((await prisma.routineCategory.count({ where: { id: { in: data.categoryIds } } })) !== data.categoryIds.length) throw fieldError('categoryIds', 'Catégorie introuvable.');
  if (data.scheduleId && !(await prisma.workSchedule.findUnique({ where: { id: data.scheduleId }, select: { id: true } }))) throw fieldError('scheduleId', 'Plage introuvable.');
  // With cases, its days and times come from them; following a schedule, from it.
  if (data.cases.length) Object.assign(data, { scheduleId: null, scheduleAnchor: null, fromTime: null, dueTime: null });
  if (data.scheduleId) Object.assign(data, { fromTime: null, dueTime: null });
  else data.scheduleAnchor = null;
  if (data.projectId && !(await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } }))) throw fieldError('projectId', 'Projet introuvable.');
  if ((await prisma.contributor.count({ where: { id: { in: data.assigneeIds } } })) !== data.assigneeIds.length) throw fieldError('assigneeIds', 'Assigné introuvable.');

  const all = await prisma.routine.findMany({ select: { id: true, parentId: true, requires: { select: { requiredId: true } } } });
  const known = new Set(all.map((routine) => routine.id));
  if (data.parentId) {
    if (!known.has(data.parentId)) throw fieldError('parentId', 'Routine parente introuvable.');
    if (id && reaches(new Map(all.map((routine) => [routine.id, routine.parentId])), data.parentId, id)) {
      throw fieldError('parentId', 'Une routine ne peut pas être rangée sous elle-même.');
    }
  }
  if (data.requiredIds.some((requiredId) => !known.has(requiredId))) throw fieldError('requiredIds', 'Routine introuvable.');
  if (id && data.requiredIds.includes(id)) throw fieldError('requiredIds', 'Une routine ne peut pas dépendre d’elle-même.');
  if (id && data.requiredIds.length) {
    // No cycle: none of the required routines may (indirectly) require this one.
    const requires = new Map(all.map((routine) => [routine.id, routine.requires.map((dependency) => dependency.requiredId)]));
    const stack = [...data.requiredIds];
    const seen = new Set<string>();
    while (stack.length) {
      const current = stack.pop()!;
      if (current === id) throw fieldError('requiredIds', 'Ces dépendances forment une boucle.');
      if (seen.has(current)) continue;
      seen.add(current);
      stack.push(...(requires.get(current) ?? []));
    }
  }
  return data;
}

/**
 * Prisma data of a validated routine.
 * @param {ReturnType<typeof routineSchema.parse>} data Routine.
 * @returns {object} Scalar fields.
 */
const scalars = (data: ReturnType<typeof routineSchema.parse>) => ({
  title: data.title,
  description: data.description,
  parentId: data.parentId,
  startDate: parseDay(data.startDate),
  recurrence: data.recurrence,
  estimate: data.estimate,
  fromTime: data.fromTime,
  dueTime: data.dueTime,
  scheduleId: data.scheduleId,
  scheduleAnchor: data.scheduleAnchor,
  reminders: [...new Set(data.reminders)].sort((a, b) => a - b),
  cases: data.cases,
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
  const position = ((await prisma.routine.aggregate({ where: { parentId: data.parentId }, _max: { position: true } }))._max.position ?? -1) + 1;
  return prisma.$transaction(async (tx) => {
    const routine = await tx.routine.create({
      data: { ...scalars(data), position, assignees: { connect: data.assigneeIds.map((id) => ({ id })) }, categories: { connect: data.categoryIds.map((id) => ({ id })) } },
    });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: routine.id, requiredId })) });
    return routine;
  });
}

/**
 * Loads a routine or throws NOT_FOUND.
 * @param {string} id Routine id.
 * @returns {Promise<Routine>} Routine.
 */
async function findRoutine(id: string): Promise<Routine> {
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine) throw notFound('Routine');
  return routine;
}

/**
 * Updates a routine (its ticked occurrences stay).
 * @param {string} id Routine id.
 * @param {RoutineInput} input Routine.
 * @returns {Promise<Routine>} Routine.
 */
export async function updateRoutine(id: string, input: RoutineInput): Promise<Routine> {
  await findRoutine(id);
  const data = await parseRoutine(input, id);
  return prisma.$transaction(async (tx) => {
    await tx.routineDependency.deleteMany({ where: { routineId: id } });
    if (data.requiredIds.length) await tx.routineDependency.createMany({ data: data.requiredIds.map((requiredId) => ({ routineId: id, requiredId })) });
    return tx.routine.update({
      where: { id },
      data: { ...scalars(data), assignees: { set: data.assigneeIds.map((assigneeId) => ({ id: assigneeId })) }, categories: { set: data.categoryIds.map((categoryId) => ({ id: categoryId })) } },
    });
  });
}

/**
 * Current form of a routine as an input.
 * @param {string} id Routine id.
 * @returns {Promise<RoutineInput>} Input.
 */
async function inputOf(id: string): Promise<RoutineInput> {
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: { assignees: { select: { id: true } }, categories: { select: { id: true } }, requires: { select: { requiredId: true } } },
  });
  if (!routine) throw notFound('Routine');
  return {
    title: routine.title,
    description: routine.description,
    categoryIds: routine.categories.map((category) => category.id),
    parentId: routine.parentId,
    startDate: formatDay(routine.startDate),
    recurrence: storedRecurrence(routine.recurrence) ?? (routine.recurrence as RoutineInput['recurrence']),
    estimate: routine.estimate,
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    scheduleId: routine.scheduleId,
    scheduleAnchor: routine.scheduleAnchor as RoutineAnchor | null,
    reminders: routine.reminders,
    cases: storedCases(routine.cases),
    location: routine.location,
    locationLat: routine.locationLat,
    locationLon: routine.locationLon,
    travelBefore: routine.travelBefore,
    travelAfter: routine.travelAfter,
    projectId: routine.projectId,
    assigneeIds: routine.assignees.map((assignee) => assignee.id),
    requiredIds: routine.requires.map((dependency) => dependency.requiredId),
  };
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

/** Same changes for several routines: values set, or ids added to and removed from their lists. */
export interface RoutineBulkChanges {
  addCategoryIds?: string[];
  removeCategoryIds?: string[];
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addRequiredIds?: string[];
  removeRequiredIds?: string[];
  /** Minutes, null: none, undefined: unchanged. */
  estimate?: number | null;
  /** Null: none, undefined: unchanged. */
  projectId?: string | null;
  /** Null: no limit, undefined: unchanged. */
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: unknown;
}

/**
 * List with ids added and removed.
 * @param {string[]} list Current ids.
 * @param {string[]} [added] Added ids. Optional.
 * @param {string[]} [removed] Removed ids. Optional.
 * @returns {string[]} New ids.
 */
const changedList = (list: string[], added: string[] = [], removed: string[] = []) => [...new Set([...list.filter((id) => !removed.includes(id)), ...added])];

/**
 * Applies the same changes to several routines; every routine is checked before any is saved.
 * @param {string[]} ids Routine ids.
 * @param {RoutineBulkChanges} changes Changes.
 * @returns {Promise<number>} Number of routines changed.
 */
export async function bulkUpdateRoutines(ids: string[], changes: RoutineBulkChanges): Promise<number> {
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
        // Times or a repetition of its own: it no longer follows its schedule.
        ...((changes.fromTime !== undefined || changes.dueTime !== undefined || changes.recurrence !== undefined) && { scheduleId: null, scheduleAnchor: null, cases: [] }),
        ...(changes.fromTime !== undefined && { fromTime: changes.fromTime }),
        ...(changes.dueTime !== undefined && { dueTime: changes.dueTime }),
        ...(changes.startDate !== undefined && { startDate: changes.startDate }),
        ...(changes.recurrence !== undefined && { recurrence: changes.recurrence as RoutineInput['recurrence'] }),
      };
      return { id, input };
    }),
  );
  for (const { id, input } of inputs) await parseRoutine(input, id);
  for (const { id, input } of inputs) await updateRoutine(id, input);
  return inputs.length;
}

/**
 * Archives or restores a routine (an archived one is no longer due).
 * @param {string} id Routine id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Routine>} Routine.
 */
export async function setRoutineArchived(id: string, archived: boolean): Promise<Routine> {
  await findRoutine(id);
  return prisma.routine.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}

/**
 * Archives or restores several routines.
 * @param {string[]} ids Routine ids.
 * @param {boolean} archived Target state.
 * @returns {Promise<number>} Number of routines changed.
 */
export async function bulkSetRoutinesArchived(ids: string[], archived: boolean): Promise<number> {
  return (await prisma.routine.updateMany({ where: { id: { in: ids } }, data: { archivedAt: archived ? new Date() : null } })).count;
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
  await prisma.$transaction([prisma.routine.updateMany({ where: { parentId: id }, data: { parentId: routine.parentId } }), prisma.routine.delete({ where: { id } })]);
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
  const parentId = place === 'INSIDE' ? target.id : target.parentId;
  // The parent is checked (no loop) by the regular update.
  if (parentId !== routine.parentId || categoryIds) await patchRoutine(id, { parentId, ...(categoryIds && { categoryIds }) });
  const siblings = (await prisma.routine.findMany({ where: { parentId, id: { not: id } }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } })).map((sibling) => sibling.id);
  const index = siblings.indexOf(target.id);
  siblings.splice(place === 'INSIDE' || index === -1 ? siblings.length : place === 'BEFORE' ? index : index + 1, 0, id);
  await prisma.$transaction(siblings.map((siblingId, position) => prisma.routine.update({ where: { id: siblingId }, data: { position } })));
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
  const routine = await prisma.routine.findUnique({ where: { id }, include: { schedule: true } });
  if (!routine) throw notFound('Routine');
  const occurrence = date ?? occurrencesOf(routine).current;
  if (!occurrence) throw clientError('BAD_USER_INPUT', 'Cette routine n’a pas encore commencé.');
  if (occurrence > routineToday()) throw clientError('BAD_USER_INPUT', 'Une occurrence à venir ne peut pas être cochée.');
  const index = slot ?? 0;
  if (index < 0 || index >= Math.max(1, slotsOf(routine, occurrence).length)) throw clientError('BAD_USER_INPUT', 'Moment introuvable ce jour-là.');
  if (doneAt && doneAt.getTime() > Date.now()) throw clientError('BAD_USER_INPUT', 'Une routine ne peut pas être faite dans le futur.', { fields: { doneAt: 'Heure à venir.' } });
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
  const today = routineToday();
  let count = 0;
  for (const routine of await prisma.routine.findMany({ where: { id: { in: ids } }, include: { schedule: true } })) {
    const current = occurrencesOf(routine, today).current;
    if (!current) continue;
    // Every time of the day, or none of them.
    const slots = Math.max(1, slotsOf(routine, current).length);
    for (let slot = 0; slot < slots; slot += 1) await setRoutineDone(routine.id, done, current, slot);
    count += 1;
  }
  return count;
}

/**
 * Moves an occurrence of a routine to another day (postponed or brought forward): an exception to its rule. Moving it
 * back to its own day removes the exception. A ticked occurrence is not moved.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @param {string} to New day.
 * @returns {Promise<void>}
 */
export async function moveRoutineOccurrence(id: string, date: string, to: string): Promise<void> {
  const routine = await prisma.routine.findUnique({ where: { id }, select: { startDate: true, moves: true } });
  if (!routine) throw notFound('Routine');
  const move = parseInput(routineMoveSchema, { from: date, to });
  if (move.to && move.to < formatDay(routine.startDate)) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
  if (await prisma.routineCheck.count({ where: { routineId: id, date: parseDay(date) } })) {
    throw clientError('BAD_USER_INPUT', 'Cette occurrence est déjà cochée : décochez-la pour la déplacer.');
  }
  const moves = withMove(storedMoves(routine.moves), move.from, move.to);
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
  const routine = await prisma.routine.findUnique({ where: { id }, select: { moves: true } });
  if (!routine) throw notFound('Routine');
  await prisma.routine.update({ where: { id }, data: { moves: storedMoves(routine.moves).filter((move) => move.from !== from) } });
}

/** Which occurrences a change applies to: this one (an exception), it and the following ones, or all. */
export type RoutineScope = 'THIS' | 'FOLLOWING' | 'ALL';

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
 * Loads a routine with what its occurrences are computed from, and checks an occurrence of it can change: not ticked.
 * @param {string} id Routine id.
 * @param {string} date Occurrence (its day now).
 * @returns {Promise<Routine & { schedule: WorkSchedule | null }>} Routine.
 */
async function changeableOccurrence(id: string, date: string) {
  const routine = await prisma.routine.findUnique({ where: { id }, include: { schedule: true } });
  if (!routine) throw notFound('Routine');
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
  const parsedTo = parseInput(z.iso.date({ error: 'Date invalide.' }), to);
  const window = parseInput(routineSlotSchema, { ...times, optional: false });
  if (parsedTo < start) throw fieldError('to', 'La routine n’a pas encore commencé ce jour-là.');
  const moves = storedMoves(routine.moves);
  const origin = movedFrom(moves, date);
  const base = ruleSlotsOn(routine, origin);
  if (slot < 0 || slot >= Math.max(1, base.length)) throw clientError('BAD_USER_INPUT', 'Moment introuvable ce jour-là.');
  const cases = storedCases(routine.cases);
  const rule = storedRecurrence(routine.recurrence);

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
  if (!cases.length && routine.scheduleId) {
    throw clientError('BAD_USER_INPUT', 'Cette routine suit une plage : changez la plage, ou cette occurrence seulement.');
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
    if (scope === 'FOLLOWING' && hasBefore(rule, start, origin)) {
      // Its repetition becomes two cases: the former one up to the occurrence, the new one from it.
      await patchRoutine(id, {
        cases: [
          { from: null, recurrence: endedBefore(rule, start, origin), slots: [{ fromTime: routine.fromTime, dueTime: routine.dueTime, optional: false }] },
          { from: parsedTo, recurrence: shiftedRule(rule, start, origin, parsedTo, true), slots: [{ fromTime: window.fromTime, dueTime: window.dueTime, optional: false }] },
        ],
      });
    } else {
      const listed = rule.frequency === 'WEEKLY' && rule.weekdays.length > 0;
      const startDate = delta === 0 || listed ? start : addDays(start, delta);
      await patchRoutine(id, { startDate, recurrence: shiftedRule(rule, start, origin, parsedTo, false), fromTime: window.fromTime, dueTime: window.dueTime });
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
  const rule = storedRecurrence(routine.recurrence);
  if (!cases.length && routine.scheduleId) throw clientError('BAD_USER_INPUT', 'Cette routine suit une plage : supprimez cette occurrence seulement, ou archivez la routine.');
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
