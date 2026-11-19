import { done } from '../errors';
import { EVENT_SCOPES } from '@ordo/shared';
import { prisma } from '../../db';
import * as categories from '../../services/calendar/calendar-categories';
import * as calendars from '../../services/calendar/calendars';
import * as events from '../../services/calendar/calendar-events';
import * as schedules from '../../services/calendar/work-schedules';
import { BY_POSITION } from '../../services/core/ordering';
import { builder } from '../builder';
import { locatedInput, locationInputFields, TRAVEL_DESCRIPTIONS, travelInputFields } from '../located-fields';
import { ItemLinkInput, ItemLinkRef } from '../link-fields';
import { LabelColorInput, labelMutations, labelObject } from '../label-inputs';
import { reloaded } from '../reload';
import { unchecked } from '../unchecked';

builder.prismaObject('CalendarCategory', {
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color'),
    parentId: t.exposeID('parentId', { nullable: true }),
    position: t.exposeInt('position'),
  }),
});

labelObject('Calendar', { description: 'Calendar of the workspace: every event belongs to one.' });

const CalendarWorkspace = builder.objectRef<calendars.CalendarSubscriptionView['workspace']>('CalendarWorkspace').implement({
  description: 'Workspace a calendar belongs to.',
  fields: (t) => ({ id: t.exposeID('id'), label: t.exposeString('label'), kind: t.exposeString('kind') }),
});

const CalendarSubscription = builder.objectRef<calendars.CalendarSubscriptionView>('CalendarSubscription').implement({
  description: 'Calendar of another workspace shown, read only, in this one.',
  fields: (t) => ({
    id: t.exposeID('id'),
    calendarId: t.exposeID('calendarId'),
    label: t.exposeString('label'),
    color: t.exposeString('color'),
    workspace: t.field({ type: CalendarWorkspace, resolve: (subscription) => subscription.workspace }),
  }),
});

const SubscribableCalendar = builder.objectRef<calendars.SubscribableCalendar>('SubscribableCalendar').implement({
  description: 'Calendar of another workspace, with whether this one shows it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color'),
    workspace: t.field({ type: CalendarWorkspace, resolve: (calendar) => calendar.workspace }),
    subscribed: t.exposeBoolean('subscribed'),
  }),
});

export const EventScope = builder.enumType('CalendarEventScope', {
  description: 'Scope of a change to a recurring event.',
  values: EVENT_SCOPES,
});

const PostponedFrom = builder.objectRef<NonNullable<events.EventOccurrence['postponedFrom']>>('CalendarPostponedFrom').implement({
  description: 'Event (and occurrence) a postponement replaces.',
  fields: (t) => ({
    eventId: t.exposeID('eventId'),
    date: t.exposeString('date', { nullable: true, description: 'Occurrence of a recurring event.' }),
    label: t.exposeString('label'),
  }),
});

const PostponedTo = builder.objectRef<events.EventOccurrence['postponedTo'][number]>('CalendarPostponedTo').implement({
  description: 'Event postponing an occurrence.',
  fields: (t) => ({
    eventId: t.exposeID('eventId'),
    label: t.exposeString('label'),
    startDate: t.exposeString('startDate'),
    startTime: t.exposeString('startTime', { nullable: true }),
  }),
});

