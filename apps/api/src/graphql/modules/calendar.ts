import { EVENT_SCOPES } from '@ordo/shared';
import { prisma } from '../../db';
import * as categories from '../../services/calendar-categories';
import * as calendars from '../../services/calendars';
import * as events from '../../services/calendar-events';
import * as schedules from '../../services/work-schedules';
import { builder } from '../builder';

builder.prismaObject('CalendarCategory', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    parentId: t.exposeID('parentId', { nullable: true }),
    position: t.exposeInt('position'),
  }),
});

builder.prismaObject('Calendar', {
  description: 'Calendar of the workspace: every event belongs to one.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    position: t.exposeInt('position'),
  }),
});

const CalendarWorkspace = builder.objectRef<calendars.CalendarSubscriptionView['workspace']>('CalendarWorkspace').implement({
  description: 'Workspace a calendar belongs to.',
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name'), kind: t.exposeString('kind') }),
});

const CalendarSubscription = builder.objectRef<calendars.CalendarSubscriptionView>('CalendarSubscription').implement({
  description: 'Calendar of another workspace shown, read only, in this one.',
  fields: (t) => ({
    id: t.exposeID('id'),
    calendarId: t.exposeID('calendarId'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    workspace: t.field({ type: CalendarWorkspace, resolve: (subscription) => subscription.workspace }),
  }),
});

const SubscribableCalendar = builder.objectRef<calendars.SubscribableCalendar>('SubscribableCalendar').implement({
  description: 'Calendar of another workspace, with whether this one shows it.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    workspace: t.field({ type: CalendarWorkspace, resolve: (calendar) => calendar.workspace }),
    subscribed: t.exposeBoolean('subscribed'),
  }),
});

const EventScope = builder.enumType('CalendarEventScope', {
  description: 'Scope of a change to a recurring event.',
  values: EVENT_SCOPES,
});

const CalendarLink = builder.objectRef<events.CalendarLink>('CalendarLink').implement({
  fields: (t) => ({ url: t.exposeString('url'), label: t.exposeString('label') }),
});

const PostponedFrom = builder.objectRef<NonNullable<events.EventOccurrence['postponedFrom']>>('CalendarPostponedFrom').implement({
  description: 'Event (and occurrence) a postponement replaces.',
  fields: (t) => ({
    eventId: t.exposeID('eventId'),
    date: t.exposeString('date', { nullable: true, description: 'Occurrence of a recurring event.' }),
    title: t.exposeString('title'),
  }),
});

const PostponedTo = builder.objectRef<events.EventOccurrence['postponedTo'][number]>('CalendarPostponedTo').implement({
  description: 'Event postponing an occurrence.',
  fields: (t) => ({
    eventId: t.exposeID('eventId'),
    title: t.exposeString('title'),
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
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    location: t.exposeString('location', { nullable: true }),
    links: t.field({ type: [CalendarLink], resolve: (occurrence) => occurrence.links }),
    allDay: t.exposeBoolean('allDay'),
    startDate: t.exposeString('startDate'),
    startTime: t.exposeString('startTime', { nullable: true }),
    endDate: t.exposeString('endDate'),
    endTime: t.exposeString('endTime', { nullable: true }),
    timeZone: t.exposeString('timeZone'),
    start: t.expose('start', { type: 'DateTime' }),
    end: t.expose('end', { type: 'DateTime' }),
    recurrence: t.field({ type: 'JSON', nullable: true, resolve: (occurrence) => occurrence.recurrence }),
    seriesStartDate: t.exposeString('seriesStartDate'),
    reminders: t.exposeIntList('reminders'),
    projectId: t.exposeID('projectId', { nullable: true }),
    calendarId: t.exposeID('calendarId'),
    contributorIds: t.exposeIDList('contributorIds'),
    categoryIds: t.exposeIDList('categoryIds'),
    taskIds: t.exposeIDList('taskIds'),
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
    name: t.exposeString('name'),
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
    name: t.exposeString('name'),
    color: t.exposeString('color'),
    dayDisplay: t.exposeString('dayDisplay', { description: 'Its slots in the week and the day: SLOT_BACKGROUND, DAY_BACKGROUND, SLOT_BORDER or NONE.' }),
    dayBar: t.exposeBoolean('dayBar', { description: 'A bar at the top of the week and the day on each day with slots.' }),
    monthDisplay: t.exposeString('monthDisplay', { description: 'Its days in the month: BACKGROUND, BORDER or NONE.' }),
    position: t.exposeInt('position'),
  }),
});

