import { readSlotRule } from '@ordo/shared';
import { daysBetween, formatDay, parseDay, readOpens, type RoutineInput, type RoutineMoveTimes } from '@ordo/shared';
import { prisma } from '../../db';
import { clientError, done } from '../errors';
import * as routines from '../../services/routines/routines';
import type { Context } from '../context';
import { BY_POSITION } from '../../services/core/ordering';
import { builder } from '../builder';
import { relationIds } from '../relation-fields';
import { EventScope } from './calendar';
import { parisToday } from '../../today';

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
const TIMING = { id: true, archivedAt: true, startDate: true, recurrence: true, cases: true, moves: true, fromTime: true, dueTime: true, opensOn: true, scheduleIds: true, excludedScheduleIds: true, moments: true, slotCondition: true } as const;

const slotContexts = new WeakMap<Context, Promise<routines.ScheduleContext>>();

/**
 * Slots of the workspace for the slot rules of the routines, loaded once per request.
 * @param {Context} ctx GraphQL context.
 * @returns {Promise<routines.ScheduleContext>} Schedules.
 */
function slotsOf(ctx: Context): Promise<routines.ScheduleContext> {
  let slots = slotContexts.get(ctx);
  if (!slots) slotContexts.set(ctx, (slots = routines.loadScheduleContext()));
  return slots;
}

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
  /** Windows it can be done in that day (several where slots cut it). */
  windows: { fromTime: string | null; dueTime: string | null }[];
}

/**
 * Times of the day of the current occurrence of a routine (its next one before it starts), with those ticked.
 * @param {routines.RoutineTiming & { checks: { date: Date, slot: number }[] }} routine Routine with its latest checks.
 * @param {routines.ScheduleContext} context Schedules of the workspace.
 * @returns {{ date: string | null, slots: SlotState[] }} Day and its times.
 */
