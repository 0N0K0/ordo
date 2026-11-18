import { done } from '../errors';
import { ALARM_FREQUENCIES, ALARM_TYPES, type AlarmInput } from '@ordo/shared';
import { prisma } from '../../db';
import * as alarms from '../../services/tasks/alarms';
import * as timeEntries from '../../services/tasks/time-entries';
import { builder, type InputFields } from '../builder';
import { relationIds } from '../relation-fields';
import { subtreeIds } from '../../services/core/trees';
import { reloaded } from '../reload';

builder.prismaObject('TimeEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId', { nullable: true }),
    routineId: t.exposeID('routineId', { nullable: true, description: 'Routine the time is spent on.' }),
    routineLabel: t.string({ nullable: true, select: { routine: { select: { label: true } } }, resolve: (entry) => entry.routine?.label ?? null }),
    description: t.exposeString('description', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'DateTime' }),
    endedAt: t.expose('endedAt', { type: 'DateTime', nullable: true }),
    pausedAt: t.expose('pausedAt', { type: 'DateTime', nullable: true }),
    pausedSeconds: t.exposeInt('pausedSeconds'),
    duration: t.exposeInt('duration', { nullable: true, description: 'Seconds, pauses excluded; null while running.' }),
    taskIds: t.idList(relationIds('tasks')),
    documentId: t.exposeID('documentId', { nullable: true, description: 'Invoice the time is billed on.' }),
    calendarEventId: t.exposeID('calendarEventId', { nullable: true, description: 'Calendar event the time was spent on.' }),
    calendarOccurrenceDate: t.expose('calendarOccurrenceDate', { type: 'Date', nullable: true, description: 'Its occurrence, for a recurring event.' }),
    calendarEventLabel: t.string({ nullable: true, select: { calendarEvent: { select: { label: true } } }, resolve: (entry) => entry.calendarEvent?.label ?? null }),
    documentNumber: t.string({
      nullable: true,
      description: 'Number of that invoice, null while it is a draft.',
      select: { document: { select: { number: true } } },
      resolve: (entry) => entry.document?.number ?? null,
    }),
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
 * Event link of an input: null clears it, undefined leaves it unchanged.
 * @param {{ eventId: string, occurrenceDate?: string | null } | null | undefined} event GraphQL input.
 * @returns {import('../../services/tasks/time-entries').TimeEventLink | null | undefined} Service input.
 */
const eventLink = (event: { eventId: string; occurrenceDate?: string | null } | null | undefined) =>
  event === undefined ? undefined : event === null ? null : { eventId: event.eventId, occurrenceDate: event.occurrenceDate ?? null };

/**
 * What a time is spent on, for a timer and an entry: a project, a routine (its project by default) or both, its tasks,
 * its description and event.
 * @param {InputFields} t Field builder.
 * @returns {object} Fields.
 */
const spentOnFields = (t: InputFields) => ({
  projectId: t.id(),
  routineId: t.id(),
  taskIds: t.idList({ required: true }),
  description: t.string(),
  event: t.field({ type: TimeEventInput }),
});

const TimerInput = builder.inputType('TimerInput', {
  description: 'A project, a routine (its project by default) or both.',
  fields: (t) => spentOnFields(t),
});

const TimeEntryInput = builder.inputType('TimeEntryInput', {
  description: 'A project, a routine (its project by default) or both.',
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
    routineId: t.id({ description: 'Null: no routine; omitted: unchanged.' }),
    taskIds: t.idList(),
    description: t.string(),
    startedAt: t.field({ type: 'DateTime' }),
    duration: t.int({ description: 'Seconds.' }),
    event: t.field({ type: TimeEventInput, description: 'Null: no event; omitted: unchanged.' }),
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
          ...(routineId ? { routineId: routineId } : {}),
          ...(since ? { startedAt: { gte: since } } : {}),
        },
        orderBy: { startedAt: 'desc' },
      });
    },
  }),
  runningTimeEntry: t.prismaField({
    type: 'TimeEntry',
    nullable: true,
    resolve: (query) => prisma.timeEntry.findFirst({ ...query, where: { endedAt: null } }),
  }),
  alarms: t.prismaField({
    type: ['Alarm'],
    resolve: (query) => prisma.alarm.findMany({ ...query, orderBy: [{ startDate: 'asc' }, { time: 'asc' }, { createdAt: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  startTimer: t.prismaField({
    type: 'TimeEntry',
    description: 'Starts a timer; the running one is stopped first.',
    args: { input: t.arg({ type: TimerInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.timeEntry, query, timeEntries.startTimer({ ...input, event: eventLink(input.event) })),
  }),
  setTimerPaused: t.prismaField({
    type: 'TimeEntry',
    args: { paused: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { paused }) => reloaded(prisma.timeEntry, query, timeEntries.setTimerPaused(paused)),
  }),
  stopTimer: t.prismaField({
    type: 'TimeEntry',
    nullable: true,
    resolve: async (query) => {
      const entry = await timeEntries.stopTimer();
      return entry ? reloaded(prisma.timeEntry, query, entry) : null;
    },
  }),
  createTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { input: t.arg({ type: TimeEntryInput, required: true }) },
    resolve: async (query, _root, { input }) => reloaded(prisma.timeEntry, query, timeEntries.createTimeEntry({ ...input, event: eventLink(input.event) })),
  }),
  updateTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TimeEntryUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloaded(prisma.timeEntry, query, timeEntries.updateTimeEntry(id, { ...input, event: eventLink(input.event) })),
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
