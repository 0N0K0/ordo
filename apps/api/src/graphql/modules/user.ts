import { RINGTONE_IDS, readRingSettings, type RingSettings } from '@ordo/shared';
import { prisma } from '../../db';
import * as rings from '../../services/tasks/alarm-rings';
import * as push from '../../services/tasks/push';
import * as workspaces from '../../services/workspaces/workspaces';
import { builder } from '../builder';
import { signedInSession } from '../context';
import { done } from '../errors';
import { reloaded } from '../reload';

/** How alarms and reminders ring for the user, in every workspace (decision FS). */
const RingSettingsRef = builder.objectRef<RingSettings>('RingSettings').implement({
  description: 'How the alarms and reminders of the user ring, in every workspace.',
  fields: (t) => ({
    ringMinutes: t.exposeInt('ringMinutes', { description: 'How long a ring lasts, 1 to 30 minutes, unless stopped or snoozed.' }),
    loop: t.exposeBoolean('loop', { description: 'The ringtone repeats during the ring (else it plays once).' }),
    repeatMinutes: t.exposeInt('repeatMinutes', { description: 'Rung again this many minutes after a ring ends, until stopped (0: not again), 60 at most.' }),
    ringtone: t.exposeString('ringtone', { description: `Ringtone of the reminders and alarms that name none: ${RINGTONE_IDS.join(', ')}.` }),
    outside: t.exposeBoolean('outside', { description: 'Ring outside the app too (push notifications).' }),
  }),
});

const RingSettingsInput = builder.inputType('RingSettingsInput', {
  fields: (t) => ({
    ringMinutes: t.int({ required: true }),
    loop: t.boolean({ required: true }),
    repeatMinutes: t.int({ required: true }),
    ringtone: t.string({ required: true }),
    outside: t.boolean({ required: true }),
  }),
});

// passwordHash is never exposed.
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),
    pendingEmail: t.exposeString('pendingEmail', { nullable: true }),
    contributorId: t.id({
      nullable: true,
      description: 'Contributor profile ("Moi") in the current workspace.',
      resolve: (user) => workspaces.meContributorId(user.id),
    }),
    ringSettings: t.field({ type: RingSettingsRef, description: 'How alarms and reminders ring, in every workspace.', resolve: (user) => readRingSettings(user.ringSettings) }),
  }),
});

builder.prismaObject('AlarmRing', {
  description: 'A ring of an alarm or a reminder of the user: its toast, when it rings again, whether it was stopped (every tab and device).',
  fields: (t) => ({
    id: t.exposeID('id'),
    key: t.exposeString('key', { description: 'Key of the occurrence rung, without the `ordo.alarm.` prefix.' }),
    workspaceId: t.exposeString('workspaceId', { nullable: true, description: 'Workspace of the alarm or reminder.' }),
    title: t.exposeString('title'),
    lines: t.stringList({ resolve: (ring) => (Array.isArray(ring.lines) ? ring.lines.filter((line): line is string => typeof line === 'string') : []) }),
    path: t.exposeString('path', { nullable: true, description: 'Page of the app its toast links to.' }),
    linkLabel: t.exposeString('linkLabel', { nullable: true }),
    ringtone: t.exposeString('ringtone', { nullable: true, description: 'Ringtone of the reminder; null: the one of the settings.' }),
    dueAt: t.expose('dueAt', { type: 'DateTime' }),
    ringingSince: t.expose('ringingSince', { type: 'DateTime', nullable: true, description: 'Start of the ring under way; null: silent.' }),
    nextAt: t.expose('nextAt', { type: 'DateTime', nullable: true, description: 'When it rings again; null: not again.' }),
    stoppedAt: t.expose('stoppedAt', { type: 'DateTime', nullable: true, description: 'Stopped for good.' }),
  }),
});