const slotStates = (routine: routines.RoutineTiming & { checks: { date: Date; slot: number }[] }, context: routines.ScheduleContext) => {
  const { current, next } = routines.occurrencesOf(routine, undefined, context);
  const date = current ?? next;
  const ticked = new Set(routine.checks.filter((check) => current && formatDay(check.date) === current).map((check) => check.slot));
  return { date, slots: routines.slotsOf(routine, date, context).map((slot, index) => ({ index, ...slot, done: ticked.has(index) })) };
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
    windows: t.field({ type: 'JSON', description: 'Windows it can be done in that day, [{ fromTime, dueTime }] (several where slots cut it).', resolve: (slot) => slot.windows }),
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
    categoryIds: t.idList(relationIds('categories', 'Categories it is shown in.')),
    parentId: t.exposeID('parentId', { nullable: true }),
    startDate: t.expose('startDate', { type: 'Date' }),
    recurrence: t.field({
      type: 'JSON',
      description: 'Rule of its repetition (every day for one saved following calendar schedules).',
      select: { recurrence: true, scheduleIds: true, slotCondition: true },
      resolve: (routine) => routines.storedRule(routine) ?? routine.recurrence,
    }),
    estimate: t.exposeInt('estimate', { nullable: true, description: 'Minutes.' }),
    projectId: t.exposeID('projectId', { nullable: true }),
    fromTime: t.exposeString('fromTime', { nullable: true, description: 'Time to do it from (HH:MM), its own (see windowFrom).' }),
    slotCondition: t.field({
      type: 'JSON',
      nullable: true,
      description: 'Following its rule: on or out of calendar schedules, in groups combined with and / or (the filters of the tables); null: any time.',
      resolve: (routine) => routines.storedCondition(routine),
    }),
    moments: t.field({ type: 'JSON', description: 'Times of the day following its rule or its schedules, [{ fromTime, dueTime, optional }].', resolve: (routine) => routines.storedMoments(routine) }),
    reminders: t.exposeIntList('reminders', { description: 'Alerts, in minutes before its moment (when to leave, else its start, else its latest time).' }),
    opensOn: t.field({
      type: 'JSON',
      nullable: true,
      description: '« À partir du » of the occurrences of its rule: { mode: DAY | WEEKDAY | WEEK | BEFORE, … }; null: from their first day.',
      resolve: (routine) => readOpens(routine.opensOn),
    }),
    slotRule: t.field({ type: 'JSON', nullable: true, description: 'Slots it is done on or out of ({ mode, kinds }); null: the workspace default.', resolve: (routine) => readSlotRule(routine.slotRule) }),
    windowFrom: t.string({
      nullable: true,
      description: 'Time to do it from on its current (or next) occurrence, for its time of the day to come: its own, its case’s or its schedule’s.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: async (routine, _args, ctx) => pendingSlot(slotStates(routine, await slotsOf(ctx)).slots)?.fromTime ?? null,
    }),
    windowTo: t.string({
      nullable: true,
      description: 'Latest time to do it by on its current (or next) occurrence, for its time of the day to come.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: async (routine, _args, ctx) => pendingSlot(slotStates(routine, await slotsOf(ctx)).slots)?.dueTime ?? null,
    }),
    dueTime: t.exposeString('dueTime', { nullable: true, description: 'Latest time to do it by (HH:MM).' }),
    location: t.exposeString('location', { nullable: true }),
    locationLat: t.exposeFloat('locationLat', { nullable: true }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    travelBefore: t.exposeInt('travelBefore', { description: 'Minutes to get there.' }),
    travelAfter: t.exposeInt('travelAfter', { description: 'Minutes to get back.' }),
    position: t.exposeInt('position'),
    archived: t.boolean({ resolve: (routine) => routine.archivedAt !== null }),
    assigneeIds: t.idList(relationIds('assignees')),
    beneficiaryIds: t.idList(relationIds('beneficiaries', '« Bénéficiaires »: contributors it is for.')),
    beneficiaryRelationIds: t.idList(relationIds('beneficiaryRelations', '« Bénéficiaires »: relations it is for.')),
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
      resolve: async (routine, _args, ctx) => asDate(routines.occurrencesOf(routine, undefined, await slotsOf(ctx)).current),
    }),
    firstDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence of the routine (from its start).',
      select: TIMING,
      resolve: async (routine, _args, ctx) => asDate(routines.firstOccurrence(routine, await slotsOf(ctx))),
    }),
    nextDate: t.field({
      type: 'Date',
      nullable: true,
      description: 'First occurrence after today.',
      select: TIMING,
      resolve: async (routine, _args, ctx) => asDate(routines.occurrencesOf(routine, undefined, await slotsOf(ctx)).next),
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
      resolve: async (routine, _args, ctx) => slotStates(routine, await slotsOf(ctx)).slots,
    }),
    done: t.boolean({
      description: 'Its current occurrence is done: every required time of the day ticked.',
      select: { ...TIMING, ...TODAY_CHECKS },
      resolve: async (routine, _args, ctx) => {
        const context = await slotsOf(ctx);
        const { current } = routines.occurrencesOf(routine, undefined, context);
        const { slots } = slotStates(routine, context);
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
    slotCondition: t.field({ type: 'JSON', description: 'Following its rule: on or out of calendar schedules, in groups (and / or); null: any time.' }),
    moments: t.field({ type: 'JSON', description: 'Times of the day, [{ fromTime, dueTime, optional }].' }),
    cases: t.field({ type: 'JSON', description: 'Cases (days and times of the day); empty: the repetition.' }),
    reminders: t.intList(),
    opensOn: t.field({ type: 'JSON', description: '« À partir du » of the occurrences of its rule: { mode: DAY | WEEKDAY | WEEK | BEFORE, … }; null: none.' }),
    dueTime: t.string({ description: 'HH:MM.' }),
    location: t.string(),
    locationLat: t.float(),
    locationLon: t.float(),
    travelBefore: t.int(),
    travelAfter: t.int(),
    projectId: t.id(),
    assigneeIds: t.idList({ required: true }),
    beneficiaryIds: t.idList({ description: 'Contributors it is for; none: none.' }),
    beneficiaryRelationIds: t.idList({ description: 'Relations it is for; none: none.' }),
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
    beneficiaryIds: t.idList(),
    beneficiaryRelationIds: t.idList(),
    requiredIds: t.idList(),
    projectId: t.id({ description: 'Null: none.' }),
    location: t.string({ description: 'Null: none (its point too).' }),
    locationLat: t.float(),
    locationLon: t.float(),
    travelBefore: t.int({ description: 'Minutes to get there.' }),
    travelAfter: t.int({ description: 'Minutes to come back.' }),
    reminders: t.intList({ description: 'Minutes before its moment.' }),
    opensOn: t.field({ type: 'JSON', description: '« À partir du »: { mode: DAY | WEEKDAY | WEEK | BEFORE, … }; null: none.' }),
    fromTime: t.string({ description: 'HH:MM; null: no limit.' }),
    dueTime: t.string({ description: 'HH:MM; null: no limit.' }),
    startDate: t.field({ type: 'Date' }),
    recurrence: t.field({ type: 'JSON' }),
    cases: t.field({ type: 'JSON', description: 'Cases (with recurrence: its whole repetition); empty: its rule.' }),
    moments: t.field({ type: 'JSON', description: 'Times of the day following its rule.' }),
    slotCondition: t.field({ type: 'JSON', description: 'On or out of calendar schedules, following its rule; null: any time.' }),
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
    cases: t.field({ type: 'JSON', description: 'Cases (with recurrence: its whole repetition); empty: its rule.' }),
    moments: t.field({ type: 'JSON', description: 'Times of the day following its rule.' }),
    slotCondition: t.field({ type: 'JSON', description: 'On or out of calendar schedules, following its rule; null: any time.' }),
    opensOn: t.field({ type: 'JSON', description: '« À partir du » of its rule; null: none.' }),
  }),
});