const EventOccurrence = builder.objectRef<events.EventOccurrence>('CalendarEventOccurrence').implement({
  description: 'One occurrence of an event in a period.',
  fields: (t) => ({
    key: t.exposeString('key'),
    eventId: t.exposeID('eventId'),
    occurrenceDate: t.exposeString('occurrenceDate', { nullable: true }),
    modified: t.exposeBoolean('modified'),
    archived: t.exposeBoolean('archived', { description: 'The event (its series) is archived: hidden by default, read only.' }),
    label: t.exposeString('label'),
    description: t.exposeString('description', { nullable: true }),
    location: t.exposeString('location', { nullable: true }),
    locationLat: t.exposeFloat('locationLat', { nullable: true }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    links: t.field({ type: [ItemLinkRef], resolve: (occurrence) => occurrence.links }),
    allDay: t.exposeBoolean('allDay'),
    startDate: t.exposeString('startDate'),
    startTime: t.exposeString('startTime', { nullable: true }),
    endDate: t.exposeString('endDate'),
    endTime: t.exposeString('endTime', { nullable: true }),
    start: t.expose('start', { type: 'DateTime' }),
    end: t.expose('end', { type: 'DateTime' }),
    recurrence: t.field({ type: 'JSON', nullable: true, resolve: (occurrence) => occurrence.recurrence }),
    seriesStartDate: t.exposeString('seriesStartDate'),
    reminders: t.exposeIntList('reminders'),
    travelBefore: t.exposeInt('travelBefore', { description: TRAVEL_DESCRIPTIONS.before }),
    travelAfter: t.exposeInt('travelAfter', { description: TRAVEL_DESCRIPTIONS.after }),
    projectId: t.exposeID('projectId', { nullable: true }),
    calendarId: t.exposeID('calendarId'),
    contributorIds: t.exposeIDList('contributorIds'),
    relationIds: t.exposeIDList('relationIds', { description: 'Relations without contributor taking part.' }),
    beneficiaryIds: t.exposeIDList('beneficiaryIds', { description: '« Bénéficiaires »: contributors the event is for.' }),
    beneficiaryRelationIds: t.exposeIDList('beneficiaryRelationIds', { description: '« Bénéficiaires »: relations the event is for.' }),
    categoryIds: t.exposeIDList('categoryIds'),
    taskIds: t.exposeIDList('taskIds'),
    routineLinks: t.field({ type: [EventRoutineLinkRef], description: 'Routines of a day of the occurrence it is about.', resolve: (occurrence) => occurrence.routineLinks }),
    calledOff: t.exposeBoolean('calledOff', { description: 'Cancelled, kept in the calendar.' }),
    postponedFrom: t.field({ type: PostponedFrom, nullable: true, resolve: (occurrence) => occurrence.postponedFrom }),
    postponedTo: t.field({ type: [PostponedTo], resolve: (occurrence) => occurrence.postponedTo }),
    trackedSeconds: t.exposeInt('trackedSeconds', { description: 'Time tracked on the occurrence.' }),
  }),
});

builder.prismaObject('WorkSchedule', {
  description: 'Planned time slots: a period, its cases (which days, which hours) and exceptions (periods with cases of their own).',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    cases: t.field({ type: 'JSON', description: 'Cases (shared schedule case shape).', resolve: (schedule) => schedules.scheduleRule(schedule).cases }),
    exceptions: t.field({ type: 'JSON', description: 'Exceptions: { from, to, label, cases }.', resolve: (schedule) => schedules.scheduleRule(schedule).exceptions }),
    typeId: t.exposeID('typeId', { nullable: true, description: 'Kind of time it plans; none: working hours.' }),
  }),
});

builder.prismaObject('ScheduleType', {
  description: 'Kind of time slots ("Travail", "Garde des enfants"…), with its color in the calendar.',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    color: t.exposeString('color'),
    dayDisplay: t.exposeString('dayDisplay', { description: 'Its slots in the week and the day: SLOT_BACKGROUND, DAY_BACKGROUND, SLOT_BORDER or NONE.' }),
    dayBar: t.exposeBoolean('dayBar', { description: 'A bar at the top of the week and the day on each day with slots.' }),
    monthDisplay: t.exposeString('monthDisplay', { description: 'Its days in the month: BACKGROUND, BORDER or NONE.' }),
    position: t.exposeInt('position'),
  }),
});

const ScheduleTypeInput = builder.inputType('ScheduleTypeInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    color: t.string({ required: true }),
    dayDisplay: t.string({ required: true }),
    dayBar: t.boolean({ required: true }),
    monthDisplay: t.string({ required: true }),
  }),
});