builder.prismaObject('PushSubscription', {
  description: 'A device of the user receiving the push notifications (lot 17c).',
  fields: (t) => ({
    id: t.exposeID('id'),
    endpoint: t.exposeString('endpoint', { description: 'Address of the push service for the device: the app finds the device it runs on by it.' }),
    label: t.exposeString('label', { description: 'Device (« Chrome · Android »).' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    lastSuccessAt: t.expose('lastSuccessAt', { type: 'DateTime', nullable: true, description: 'Last message the push service accepted.' }),
  }),
});

const PushSubscriptionInput = builder.inputType('PushSubscriptionInput', {
  fields: (t) => ({
    endpoint: t.string({ required: true }),
    p256dh: t.string({ required: true }),
    auth: t.string({ required: true }),
    label: t.string({ required: true }),
  }),
});

const AlarmRingInput = builder.inputType('AlarmRingInput', {
  fields: (t) => ({
    key: t.string({ required: true }),
    workspaceId: t.id(),
    title: t.string({ required: true }),
    lines: t.stringList(),
    path: t.string(),
    linkLabel: t.string(),
    ringtone: t.string(),
    dueAt: t.field({ type: 'DateTime', required: true }),
  }),
});

builder.queryFields((t) => ({
  alarmRings: t.prismaField({
    type: ['AlarmRing'],
    description: 'Rings of the user changed in the last 6 hours, stopped ones included, latest first.',
    resolve: (query, _root, _args, ctx) => prisma.alarmRing.findMany({ ...query, ...rings.recentRings(signedInSession(ctx).userId) }),
  }),
  pushPublicKey: t.string({
    nullable: true,
    description: 'Public VAPID key the devices subscribe to the push notifications with; null: push is off on this server.',
    resolve: (_root, _args, ctx) => {
      signedInSession(ctx);
      return push.pushPublicKey();
    },
  }),
  pushSubscriptions: t.prismaField({
    type: ['PushSubscription'],
    description: 'Devices of the user receiving the push notifications, the latest first.',
    resolve: (query, _root, _args, ctx) => prisma.pushSubscription.findMany({ ...query, ...push.devicesOf(signedInSession(ctx).userId) }),
  }),
}));

builder.mutationFields((t) => ({
  updateRingSettings: t.prismaField({
    type: 'User',
    description: 'Saves how alarms and reminders ring, in every workspace.',
    args: { input: t.arg({ type: RingSettingsInput, required: true }) },
    resolve: async (query, _root, { input }, ctx) => reloaded(prisma.user, query, rings.updateRingSettings(signedInSession(ctx).userId, input as RingSettings)),
  }),
  ringAlarm: t.prismaField({
    type: 'AlarmRing',
    description: 'Records that an alarm or a reminder starts ringing (first ring or repetition); a stopped one is returned as it is.',
    args: { input: t.arg({ type: AlarmRingInput, required: true }) },
    resolve: async (query, _root, { input }, ctx) => reloaded(prisma.alarmRing, query, rings.ringAlarm(signedInSession(ctx).userId, input)),
  }),
  snoozeAlarmRing: t.prismaField({
    type: 'AlarmRing',
    nullable: true,
    description: '« Répéter dans N min »: silent, rings again after the minutes of the settings; null: unknown or stopped.',
    args: { key: t.arg.string({ required: true }) },
    resolve: (_query, _root, { key }, ctx) => rings.snoozeAlarmRing(signedInSession(ctx).userId, key),
  }),
  registerPushSubscription: t.prismaField({
    type: 'PushSubscription',
    description: 'Subscribes a device of the user to the push notifications (a device used by another user before changes hands).',
    args: { input: t.arg({ type: PushSubscriptionInput, required: true }) },
    resolve: async (query, _root, { input }, ctx) => reloaded(prisma.pushSubscription, query, push.registerPushSubscription(signedInSession(ctx).userId, input)),
  }),
  removePushSubscription: t.boolean({
    description: 'Removes a device of the user: it receives no more push notifications.',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => done(push.removePushSubscription(signedInSession(ctx).userId, id)),
  }),
  testPushSubscription: t.boolean({
    description: '« Tester »: pushes a test notification to a device of the user; false when the push service refused it (an expired device is removed).',
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }, ctx) => push.testPushSubscription(signedInSession(ctx).userId, id),
  }),
  stopAlarmRing: t.boolean({
    description: '« Arrêter »: the ring is stopped for good, in every tab and device.',
    args: { key: t.arg.string({ required: true }) },
    resolve: (_root, { key }, ctx) => done(rings.stopAlarmRing(signedInSession(ctx).userId, key)),
  }),
}));