/**
 * Optional id or null.
 * @param {string | null | undefined} id GraphQL id.
 * @returns {string | null} Id.
 */
const idOrNull = (id: string | null | undefined) => id ?? null;

/**
 * Routine input with omitted optional fields as null.
 * @param {typeof RoutineInputType.$inferInput} input GraphQL input.
 * @returns {RoutineInput} Service input.
 */
const routineInput = (input: typeof RoutineInputType.$inferInput): RoutineInput => ({
  title: input.title,
  description: input.description ?? null,
  categoryIds: input.categoryIds,
  parentId: idOrNull(input.parentId),
  startDate: input.startDate,
  recurrence: input.recurrence as RoutineInput['recurrence'],
  estimate: input.estimate ?? null,
  fromTime: input.fromTime ?? null,
  scheduleId: null,
  scheduleAnchor: null,
  scheduleIds: [],
  excludedScheduleIds: [],
  slotCondition: (input.slotCondition ?? null) as RoutineInput['slotCondition'],
  moments: (input.moments ?? []) as RoutineInput['moments'],
  reminders: input.reminders ?? [],
  opensOn: (input.opensOn ?? null) as RoutineInput['opensOn'],
  slotRule: null,
  cases: (input.cases ?? []) as RoutineInput['cases'],
  dueTime: input.dueTime ?? null,
  location: input.location ?? null,
  locationLat: input.locationLat ?? null,
  locationLon: input.locationLon ?? null,
  travelBefore: input.travelBefore ?? 0,
  travelAfter: input.travelAfter ?? 0,
  projectId: idOrNull(input.projectId),
  assigneeIds: input.assigneeIds,
  beneficiaryIds: input.beneficiaryIds ?? [],
  beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
  requiredIds: input.requiredIds,
});

/** Occurrence of a routine on a day, with its times of the day. */
interface OccurrenceState {
  routineId: string;
  date: string;
  /** First day it can be done (its due day for a single day). */
  startDate: string;
  /** Day it shows on: its due day once past, today while it runs, its first day before. */
  shownDate: string;
  movedFrom: string | null;
  slots: SlotState[];
}

