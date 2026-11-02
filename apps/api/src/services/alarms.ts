import { alarmInputSchema, type AlarmInput } from '@ordo/shared';
import { prisma } from '../db';
import type { Alarm } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';

/**
 * Converts a YYYY-MM-DD date to a UTC Date, keeping null.
 * @param {string | null} date Calendar date.
 * @returns {Date | null} Date at midnight UTC.
 */
function toDate(date: string | null): Date | null {
  return date === null ? null : new Date(`${date}T00:00:00.000Z`);
}

/**
 * Validates an alarm and the project or task it points to.
 * @param {AlarmInput} input Alarm input.
 * @returns {Promise<object>} Prisma data.
 */
async function parseAlarm(input: AlarmInput) {
  const alarm = parseInput(alarmInputSchema, input);
  if (alarm.projectId && !(await prisma.project.findUnique({ where: { id: alarm.projectId } }))) throw notFound('Projet');
  if (alarm.taskId && !(await prisma.task.findUnique({ where: { id: alarm.taskId } }))) throw notFound('Tâche');
  const tracking = alarm.type === 'TRACKING_DURATION';
  return {
    ...alarm,
    // Fields that do not apply to the type are cleared.
    startDate: tracking ? null : toDate(alarm.startDate),
    time: tracking ? null : alarm.time,
    endDate: tracking ? null : toDate(alarm.endDate),
    minutes: tracking ? alarm.minutes : null,
    weekdays: alarm.frequency === 'WEEKLY' ? [...new Set(alarm.weekdays)].sort() : [],
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
  if (!(await prisma.alarm.findUnique({ where: { id } }))) throw notFound('Alarme');
  return prisma.alarm.update({ where: { id }, data: { ...(await parseAlarm(input)), lastFiredAt: new Date() } });
}

/**
 * Records that an alarm rang, so it does not ring again for the same occurrence.
 * @param {string} id Alarm id.
 * @param {Date} at Moment of the occurrence.
 * @returns {Promise<Alarm>} Updated alarm.
 */
export async function markAlarmFired(id: string, at: Date): Promise<Alarm> {
  const alarm = await prisma.alarm.findUnique({ where: { id } });
  if (!alarm) throw notFound('Alarme');
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
  if (!(await prisma.alarm.findUnique({ where: { id } }))) throw notFound('Alarme');
  await prisma.alarm.delete({ where: { id } });
}
