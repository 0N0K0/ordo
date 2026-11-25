import { linkedDocumentsInputFields } from '../document-fields';
import { done } from '../errors';
import { EVENT_SCOPES, readReminders } from '@ordo/shared';
import { prisma } from '../../db';
import * as categories from '../../services/calendar/calendar-categories';
import * as calendars from '../../services/calendar/calendars';
import * as events from '../../services/calendar/calendar-events';
import * as schedules from '../../services/calendar/work-schedules';
import { settleScheduleChange } from '../../services/routines/routines';
import { BY_POSITION } from '../../services/core/ordering';
import { builder, type BuilderTypes } from '../builder';
import { locatedInput, locationInputFields, TRAVEL_DESCRIPTIONS, travelInputFields } from '../located-fields';
import { ItemLinkInput, ItemLinkRef } from '../link-fields';
import { ReminderInput, ReminderRef } from '../reminder-fields';
import { BIRTH_DATE_DESCRIPTION } from '../person-fields';
import * as birthdays from '../../services/calendar/birthdays';
import { chosenRule, CONFIRM_LOSS_DESCRIPTION, MOVED_RULE_DESCRIPTION } from '../occurrence-fields';
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

/**
 * Fields an occurrence changed on its own may have apart from its series (label, place, links, days and times, travel).
 * @param {PothosSchemaTypes.ObjectFieldBuilder<BuilderTypes, events.EventSeriesFields>} t Field builder.
 * @returns {object} Fields.
 */
const ownFields = (t: PothosSchemaTypes.ObjectFieldBuilder<BuilderTypes, events.EventSeriesFields>) => ({
    label: t.exposeString('label'),
    description: t.exposeString('description', { nullable: true }),
    location: t.exposeString('location', { nullable: true }),
    locationLat: t.exposeFloat('locationLat', { nullable: true }),
    locationLon: t.exposeFloat('locationLon', { nullable: true }),
    links: t.field({ type: [ItemLinkRef], resolve: (fields) => fields.links }),
    allDay: t.exposeBoolean('allDay'),
    startDate: t.exposeString('startDate'),
    startTime: t.exposeString('startTime', { nullable: true }),
    endDate: t.exposeString('endDate'),
    endTime: t.exposeString('endTime', { nullable: true }),
    travelBefore: t.exposeInt('travelBefore', { description: TRAVEL_DESCRIPTIONS.before }),
    travelAfter: t.exposeInt('travelAfter', { description: TRAVEL_DESCRIPTIONS.after }),
});

const EventSeriesFields = builder.objectRef<events.EventSeriesFields>('CalendarEventSeriesFields').implement({
  description: 'Fields of an occurrence changed on its own as its series has them on its date.',
  fields: (t) => ownFields(t),
});

