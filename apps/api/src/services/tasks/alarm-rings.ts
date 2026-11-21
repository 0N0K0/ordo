import { alarmRingInputSchema, readRingSettings, repeatedRingAt, RING_KEPT_MS, ringSettingsSchema, snoozeMinutes, type AlarmRingInput, type RingSettings } from '@ordo/shared';
import { prisma } from '../../db';
import type { AlarmRing, User } from '../../generated/prisma/client';
import { isUniqueConflict, parseInput } from '../../graphql/errors';
import { toJson } from '../core/json';

/**
 * Rings of the alarms and reminders of a user: the settings of the user (every workspace) and the state
 * of each ring, kept here so every tab and device follows a stop or a snooze, and so the push notifications
 * know when to ring again. A ring is one row per key (`userId`, `key`); it is kept 6 hours after its last change.
 */

/**
 * Settings of the rings of a user (the defaults for what was never chosen).
 * @param {string} userId User.
 * @returns {Promise<RingSettings>} Settings.
 */
export async function ringSettingsOf(userId: string): Promise<RingSettings> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { ringSettings: true } });
  return readRingSettings(user.ringSettings);
}

/**
 * Saves the settings of the rings of a user.
 * @param {string} userId User.
 * @param {RingSettings} input Settings.
 * @returns {Promise<User>} User.
 */
export async function updateRingSettings(userId: string, input: RingSettings): Promise<User> {
  const settings = parseInput(ringSettingsSchema, input);
  return prisma.user.update({ where: { id: userId }, data: { ringSettings: toJson(settings) } });
}

/**
 * Query of the rings of a user changed in the last 6 hours, stopped ones included (a tab does not ring again what
 * another one stopped), latest first.
 * @param {string} userId User.
 * @returns {object} `where` and `orderBy` of the query.
 */
export function recentRings(userId: string) {
  return { where: { userId, updatedAt: { gte: new Date(Date.now() - RING_KEPT_MS) } }, orderBy: { updatedAt: 'desc' as const } };
}

/**
 * Start of a ring now and its next one (after the ring and the repetition of the settings; none without repetition).
 * @param {string} userId User.
 * @param {Date} now Now.
 * @returns {Promise<{ ringingSince: Date, nextAt: Date | null }>} Timing.
 */
async function ringTiming(userId: string, now: Date): Promise<{ ringingSince: Date; nextAt: Date | null }> {
  return { ringingSince: now, nextAt: repeatedRingAt(await ringSettingsOf(userId), now) };
}

/**
 * Columns of a ring as sent (its toast).
 * @param {AlarmRingInput} input Ring.
 * @returns {object} Columns.
 */
function ringFields(input: AlarmRingInput) {
  const ring = parseInput(alarmRingInputSchema, input);
  return { ...ring, lines: toJson(ring.lines), workspaceId: ring.workspaceId ?? null, path: ring.path ?? null, linkLabel: ring.linkLabel ?? null, ringtone: ring.ringtone ?? null };
}

/**
 * Removes the rings of a user older than 6 hours.
 * @param {string} userId User.
 * @param {Date} now Now.
 * @returns {Promise<void>} Done.
 */
async function forgetOldRings(userId: string, now: Date): Promise<void> {
  await prisma.alarmRing.deleteMany({ where: { userId, updatedAt: { lt: new Date(now.getTime() - RING_KEPT_MS) } } });
}

/**
 * Records that an alarm or a reminder starts ringing (its first ring, or a repetition): its toast, the start of the ring
 * and the next one (after the ring and the repetition of the settings; none without repetition). A ring stopped already
 * is left as it is (the app then stops ringing it). Rings older than 6 hours are removed on the way.
 * @param {string} userId User.
 * @param {AlarmRingInput} input Ring.
 * @returns {Promise<AlarmRing>} Ring.
 */
export async function ringAlarm(userId: string, input: AlarmRingInput): Promise<AlarmRing> {
  const fields = ringFields(input);
  const now = new Date();
  const existing = await prisma.alarmRing.findUnique({ where: { userId_key: { userId, key: fields.key } } });
  if (existing?.stoppedAt) return existing;
  const timing = await ringTiming(userId, now);
  await forgetOldRings(userId, now);
  return prisma.alarmRing.upsert({
    where: { userId_key: { userId, key: fields.key } },
    create: { userId, ...fields, ...timing },
    update: timing,
  });
}

/**
 * First ring of an alarm or a reminder by the server, outside the app: recorded only when no tab nor device
 * rang it already (no row for its key), so it is pushed once.
 * @param {string} userId User.
 * @param {AlarmRingInput} input Ring.
 * @returns {Promise<AlarmRing | null>} Ring, null when it rang already.
 */
export async function ringOutside(userId: string, input: AlarmRingInput): Promise<AlarmRing | null> {
  const fields = ringFields(input);
  const now = new Date();
  await forgetOldRings(userId, now);
  try {
    return await prisma.alarmRing.create({ data: { userId, ...fields, ...(await ringTiming(userId, now)) } });
  } catch (error) {
    // Rung meanwhile by a tab (or another run): it is its ring.
    if (isUniqueConflict(error)) return null;
    throw error;
  }
}

/**
 * Repetition of a ring by the server, outside the app: it rings again now, unless a tab or a device stopped
 * it, snoozed it or rang it again meanwhile (its next ring changed).
 * @param {AlarmRing} ring Ring due to ring again.
 * @returns {Promise<boolean>} Rung again.
 */
export async function ringAgainOutside(ring: AlarmRing): Promise<boolean> {
  const { count } = await prisma.alarmRing.updateMany({ where: { id: ring.id, stoppedAt: null, nextAt: ring.nextAt }, data: await ringTiming(ring.userId, new Date()) });
  return count > 0;
}

/**
 * « Répéter dans N min »: silent now, rings again after the minutes of the settings (5 without repetition).
 * @param {string} userId User.
 * @param {string} key Key of the ring.
 * @returns {Promise<AlarmRing | null>} Ring, null when unknown (gone) or stopped.
 */
export async function snoozeAlarmRing(userId: string, key: string): Promise<AlarmRing | null> {
  const minutes = snoozeMinutes(await ringSettingsOf(userId));
  const { count } = await prisma.alarmRing.updateMany({ where: { userId, key, stoppedAt: null }, data: { ringingSince: null, nextAt: new Date(Date.now() + minutes * 60_000) } });
  return count ? prisma.alarmRing.findUnique({ where: { userId_key: { userId, key } } }) : null;
}

/**
 * « Arrêter »: stopped for good, rings no more (in no tab nor device).
 * @param {string} userId User.
 * @param {string} key Key of the ring.
 * @returns {Promise<void>} Done (nothing for an unknown ring).
 */
export async function stopAlarmRing(userId: string, key: string): Promise<void> {
  await prisma.alarmRing.updateMany({ where: { userId, key }, data: { ringingSince: null, nextAt: null, stoppedAt: new Date() } });
}