const DefaultScheduleKindRef = builder.objectRef<schedules.DefaultScheduleKind>('DefaultScheduleKind').implement({
  description: 'Schedules without kind of this workspace: their label, color (none: the green of working hours) and display.',
  fields: (t) => ({
    label: t.exposeString('label'),
    color: t.exposeString('color', { nullable: true }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
  }),
});

const DefaultScheduleKindInput = builder.inputType('DefaultScheduleKindInput', {
  fields: (t) => ({
    label: t.string({ required: true, description: 'Empty: "Travail".' }),
    color: t.string(),
    dayDisplay: t.string({ required: true }),
    dayBar: t.boolean({ required: true }),
    monthDisplay: t.string({ required: true }),
  }),
});

const ScheduleSubscriptionLookInput = builder.inputType('ScheduleSubscriptionLookInput', {
  description: 'Color and display of a kind of schedules subscribed to, in this workspace; null: those of the kind.',
  fields: (t) => ({ color: t.string(), dayDisplay: t.string(), dayBar: t.boolean(), monthDisplay: t.string() }),
});

const EventRoutineLinkRef = builder.objectRef<{ routineId: string; date: string }>('EventRoutineLink').implement({
  description: 'Occurrence of a routine (its day) an event is about.',
  fields: (t) => ({ routineId: t.exposeID('routineId'), date: t.exposeString('date', { description: 'YYYY-MM-DD.' }) }),
});

const EventRoutineLinkInput = builder.inputType('EventRoutineLinkInput', {
  fields: (t) => ({ routineId: t.id({ required: true }), date: t.string({ required: true, description: 'YYYY-MM-DD, a day of the occurrence.' }) }),
});

const ForeignScheduleRef = builder.objectRef<schedules.ForeignSchedule>('ForeignWorkSchedule').implement({
  description: 'Schedule of another workspace: of a kind this one subscribes to (shown read only), or one a slot condition can name.',
  fields: (t) => ({
    id: t.id({ resolve: (item) => item.rule.id }),
    archived: t.exposeBoolean('archived'),
    label: t.string({ resolve: (item) => item.rule.label }),
    startDate: t.string({ resolve: (item) => item.rule.startDate }),
    endDate: t.string({ nullable: true, resolve: (item) => item.rule.endDate }),
    cases: t.field({ type: 'JSON', resolve: (item) => item.rule.cases }),
    exceptions: t.field({ type: 'JSON', resolve: (item) => item.rule.exceptions }),
    typeLabel: t.exposeString('typeLabel', { nullable: true }),
    typeId: t.id({ nullable: true, description: 'Kind in its workspace; none: its working hours.', resolve: (item) => item.rule.typeId ?? null }),
    color: t.exposeString('color', { nullable: true, description: 'In this workspace.' }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
    workspaceId: t.id({ resolve: (item) => item.workspace.id }),
    workspaceLabel: t.string({ resolve: (item) => item.workspace.label }),
  }),
});

const ForeignScheduleKindRef = builder.objectRef<schedules.ForeignScheduleKind>('ForeignScheduleKind').implement({
  description: 'Kind of schedules of another workspace (or its schedules without kind), with whether this one shows it.',
  fields: (t) => ({
    workspaceId: t.id({ resolve: (item) => item.workspace.id }),
    workspaceLabel: t.string({ resolve: (item) => item.workspace.label }),
    typeId: t.exposeID('typeId', { nullable: true, description: 'None: the schedules without kind (working hours).' }),
    label: t.exposeString('label'),
    color: t.exposeString('color', { nullable: true, description: 'In this workspace: the subscription’s, or the kind’s.' }),
    sourceColor: t.exposeString('sourceColor', { nullable: true, description: 'Of the kind, in its workspace.' }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
    customized: t.exposeBoolean('customized', { description: 'The subscription sets a color or a display of its own.' }),
    scheduleCount: t.exposeInt('scheduleCount'),
    subscribed: t.exposeBoolean('subscribed'),
    archived: t.exposeBoolean('archived', { description: 'Kind archived in its workspace: no longer offered in a slot condition.' }),
  }),
});

const WorkScheduleInput = builder.inputType('WorkScheduleInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    endDate: t.field({ type: 'Date' }),
    cases: t.field({ type: 'JSON', required: true, description: 'Cases (shared schedule case shape).' }),
    exceptions: t.field({ type: 'JSON', required: true, description: 'Exceptions: { from, to, label, cases }.' }),
    typeId: t.id({ description: 'Kind of time it plans; none: working hours.' }),
  }),
});