const EventRoutineLinkRef = builder.objectRef<{ routineId: string; date: string; shownDate: string }>('EventRoutineLink').implement({
  description: 'Occurrence of a routine (its day) an event is about.',
  fields: (t) => ({
    routineId: t.exposeID('routineId'),
    date: t.exposeString('date', { description: 'Day that identifies the occurrence (YYYY-MM-DD): its due day, or the day of its rule when moved onto a day that has its own and kept apart.' }),
    shownDate: t.exposeString('shownDate', { description: 'Day the occurrence shows on (a day of the event; YYYY-MM-DD).' }),
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
    ...ownFields(t as unknown as Parameters<typeof ownFields>[0]),
    start: t.expose('start', { type: 'DateTime' }),
    end: t.expose('end', { type: 'DateTime' }),
    recurrence: t.field({ type: 'JSON', nullable: true, resolve: (occurrence) => occurrence.recurrence }),
    seriesStartDate: t.exposeString('seriesStartDate'),
    reminders: t.field({ type: [ReminderRef], description: 'Minutes before its start or its end (all day: Paris midnight of its first day, or after its last day), a time of its first (or last) day, or that time 1 to 30 days before.', resolve: (occurrence) => occurrence.reminders }),
    projectId: t.exposeID('projectId', { nullable: true }),
    calendarId: t.exposeID('calendarId'),
    contributorIds: t.exposeIDList('contributorIds'),
    relationIds: t.exposeIDList('relationIds', { description: 'Relations without contributor taking part.' }),
    beneficiaryIds: t.exposeIDList('beneficiaryIds', { description: '« Bénéficiaires »: contributors the event is for.' }),
    beneficiaryRelationIds: t.exposeIDList('beneficiaryRelationIds', { description: '« Bénéficiaires »: relations the event is for.' }),
    categoryIds: t.exposeIDList('categoryIds'),
    taskIds: t.exposeIDList('taskIds'),
    libraryDocumentIds: t.exposeIDList('libraryDocumentIds', { description: 'Documents of the library linked to the event (its whole series).' }),
    projectResourceIds: t.exposeIDList('projectResourceIds', { description: 'Documents of projects linked to the event (its whole series), of its project tree.' }),
    savedCountdownIds: t.exposeIDList('savedCountdownIds', { description: 'Saved timers launched from the event (its whole series).' }),
    routineLinks: t.field({ type: [EventRoutineLinkRef], description: 'Routines of a day of the occurrence it is about.', resolve: (occurrence) => occurrence.routineLinks }),
    calledOff: t.exposeBoolean('calledOff', { description: 'Cancelled, kept in the calendar.' }),
    postponedFrom: t.field({ type: PostponedFrom, nullable: true, resolve: (occurrence) => occurrence.postponedFrom }),
    postponedTo: t.field({ type: [PostponedTo], resolve: (occurrence) => occurrence.postponedTo }),
    trackedSeconds: t.exposeInt('trackedSeconds', { description: 'Time tracked on the occurrence.' }),
    series: t.field({
      type: EventSeriesFields,
      nullable: true,
      description: 'Changed on its own: its fields as its series has them on its date (what « Toutes les occurrences » and « Celle-ci et les suivantes » edit); else null.',
      resolve: (occurrence) => occurrence.series,
    }),
  }),
});

/** Planned time slots (a créneau or an éphéméride); also the periods of the contexts of the treasury. */
export const WorkScheduleRef = builder.prismaObject('WorkSchedule', {
  description: 'Planned time slots: a period, its cases (which days, which hours) and exceptions (periods with cases of their own).',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    startDate: t.expose('startDate', { type: 'Date' }),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    cases: t.field({ type: 'JSON', description: 'Cases (shared schedule case shape).', resolve: (schedule) => schedules.scheduleRule(schedule).cases }),
    exceptions: t.field({ type: 'JSON', description: 'Exceptions: { from, to, label, cases }.', resolve: (schedule) => schedules.scheduleRule(schedule).exceptions }),
    typeId: t.exposeID('typeId', { nullable: true, description: 'Kind of time it plans; none: working hours (or, an éphéméride, no kind).' }),
    ephemeris: t.exposeBoolean('ephemeris', { description: 'An éphéméride, not a créneau (that of its kind when it has one).' }),
    unavailable: t.exposeBoolean('unavailable', { description: '« Indisponible » in this workspace: nothing is scheduled during its slots (that of its kind when it has one).' }),
    reminders: t.field({
      type: [ReminderRef],
      description: 'Reminders of an éphéméride, counted from the first day of each run of consecutive days it has (a créneau rings none).',
      resolve: (schedule) => readReminders(schedule.reminders),
    }),
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
    ephemeris: t.exposeBoolean('ephemeris', { description: 'A kind of éphémérides (holidays, birthdays…), not of créneaux.' }),
    unavailable: t.exposeBoolean('unavailable', { description: '« Indisponible » in this workspace: nothing is scheduled during the slots of its schedules.' }),
    budgetContext: t.exposeBoolean('budgetContext', { description: 'Éphémérides only: a context of the treasury, its éphémérides its periods.' }),
    sharedContext: t.exposeBoolean('sharedContext', { description: 'A context in every workspace of the user.' }),
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
    ephemeris: t.boolean({ description: 'A kind of éphémérides; set at its creation only (a conversion changes it).' }),
    unavailable: t.boolean({ description: '« Indisponible »: nothing is scheduled during the slots of its schedules (they take it).' }),
    budgetContext: t.boolean({ description: 'Éphémérides only: « Sert de contexte au budget ».' }),
    sharedContext: t.boolean({ description: 'Budget context only: « Partagé entre espaces ».' }),
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

const BirthdayLookRef = builder.objectRef<schedules.BirthdayLook>('BirthdayLook').implement({
  description: 'Birthdays of the people of this workspace in its calendar, shown as all-day events: shown or not, and color (none: the gray of the éphémérides).',
  fields: (t) => ({
    shown: t.exposeBoolean('shown', { description: 'Shown in the calendar; hidden, their reminders still ring.' }),
    color: t.exposeString('color', { nullable: true }),
  }),
});

const BirthdayLookInput = builder.inputType('BirthdayLookInput', {
  fields: (t) => ({ shown: t.boolean({ required: true }), color: t.string() }),
});

const ScheduleSubscriptionLookInput = builder.inputType('ScheduleSubscriptionLookInput', {
  description: 'Color and display of a kind of schedules subscribed to, in this workspace; null: those of the kind.',
  fields: (t) => ({ color: t.string(), dayDisplay: t.string(), dayBar: t.boolean(), monthDisplay: t.string() }),
});

const EventRoutineLinkInput = builder.inputType('EventRoutineLinkInput', {
  fields: (t) => ({
    routineId: t.id({ required: true }),
    date: t.string({ required: true, description: 'Day that identifies the occurrence of the routine (YYYY-MM-DD).' }),
    shownDate: t.string({ description: 'Moved with the event: the day it shows on now (YYYY-MM-DD); the occurrence of that routine shown that day is linked, none there: the link is dropped.' }),
  }),
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
    typeId: t.id({ nullable: true, description: 'Kind in its workspace; none: its working hours (or, an éphéméride, no kind).', resolve: (item) => item.rule.typeId ?? null }),
    ephemeris: t.boolean({ description: 'An éphéméride, not a créneau.', resolve: (item) => item.rule.ephemeris ?? false }),
    unavailable: t.boolean({ description: '« Indisponible » in this workspace (its subscription to the kind says so, whatever its own workspace says).', resolve: (item) => item.rule.unavailable ?? false }),
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
    ephemeris: t.exposeBoolean('ephemeris', { description: 'A kind of éphémérides.' }),
    unavailable: t.exposeBoolean('unavailable', { description: '« Indisponible » in this workspace (set on its subscription).' }),
  }),
});

