import { daysBetween, formatDay, parseDay, type RoutineInput } from '@ordo/shared';
import { prisma } from '../../db';
import { clientError } from '../errors';
import * as routines from '../../services/routines';
import { builder } from '../builder';
import { EventScope } from './calendar';

builder.prismaObject('RoutineCategory', {
  description: 'Category of the routines, in a tree.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color', { nullable: true }),
    parentId: t.exposeID('parentId', { nullable: true }),
    position: t.exposeInt('position', { description: 'Manual order among its siblings.' }),
  }),
});

/** Selection computing the occurrences and times of the day of a routine. */
const TIMING = { startDate: true, recurrence: true, scheduleAnchor: true, schedule: true, cases: true, moves: true, fromTime: true, dueTime: true } as const;

/**
 * Calendar date as a Date (the Date scalar), or null.
 * @param {string | null} date YYYY-MM-DD.
 * @returns {Date | null} Date.
 */
const asDate = (date: string | null) => (date ? parseDay(date) : null);

/** Time of the day of an occurrence, with its state. */
interface SlotState {
  index: number;
  fromTime: string | null;
  dueTime: string | null;
  optional: boolean;
  done: boolean;
}

/**
 * Times of the day of the current occurrence of a routine (its next one before it starts), with those ticked.
 * @param {routines.RoutineTiming & { checks: { date: Date, slot: number }[] }} routine Routine with its latest checks.
 * @returns {{ date: string | null, slots: SlotState[] }} Day and its times.
 */
const slotStates = (routine: routines.RoutineTiming & { checks: { date: Date; slot: number }[] }) => {
  const { current, next } = routines.occurrencesOf(routine);
  const date = current ?? next;
  const ticked = new Set(routine.checks.filter((check) => current && formatDay(check.date) === current).map((check) => check.slot));
  return { date, slots: routines.slotsOf(routine, date).map((slot, index) => ({ index, ...slot, done: ticked.has(index) })) };
};

/**
 * Time of the day to come: the first not ticked (a required one first), else the first.
 * @param {SlotState[]} slots Times of the day.
 * @returns {SlotState | undefined} Time.
 */
const pendingSlot = (slots: SlotState[]) => slots.find((slot) => !slot.done && !slot.optional) ?? slots.find((slot) => !slot.done) ?? slots[0];

const RoutineSlotRef = builder.objectRef<SlotState>('RoutineSlot').implement({
  description: 'Time of the day of an occurrence of a routine.',
  fields: (t) => ({
    index: t.exposeInt('index'),
    fromTime: t.exposeString('fromTime', { nullable: true }),
    dueTime: t.exposeString('dueTime', { nullable: true }),
    optional: t.exposeBoolean('optional'),
    done: t.exposeBoolean('done'),
  }),
});

