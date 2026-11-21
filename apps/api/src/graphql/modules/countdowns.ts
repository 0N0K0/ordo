import { prisma } from '../../db';
import * as countdowns from '../../services/tasks/countdowns';
import { builder } from '../builder';
import { signedInSession } from '../context';
import { done } from '../errors';
import { reloaded } from '../reload';

builder.prismaObject('Countdown', {
  description: 'A timer (« minuteur ») of the user, in every workspace: it counts down and rings at its end.',
  fields: (t) => ({
    id: t.exposeID('id'),
    label: t.exposeString('label', { nullable: true, description: 'Its name; null: « Minuteur ».' }),
    durationSeconds: t.exposeInt('durationSeconds', { description: 'Duration programmed, minutes added included.' }),
    endsAt: t.expose('endsAt', { type: 'DateTime', nullable: true, description: 'End while it runs; null: paused.' }),
    remainingSeconds: t.exposeInt('remainingSeconds', { nullable: true, description: 'Seconds left while paused; null: running.' }),
    ringtone: t.exposeString('ringtone', { nullable: true, description: 'Ringtone at its end; null: the one of the settings.' }),
    workspaceId: t.exposeString('workspaceId', { nullable: true, description: 'Workspace of its item.' }),
    taskId: t.exposeString('taskId', { nullable: true, description: 'Task of the dead time it was launched for.' }),
    routineId: t.exposeString('routineId', { nullable: true, description: 'Routine of the dead time it was launched for.' }),
    occurrenceDate: t.expose('occurrenceDate', { type: 'Date', nullable: true, description: 'Occurrence of that routine.' }),
    subject: t.exposeString('subject', { nullable: true, description: 'Name of its item.' }),
    path: t.exposeString('path', { nullable: true, description: 'Page of the app its ring links to.' }),
    linkLabel: t.exposeString('linkLabel', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

const CountdownInput = builder.inputType('CountdownInput', {
  fields: (t) => ({
    label: t.string({ description: 'Its name; none: « Minuteur ».' }),
    seconds: t.int({ required: true, description: 'Duration, 1 minute to 24 hours.' }),
    ringtone: t.string({ description: 'Ringtone of the bank; none: the one of the settings.' }),
    workspaceId: t.id({ description: 'Workspace of its item.' }),
    taskId: t.id({ description: 'Task of the dead time.' }),
    routineId: t.id({ description: 'Routine of the dead time.' }),
    occurrenceDate: t.field({ type: 'Date', description: 'Occurrence of that routine.' }),
    subject: t.string({ description: 'Name of its item.' }),
    path: t.string({ description: 'Page of the app its ring links to.' }),
    linkLabel: t.string(),
  }),
});

builder.queryFields((t) => ({
  countdowns: t.prismaField({
    type: ['Countdown'],
    description: 'Timers of the user not rung yet (every workspace), the soonest end first, paused ones last.',
    resolve: (query, _root, _args, ctx) => prisma.countdown.findMany({ ...query, ...countdowns.activeCountdowns(signedInSession(ctx).userId) }),
  }),
}));

builder.mutationFields((t) => ({
  startCountdown: t.prismaField({
    type: 'Countdown',
    description: 'Starts a timer; the others keep running.',
    args: { input: t.arg({ type: CountdownInput, required: true }) },
    resolve: async (query, _root, { input }, ctx) => reloaded(prisma.countdown, query, countdowns.startCountdown(signedInSession(ctx).userId, input)),
  }),
  setCountdownPaused: t.prismaField({
    type: 'Countdown',
    description: 'Pauses (the seconds left kept) or resumes a timer.',
    args: { id: t.arg.id({ required: true }), paused: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, paused }, ctx) => reloaded(prisma.countdown, query, countdowns.setCountdownPaused(signedInSession(ctx).userId, id, paused)),
  }),
  extendCountdown: t.prismaField({
    type: 'Countdown',
    description: 'Gives a timer more minutes (1 to 60), 24 hours left at most.',
    args: { id: t.arg.id({ required: true }), minutes: t.arg.int({ required: true }) },
    resolve: async (query, _root, { id, minutes }, ctx) => reloaded(prisma.countdown, query, countdowns.extendCountdown(signedInSession(ctx).userId, id, minutes)),
  }),
  ringCountdown: t.boolean({
    description: 'Records that the end of a timer rang (its ring goes on as an AlarmRing): it no longer shows.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => done(countdowns.ringCountdown(signedInSession(ctx).userId, id)),
  }),
  cancelCountdown: t.boolean({
    description: 'Cancels a timer: it never rings.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => done(countdowns.cancelCountdown(signedInSession(ctx).userId, id)),
  }),
}));
