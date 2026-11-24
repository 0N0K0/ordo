import { COUNTDOWN_MAX_SECONDS, countdownExtensionSchema, countdownInputSchema, countdownRemaining, parseOptionalDay, RING_KEPT_MS, RING_LATE_MS, type CountdownInput } from '@ordo/shared';
import { prisma } from '../../db';
import type { Countdown } from '../../generated/prisma/client';
import { orNotFound, parseInput } from '../../graphql/errors';

/** Clock gap allowed between the device that rings a timer and the server, in milliseconds. */
const RING_CLOCK_GAP_MS = 5000;

/**
 * Timers (« minuteurs ») of a user, shared by the workspaces as the rings (`AlarmRing`): several run at
 * once; a running one keeps its end (`endsAt`, the moment the server can push it), a paused one the seconds
 * left. At its end, the app rings it (`startRinging`, key `countdown:<id>`) and records it (`ringCountdown`): the ring
 * goes on as an `AlarmRing`, the timer no longer shows, and it is removed 6 hours later.
 */

/**
 * Query of the timers of a user not rung yet, the soonest end first (paused ones last).
 * @param {string} userId User.
 * @returns {object} `where` and `orderBy` of the query.
 */
export function activeCountdowns(userId: string) {
  return { where: { userId, rungAt: null }, orderBy: [{ endsAt: { sort: 'asc' as const, nulls: 'last' as const } }, { createdAt: 'asc' as const }] };
}

/**
 * Before the timers of a user are read: one ended more than 6 hours ago without ringing (app closed, no push) is
 * no longer rung, as an alarm missed that long ago (recorded as rung: it no longer shows, removed 6 hours later); one
 * paused once ended (no time left) ends now, so that it rings.
 * @param {string} userId User.
 * @returns {Promise<void>} Done.
 */
export async function settleStaleCountdowns(userId: string): Promise<void> {
  const now = Date.now();
  await prisma.$transaction([
    prisma.countdown.updateMany({ where: { userId, rungAt: null, endsAt: { lt: new Date(now - RING_LATE_MS) } }, data: { rungAt: new Date(now) } }),
    prisma.countdown.updateMany({ where: { userId, rungAt: null, endsAt: null, remainingSeconds: { lte: 0 } }, data: { endsAt: new Date(now), remainingSeconds: null } }),
  ]);
}

/**
 * A timer of the user, or NOT_FOUND (another user's too).
 * @param {string} userId User.
 * @param {string} id Timer.
 * @returns {Promise<Countdown>} Timer.
 */
function findCountdown(userId: string, id: string): Promise<Countdown> {
  return orNotFound(prisma.countdown.findFirst({ where: { id, userId } }), 'Minuteur');
}

/**
 * Starts a timer: it ends after its duration. The timers rung more than 6 hours ago are removed on the way.
 * @param {string} userId User.
 * @param {CountdownInput} input Timer (duration 1 minute to 24 hours, name, ringtone, item it is launched for).
 * @returns {Promise<Countdown>} Timer.
 */
export async function startCountdown(userId: string, input: CountdownInput): Promise<Countdown> {
  const data = parseInput(countdownInputSchema, input);
  const now = Date.now();
  await prisma.countdown.deleteMany({ where: { userId, rungAt: { lt: new Date(now - RING_KEPT_MS) } } });
  return prisma.countdown.create({
    data: {
      userId,
      label: data.label,
      durationSeconds: data.seconds,
      endsAt: new Date(now + data.seconds * 1000),
      ringtone: data.ringtone,
      workspaceId: data.workspaceId ?? null,
      taskId: data.taskId ?? null,
      routineId: data.routineId ?? null,
      eventId: data.eventId ?? null,
      sheetId: data.sheetId ?? null,
      occurrenceDate: parseOptionalDay(data.occurrenceDate ?? null),
      subject: data.subject ?? null,
      path: data.path ?? null,
      linkLabel: data.linkLabel ?? null,
    },
  });
}

/**
 * Pauses (the seconds left kept) or resumes (it ends after them) a timer not rung; asking the state it is in, or
 * pausing one already ended, does nothing.
 * @param {string} userId User.
 * @param {string} id Timer.
 * @param {boolean} paused Target state.
 * @returns {Promise<Countdown>} Timer.
 */
export async function setCountdownPaused(userId: string, id: string, paused: boolean): Promise<Countdown> {
  const countdown = await findCountdown(userId, id);
  if (countdown.rungAt || paused === (countdown.endsAt === null)) return countdown;
  const left = countdownRemaining(countdown);
  // Ended (its ring due): nothing to pause, it rings.
  if (paused && left <= 0) return countdown;
  const data = paused ? { endsAt: null, remainingSeconds: left } : { endsAt: new Date(Date.now() + left * 1000), remainingSeconds: null };
  return prisma.countdown.update({ where: { id }, data });
}

/**
 * Gives a timer not rung more minutes (« +1 min », « +5 min »), 24 hours left at most.
 * @param {string} userId User.
 * @param {string} id Timer.
 * @param {number} minutes Minutes added, 1 to 60.
 * @returns {Promise<Countdown>} Timer.
 */
export async function extendCountdown(userId: string, id: string, minutes: number): Promise<Countdown> {
  const added = parseInput(countdownExtensionSchema, minutes) * 60;
  const countdown = await findCountdown(userId, id);
  if (countdown.rungAt) return countdown;
  const left = countdownRemaining(countdown);
  const next = Math.min(COUNTDOWN_MAX_SECONDS, left + added);
  const timing = countdown.endsAt === null ? { remainingSeconds: next } : { endsAt: new Date(Date.now() + next * 1000) };
  return prisma.countdown.update({ where: { id }, data: { ...timing, durationSeconds: countdown.durationSeconds + (next - left) } });
}

/**
 * Records that the end of a timer rang (its ring goes on as an `AlarmRing`): it no longer shows. Only a timer that
 * runs and has ended is recorded (a few seconds of clock gap between the device and the server allowed): one paused
 * or given more minutes elsewhere meanwhile, already rung or cancelled: nothing.
 * @param {string} userId User.
 * @param {string} id Timer.
 * @returns {Promise<void>} Done.
 */
export async function ringCountdown(userId: string, id: string): Promise<void> {
  const now = Date.now();
  await prisma.countdown.updateMany({ where: { id, userId, rungAt: null, endsAt: { lte: new Date(now + RING_CLOCK_GAP_MS) } }, data: { rungAt: new Date(now) } });
}

/**
 * Cancels a timer: removed, it never rings (in no tab nor device).
 * @param {string} userId User.
 * @param {string} id Timer.
 * @returns {Promise<void>} Done (nothing for an unknown one).
 */
export async function cancelCountdown(userId: string, id: string): Promise<void> {
  await prisma.countdown.deleteMany({ where: { id, userId } });
}