/**
 * Schedule input with omitted optional fields as null.
 * @param {typeof WorkScheduleInput.$inferInput} input GraphQL input.
 * @returns {import('@ordo/shared').WorkScheduleInput} Service input.
 */
const scheduleInput = (input: typeof WorkScheduleInput.$inferInput) => ({
  ...input,
  endDate: input.endDate ?? null,
  typeId: input.typeId ?? null,
  // Validated by the service.
  cases: unchecked(input.cases),
  exceptions: unchecked(input.exceptions),
});

const CalendarEventInput = builder.inputType('CalendarEventInput', {
  description: 'Times are Paris times; all-day events have none.',
  fields: (t) => ({
    label: t.string({ required: true }),
    description: t.string(),
    ...locationInputFields(t),
    links: t.field({ type: [ItemLinkInput], required: true }),
    allDay: t.boolean({ required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    startTime: t.string(),
    endDate: t.field({ type: 'Date', required: true }),
    endTime: t.string(),
    recurrence: t.field({ type: 'JSON' }),
    reminders: t.intList({ required: true, description: 'Minutes before the start.' }),
    ...travelInputFields(t, 'none: 0'),
    projectId: t.id(),
    calendarId: t.id({ description: 'Calendar; the first one of the workspace when omitted.' }),
    contributorIds: t.idList({ required: true }),
    relationIds: t.idList({ description: 'Relations without contributor taking part; none: none.' }),
    beneficiaryIds: t.idList({ description: 'Contributors the event is for; none: none.' }),
    beneficiaryRelationIds: t.idList({ description: 'Relations the event is for; none: none.' }),
    categoryIds: t.idList({ required: true }),
    taskIds: t.idList({ description: 'Tasks the event is about (none when omitted).' }),
    routineLinks: t.field({ type: [EventRoutineLinkInput], description: 'Routines of a day of the occurrence it is about (its other days kept); none when omitted.' }),
  }),
});

const CalendarCategoryInput = builder.inputType('CalendarCategoryInput', {
  fields: (t) => ({ label: t.string({ required: true }), color: t.string({ required: true }), parentId: t.id() }),
});

/**
 * Event input with omitted optional fields as null.
 * @param {typeof CalendarEventInput.$inferInput} input GraphQL input.
 * @returns {import('@ordo/shared').CalendarEventInput} Service input.
 */
const eventInput = (input: typeof CalendarEventInput.$inferInput) => ({
  ...input,
  description: input.description ?? null,
  ...locatedInput(input),
  startTime: input.startTime ?? null,
  endTime: input.endTime ?? null,
  recurrence: unchecked(input.recurrence ?? null),
  projectId: input.projectId ?? null,
  calendarId: input.calendarId ?? null,
  taskIds: input.taskIds ?? [],
  routineLinks: (input.routineLinks ?? []).map((link) => ({ routineId: link.routineId, date: link.date })),
  relationIds: input.relationIds ?? [],
  beneficiaryIds: input.beneficiaryIds ?? [],
  beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
});

builder.queryFields((t) => ({
  calendars: t.prismaField({
    type: ['Calendar'],
    description: 'Calendars of the workspace, in their order.',
    resolve: (query) => prisma.calendar.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  calendarSubscriptions: t.field({
    type: [CalendarSubscription],
    description: 'Calendars of other workspaces shown in this one (read only).',
    resolve: () => calendars.listSubscriptions(),
  }),
  subscribableCalendars: t.field({
    type: [SubscribableCalendar],
    description: 'Calendars of the other workspaces.',
    resolve: () => calendars.subscribableCalendars(),
  }),
  subscribedCalendarEvents: t.field({
    type: [EventOccurrence],
    description: 'Occurrences, in a period, of the calendars of other workspaces shown in this one (read only).',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { from, to }) => events.subscribedOccurrences(from, to),
  }),
  calendarCategories: t.prismaField({
    type: ['CalendarCategory'],
    resolve: (query) => prisma.calendarCategory.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  scheduleTypes: t.prismaField({
    type: ['ScheduleType'],
    resolve: (query) => prisma.scheduleType.findMany({ ...query, orderBy: BY_POSITION }),
  }),
  defaultScheduleKind: t.field({
    type: DefaultScheduleKindRef,
    description: 'Schedules without kind of this workspace: name, color and display.',
    resolve: () => schedules.defaultScheduleKind(),
  }),
  foreignScheduleKinds: t.field({
    type: [ForeignScheduleKindRef],
    description: 'Kinds of schedules of the other workspaces, with whether this one shows them.',
    resolve: () => schedules.foreignScheduleKinds(),
  }),
  subscribedWorkSchedules: t.field({
    type: [ForeignScheduleRef],
    description: 'Schedules of the kinds of other workspaces this one shows (read only).',
    resolve: () => schedules.subscribedSchedules(),
  }),
  otherWorkspaceSchedules: t.field({
    type: [ForeignScheduleRef],
    description: 'Every schedule of the other workspaces of the user (archived ones too), shown or not: what a slot condition can name.',
    resolve: () => schedules.otherWorkspaceSchedules(),
  }),
  workSchedules: t.prismaField({
    type: ['WorkSchedule'],
    resolve: (query) => prisma.workSchedule.findMany({ ...query, orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }] }),
  }),
  calendarEvents: t.field({
    type: [EventOccurrence],
    description: 'Occurrences of the events overlapping a period (dates included).',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { from, to }) => events.eventOccurrences(from, to),
  }),
}));

builder.mutationFields((t) => ({
  createCalendar: t.prismaField({
    type: 'Calendar',
    args: { input: t.arg({ type: LabelColorInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.calendar, query, calendars.createCalendar(input)),
  }),
  updateCalendar: t.prismaField({
    type: 'Calendar',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: LabelColorInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.calendar, query, calendars.updateCalendar(id, input)),
  }),
  deleteCalendar: t.boolean({
    description: 'Deletes a calendar with its events (not the last one of the workspace).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(calendars.deleteCalendar(id)),
  }),
  subscribeCalendar: t.boolean({
    description: 'Shows a calendar of another workspace in this one (read only).',
    args: { calendarId: t.arg.id({ required: true }) },
    resolve: (_root, { calendarId }) => done(calendars.subscribe(calendarId)),
  }),
  unsubscribeCalendar: t.boolean({
    description: 'Stops showing a calendar of another workspace.',
    args: { calendarId: t.arg.id({ required: true }) },
    resolve: (_root, { calendarId }) => done(calendars.unsubscribe(calendarId)),
  }),
  createCalendarCategory: t.prismaField({
    type: 'CalendarCategory',
    args: { input: t.arg({ type: CalendarCategoryInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      reloaded(prisma.calendarCategory, query, categories.createCalendarCategory({ ...input, parentId: input.parentId ?? null })),
  }),
  updateCalendarCategory: t.prismaField({
    type: 'CalendarCategory',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CalendarCategoryInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      reloaded(prisma.calendarCategory, query, categories.updateCalendarCategory(id, { ...input, parentId: input.parentId ?? null })),
  }),
  deleteCalendarCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(categories.deleteCalendarCategory(id)),
  }),
  moveCalendarCategory: t.boolean({
    description: 'Moves a category at an index among its siblings; with parentId, under another category first (null: top level).',
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }), parentId: t.arg.id() },
    resolve: (_root, { id, index, parentId }) => done(categories.moveCalendarCategory(id, parentId === undefined ? undefined : (parentId ?? null), index)),
  }),
  createCalendarEvent: t.id({
    args: { input: t.arg({ type: CalendarEventInput, required: true }) },
    resolve: async (_root, { input }) => (await events.createCalendarEvent(eventInput(input))).id,
  }),
  updateCalendarEvent: t.id({
    description: 'Changes an event; for a recurring one, the occurrence, it and the following ones, or the whole series.',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: CalendarEventInput, required: true }),
      scope: t.arg({ type: EventScope, required: true }),
      occurrenceDate: t.arg({ type: 'Date' }),
    },
    resolve: async (_root, { id, input, scope, occurrenceDate }) => (await events.updateCalendarEvent(id, eventInput(input), scope, occurrenceDate)).id,
  }),
  setCalendarEventCalledOff: t.boolean({
    description: 'Cancels an event, kept in the calendar struck through, or restores it; for a recurring one, the occurrence, it and the following ones, or the whole series.',
    args: {
      id: t.arg.id({ required: true }),
      scope: t.arg({ type: EventScope, required: true }),
      occurrenceDate: t.arg({ type: 'Date' }),
      calledOff: t.arg.boolean({ required: true }),
    },
    resolve: (_root, { id, scope, occurrenceDate, calledOff }) => done(events.setEventCalledOff(id, scope, occurrenceDate, calledOff)),
  }),
  postponeCalendarEvent: t.id({
    description: 'Cancels an event (or one occurrence) and creates its postponement, linked to it.',
    args: { id: t.arg.id({ required: true }), occurrenceDate: t.arg({ type: 'Date' }), input: t.arg({ type: CalendarEventInput, required: true }) },
    resolve: async (_root, { id, occurrenceDate, input }) => (await events.postponeCalendarEvent(id, occurrenceDate, eventInput(input))).id,
  }),
  subscribeScheduleKind: t.boolean({
    description: 'Shows a kind of schedules of another workspace (without typeId: its schedules without kind), read only.',
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id() },
    resolve: (_root, { workspaceId, typeId }) => done(schedules.subscribeScheduleKind(workspaceId, typeId ?? null)),
  }),
  saveDefaultScheduleKind: t.field({
    type: DefaultScheduleKindRef,
    args: { input: t.arg({ type: DefaultScheduleKindInput, required: true }) },
    // Display values are checked by the service.
    resolve: (_root, { input }) => schedules.saveDefaultScheduleKind(unchecked({ ...input, color: input.color ?? null })),
  }),
  setScheduleSubscriptionLook: t.boolean({
    description: 'Color and display of a kind of schedules subscribed to, in this workspace (null fields: those of the kind).',
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id(), input: t.arg({ type: ScheduleSubscriptionLookInput, required: true }) },
    resolve: (_root, { workspaceId, typeId, input }) =>
      done(
        schedules.setScheduleSubscriptionLook(workspaceId, typeId ?? null, {
          color: input.color ?? null,
          dayDisplay: unchecked(input.dayDisplay ?? null),
          dayBar: input.dayBar ?? null,
          monthDisplay: unchecked(input.monthDisplay ?? null),
        }),
      ),
  }),
  unsubscribeScheduleKind: t.boolean({
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id() },
    resolve: (_root, { workspaceId, typeId }) => done(schedules.unsubscribeScheduleKind(workspaceId, typeId ?? null)),
  }),
  createWorkSchedule: t.id({
    args: { input: t.arg({ type: WorkScheduleInput, required: true }) },
    resolve: async (_root, { input }) => (await schedules.createWorkSchedule(scheduleInput(input))).id,
  }),
  updateWorkSchedule: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: WorkScheduleInput, required: true }) },
    resolve: (_root, { id, input }) => done(schedules.updateWorkSchedule(id, scheduleInput(input))),
  }),
  deleteWorkSchedule: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(schedules.deleteWorkSchedule(id)),
  }),
  deleteCalendarEvent: t.boolean({
    args: { id: t.arg.id({ required: true }), scope: t.arg({ type: EventScope, required: true }), occurrenceDate: t.arg({ type: 'Date' }) },
    resolve: (_root, { id, scope, occurrenceDate }) => done(events.deleteCalendarEvent(id, scope, occurrenceDate)),
  }),
}));

// Display values are checked by the service.
labelMutations('ScheduleType', schedules.scheduleTypes, { create: ScheduleTypeInput, update: ScheduleTypeInput }, { delete: 'Deletes a kind of time slots (its schedules stay, without kind).' });