const RoutineOccurrenceRef = builder.objectRef<OccurrenceState>('RoutineOccurrence').implement({
  description: 'Occurrence of a routine on a day (for the calendar).',
  fields: (t) => ({
    routineId: t.exposeID('routineId'),
    date: t.field({ type: 'Date', description: 'Due day (its last day).', resolve: (occurrence) => parseDay(occurrence.date) }),
    startDate: t.field({ type: 'Date', description: 'First day it can be done.', resolve: (occurrence) => parseDay(occurrence.startDate) }),
    shownDate: t.field({ type: 'Date', description: 'Day it shows on: its due day once past, today while it runs, its first day before.', resolve: (occurrence) => parseDay(occurrence.shownDate) }),
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
      resolve: async (check, _args, ctx) => routines.slotsOf(check.routine, formatDay(check.date), await slotsOf(ctx))[check.slot]?.fromTime ?? null,
    }),
    dueTime: t.string({
      nullable: true,
      description: 'End of the time of the day ticked (as the routine is now).',
      select: { routine: { select: TIMING } },
      resolve: async (check, _args, ctx) => routines.slotsOf(check.routine, formatDay(check.date), await slotsOf(ctx))[check.slot]?.dueTime ?? null,
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
    resolve: (query) => prisma.routine.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  routineOccurrences: t.field({
    type: [RoutineOccurrenceRef],
    description: `Occurrences of the routines not archived in a period (both days included, ${OCCURRENCE_DAYS} days at most), with their times of the day ticked.`,
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: async (_root, { from, to }, ctx) => {
      if (to < from || daysBetween(from, to) >= OCCURRENCE_DAYS) throw clientError('BAD_USER_INPUT', `Période de ${OCCURRENCE_DAYS} jours au plus.`);
      const list = await prisma.routine.findMany({
        where: { archivedAt: null },
        select: { ...TIMING, checks: { where: { date: { gte: parseDay(from), lte: parseDay(to) } }, select: { date: true, slot: true } } },
      });
      const context = await slotsOf(ctx);
      const today = parisToday();
      return list.flatMap((routine) => {
        const moves = routines.storedMoves(routine.moves);
        const ticked = new Set(routine.checks.map((check) => `${formatDay(check.date)}/${check.slot}`));
        return routines.occurrenceSpansBetween(routine, from, to, context).map(({ start, end: date }) => ({
          routineId: routine.id,
          date,
          startDate: start,
          shownDate: routines.shownDay({ start, end: date }, today),
          movedFrom: moves.find((move) => move.to === date && move.from !== date)?.from ?? null,
          slots: routines.slotsOf(routine, date, context).map((slot, index) => ({ index, ...slot, done: ticked.has(`${date}/${index}`) })),
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
    resolve: (_root, { id, input }) => done(routines.updateCategory(id, { name: input.name, color: input.color ?? null, parentId: idOrNull(input.parentId) })),
  }),
  moveRoutineCategory: t.boolean({
    description: 'Moves a category under another one (parentId), or to the top level (parentId null), at an index among its siblings (last without).',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int() },
    resolve: (_root, { id, parentId, index }) => done(routines.moveCategory(id, idOrNull(parentId), index)),
  }),
  deleteRoutineCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(routines.deleteCategory(id)),
  }),
  createRoutine: t.id({
    args: { input: t.arg({ type: RoutineInputType, required: true }) },
    resolve: async (_root, { input }) => (await routines.createRoutine(routineInput(input))).id,
  }),
  copySubRoutines: t.int({
    description: 'Copies the sub-routines of a routine under its copy (theirs too); returns how many were copied.',
    args: { fromId: t.arg.id({ required: true }), toId: t.arg.id({ required: true }) },
    resolve: (_root, { fromId, toId }) => routines.copySubRoutines(fromId, toId),
  }),
  updateRoutine: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: RoutineInputType, required: true }) },
    resolve: (_root, { id, input }) => done(routines.updateRoutine(id, routineInput(input))),
  }),
  patchRoutine: t.boolean({
    description: 'Changes some fields of a routine (inline edits).',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: RoutinePatch, required: true }) },
    resolve: async (_root, { id, input }) => {
      const changes: Partial<RoutineInput> = {};
      if (input.title !== undefined && input.title !== null) changes.title = input.title;
      if (input.categoryIds) changes.categoryIds = input.categoryIds;
      if (input.parentId !== undefined) changes.parentId = idOrNull(input.parentId);
      if (input.estimate !== undefined) changes.estimate = input.estimate;
      if (input.assigneeIds) changes.assigneeIds = input.assigneeIds;
      if (input.beneficiaryIds) changes.beneficiaryIds = input.beneficiaryIds;
      if (input.beneficiaryRelationIds) changes.beneficiaryRelationIds = input.beneficiaryRelationIds;
      if (input.requiredIds) changes.requiredIds = input.requiredIds;
      if (input.projectId !== undefined) changes.projectId = idOrNull(input.projectId);
      if (input.location !== undefined) Object.assign(changes, { location: input.location ?? null, locationLat: input.locationLat ?? null, locationLon: input.locationLon ?? null });
      if (input.travelBefore !== undefined && input.travelBefore !== null) changes.travelBefore = input.travelBefore;
      if (input.travelAfter !== undefined && input.travelAfter !== null) changes.travelAfter = input.travelAfter;
      if (input.reminders) changes.reminders = input.reminders;
      if (input.opensOn !== undefined) changes.opensOn = (input.opensOn ?? null) as RoutineInput['opensOn'];
      // A repetition of its own: it no longer follows its cases.
      if (input.recurrence !== undefined && input.recurrence !== null) Object.assign(changes, { cases: [] });
      // Times of its own: a single moment.
      if (input.fromTime !== undefined || input.dueTime !== undefined) {
        const current = await routines.momentOf(id);
        changes.moments = [{ fromTime: input.fromTime !== undefined ? (input.fromTime ?? null) : current.fromTime, dueTime: input.dueTime !== undefined ? (input.dueTime ?? null) : current.dueTime, optional: false }];
      }
      if (input.startDate) changes.startDate = input.startDate;
      if (input.recurrence !== undefined && input.recurrence !== null) changes.recurrence = input.recurrence as RoutineInput['recurrence'];
      // Its whole repetition: its cases (none: its rule), moments and condition.
      if (input.cases !== undefined && input.cases !== null) changes.cases = input.cases as RoutineInput['cases'];
      if (input.moments !== undefined && input.moments !== null) changes.moments = input.moments as RoutineInput['moments'];
      if (input.slotCondition !== undefined) changes.slotCondition = (input.slotCondition ?? null) as RoutineInput['slotCondition'];
      await routines.patchRoutine(id, changes);
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
    resolve: (_root, { id, targetId, place, categoryIds }) => done(routines.moveRoutine(id, targetId, place, categoryIds || null)),
  }),
  bulkUpdateRoutines: t.int({
    description: 'Applies the same changes to several routines; returns how many changed.',
    args: { ids: t.arg.idList({ required: true }), changes: t.arg({ type: RoutineBulkChangesInput, required: true }) },
    resolve: (_root, { ids, changes }) => {
      const list = (value: string[] | null | undefined) => value ?? undefined;
      return routines.bulkUpdateRoutines(ids, {
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
        cases: changes.cases ?? undefined,
        moments: changes.moments ?? undefined,
        slotCondition: changes.slotCondition === undefined ? undefined : (changes.slotCondition ?? null),
        opensOn: changes.opensOn === undefined ? undefined : (changes.opensOn ?? null),
      });
    },
  }),
  bulkSetRoutinesArchived: t.int({
    args: { ids: t.arg.idList({ required: true }), archived: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, archived }) => routines.bulkSetRoutinesArchived(ids, archived),
  }),
  bulkSetRoutinesDone: t.int({
    description: 'Ticks or unticks the current occurrence of several routines; returns how many changed.',
    args: { ids: t.arg.idList({ required: true }), done: t.arg.boolean({ required: true }) },
    resolve: (_root, { ids, done }) => routines.bulkSetRoutinesDone(ids, done),
  }),
  bulkDeleteRoutines: t.int({
    args: { ids: t.arg.idList({ required: true }) },
    resolve: (_root, { ids }) => routines.bulkDeleteRoutines(ids),
  }),
  moveRoutineOccurrence: t.boolean({
    description:
      'Moves an occurrence to another day (postponed or brought forward) and / or other times ([{ fromTime, dueTime } | null] by time of the day, null: those of its rule; none: those it had); back to its own day and times, the exception is removed.',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }), times: t.arg({ type: 'JSON' }) },
    resolve: (_root, { id, date, to, times }) => done(routines.moveRoutineOccurrence(id, date, to, times === undefined || times === null ? undefined : (times as RoutineMoveTimes))),
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
    resolve: (_root, { id, date, scope, to, slot, fromTime, dueTime }) => done(routines.changeRoutineOccurrence(id, date, scope, to, slot, { fromTime: fromTime ?? null, dueTime: dueTime ?? null })),
  }),
  deleteRoutineOccurrence: t.boolean({
    description: 'Deletes an occurrence (THIS: an exception) or it and the following ones (FOLLOWING); true when the routine was archived (nothing left).',
    args: { id: t.arg.id({ required: true }), date: t.arg({ type: 'Date', required: true }), scope: t.arg({ type: EventScope, required: true }) },
    resolve: async (_root, { id, date, scope }) => {
      if (scope === 'ALL') throw clientError('BAD_USER_INPUT', 'Archivez ou supprimez la routine elle-même.');
      return routines.deleteRoutineOccurrence(id, date, scope);
    },
  }),
  removeRoutineMove: t.boolean({
    description: 'Removes an exception: the occurrence goes back to its own day.',
    args: { id: t.arg.id({ required: true }), from: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { id, from }) => done(routines.removeRoutineMove(id, from)),
  }),
  setRoutineDone: t.field({
    type: 'Date',
    description: 'Ticks or unticks an occurrence (by default the current one); returns its date.',
    args: { id: t.arg.id({ required: true }), done: t.arg.boolean({ required: true }), date: t.arg({ type: 'Date' }), slot: t.arg.int({ description: 'Time of the day (index); 0 by default.' }),
      doneAt: t.arg({ type: 'DateTime', description: 'When it was done (ticked after the fact); now by default.' }),
    },
    resolve: async (_root, { id, done, date, slot, doneAt }) => parseDay(await routines.setRoutineDone(id, done, date ?? null, slot ?? null, doneAt ?? null)),
  }),
}));
