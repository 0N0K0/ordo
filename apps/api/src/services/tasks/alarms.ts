import { type AlarmInput, alarmInputSchema, parseOptionalDay } from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type Alarm } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { assertExists } from '../core/lookup';

/**
 * Validates an alarm and the project or task it points to.
 * @param {AlarmInput} input Alarm input.
 * @returns {Promise<object>} Prisma data.
 */
async function parseAlarm(input: AlarmInput) {
  const alarm = parseInput(alarmInputSchema, input);
  await assertExists(prisma.project, alarm.projectId, 'Projet');
  await assertExists(prisma.task, alarm.taskId, 'Tâche');
  const tracking = alarm.type === 'TRACKING_DURATION';
  return {
    ...alarm,
    // Fields that do not apply to the type are cleared.
    startDate: tracking ? null : parseOptionalDay(alarm.startDate),
    time: tracking ? null : alarm.time,
    endDate: tracking ? null : parseOptionalDay(alarm.endDate),
    minutes: tracking ? alarm.minutes : null,
    weekdays: alarm.frequency === 'WEEKLY' ? [...new Set(alarm.weekdays)].sort() : [],
    // The common repetition; none: once (or, for an alarm saved before it, its former fields).
    recurrence: tracking || !alarm.recurrence ? Prisma.DbNull : alarm.recurrence,
  };
}

/**
 * Creates an alarm.
 * @param {AlarmInput} input Alarm input.
 * @returns {Promise<Alarm>} Created alarm.
 */
export async function createAlarm(input: AlarmInput): Promise<Alarm> {
  return prisma.alarm.create({ data: await parseAlarm(input) });
}

/**
 * Replaces an alarm's fields. A changed schedule starts afresh: occurrences already past do not ring.
 * @param {string} id Alarm id.
 * @param {AlarmInput} input Alarm input.
 * @returns {Promise<Alarm>} Updated alarm.
 */
export async function updateAlarm(id: string, input: AlarmInput): Promise<Alarm> {
  await assertExists(prisma.alarm, id, 'Alarme');
  return prisma.alarm.update({ where: { id }, data: { ...(await parseAlarm(input)), lastFiredAt: new Date() } });
}

/**
 * Records that an alarm rang, so it does not ring again for the same occurrence.
 * @param {string} id Alarm id.
 * @param {Date} at Moment of the occurrence.
 * @returns {Promise<Alarm>} Updated alarm.
 */
export async function markAlarmFired(id: string, at: Date): Promise<Alarm> {
  const alarm = await orNotFound(prisma.alarm.findUnique({ where: { id } }), 'Alarme');
  if (at.getTime() > Date.now() + 60_000) throw clientError('BAD_USER_INPUT', 'Moment invalide.');
  if (alarm.lastFiredAt && alarm.lastFiredAt >= at) return alarm;
  return prisma.alarm.update({ where: { id }, data: { lastFiredAt: at } });
}

/**
 * Deletes an alarm.
 * @param {string} id Alarm id.
 * @returns {Promise<void>}
 */
export async function deleteAlarm(id: string): Promise<void> {
  await assertExists(prisma.alarm, id, 'Alarme');
  await prisma.alarm.delete({ where: { id } });
}
