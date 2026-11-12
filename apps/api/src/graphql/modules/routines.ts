import { formatDay, parseDay, routineOccurrences, type RoutineInput } from '@ordo/shared';
import { prisma } from '../../db';
import { storedRecurrence } from '../../services/calendar-events';
import * as routines from '../../services/routines';
import { builder } from '../builder';

builder.prismaObject('RoutineCategory', {
  description: 'Category of the routines, in a tree.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color', { nullable: true }),
    parentId: t.exposeID('parentId', { nullable: true }),
  }),
});

/**
 * Current and next occurrences of a stored routine, today.
 * @param {{ startDate: Date, recurrence: unknown }} routine Routine.
 * @returns {{ current: Date | null, next: Date | null }} Dates.
 */
const occurrencesOf = (routine: { startDate: Date; recurrence: unknown }) => {
  const rule = storedRecurrence(routine.recurrence);
  const { current, next } = rule ? routineOccurrences(rule, formatDay(routine.startDate), routines.routineToday()) : { current: null, next: null };
  return { current: current ? parseDay(current) : null, next: next ? parseDay(next) : null };
};

/** Ticked occurrences loaded with a routine (the latest ones). */
const RECENT_CHECKS = 30;

builder.prismaObject('Routine', {
  description: 'Task repeating on a calendar rule, ticked once done for its current occurrence.',
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    categoryIds: t.idList({
      description: 'Categories it is shown in.',
      select: { categories: { select: { id: true } } },
      resolve: (routine) => routine.categories.map((category) => category.id),
    }),
    parentId: t.exposeID('parentId', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date' }),
    recurrence: t.expose('recurrence', { type: 'JSON' }),
    estimate: t.exposeInt('estimate', { nullable: true, description: 'Minutes.' }),
    projectId: t.exposeID('projectId', { nullable: true }),
    position: t.exposeInt('position'),
    archived: t.boolean({ resolve: (routine) => routine.archivedAt !== null }),
    assigneeIds: t.idList({ select: { assignees: { select: { id: true } } }, resolve: (routine) => routine.assignees.map((assignee) => assignee.id) }),
    requiredIds: t.idList({
      description: 'Routines to do before this one.',
      select: { requires: { select: { requiredId: true } } },
      resolve: (routine) => routine.requires.map((dependency) => dependency.requiredId),
    }),
    currentDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'Current occurrence: the last one on or before today (null before the start or after the end).',
      select: { startDate: true, recurrence: true },
      resolve: (routine) => occurrencesOf(routine).current,
    }),
    nextDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence after today.',
      select: { startDate: true, recurrence: true },
      resolve: (routine) => occurrencesOf(routine).next,
    }),
    doneDates: t.field({
      type: ['Date'],
      description: `Latest ticked occurrences (${RECENT_CHECKS} at most), latest first.`,
      select: { checks: { orderBy: { date: 'desc' }, take: RECENT_CHECKS, select: { date: true } } },
      resolve: (routine) => routine.checks.map((check) => check.date),
    }),
    lastDoneAt: t.field({
      type: 'DateTime',
      nullable: true,
      select: { checks: { orderBy: { doneAt: 'desc' }, take: 1, select: { doneAt: true } } },
      resolve: (routine) => routine.checks[0]?.doneAt ?? null,
    }),
    trackedSeconds: t.int({
      description: 'Time tracked on it, finished entries only.',
      select: { timeEntries: { select: { duration: true } } },
      resolve: (routine) => routine.timeEntries.reduce((total, entry) => total + (entry.duration ?? 0), 0),
    }),
  }),
});

const RoutinePlaceEnum = builder.enumType('RoutinePlace', { values: ['BEFORE', 'AFTER', 'INSIDE'] as const, description: 'Where a routine is dropped, relative to another one.' });

const CategoryInput = builder.inputType('RoutineCategoryInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string(), parentId: t.id() }),
});

const RoutineInputType = builder.inputType('RoutineInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    description: t.string(),
    categoryIds: t.idList({ required: true }),
    parentId: t.id(),
    startDate: t.field({ type: 'Date', required: true }),
    recurrence: t.field({ type: 'JSON', required: true }),
    estimate: t.int({ description: 'Minutes.' }),
    projectId: t.id(),
    assigneeIds: t.idList({ required: true }),
    requiredIds: t.idList({ required: true }),
  }),
});

const RoutinePatch = builder.inputType('RoutinePatch', {
  description: 'Changes of a routine (omitted fields unchanged).',
  fields: (t) => ({
    title: t.string(),
    categoryIds: t.idList(),
    parentId: t.id({ description: 'Null: top level.' }),
    estimate: t.int(),
    assigneeIds: t.idList(),
    requiredIds: t.idList(),
  }),
});