const WorkScheduleInput = builder.inputType('WorkScheduleInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    startDate: t.field({ type: 'Date', required: true }),
    endDate: t.field({ type: 'Date' }),
    cases: t.field({ type: 'JSON', required: true, description: 'Cases (shared schedule case shape).' }),
    exceptions: t.field({ type: 'JSON', required: true, description: 'Exceptions: { from, to, label, cases }.' }),
    typeId: t.id({ description: 'Kind of time it plans; none: working hours (or, an éphéméride, no kind).' }),
    ephemeris: t.boolean({ description: 'Without kind: an éphéméride, not a créneau (with one: that of its kind).' }),
    unavailable: t.boolean({ description: 'Without kind: « Indisponible », nothing is scheduled during its slots (with one: that of its kind).' }),
    reminders: t.field({ type: [ReminderInput], description: 'Reminders of an éphéméride, 10 at most; omitted: left unchanged.' }),
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
  ephemeris: input.ephemeris ?? false,
  unavailable: input.unavailable ?? false,
  reminders: input.reminders ?? undefined,
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
    reminders: t.field({ type: [ReminderInput], required: true, description: 'Minutes before its start or its end (24 hours at most), a time of its first (or last) day, or that time 1 to 30 days before; each with its ringtone or none; 10 at most.' }),
    ...travelInputFields(t, 'none: 0'),
    projectId: t.id(),
    calendarId: t.id({ description: 'Calendar; the first one of the workspace when omitted.' }),
    contributorIds: t.idList({ required: true }),
    relationIds: t.idList({ description: 'Relations without contributor taking part; none: none.' }),
    beneficiaryIds: t.idList({ description: 'Contributors the event is for; none: none.' }),
    beneficiaryRelationIds: t.idList({ description: 'Relations the event is for; none: none.' }),
    categoryIds: t.idList({ required: true }),
    taskIds: t.idList({ description: 'Tasks the event is about (none when omitted).' }),
    ...linkedDocumentsInputFields(t, 'none: none'),
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
  routineLinks: (input.routineLinks ?? []).map((link) => ({ routineId: link.routineId, date: link.date, ...(link.shownDate && { shownDate: link.shownDate }) })),
  relationIds: input.relationIds ?? [],
  beneficiaryIds: input.beneficiaryIds ?? [],
  beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
  libraryDocumentIds: input.libraryDocumentIds ?? [],
  projectResourceIds: input.projectResourceIds ?? [],
});