/** Checks loaded to know the times ticked today. */
const TODAY_CHECKS = { checks: { orderBy: { date: 'desc' }, take: 20, select: { date: true, slot: true } } } as const;

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
      description: 'Time to do it from on its current (or next) occurrence, for its time of the day to come: its own, its case’s or its schedule’s.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: (routine) => pendingSlot(slotStates(routine).slots)?.fromTime ?? null,
    }),
    windowTo: t.string({
      nullable: true,
      description: 'Latest time to do it by on its current (or next) occurrence, for its time of the day to come.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: (routine) => pendingSlot(slotStates(routine).slots)?.dueTime ?? null,
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
    firstDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence of the routine (from its start).',
      select: TIMING,
      resolve: (routine) => asDate(routines.firstOccurrence(routine)),
    }),
    nextDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence after today.',
      select: TIMING,
      resolve: (routine) => asDate(routines.occurrencesOf(routine).next),
    }),
    cases: t.expose('cases', { type: 'JSON', description: 'Cases (days and times of the day); empty: its repetition.' }),
    moves: t.field({
      type: 'JSON',
      description: 'Exceptions: occurrences moved to another day, deleted (to null) or with other times, [{ from, to, times }] (YYYY-MM-DD), by day of the rule.',
      select: { moves: true },
      resolve: (routine) => routines.storedMoves(routine.moves),
    }),
    slots: t.field({
      type: [RoutineSlotRef],
      description: 'Times of the day of its current occurrence (its next one before it starts), with those ticked.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: (routine) => slotStates(routine).slots,
    }),
    done: t.boolean({
      description: 'Its current occurrence is done: every required time of the day ticked.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: (routine) => {
        const { current } = routines.occurrencesOf(routine);
        const { slots } = slotStates(routine);
        return current !== null && slots.length > 0 && slots.every((slot) => slot.done || slot.optional);
      },
    }),
    doneDates: t.field({
      type: ['Date'],
      description: `Latest ticked occurrences (${RECENT_CHECKS} at most), latest first.`,
      select: { checks: { orderBy: { date: 'desc' }, take: RECENT_CHECKS, select: { date: true } } },
      resolve: (routine) => [...new Set(routine.checks.map((check) => formatDay(check.date)))].map(parseDay),
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
    cases: t.field({ type: 'JSON', description: 'Cases (days and times of the day); empty: the repetition.' }),
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
  cases: (input.cases ?? []) as RoutineInput['cases'],
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

/** Occurrence of a routine on a day, with its times of the day. */
interface OccurrenceState {
  routineId: string;
  date: string;
  movedFrom: string | null;
  slots: SlotState[];
}

const RoutineOccurrenceRef = builder.objectRef<OccurrenceState>('RoutineOccurrence').implement({
  description: 'Occurrence of a routine on a day (for the calendar).',
  fields: (t) => ({
    routineId: t.exposeID('routineId'),
    date: t.field({ type: 'Date', resolve: (occurrence) => parseDay(occurrence.date) }),
    movedFrom: t.field({ type: 'Date', nullable: true, description: 'Day of the rule it was moved from (an exception).', resolve: (occurrence) => asDate(occurrence.movedFrom) }),
    slots: t.field({ type: [RoutineSlotRef], resolve: (occurrence) => occurrence.slots }),
  }),
});

/** Days of a period of occurrences, at most. */
const OCCURRENCE_DAYS = 100;

builder.prismaObject('RoutineCheck', {
  description: 'Time of the day of a routine ticked as done, for an occurrence.',
  fields: (t) => ({
    routineId: t.exposeID('routineId'),
    date: t.expose('date', { type: 'Date', description: 'Day of the occurrence.' }),
    slot: t.exposeInt('slot', { description: 'Time of the day ticked (its index in the times of that day).' }),
    doneAt: t.expose('doneAt', { type: 'DateTime', description: 'When it was ticked.' }),
    fromTime: t.string({
      nullable: true,
      description: 'Start of the time of the day ticked (as the routine is now).',
      select: { routine: { select: TIMING } },
      resolve: (check) => routines.slotsOf(check.routine, formatDay(check.date))[check.slot]?.fromTime ?? null,
    }),
    dueTime: t.string({
      nullable: true,
      description: 'End of the time of the day ticked (as the routine is now).',
      select: { routine: { select: TIMING } },
      resolve: (check) => routines.slotsOf(check.routine, formatDay(check.date))[check.slot]?.dueTime ?? null,
    }),
  }),
});

builder.queryFields((t) => ({
  routineCategories: t.prismaField({
    type: ['RoutineCategory'],
    resolve: (query) => prisma.routineCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  routines: t.prismaField({
    type: ['Routine'],
    description: 'Every routine, archived ones included, in manual order.',
    resolve: (query) => prisma.routine.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  routineOccurrences: t.field({
    type: [RoutineOccurrenceRef],
    description: `Occurrences of the routines not archived in a period (both days included, ${OCCURRENCE_DAYS} days at most), with their times of the day ticked.`,
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: async (_root, { from, to }) => {
      if (to < from || daysBetween(from, to) >= OCCURRENCE_DAYS) throw clientError('BAD_USER_INPUT', `Période de ${OCCURRENCE_DAYS} jours au plus.`);
      const list = await prisma.routine.findMany({
        where: { archivedAt: null },
        select: { id: true, ...TIMING, checks: { where: { date: { gte: parseDay(from), lte: parseDay(to) } }, select: { date: true, slot: true } } },
      });
      return list.flatMap((routine) => {
        const moves = routines.storedMoves(routine.moves);
        const ticked = new Set(routine.checks.map((check) => `${formatDay(check.date)}/${check.slot}`));
        return routines.occurrencesBetween(routine, from, to).map((date) => ({
          routineId: routine.id,
          date,
          movedFrom: moves.find((move) => move.to === date && move.from !== date)?.from ?? null,
          slots: routines.slotsOf(routine, date).map((slot, index) => ({ index, ...slot, done: ticked.has(`${date}/${index}`) })),
        }));
      });
    },
  }),
  routineChecks: t.prismaField({
    type: ['RoutineCheck'],
    description: 'Times of the day ticked as done, of the occurrences of a period (both days included), latest first.',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: (query, _root, { from, to }) =>
      prisma.routineCheck.findMany({
        ...query,
        where: { date: { gte: parseDay(from), lte: parseDay(to) } },
        orderBy: [{ date: 'desc' }, { doneAt: 'desc' }],
        take: 2000,
      }),
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
    description: 'Moves a category under another one (parentId), or to the top level (parentId null), at an index among its siblings (last without).',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int() },
    resolve: async (_root, { id, parentId, index }) => {
      await routines.moveCategory(String(id), idOrNull(parentId), index);
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
        Object.assign(changes, { scheduleId: null, scheduleAnchor: null, cases: [] });
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
  moveRoutineOccurrence: t.boolean({
    description: 'Moves an occurrence to another day (postponed or brought forward); back to its own day, the exception is removed.',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: async (_root, { id, date, to }) => {
      await routines.moveRoutineOccurrence(String(id), date, to);
      return true;
    },
  }),
  changeRoutineOccurrence: t.boolean({
    description: 'Changes the day and the times of one time of the day of an occurrence: this one (an exception), it and the following ones, or all.',
    args: {
      id: t.arg.id({ required: true }),
      date: t.arg({ type: 'Date', required: true }),
      scope: t.arg({ type: EventScope, required: true }),
      to: t.arg({ type: 'Date', required: true }),
      slot: t.arg.int({ required: true }),
      fromTime: t.arg.string(),
      dueTime: t.arg.string(),
    },
    resolve: async (_root, { id, date, scope, to, slot, fromTime, dueTime }) => {
      await routines.changeRoutineOccurrence(String(id), date, scope, to, slot, { fromTime: fromTime ?? null, dueTime: dueTime ?? null });
      return true;
    },
  }),
  deleteRoutineOccurrence: t.boolean({
    description: 'Deletes an occurrence (THIS: an exception) or it and the following ones (FOLLOWING); true when the routine was archived (nothing left).',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date', required: true }), scope: t.arg({ type: EventScope, required: true }) },
    resolve: async (_root, { id, date, scope }) => {
      if (scope === 'ALL') throw clientError('BAD_USER_INPUT', 'Archivez ou supprimez la routine elle-même.');
      return routines.deleteRoutineOccurrence(String(id), date, scope);
    },
  }),
  removeRoutineMove: t.boolean({
    description: 'Removes an exception: the occurrence goes back to its own day.',
    args: { id: t.arg.id({ required: true }), from: t.arg({ type: 'Date', required: true }) },
    resolve: async (_root, { id, from }) => {
      await routines.removeRoutineMove(String(id), from);
      return true;
    },
  }),
  setRoutineDone: t.field({
    type: 'Date',
    description: 'Ticks or unticks an occurrence (by default the current one); returns its date.',
    args: { id: t.arg.id({ required: true }), done: t.arg.boolean({ required: true }), date: t.arg({ type: 'Date' }), slot: t.arg.int({ description: 'Time of the day (index); 0 by default.' }),
      doneAt: t.arg({ type: 'DateTime', description: 'When it was done (ticked after the fact); now by default.' }),
    },
    resolve: async (_root, { id, done, date, slot, doneAt }) => parseDay(await routines.setRoutineDone(String(id), done, date ?? null, slot ?? null, doneAt ?? null)),
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
