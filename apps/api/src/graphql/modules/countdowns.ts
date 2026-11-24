import { SAVED_COUNTDOWN_TARGETS } from '@ordo/shared';
import { prisma } from '../../db';
import { BY_POSITION } from '../../services/core/ordering';
import * as countdowns from '../../services/tasks/countdowns';
import * as saved from '../../services/tasks/saved-countdowns';
import { builder } from '../builder';
import { signedInSession } from '../context';
import { done } from '../errors';
import { reloaded } from '../reload';
import { labelMutations, labelObject } from '../label-inputs';
import { relationIds } from '../relation-fields';

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
    taskId: t.exposeString('taskId', { nullable: true, description: 'Task it was launched for (a dead time, a saved timer).' }),
    routineId: t.exposeString('routineId', { nullable: true, description: 'Routine it was launched for.' }),
    eventId: t.exposeString('eventId', { nullable: true, description: 'Event it was launched for.' }),
    sheetId: t.exposeString('sheetId', { nullable: true, description: 'Sheet it was launched for.' }),
    occurrenceDate: t.expose('occurrenceDate', { type: 'Date', nullable: true, description: 'Occurrence of that routine or recurring event.' }),
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
    taskId: t.id({ description: 'Task it is launched for (a dead time, a saved timer).' }),
    routineId: t.id({ description: 'Routine it is launched for.' }),
    eventId: t.id({ description: 'Event it is launched for.' }),
    sheetId: t.id({ description: 'Sheet it is launched for.' }),
    occurrenceDate: t.field({ type: 'Date', description: 'Occurrence of that routine or recurring event.' }),
    subject: t.string({ description: 'Name of its item.' }),
    path: t.string({ description: 'Page of the app its ring links to.' }),
    linkLabel: t.string(),
  }),
});

builder.queryFields((t) => ({
  countdowns: t.prismaField({
    type: ['Countdown'],
    description: 'Timers of the user not rung yet (every workspace), the soonest end first, paused ones last.',
    resolve: async (query, _root, _args, ctx) => {
      const { userId } = signedInSession(ctx);
      // Those ended long ago without ringing, or paused once ended, settled first.
      await countdowns.settleStaleCountdowns(userId);
      return prisma.countdown.findMany({ ...query, ...countdowns.activeCountdowns(userId) });
    },
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
    description:
      'Records that the end of a timer rang (its ring goes on as an AlarmRing): it no longer shows. False when not recorded: not running, not ended yet for the server (a few seconds of clock gap allowed), already rung or cancelled.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => countdowns.ringCountdown(signedInSession(ctx).userId, id),
  }),
  cancelCountdown: t.boolean({
    description: 'Cancels a timer: it never rings.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => done(countdowns.cancelCountdown(signedInSession(ctx).userId, id)),
  }),
}));

labelObject('SavedCountdown', { description: 'Saved timer (« minuteur enregistré ») of the workspace, a settings list: started again in one click.' });

builder.prismaObjectFields('SavedCountdown', (t) => ({
  minutes: t.exposeInt('minutes', { description: 'Duration, 1 to 1 440 minutes.' }),
  ringtone: t.exposeString('ringtone', { nullable: true, description: 'Ringtone at its end; null: the one of the settings.' }),
}));

// The tasks, routines and sheets list the saved timers launched from them (the occurrences of the events too).
for (const type of ['Task', 'Routine', 'Sheet'] as const) {
  builder.prismaObjectField(type as 'Sheet', 'savedCountdownIds', (t) => t.idList(relationIds('savedCountdowns', 'Saved timers launched from it.')));
}

const SavedCountdownInput = builder.inputType('SavedCountdownInput', {
  fields: (t) => ({
    label: t.string({ required: true, description: 'Its name, unique in the workspace.' }),
    color: t.string({ required: true }),
    minutes: t.int({ required: true, description: 'Duration, 1 to 1 440 minutes.' }),
    ringtone: t.string({ description: 'Ringtone of the bank; none: the one of the settings.' }),
  }),
});

const SavedCountdownPatch = builder.inputType('SavedCountdownPatch', {
  description: 'Changes of a saved timer (omitted fields unchanged; a null ringtone: the one of the settings).',
  fields: (t) => ({ label: t.string(), color: t.string(), minutes: t.int(), ringtone: t.string() }),
});

const SavedCountdownTargetEnum = builder.enumType('SavedCountdownTarget', {
  description: 'Item saved timers are linked to.',
  values: SAVED_COUNTDOWN_TARGETS,
});

builder.queryFields((t) => ({
  savedCountdowns: t.prismaField({
    type: ['SavedCountdown'],
    description: 'Saved timers of the workspace, in their manual order (archived ones included).',
    resolve: (query) => prisma.savedCountdown.findMany({ ...query, orderBy: BY_POSITION }),
  }),
}));

labelMutations('SavedCountdown', saved.savedCountdowns, { create: SavedCountdownInput, update: SavedCountdownPatch });

builder.mutationFields((t) => ({
  setSavedCountdownLinks: t.boolean({
    description:
      'Sets the saved timers of a task, a routine, an event (its whole series) or a sheet, in place of the current ones (20 at most); refused on an archived item; an archived saved timer is not newly chosen.',
    args: { target: t.arg({ type: SavedCountdownTargetEnum, required: true }), id: t.arg.id({ required: true }), savedCountdownIds: t.arg.idList({ required: true }) },
    resolve: (_root, { target, id, savedCountdownIds }) => done(saved.setSavedCountdownLinks(target, id, savedCountdownIds)),
  }),
}));