const BirthdayRef = builder.objectRef<birthdays.PersonBirthday>('Birthday').implement({
  description: 'Birthday of a contributor or a relation: a whole-day éphéméride derived from its birth date, every year, not stored.',
  fields: (t) => ({
    id: t.exposeID('id', { description: '`contributor:<id>` or `relation:<id>`.' }),
    contributorId: t.exposeID('contributorId', { nullable: true, description: 'Contributor it is of (also set for a relation that is a contributor).' }),
    relationId: t.exposeID('relationId', { nullable: true, description: 'Relation it is of.' }),
    name: t.exposeString('name'),
    birthDate: t.exposeString('birthDate', { description: BIRTH_DATE_DESCRIPTION }),
    reminders: t.field({ type: [ReminderRef], description: 'Reminders « À HH:MM » or « N jours avant, à HH:MM » of the birthday.', resolve: (birthday) => birthday.reminders }),
    archived: t.exposeBoolean('archived', { description: 'Its person is archived (asked with `archived: true` only): shown nowhere, no moment to the slot conditions.' }),
    aliases: t.exposeStringList('aliases', {
      description: 'Other ids (`relation:<id>`, `contributor:<id>`) naming the same birthday in the slot conditions: the relation linked to the contributor whose birthday applies, or the reverse.',
    }),
  }),
});

const BirthdayPersonNameRef = builder.objectRef<birthdays.BirthdayPersonName>('BirthdayPersonName').implement({
  description: 'A contributor or a relation of the workspace (archived ones too) as a slot condition names its birthday, with or without one.',
  fields: (t) => ({
    id: t.exposeID('id', { description: '`contributor:<id>` or `relation:<id>`.' }),
    name: t.exposeString('name'),
    archived: t.exposeBoolean('archived'),
  }),
});