/**
 * Optional id as a string or null.
 * @param {string | number | null | undefined} id GraphQL id.
 * @returns {string | null} Id.
 */
const idOrNull = (id: string | number | null | undefined) => (id === null || id === undefined ? null : String(id));

/**
 * Routine input with omitted optional fields as null.
 * @param {typeof RoutineInputType.$inferInput} input GraphQL input.
 * @returns {RoutineInput} Service input.
 */
const routineInput = (input: typeof RoutineInputType.$inferInput): RoutineInput => ({
  title: input.title,
  description: input.description ?? null,
  categoryIds: input.categoryIds.map(String),
  parentId: idOrNull(input.parentId),
  startDate: input.startDate,
  recurrence: input.recurrence as RoutineInput['recurrence'],
  estimate: input.estimate ?? null,
  projectId: idOrNull(input.projectId),
  assigneeIds: input.assigneeIds.map(String),
  requiredIds: input.requiredIds.map(String),
});

builder.queryFields((t) => ({
  routineCategories: t.prismaField({
    type: ['RoutineCategory'],
    resolve: (query) => prisma.routineCategory.findMany({ ...query, orderBy: { name: 'asc' } }),
  }),
  routines: t.prismaField({
    type: ['Routine'],
    description: 'Every routine, archived ones included, in manual order.',
    resolve: (query) => prisma.routine.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  createRoutineCategory: t.id({
    args: { input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { input }) => (await routines.createCategory({ name: input.name, color: input.color ?? null, parentId: idOrNull(input.parentId) })).id,
  }),
  updateRoutineCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CategoryInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await routines.updateCategory(String(id), { name: input.name, color: input.color ?? null, parentId: idOrNull(input.parentId) });
      return true;
    },
  }),
  moveRoutineCategory: t.boolean({
    description: 'Moves a category under another one (parentId), or to the top level (parentId null).',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id() },
    resolve: async (_root, { id, parentId }) => {
      await routines.moveCategory(String(id), idOrNull(parentId));
      return true;
    },
  }),
  deleteRoutineCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await routines.deleteCategory(String(id));
      return true;
    },
  }),
  createRoutine: t.id({
    args: { input: t.arg({ type: RoutineInputType, required: true }) },
    resolve: async (_root, { input }) => (await routines.createRoutine(routineInput(input))).id,
  }),
  updateRoutine: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: RoutineInputType, required: true }) },
    resolve: async (_root, { id, input }) => {
      await routines.updateRoutine(String(id), routineInput(input));
      return true;
    },
  }),
  patchRoutine: t.boolean({
    description: 'Changes some fields of a routine (inline edits).',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: RoutinePatch, required: true }) },
    resolve: async (_root, { id, input }) => {
      const changes: Partial<RoutineInput> = {};
      if (input.title !== undefined && input.title !== null) changes.title = input.title;
      if (input.categoryIds) changes.categoryIds = input.categoryIds.map(String);
      if (input.parentId !== undefined) changes.parentId = idOrNull(input.parentId);
      if (input.estimate !== undefined) changes.estimate = input.estimate;
      if (input.assigneeIds) changes.assigneeIds = input.assigneeIds.map(String);
      if (input.requiredIds) changes.requiredIds = input.requiredIds.map(String);
      await routines.patchRoutine(String(id), changes);
      return true;
    },
  }),
  moveRoutine: t.boolean({
    description: 'Moves a routine before or after another one (same parent), or last under it; categoryIds, when given, become its categories.',
    args: {
      id: t.arg.id({ required: true }),
      targetId: t.arg.id({ required: true }),
      place: t.arg({ type: RoutinePlaceEnum, required: true }),
      categoryIds: t.arg.idList(),
    },
    resolve: async (_root, { id, targetId, place, categoryIds }) => {
      await routines.moveRoutine(String(id), String(targetId), place, categoryIds ? categoryIds.map(String) : null);
      return true;
    },
  }),
  setRoutineDone: t.field({
    type: 'Date',
    description: 'Ticks or unticks an occurrence (by default the current one); returns its date.',
    args: { id: t.arg.id({ required: true }), done: t.arg.boolean({ required: true }), date: t.arg({ type: 'Date' }) },
    resolve: async (_root, { id, done, date }) => parseDay(await routines.setRoutineDone(String(id), done, date ?? null)),
  }),
  setRoutineArchived: t.boolean({
    args: { id: t.arg.id({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: async (_root, { id, archived }) => {
      await routines.setRoutineArchived(String(id), archived);
      return true;
    },
  }),
  deleteRoutine: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await routines.deleteRoutine(String(id));
      return true;
    },
  }),
}));
