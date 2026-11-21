import { createHash } from 'node:crypto';
import { APP_PATHS, isPushServiceEndpoint, pushSubscriptionInputSchema, type PushPayload, type PushSubscriptionInput } from '@ordo/shared';
import webpush, { WebPushError } from 'web-push';
import { prisma } from '../../db';
import { env } from '../../env';
import type { PushSubscription } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';

/**
 * Push notifications (Web Push): the devices of a user subscribe (`PushSubscription`, one row per
 * endpoint), the server pushes them the rings of the alarms and reminders while « Sonner hors de l'app » is on. Signed
 * with the VAPID keys of the environment; without them, push is off (`pushPublicKey` null, the app says so).
 */

/** A message the push service may keep for a device out of reach, in seconds: a ring older than 10 minutes is no use. */
const PUSH_TTL_SECONDS = 600;

/** Message refused when the server has no VAPID keys. */
export const PUSH_DISABLED = 'Les notifications push ne sont pas configurées sur le serveur (clés VAPID manquantes).';

const vapid = env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY ? { subject: env.VAPID_SUBJECT ?? env.APP_URL, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY } : null;

/**
 * Public VAPID key the browsers subscribe with, null when push is off (no keys).
 * @returns {string | null} Key (base64url).
 */
export function pushPublicKey(): string | null {
  return vapid?.publicKey ?? null;
}

/**
 * Whether push is on (VAPID keys set).
 * @returns {boolean} On.
 */
export const pushEnabled = (): boolean => vapid !== null;

/**
 * Query of the devices of a user, the latest first.
 * @param {string} userId User.
 * @returns {object} `where` and `orderBy` of the query.
 */
export function devicesOf(userId: string) {
  return { where: { userId }, orderBy: { createdAt: 'desc' as const } };
}

/**
 * Subscribes a device of the user (its endpoint taken from another user who used it before: one device, one user).
 * @param {string} userId User.
 * @param {PushSubscriptionInput} input Endpoint, keys and label of the device.
 * @returns {Promise<PushSubscription>} Device.
 */
export async function registerPushSubscription(userId: string, input: PushSubscriptionInput): Promise<PushSubscription> {
  if (!vapid) throw clientError('BAD_USER_INPUT', PUSH_DISABLED);
  const { endpoint, ...fields } = parseInput(pushSubscriptionInputSchema, input);
  return prisma.pushSubscription.upsert({ where: { endpoint }, create: { userId, endpoint, ...fields }, update: { userId, ...fields } });
}

/**
 * A device of the user (« Appareil » introuvable otherwise).
 * @param {string} userId User.
 * @param {string} id Device.
 * @returns {Promise<PushSubscription>} Device.
 */
function deviceOf(userId: string, id: string): Promise<PushSubscription> {
  return orNotFound(prisma.pushSubscription.findFirst({ where: { id, userId } }), 'Appareil');
}

/**
 * Removes a device of the user: it receives nothing more (its browser keeps its subscription until it subscribes again).
 * @param {string} userId User.
 * @param {string} id Device.
 * @returns {Promise<void>} Done.
 */
export async function removePushSubscription(userId: string, id: string): Promise<void> {
  await deviceOf(userId, id);
  await prisma.pushSubscription.delete({ where: { id } });
}

/**
 * Topic of a ring for the push service: a message waiting for a device out of reach is replaced by the next one of the
 * same ring (32 characters of base64url at most).
 * @param {string} key Key of the ring.
 * @returns {string} Topic.
 */
const topicOf = (key: string): string => createHash('sha256').update(key).digest('base64url').slice(0, 32);

/**
 * Pushes a message to a device: its last success kept; deleted when the push service says it expired (404, 410).
 * @param {PushSubscription} device Device.
 * @param {PushPayload} payload Message.
 * @returns {Promise<boolean>} Accepted by the push service.
 */
async function pushTo(device: PushSubscription, payload: PushPayload): Promise<boolean> {
  // Checked again before each send: only a known push service is ever requested (a row stored before the check, or
  // written another way, is not trusted).
  if (!vapid || !isPushServiceEndpoint(device.endpoint)) return false;
  try {
    await webpush.sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, JSON.stringify(payload), {
      vapidDetails: vapid,
      TTL: PUSH_TTL_SECONDS,
      urgency: 'high',
      ...(payload.key ? { topic: topicOf(payload.key) } : {}),
    });
    await prisma.pushSubscription.updateMany({ where: { id: device.id }, data: { lastSuccessAt: new Date() } });
    return true;
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await prisma.pushSubscription.deleteMany({ where: { id: device.id } });
    } else {
      console.warn(`Notification push en échec (${device.label}).`, error instanceof WebPushError ? `${error.statusCode} ${error.body}` : error);
    }
    return false;
  }
}

/**
 * Pushes a message to every device of a user.
 * @param {string} userId User.
 * @param {PushPayload} payload Message.
 * @returns {Promise<number>} Devices reached.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  const results = await Promise.all((await prisma.pushSubscription.findMany(devicesOf(userId))).map((device) => pushTo(device, payload)));
  return results.filter(Boolean).length;
}

/**
 * « Tester »: pushes a test notification to a device of the user.
 * @param {string} userId User.
 * @param {string} id Device.
 * @returns {Promise<boolean>} Accepted by the push service (false: it failed, or it expired and was removed).
 */
export async function testPushSubscription(userId: string, id: string): Promise<boolean> {
  if (!vapid) throw clientError('BAD_USER_INPUT', PUSH_DISABLED);
  const device = await deviceOf(userId, id);
  return pushTo(device, { key: null, title: 'Ordo', body: 'Les notifications de cet appareil fonctionnent.', path: APP_PATHS.account, workspaceId: null, actions: [] });
}