builder.queryFields((t) => ({
  birthdayPersonNames: t.field({
    type: [BirthdayPersonNameRef],
    description: 'Every contributor and relation of the workspace, archived ones too: the names of the people a slot condition cites, even those without a birthday.',
    resolve: () => birthdays.birthdayPersonNames(),
  }),
  birthdays: t.field({
    type: [BirthdayRef],
    description: 'Birthdays of the people of the workspace (contributors and relations with a birth date, not archived unless asked), by name.',
    args: { archived: t.arg.boolean({ description: 'Those of archived people too (flagged `archived`): what a slot condition may still name.' }) },
    resolve: (_root, { archived }) => birthdays.birthdays({ archived: archived ?? false }),
  }),
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
  birthdayLook: t.field({
    type: BirthdayLookRef,
    description: 'Birthdays of the people of this workspace in its calendar: shown or not, color and display.',
    resolve: () => schedules.birthdayLook(),
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
      confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }),
      movedRule: t.arg({ type: 'JSON', description: MOVED_RULE_DESCRIPTION }),
    },
    resolve: async (_root, { id, input, scope, occurrenceDate, confirmLoss, movedRule }) =>
      (await events.updateCalendarEvent(id, eventInput(input), scope, occurrenceDate, confirmLoss ?? false, chosenRule(movedRule))).id,
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
  saveBirthdayLook: t.field({
    type: BirthdayLookRef,
    args: { input: t.arg({ type: BirthdayLookInput, required: true }) },
    // The color is checked by the service.
    resolve: (_root, { input }) => schedules.saveBirthdayLook(unchecked({ ...input, color: input.color ?? null })),
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
  setScheduleSubscriptionUnavailable: t.boolean({
    description:
      'Sets a kind of schedules subscribed to (without typeId: the schedules without kind) « Indisponible » in this workspace, or back; the occurrences of routines it makes disappear lose their comments, once confirmed.',
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id(), unavailable: t.arg.boolean({ required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: (_root, { workspaceId, typeId, unavailable, confirmLoss }) =>
      done(schedules.setScheduleSubscriptionUnavailable(workspaceId, typeId ?? null, unavailable, (subscription) => settleScheduleChange({ subscription }, confirmLoss ?? false))),
  }),
  unsubscribeScheduleKind: t.boolean({
    args: { workspaceId: t.arg.id({ required: true }), typeId: t.arg.id() },
    resolve: (_root, { workspaceId, typeId }) => done(schedules.unsubscribeScheduleKind(workspaceId, typeId ?? null)),
  }),
  createWorkSchedule: t.id({
    description: 'Creates a schedule; the occurrences of routines it makes disappear (no moment left) lose their comments, once confirmed.',
    args: { input: t.arg({ type: WorkScheduleInput, required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: async (_root, { input, confirmLoss }) => (await schedules.createWorkSchedule(scheduleInput(input), (change) => settleScheduleChange({ apply: change }, confirmLoss ?? false))).id,
  }),
  updateWorkSchedule: t.boolean({
    description: 'Changes a schedule; the occurrences of routines it makes disappear (no moment left) lose their comments, once confirmed.',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: WorkScheduleInput, required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: (_root, { id, input, confirmLoss }) => done(schedules.updateWorkSchedule(id, scheduleInput(input), (change) => settleScheduleChange({ apply: change }, confirmLoss ?? false))),
  }),
  setWorkScheduleEphemeris: t.boolean({
    description:
      'Turns a schedule into an éphéméride or back into a créneau (its id kept; a kind of the other nature left); the occurrences of routines it makes disappear lose their comments, once confirmed.',
    args: { id: t.arg.id({ required: true }), ephemeris: t.arg.boolean({ required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: (_root, { id, ephemeris, confirmLoss }) => done(schedules.setWorkScheduleEphemeris(id, ephemeris, (change) => settleScheduleChange({ apply: change }, confirmLoss ?? false))),
  }),
  setScheduleTypeEphemeris: t.boolean({
    description:
      'Turns a whole kind (its schedules with it, ids kept) into a kind of éphémérides or back into a kind of créneaux; the occurrences of routines it makes disappear lose their comments, once confirmed.',
    args: { id: t.arg.id({ required: true }), ephemeris: t.arg.boolean({ required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: (_root, { id, ephemeris, confirmLoss }) => done(schedules.setScheduleTypeEphemeris(id, ephemeris, (change) => settleScheduleChange({ apply: change }, confirmLoss ?? false))),
  }),
  deleteWorkSchedule: t.boolean({
    description: 'Deletes a schedule; the occurrences of routines it makes disappear (no moment left) lose their comments, once confirmed.',
    args: { id: t.arg.id({ required: true }), confirmLoss: t.arg.boolean({ description: CONFIRM_LOSS_DESCRIPTION }) },
    resolve: (_root, { id, confirmLoss }) => done(schedules.deleteWorkSchedule(id, (change) => settleScheduleChange({ apply: change }, confirmLoss ?? false))),
  }),
  deleteCalendarEvent: t.boolean({
    args: { id: t.arg.id({ required: true }), scope: t.arg({ type: EventScope, required: true }), occurrenceDate: t.arg({ type: 'Date' }) },
    resolve: (_root, { id, scope, occurrenceDate }) => done(events.deleteCalendarEvent(id, scope, occurrenceDate)),
  }),
}));

// Display values are checked by the service.
labelMutations(
  'ScheduleType',
  schedules.scheduleTypes,
  { create: ScheduleTypeInput, update: ScheduleTypeInput },
  { delete: 'Deletes a kind of time slots (its schedules stay, without kind); the occurrences of routines it makes disappear lose their comments, once confirmed.' },
  (id, confirmLoss) => schedules.deleteScheduleType(id, (change) => settleScheduleChange({ apply: change }, confirmLoss)),
  // « Indisponible » changed: the occurrences of routines it makes disappear lose their comments, once confirmed.
  (id, input, confirmLoss) => schedules.updateScheduleType(id, input, (change) => settleScheduleChange({ apply: change }, confirmLoss)),
);
