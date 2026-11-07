import { ALARM_FREQUENCIES, ALARM_TYPES } from '@ordo/shared';
import { prisma } from '../../db';
import * as alarms from '../../services/alarms';
import * as timeEntries from '../../services/time-entries';
import { builder } from '../builder';

builder.prismaObject('TimeEntry', {
  fields: (t) => ({
    id: t.exposeID('id'),
    projectId: t.exposeID('projectId'),
    description: t.exposeString('description', { nullable: true }),
    startedAt: t.expose('startedAt', { type: 'DateTime' }),
    endedAt: t.expose('endedAt', { type: 'DateTime', nullable: true }),
    pausedAt: t.expose('pausedAt', { type: 'DateTime', nullable: true }),
    pausedSeconds: t.exposeInt('pausedSeconds'),
    duration: t.exposeInt('duration', { nullable: true, description: 'Seconds, pauses excluded; null while running.' }),
    taskIds: t.idList({
      select: { tasks: { select: { id: true } } },
      resolve: (entry) => entry.tasks.map((task) => task.id),
    }),
    documentId: t.exposeID('documentId', { nullable: true, description: 'Invoice the time is billed on.' }),
    calendarEventId: t.exposeID('calendarEventId', { nullable: true, description: 'Calendar event the time was spent on.' }),
    calendarOccurrenceDate: t.expose('calendarOccurrenceDate', { type: 'Date', nullable: true, description: 'Its occurrence, for a recurring event.' }),
    calendarEventTitle: t.string({ nullable: true, select: { calendarEvent: { select: { title: true } } }, resolve: (entry) => entry.calendarEvent?.title ?? null }),
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
    title: t.exposeString('title'),
    note: t.exposeString('note', { nullable: true }),
    type: t.field({ type: AlarmTypeEnum, resolve: (alarm) => alarm.type }),
    startDate: t.expose('startDate', { type: 'Date', nullable: true }),
    time: t.exposeString('time', { nullable: true }),
    frequency: t.field({ type: AlarmFrequencyEnum, resolve: (alarm) => alarm.frequency }),
    interval: t.exposeInt('interval'),
    weekdays: t.exposeIntList('weekdays'),
    endDate: t.expose('endDate', { type: 'Date', nullable: true }),
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
 * @returns {import('../../services/time-entries').TimeEventLink | null | undefined} Service input.
 */
const eventLink = (event: { eventId: string | number; occurrenceDate?: string | null } | null | undefined) =>
  event === undefined ? undefined : event === null ? null : { eventId: String(event.eventId), occurrenceDate: event.occurrenceDate ?? null };

const TimerInput = builder.inputType('TimerInput', {
  fields: (t) => ({
    projectId: t.id({ required: true }),
    taskIds: t.idList({ required: true }),
    description: t.string(),
    event: t.field({ type: TimeEventInput }),
  }),
});

const TimeEntryInput = builder.inputType('TimeEntryInput', {
  fields: (t) => ({
    projectId: t.id({ required: true }),
    taskIds: t.idList({ required: true }),
    description: t.string(),
    startedAt: t.field({ type: 'DateTime', required: true }),
    duration: t.int({ required: true, description: 'Seconds.' }),
    event: t.field({ type: TimeEventInput }),
  }),
});

const TimeEntryUpdateInput = builder.inputType('TimeEntryUpdateInput', {
  description: 'Omitted fields are left unchanged. The duration of the running timer cannot be changed.',
  fields: (t) => ({
    projectId: t.id(),
    taskIds: t.idList(),
    description: t.string(),
    startedAt: t.field({ type: 'DateTime' }),
    duration: t.int({ description: 'Seconds.' }),
    event: t.field({ type: TimeEventInput, description: 'Null: no event; omitted: unchanged.' }),
  }),
});

const AlarmInput = builder.inputType('AlarmInput', {
  fields: (t) => ({
    title: t.string({ required: true }),
    note: t.string(),
    type: t.field({ type: AlarmTypeEnum, required: true }),
    startDate: t.field({ type: 'Date' }),
    time: t.string({ description: 'HH:MM, local time.' }),
    frequency: t.field({ type: AlarmFrequencyEnum, required: true }),
    interval: t.int({ required: true }),
    weekdays: t.intList({ required: true, description: '1 (Monday) to 7 (Sunday).' }),
    endDate: t.field({ type: 'Date' }),
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
  minutes: input.minutes ?? null,
  projectId: input.projectId ?? null,
  taskId: input.taskId ?? null,
});

builder.queryFields((t) => ({
  timeEntries: t.prismaField({
    type: ['TimeEntry'],
    description: 'Time entries, latest first: those of a project and its sub-projects, or every entry; optionally only those started since a moment.',
    args: { projectId: t.arg.id(), since: t.arg({ type: 'DateTime' }) },
    resolve: async (query, _root, { projectId, since }) => {
      let projectIds: string[] | undefined;
      if (projectId) {
        const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
        projectIds = [projectId];
        for (let index = 0; index < projectIds.length; index += 1) {
          projectIds.push(...projects.filter((project) => project.parentId === projectIds![index]).map((project) => project.id));
        }
      }
      return prisma.timeEntry.findMany({
        ...query,
        where: { ...(projectIds ? { projectId: { in: projectIds } } : {}), ...(since ? { startedAt: { gte: since } } : {}) },
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

/**
 * Reloads a time entry with the requested selection.
 * @param {object} query Pothos query.
 * @param {string} id Entry id.
 * @returns {Promise<object>} Entry.
 */
const reloadEntry = (query: object, id: string) => prisma.timeEntry.findUniqueOrThrow({ ...query, where: { id } });

builder.mutationFields((t) => ({
  startTimer: t.prismaField({
    type: 'TimeEntry',
    description: 'Starts a timer; the running one is stopped first.',
    args: { input: t.arg({ type: TimerInput, required: true }) },
    resolve: async (query, _root, { input }) => reloadEntry(query, (await timeEntries.startTimer({ ...input, event: eventLink(input.event) })).id),
  }),
  setTimerPaused: t.prismaField({
    type: 'TimeEntry',
    args: { paused: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { paused }) => reloadEntry(query, (await timeEntries.setTimerPaused(paused)).id),
  }),
  stopTimer: t.prismaField({
    type: 'TimeEntry',
    nullable: true,
    resolve: async (query) => {
      const entry = await timeEntries.stopTimer();
      return entry ? reloadEntry(query, entry.id) : null;
    },
  }),
  createTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { input: t.arg({ type: TimeEntryInput, required: true }) },
    resolve: async (query, _root, { input }) => reloadEntry(query, (await timeEntries.createTimeEntry({ ...input, event: eventLink(input.event) })).id),
  }),
  updateTimeEntry: t.prismaField({
    type: 'TimeEntry',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: TimeEntryUpdateInput, required: true }) },
    resolve: async (query, _root, { id, input }) => reloadEntry(query, (await timeEntries.updateTimeEntry(id, { ...input, event: eventLink(input.event) })).id),
  }),
  deleteTimeEntry: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await timeEntries.deleteTimeEntry(id);
      return true;
    },
  }),

  createAlarm: t.prismaField({
    type: 'Alarm',
    args: { input: t.arg({ type: AlarmInput, required: true }) },
    resolve: async (query, _root, { input }) =>
      prisma.alarm.findUniqueOrThrow({ ...query, where: { id: (await alarms.createAlarm(alarmInput(input))).id } }),
  }),
  updateAlarm: t.prismaField({
    type: 'Alarm',
    args: { id: t.arg.id({ required: true }), input: t.arg({ type: AlarmInput, required: true }) },
    resolve: async (query, _root, { id, input }) =>
      prisma.alarm.findUniqueOrThrow({ ...query, where: { id: (await alarms.updateAlarm(id, alarmInput(input))).id } }),
  }),
  markAlarmFired: t.boolean({
    description: 'Records that an alarm rang for the occurrence at `at`.',
    args: { id: t.arg.id({ required: true }), at: t.arg({ type: 'DateTime', required: true }) },
    resolve: async (_root, { id, at }) => {
      await alarms.markAlarmFired(id, at);
      return true;
    },
  }),
  deleteAlarm: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await alarms.deleteAlarm(id);
      return true;
    },
  }),
}));
