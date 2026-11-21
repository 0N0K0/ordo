import { done } from '../errors';
import { ALARM_FREQUENCIES, ALARM_TYPES, type AlarmInput } from '@ordo/shared';
import { prisma } from '../../db';
import * as alarms from '../../services/tasks/alarms';
import * as timeEntries from '../../services/tasks/time-entries';
import type { GoneOccurrences } from '../../services/tasks/time-entries';
import { builder, type InputFields } from '../builder';
import { relationIds } from '../relation-fields';
import { deletedTreeIds, subtreeIds } from '../../services/core/trees';
import { goneOccurrences, placeLegacyEventComments } from '../../services/calendar/calendar-events';
import { placeLegacyRoutineComments } from '../../services/routines/routines';
import { calendarEventsGone } from '../../services/calendar/calendars';
import { EventScope } from './calendar';
import { reloaded } from '../reload';
import { commentsLostOnDelete } from '../../services/core/comments';

const LostOnDeleteRef = builder.objectRef<{ times: number; comments: number }>('LostOnDelete').implement({
  description: 'What a deletion takes with it, for its confirmation.',
  fields: (t) => ({
    times: t.exposeInt('times', { description: 'Times without project, not billed, left with nothing attached.' }),
    comments: t.exposeInt('comments', { description: 'Comments of the items and occurrences deleted.' }),
  }),
});

const RoutineOccurrenceGoneInput = builder.inputType('RoutineOccurrenceGoneInput', {
  fields: (t) => ({
    id: t.id({ required: true }),
    date: t.field({ type: 'Date', required: true, description: 'Occurrence (its day now).' }),
    scope: t.field({ type: EventScope, required: true, description: 'THIS or FOLLOWING.' }),
  }),
});

builder.prismaObject('TimeEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId', { nullable: true }),
    routines: t.relation('routines', { description: 'Routines the time is spent on.' }),
    description: t.exposeString('description', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'DateTime' }),
    endedAt: t.expose('endedAt', { type: 'DateTime', nullable: true }),
    pausedAt: t.expose('pausedAt', { type: 'DateTime', nullable: true }),
    pausedSeconds: t.exposeInt('pausedSeconds'),
    duration: t.exposeInt('duration', { nullable: true, description: 'Seconds, pauses excluded; null while running.' }),
    taskIds: t.idList(relationIds('tasks')),
    documentId: t.exposeID('documentId', { nullable: true, description: 'Invoice the time is billed on.' }),
    events: t.relation('events', { description: 'Calendar events (occurrences) the time was spent on.' }),
    documentNumber: t.string({
      nullable: true,
      description: 'Number of that invoice, null while it is a draft.',
      select: { document: { select: { number: true } } },
      resolve: (entry) => entry.document?.number ?? null,
    }),
  }),
});

builder.prismaObject('TimeEntryEvent', {
  description: 'Calendar event (its occurrence for a recurring one) a time was spent on.',
  fields: (t) => ({
    eventId: t.exposeID('eventId'),
    occurrenceDate: t.expose('occurrenceDate', { type: 'Date', nullable: true, description: 'Its occurrence, for a recurring event.' }),
    label: t.string({ select: { event: { select: { label: true } } }, resolve: (link) => link.event.label }),
  }),
});

const AlarmTypeEnum = builder.enumType('AlarmType', { values: ALARM_TYPES });
const AlarmFrequencyEnum = builder.enumType('AlarmFrequency', { values: ALARM_FREQUENCIES });

