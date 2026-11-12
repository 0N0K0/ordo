import { parseDay, type RoutineInput } from '@ordo/shared';
import { prisma } from '../../db';
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

/** Selection computing the occurrences and window of a routine. */
const TIMING = { startDate: true, recurrence: true, scheduleAnchor: true, schedule: true } as const;

/**
 * Calendar date as a Date (the Date scalar), or null.
 * @param {string | null} date YYYY-MM-DD.
 * @returns {Date | null} Date.
 */
const asDate = (date: string | null) => (date ? parseDay(date) : null);

/**
 * Window of a routine following a schedule, on its current occurrence (or its next one before it starts).
 * @param {routines.RoutineTiming} routine Routine.
 * @returns {{ fromTime: string | null, dueTime: string | null } | null} Window.
 */
const windowOf = (routine: routines.RoutineTiming) => {
  const { current, next } = routines.occurrencesOf(routine);
  return routines.scheduleWindowOf(routine, current ?? next);
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
    fromTime: t.exposeString('fromTime', { nullable: true, description: 'Time to do it from (HH:MM), its own (see windowFrom).' }),
    scheduleId: t.exposeID('scheduleId', { nullable: true, description: 'Calendar schedule it follows (its days and times).' }),
    scheduleAnchor: t.exposeString('scheduleAnchor', { nullable: true, description: 'START, WHOLE or END of the schedule.' }),
    reminders: t.exposeIntList('reminders', { description: 'Alerts, in minutes before its moment (when to leave, else its start, else its latest time).' }),
    windowFrom: t.string({
      nullable: true,
      description: 'Time to do it from on its current (or next) occurrence: its own, or the one of its schedule.',
      select: { ...TIMING, fromTime: true },
      resolve: (routine) => (routine.schedule ? (windowOf(routine)?.fromTime ?? null) : routine.fromTime),
    }),
    windowTo: t.string({
      nullable: true,
      description: 'Latest time to do it by on its current (or next) occurrence: its own, or the one of its schedule.',
      select: { ...TIMING, dueTime: true },
      resolve: (routine) => (routine.schedule ? (windowOf(routine)?.dueTime ?? null) : routine.dueTime),
    }),
    dueTime: t.exposeString('dueTime', { nullable: true, description: 'Latest time to do it by (HH:MM).' }),
    location: t.exposeString('location', { nullable: true }),
    locationLat: t.exposeFloat('locationLat', { nullable: true }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    travelBefore: t.exposeInt('travelBefore', { description: 'Minutes to get there.' }),
    travelAfter: t.exposeInt('travelAfter', { description: 'Minutes to get back.' }),
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
      select: TIMING,
      resolve: (routine) => asDate(routines.occurrencesOf(routine).current),
    }),
    nextDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence after today.',
      select: TIMING,
      resolve: (routine) => asDate(routines.occurrencesOf(routine).next),
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
    fromTime: t.string({ description: 'HH:MM.' }),
    scheduleId: t.id(),
    scheduleAnchor: t.string({ description: 'START, WHOLE or END.' }),
    reminders: t.intList(),
    dueTime: t.string({ description: 'HH:MM.' }),
    location: t.string(),
    locationLat: t.float(),
    locationLon: t.float(),
    travelBefore: t.int(),
    travelAfter: t.int(),
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
    projectId: t.id({ description: 'Null: none.' }),
    fromTime: t.string({ description: 'HH:MM; null: no limit.' }),
    dueTime: t.string({ description: 'HH:MM; null: no limit.' }),
    startDate: t.field({ type: 'Date' }),
    recurrence: t.field({ type: 'JSON' }),
  }),
});

const RoutineBulkChangesInput = builder.inputType('RoutineBulkChanges', {
  description: 'Same changes for several routines (omitted fields unchanged; null clears estimate and projectId).',
  fields: (t) => ({
    addCategoryIds: t.idList(),
    removeCategoryIds: t.idList(),
    addAssigneeIds: t.idList(),
    removeAssigneeIds: t.idList(),
    addRequiredIds: t.idList(),
    removeRequiredIds: t.idList(),
    estimate: t.int({ description: 'Minutes.' }),
    projectId: t.id(),
    fromTime: t.string({ description: 'HH:MM; null: no limit.' }),
    dueTime: t.string({ description: 'HH:MM; null: no limit.' }),
    startDate: t.field({ type: 'Date' }),
    recurrence: t.field({ type: 'JSON' }),
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
  fromTime: input.fromTime ?? null,
  scheduleId: idOrNull(input.scheduleId),
  scheduleAnchor: (input.scheduleAnchor ?? null) as RoutineInput['scheduleAnchor'],
  reminders: input.reminders ?? [],
  dueTime: input.dueTime ?? null,
  location: input.location ?? null,
  locationLat: input.locationLat ?? null,
  locationLon: input.locationLon ?? null,
  travelBefore: input.travelBefore ?? 0,
  travelAfter: input.travelAfter ?? 0,
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
      if (input.projectId !== undefined) changes.projectId = idOrNull(input.projectId);
      // Times or a repetition of its own: it no longer follows its schedule.
      if (input.fromTime !== undefined || input.dueTime !== undefined || (input.recurrence !== undefined && input.recurrence !== null))
        Object.assign(changes, { scheduleId: null, scheduleAnchor: null });
      if (input.fromTime !== undefined) changes.fromTime = input.fromTime;
      if (input.dueTime !== undefined) changes.dueTime = input.dueTime;
      if (input.startDate) changes.startDate = input.startDate;
      if (input.recurrence !== undefined && input.recurrence !== null) changes.recurrence = input.recurrence as RoutineInput['recurrence'];
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
  bulkUpdateRoutines: t.int({
    description: 'Applies the same changes to several routines; returns how many changed.',
    args: { ids: t.arg.idList({ required: true }), changes: t.arg({ type: RoutineBulkChangesInput, required: true }) },
    resolve: (_root, { ids, changes }) => {
      const list = (value: (string | number)[] | null | undefined) => (value ? value.map(String) : undefined);
      return routines.bulkUpdateRoutines(ids.map(String), {
        addCategoryIds: list(changes.addCategoryIds),
        removeCategoryIds: list(changes.removeCategoryIds),
        addAssigneeIds: list(changes.addAssigneeIds),
        removeAssigneeIds: list(changes.removeAssigneeIds),
        addRequiredIds: list(changes.addRequiredIds),
        removeRequiredIds: list(changes.removeRequiredIds),
        estimate: changes.estimate,
        projectId: changes.projectId === undefined ? undefined : idOrNull(changes.projectId),
        fromTime: changes.fromTime,
        dueTime: changes.dueTime,
        startDate: changes.startDate ?? undefined,
        recurrence: changes.recurrence ?? undefined,
      });
    },
  }),
  bulkSetRoutinesArchived: t.int({
    args: { ids: t.arg.idList({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, archived }) => routines.bulkSetRoutinesArchived(ids.map(String), archived),
  }),
  bulkSetRoutinesDone: t.int({
    description: 'Ticks or unticks the current occurrence of several routines; returns how many changed.',
    args: { ids: t.arg.idList({ required: true }), done: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, done }) => routines.bulkSetRoutinesDone(ids.map(String), done),
  }),
  bulkDeleteRoutines: t.int({
    args: { ids: t.arg.idList({ required: true }) },
    resolve: (_root, { ids }) => routines.bulkDeleteRoutines(ids.map(String)),
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
