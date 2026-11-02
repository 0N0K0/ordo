import { EVENT_SCOPES } from '@ordo/shared';
import { prisma } from '../../db';
import * as categories from '../../services/calendar-categories';
import * as events from '../../services/calendar-events';
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

const EventScope = builder.enumType('CalendarEventScope', {
  description: 'Scope of a change to a recurring event.',
  values: EVENT_SCOPES,
});

const CalendarLink = builder.objectRef<events.CalendarLink>('CalendarLink').implement({
  fields: (t) => ({ url: t.exposeString('url'), label: t.exposeString('label') }),
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
    contributorIds: t.exposeIDList('contributorIds'),
    categoryIds: t.exposeIDList('categoryIds'),
  }),
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
    contributorIds: t.idList({ required: true }),
    categoryIds: t.idList({ required: true }),
  }),
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
});

builder.queryFields((t) => ({
  calendarCategories: t.prismaField({
    type: ['CalendarCategory'],
    resolve: (query) => prisma.calendarCategory.findMany({ ...query, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  }),
  calendarEvents: t.field({
    type: [EventOccurrence],
    description: 'Occurrences of the events overlapping a period (dates included).',
    args: { from: t.arg({ type: 'Date', required: true }), to: t.arg({ type: 'Date', required: true }) },
    resolve: (_root, { from, to }) => events.eventOccurrences(from, to),
  }),
}));

builder.mutationFields((t) => ({
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
  deleteCalendarEvent: t.boolean({
    args: { id: t.arg.id({ required: true }), scope: t.arg({ type: EventScope, required: true }), occurrenceDate: t.arg({ type: 'Date' }) },
    resolve: async (_root, { id, scope, occurrenceDate }) => {
      await events.deleteCalendarEvent(id, scope, occurrenceDate);
      return true;
    },
  }),
}));