builder.prismaObject('Alarm', {
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label'),
    note: t.exposeString('note', { nullable: true }),
    type: t.field({ type: AlarmTypeEnum, resolve: (alarm) => alarm.type }),
    startDate: t.expose('startDate', { type: 'Date', nullable: true }),
    time: t.exposeString('time', { nullable: true }),
    frequency: t.field({ type: AlarmFrequencyEnum, resolve: (alarm) => alarm.frequency }),
    interval: t.exposeInt('interval'),
    weekdays: t.exposeIntList('weekdays'),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
    recurrence: t.field({ type: 'JSON', nullable: true, description: 'Repetition in the common form; null: frequency, interval, weekdays and endDate.', resolve: (alarm) => alarm.recurrence ?? null }),
    minutes: t.exposeInt('minutes', { nullable: true }),
    projectId: t.exposeID('projectId', { nullable: true }),
    taskId: t.exposeID('taskId', { nullable: true }),
    project: t.relation('project', { nullable: true }),
    task: t.relation('task', { nullable: true }),
    enabled: t.exposeBoolean('enabled'),
    lastFiredAt: t.expose('lastFiredAt', { type: 'DateTime', nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

const TimeEventInput = builder.inputType('TimeEventInput', {
  description: 'Calendar event a time is spent on (its occurrence for a recurring one).',
  fields: (t) => ({ eventId: t.id({ required: true }), occurrenceDate: t.field({ type: 'Date' }) }),
});

/**
 * Event links of an input: null or omitted leaves them unchanged (none for a new time).
 * @param {{ eventId: string, occurrenceDate?: string | null }[] | null | undefined} events GraphQL input.
 * @returns {import('../../services/tasks/time-entries').TimeEventLink[] | undefined} Service input.
 */
const eventLinks = (events: readonly { eventId: string; occurrenceDate?: string | null }[] | null | undefined) =>
  events?.map((event) => ({ eventId: event.eventId, occurrenceDate: event.occurrenceDate ?? null }));

/**
 * What a time is spent on, for a timer and an entry: a project, routines (the project of the first one by default),
 * tasks and events (several of each), and its description.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const spentOnFields = (t: InputFields) => ({
  projectId: t.id(),
  routineIds: t.idList(),
  taskIds: t.idList({ required: true }),
  description: t.string(),
  events: t.field({ type: [TimeEventInput] }),
});

const TimerInput = builder.inputType('TimerInput', {
  description: 'At least a project, a task, a routine (the project of the first one by default) or an event.',
  fields: (t) => spentOnFields(t),
});

const TimeEntryInput = builder.inputType('TimeEntryInput', {
  description: 'At least a project, a task, a routine (the project of the first one by default) or an event.',
  fields: (t) => ({
    ...spentOnFields(t),
    startedAt: t.field({ type: 'DateTime', required: true }),
    duration: t.int({ required: true, description: 'Seconds.' }),
  }),
});

const TimeEntryUpdateInput = builder.inputType('TimeEntryUpdateInput', {
  description: 'Omitted fields are left unchanged. The duration of the running timer cannot be changed.',
  fields: (t) => ({
    projectId: t.id(),
    routineIds: t.idList({ description: 'Omitted: unchanged.' }),
    taskIds: t.idList({ description: 'Omitted: unchanged.' }),
    description: t.string(),
    startedAt: t.field({ type: 'DateTime' }),
    duration: t.int({ description: 'Seconds.' }),
    events: t.field({ type: [TimeEventInput], description: 'Omitted: unchanged.' }),
  }),
});

const AlarmInput = builder.inputType('AlarmInput', {
  fields: (t) => ({
    label: t.string({ required: true }),
    note: t.string(),
    type: t.field({ type: AlarmTypeEnum, required: true }),
    startDate: t.field({ type: 'Date' }),
    time: t.string({ description: 'HH:MM, local time.' }),
    frequency: t.field({ type: AlarmFrequencyEnum, required: true }),
    interval: t.int({ required: true }),
    weekdays: t.intList({ required: true, description: '1 (Monday) to 7 (Sunday).' }),
    endDate: t.field({ type: 'Date' }),
    recurrence: t.field({ type: 'JSON', description: 'Repetition in the common form; null: it rings once.' }),
    minutes: t.int(),
    projectId: t.id(),
    taskId: t.id(),
    enabled: t.boolean({ required: true }),
  }),
});

/**
 * Alarm input with omitted optional fields as null.
 * @param {typeof AlarmInput.$inferInput} input GraphQL input.
 * @returns {import('@ordo/shared').AlarmInput} Service input.
 */
const alarmInput = (input: typeof AlarmInput.$inferInput) => ({
  ...input,
  note: input.note ?? null,
  startDate: input.startDate ?? null,
  time: input.time ?? null,
  endDate: input.endDate ?? null,
  recurrence: (input.recurrence ?? null) as AlarmInput['recurrence'],
  minutes: input.minutes ?? null,
  projectId: input.projectId ?? null,
  taskId: input.taskId ?? null,
});

builder.queryFields((t) => ({
  timeEntries: t.prismaField({
    type: ['TimeEntry'],
    description: 'Time entries, latest first: those of a project and its sub-projects, of a routine, or every entry; optionally only those started since a moment.',
    args: { projectId: t.arg.id(), routineId: t.arg.id(), since: t.arg({ type: 'DateTime' }) },
    resolve: async (query, _root, { projectId, routineId, since }) => {
      const projectIds = projectId ? await subtreeIds('project', projectId) : undefined;
      return prisma.timeEntry.findMany({
        ...query,
        where: {
          ...(projectIds ? { projectId: { in: projectIds } } : {}),
          ...(routineId ? { routines: { some: { id: routineId } } } : {}),
          ...(since ? { startedAt: { gte: since } } : {}),
        },
        orderBy: { startedAt: 'desc' },
      });
    },
  }),
  lostOnDelete: t.field({
    type: LostOnDeleteRef,
    description:
      'What a deletion of tasks, routines, occurrences of a routine, an event (occurrences) or a calendar takes with it: the times without project, not billed, left with nothing attached, and the comments of the routines, events and occurrences deleted.',
    args: {
      taskIds: t.arg.idList(),
      routineIds: t.arg.idList(),
      withSubtree: t.arg.boolean({ description: 'Their sub-tasks or sub-routines are deleted too.' }),
      eventId: t.arg.id(),
      scope: t.arg({ type: EventScope }),
      occurrenceDate: t.arg({ type: 'Date' }),
      calendarId: t.arg.id({ description: 'Calendar deleted with all its events.' }),
      routineOccurrence: t.arg({
        type: RoutineOccurrenceGoneInput,
        description: 'Occurrence of a routine cancelled (THIS: it stays, with its comments: nothing lost), or it and the following ones deleted (FOLLOWING).',
      }),
    },
    resolve: async (_root, { taskIds, routineIds, withSubtree, eventId, scope, occurrenceDate, calendarId, routineOccurrence }) => {
      const routinesGone = await deletedTreeIds('routine', routineIds ?? [], withSubtree ?? false);
      // Comments written before they were on occurrences: placed first, to be counted on theirs.
      if (routineOccurrence) await placeLegacyRoutineComments([routineOccurrence.id]);
      if (eventId) await placeLegacyEventComments([eventId]);
      const events: GoneOccurrences[] = [...(eventId ? [await goneOccurrences(eventId, scope ?? 'ALL', occurrenceDate)] : []), ...(calendarId ? await calendarEventsGone(calendarId) : [])];
      const times = await timeEntries.timeLeftEmpty({ taskIds: await deletedTreeIds('task', taskIds ?? [], withSubtree ?? false), routineIds: routinesGone, events });
      const comments = await commentsLostOnDelete({
        routineIds: routinesGone,
        // A cancelled occurrence stays shown with its comments: only the following ones deleted lose theirs.
        routines: routineOccurrence?.scope === 'FOLLOWING' ? [{ id: routineOccurrence.id, from: routineOccurrence.date }] : [],
        events: events.map((gone) => ({ id: gone.eventId, on: gone.on, from: gone.from })),
      });
      return { times: times.length, comments };
    },
  }),
  runningTimeEntries: t.prismaField({
    type: ['TimeEntry'],
    description: 'Running timers of the workspace (several at once), the first started first.',
    resolve: (query) => prisma.timeEntry.findMany({ ...query, where: { endedAt: null }, orderBy: [{ startedAt: 'asc' }, { id: 'asc' }] }),
  }),
  alarms: t.prismaField({
    type: ['Alarm'],
    resolve: (query) => prisma.alarm.findMany({ ...query, orderBy: [{ startDate: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  startTimer: t.prismaField({
    type: 'TimeEntry',
    description: 'Starts a timer; the ones running keep running.',
    args: { input: t.arg({ type: TimerInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.timeEntry, query, timeEntries.startTimer({ ...input, events: eventLinks(input.events) })),
  }),
  setTimerPaused: t.prismaField({
    type: 'TimeEntry',
    description: 'Pauses or resumes a running timer.',
    args: { id: t.arg.id({ required: true }), paused: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, paused }) => reloaded(prisma.timeEntry, query, timeEntries.setTimerPaused(id, paused)),
  }),
  stopTimer: t.prismaField({
    type: 'TimeEntry',
    nullable: true,
    description: 'Stops a running timer (its time saved); null when it no longer runs. The others keep running.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (query, _root, { id }) => {
      const entry = await timeEntries.stopTimer(id);
      return entry ? reloaded(prisma.timeEntry, query, entry) : null;
    },
  }),
  stopAllTimers: t.prismaField({
    type: ['TimeEntry'],
    description: '« Arrêter tout »: stops every running timer (their time saved).',
    resolve: async (query) => {
      const stopped = await timeEntries.stopAllTimers();
      return prisma.timeEntry.findMany({ ...query, where: { id: { in: stopped.map((entry) => entry.id) } }, orderBy: { startedAt: 'asc' } });
    },
  }),
  createTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { input: t.arg({ type: TimeEntryInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.timeEntry, query, timeEntries.createTimeEntry({ ...input, events: eventLinks(input.events) })),
  }),
  updateTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TimeEntryUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.timeEntry, query, timeEntries.updateTimeEntry(id, { ...input, events: eventLinks(input.events) })),
  }),
  deleteTimeEntry: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(timeEntries.deleteTimeEntry(id)),
  }),

  createAlarm: t.prismaField({
    type: 'Alarm',
    args: { input: t.arg({ type: AlarmInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.alarm, query, alarms.createAlarm(alarmInput(input))),
  }),
  updateAlarm: t.prismaField({
    type: 'Alarm',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: AlarmInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.alarm, query, alarms.updateAlarm(id, alarmInput(input))),
  }),
  markAlarmFired: t.boolean({
    description: 'Records that an alarm rang for the occurrence at `at`.',
    args: { id: t.arg.id({ required: true }), at: t.arg({ type: 'DateTime', required: true }) },
    resolve: (_root, { id, at }) => done(alarms.markAlarmFired(id, at)),
  }),
  deleteAlarm: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(alarms.deleteAlarm(id)),
  }),
}));