const ScheduleTypeInput = builder.inputType('ScheduleTypeInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    color: t.string({ required: true }),
    dayDisplay: t.string({ required: true }),
    dayBar: t.boolean({ required: true }),
    monthDisplay: t.string({ required: true }),
  }),
});

const DefaultScheduleKindRef = builder.objectRef<schedules.DefaultScheduleKind>('DefaultScheduleKind').implement({
  description: 'Schedules without kind of this workspace: their name, color (none: the green of working hours) and display.',
  fields: (t) => ({
    name: t.exposeString('name'),
    color: t.exposeString('color', { nullable: true }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
  }),
});

const DefaultScheduleKindInput = builder.inputType('DefaultScheduleKindInput', {
  fields: (t) => ({
    name: t.string({ required: true, description: 'Empty: "Travail".' }),
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

const ForeignScheduleRef = builder.objectRef<schedules.ForeignSchedule>('ForeignWorkSchedule').implement({
  description: 'Schedule of a kind of another workspace this one subscribes to, shown read only.',
  fields: (t) => ({
    id: t.id({ resolve: (item) => item.rule.id }),
    name: t.string({ resolve: (item) => item.rule.name }),
    startDate: t.string({ resolve: (item) => item.rule.startDate }),
    endDate: t.string({ nullable: true, resolve: (item) => item.rule.endDate }),
    cases: t.field({ type: 'JSON', resolve: (item) => item.rule.cases }),
    exceptions: t.field({ type: 'JSON', resolve: (item) => item.rule.exceptions }),
    typeName: t.exposeString('typeName', { nullable: true }),
    color: t.exposeString('color', { nullable: true, description: 'In this workspace.' }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
    workspaceId: t.id({ resolve: (item) => item.workspace.id }),
    workspaceName: t.string({ resolve: (item) => item.workspace.name }),
  }),
});

const ForeignScheduleKindRef = builder.objectRef<schedules.ForeignScheduleKind>('ForeignScheduleKind').implement({
  description: 'Kind of schedules of another workspace (or its schedules without kind), with whether this one shows it.',
  fields: (t) => ({
    workspaceId: t.id({ resolve: (item) => item.workspace.id }),
    workspaceName: t.string({ resolve: (item) => item.workspace.name }),
    typeId: t.exposeID('typeId', { nullable: true, description: 'None: the schedules without kind (working hours).' }),
    name: t.exposeString('name'),
    color: t.exposeString('color', { nullable: true, description: 'In this workspace: the subscription’s, or the kind’s.' }),
    sourceColor: t.exposeString('sourceColor', { nullable: true, description: 'Of the kind, in its workspace.' }),
    dayDisplay: t.string({ resolve: (item) => item.display.dayDisplay }),
    dayBar: t.boolean({ resolve: (item) => item.display.dayBar }),
    monthDisplay: t.string({ resolve: (item) => item.display.monthDisplay }),
    customized: t.exposeBoolean('customized', { description: 'The subscription sets a color or a display of its own.' }),
    scheduleCount: t.exposeInt('scheduleCount'),
    subscribed: t.exposeBoolean('subscribed'),
  }),
});

const WorkScheduleInput = builder.inputType('WorkScheduleInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
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
  cases: input.cases as never,
  exceptions: input.exceptions as never,
});

const CalendarLinkInput = builder.inputType('CalendarLinkInput', {
  fields: (t) => ({ url: t.string({ required: true }), label: t.string({ required: true }) }),
});

const CalendarEventInput = builder.inputType('CalendarEventInput', {
  description: 'Times are local to timeZone; all-day events have none.',
  fields: (t) => ({
    title: t.string({ required: true }),
    description: t.string(),
    location: t.string(),
    links: t.field({ type: [CalendarLinkInput], required: true }),
    allDay: t.boolean({ required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    startTime: t.string(),
    endDate: t.field({ type: 'Date', required: true }),
    endTime: t.string(),
    timeZone: t.string({ required: true }),
    recurrence: t.field({ type: 'JSON' }),
    reminders: t.intList({ required: true, description: 'Minutes before the start.' }),
    projectId: t.id(),
    calendarId: t.id({ description: 'Calendar; the first one of the workspace when omitted.' }),
    contributorIds: t.idList({ required: true }),
    categoryIds: t.idList({ required: true }),
    taskIds: t.idList({ description: 'Tasks the event is about (none when omitted).' }),
  }),
});

const CalendarInput = builder.inputType('CalendarInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }) }),
});

const CalendarCategoryInput = builder.inputType('CalendarCategoryInput', {
  fields: (t) => ({ name: t.string({ required: true }), color: t.string({ required: true }), parentId: t.id() }),
});

/**
 * Event input with omitted optional fields as null.
 * @param {typeof CalendarEventInput.$inferInput} input GraphQL input.
 * @returns {import('@ordo/shared').CalendarEventInput} Service input.
 */
const eventInput = (input: typeof CalendarEventInput.$inferInput) => ({
  ...input,
  description: input.description ?? null,
  location: input.location ?? null,
  startTime: input.startTime ?? null,
  endTime: input.endTime ?? null,
  recurrence: (input.recurrence ?? null) as never,
  projectId: input.projectId ?? null,
  calendarId: input.calendarId ?? null,
  taskIds: input.taskIds ?? [],
});

builder.queryFields((t) => ({
  calendars: t.prismaField({
    type: ['Calendar'],
    description: 'Calendars of the workspace, in their order.',
    resolve: (query) => prisma.calendar.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
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
    resolve: (query) => prisma.calendarCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  scheduleTypes: t.prismaField({
    type: ['ScheduleType'],
    resolve: (query) => prisma.scheduleType.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
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
    args: { input: t.arg({ type: CalendarInput, required: true }) },
    resolve: async (query, _root, { input }) => prisma.calendar.findUniqueOrThrow({ ...query, where: { id: (await calendars.createCalendar(input)).id } }),
  }),
  updateCalendar: t.prismaField({
    type: 'Calendar',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CalendarInput, required: true }) },
    resolve: async (query, _root, { id, input }) => prisma.calendar.findUniqueOrThrow({ ...query, where: { id: (await calendars.updateCalendar(id, input)).id } }),
  }),
  moveCalendar: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await calendars.moveCalendar(id, index);
      return true;
    },
  }),
  deleteCalendar: t.boolean({
    description: 'Deletes a calendar with its events (not the last one of the workspace).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await calendars.deleteCalendar(id);
      return true;
    },
  }),
  subscribeCalendar: t.boolean({
    description: 'Shows a calendar of another workspace in this one (read only).',
    args: { calendarId: t.arg.id({ required: true }) },
    resolve: async (_root, { calendarId }) => {
      await calendars.subscribe(calendarId);
      return true;
    },
  }),
  unsubscribeCalendar: t.boolean({
    description: 'Stops showing a calendar of another workspace.',
    args: { calendarId: t.arg.id({ required: true }) },
    resolve: async (_root, { calendarId }) => {
      await calendars.unsubscribe(calendarId);
      return true;
    },
  }),
  createCalendarCategory: t.prismaField({
    type: 'CalendarCategory',
    args: { input: t.arg({ type: CalendarCategoryInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.calendarCategory.findUniqueOrThrow({
        ...query,
        where: { id: (await categories.createCalendarCategory({ ...input, parentId: input.parentId ?? null })).id },
      }),
  }),
  updateCalendarCategory: t.prismaField({
    type: 'CalendarCategory',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: CalendarCategoryInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.calendarCategory.findUniqueOrThrow({
        ...query,
        where: { id: (await categories.updateCalendarCategory(id, { ...input, parentId: input.parentId ?? null })).id },
      }),
  }),
  deleteCalendarCategory: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await categories.deleteCalendarCategory(id);
      return true;
    },
  }),
  moveCalendarCategory: t.boolean({
    args: { id: t.arg.id({ required: true }), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, index }) => {
      await categories.moveCalendarCategory(id, index);
      return true;
    },
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
    resolve: async (_root, { id, input, scope, occurrenceDate }) =>
      (await events.updateCalendarEvent(id, eventInput(input), scope, occurrenceDate)).id,
  }),
  setCalendarEventCalledOff: t.boolean({
    description: 'Cancels an event, kept in the calendar struck through, or restores it; for a recurring one, the occurrence, it and the following ones, or the whole series.',
    args: {
      id: t.arg.id({ required: true }),
      scope: t.arg({ type: EventScope, required: true }),
      occurrenceDate: t.arg({ type: 'Date' }),
      calledOff: t.arg.boolean({ required: true }),
    },
    resolve: async (_root, { id, scope, occurrenceDate, calledOff }) => {
      await events.setEventCalledOff(id, scope, occurrenceDate, calledOff);
      return true;
    },
  }),
  postponeCalendarEvent: t.id({
    description: 'Cancels an event (or one occurrence) and creates its postponement, linked to it.',
    args: { id: t.arg.id({ required: true }), occurrenceDate: t.arg({ type: 'Date' }), input: t.arg({ type: CalendarEventInput, required: true }) },
    resolve: async (_root, { id, occurrenceDate, input }) => (await events.postponeCalendarEvent(id, occurrenceDate, eventInput(input))).id,
  }),
  saveScheduleType: t.id({
    args: { id: t.arg.id(), input: t.arg({ type: ScheduleTypeInput, required: true }) },
    // Display values are checked by the service.
    resolve: async (_root, { id, input }) => (await schedules.saveScheduleType(id ?? null, input as never)).id,
  }),
  deleteScheduleType: t.boolean({
    description: 'Deletes a kind of time slots (its schedules stay, without kind).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await schedules.deleteScheduleType(id);
      return true;
    },
  }),
  subscribeScheduleKind: t.boolean({
    description: 'Shows a kind of schedules of another workspace (without typeId: its schedules without kind), read only.',
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id() },
    resolve: async (_root, { workspaceId, typeId }) => {
      await schedules.subscribeScheduleKind(workspaceId, typeId ?? null);
      return true;
    },
  }),
  saveDefaultScheduleKind: t.field({
    type: DefaultScheduleKindRef,
    args: { input: t.arg({ type: DefaultScheduleKindInput, required: true }) },
    // Display values are checked by the service.
    resolve: (_root, { input }) => schedules.saveDefaultScheduleKind({ ...input, color: input.color ?? null } as never),
  }),
  setScheduleSubscriptionLook: t.boolean({
    description: 'Color and display of a kind of schedules subscribed to, in this workspace (null fields: those of the kind).',
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id(), input: t.arg({ type: ScheduleSubscriptionLookInput, required: true }) },
    resolve: async (_root, { workspaceId, typeId, input }) => {
      await schedules.setScheduleSubscriptionLook(workspaceId, typeId ?? null, {
        color: input.color ?? null,
        dayDisplay: (input.dayDisplay ?? null) as never,
        dayBar: input.dayBar ?? null,
        monthDisplay: (input.monthDisplay ?? null) as never,
      });
      return true;
    },
  }),
  unsubscribeScheduleKind: t.boolean({
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id() },
    resolve: async (_root, { workspaceId, typeId }) => {
      await schedules.unsubscribeScheduleKind(workspaceId, typeId ?? null);
      return true;
    },
  }),
  createWorkSchedule: t.id({
    args: { input: t.arg({ type: WorkScheduleInput, required: true }) },
    resolve: async (_root, { input }) => (await schedules.createWorkSchedule(scheduleInput(input))).id,
  }),
  updateWorkSchedule: t.boolean({
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: WorkScheduleInput, required: true }) },
    resolve: async (_root, { id, input }) => {
      await schedules.updateWorkSchedule(id, scheduleInput(input));
      return true;
    },
  }),
  deleteWorkSchedule: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await schedules.deleteWorkSchedule(id);
      return true;
    },
  }),
  deleteCalendarEvent: t.boolean({
    args: { id: t.arg.id({ required: true }), scope: t.arg({ type: EventScope, required: true }), occurrenceDate: t.arg({ type: 'Date' }) },
    resolve: async (_root, { id, scope, occurrenceDate }) => {
      await events.deleteCalendarEvent(id, scope, occurrenceDate);
      return true;
    },
  }),
}));
