import { formatDay, parseDay, workPauseSchema, workScheduleSchema, workSlotSchema, type WorkScheduleInput, type WorkScheduleRule } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { WorkSchedule } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';

/**
 * Schedule as the shared functions read it (invalid stored slots or pauses left out).
 * @param {WorkSchedule} schedule Stored schedule.
 * @returns {WorkScheduleRule} Rule.
 */
export function scheduleRule(schedule: WorkSchedule): WorkScheduleRule {
  const slots = z.array(workSlotSchema).safeParse(schedule.slots);
  const pauses = z.array(workPauseSchema).safeParse(schedule.pauses);
  return {
    id: schedule.id,
    name: schedule.name,
    startDate: formatDay(schedule.startDate),
    endDate: schedule.endDate ? formatDay(schedule.endDate) : null,
    intervalWeeks: schedule.intervalWeeks,
    slots: slots.success ? slots.data : [],
    pauses: pauses.success ? pauses.data : [],
  };
}

/**
 * Prisma data of a schedule, slots sorted by day and time and pauses by date.
 * @param {WorkScheduleInput} input Schedule.
 * @returns {object} Data.
 */
function scheduleData(input: WorkScheduleInput) {
  const schedule = parseInput(workScheduleSchema, input);
  return {
    name: schedule.name,
    startDate: parseDay(schedule.startDate),
    endDate: schedule.endDate ? parseDay(schedule.endDate) : null,
    intervalWeeks: schedule.intervalWeeks,
    slots: [...schedule.slots].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
    pauses: [...schedule.pauses].sort((a, b) => a.from.localeCompare(b.from)),
  };
}

/**
 * Creates a schedule.
 * @param {WorkScheduleInput} input Schedule.
 * @returns {Promise<WorkSchedule>} Schedule.
 */
export async function createWorkSchedule(input: WorkScheduleInput): Promise<WorkSchedule> {
  return prisma.workSchedule.create({ data: scheduleData(input) });
}

/**
 * Replaces a schedule (its slots and pauses with it).
 * @param {string} id Schedule id.
 * @param {WorkScheduleInput} input Schedule.
 * @returns {Promise<WorkSchedule>} Schedule.
 */
export async function updateWorkSchedule(id: string, input: WorkScheduleInput): Promise<WorkSchedule> {
  const data = scheduleData(input);
  if (!(await prisma.workSchedule.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Plage de travail');
  return prisma.workSchedule.update({ where: { id }, data });
}

/**
 * Deletes a schedule.
 * @param {string} id Schedule id.
 * @returns {Promise<void>}
 */
export async function deleteWorkSchedule(id: string): Promise<void> {
  const { count } = await prisma.workSchedule.deleteMany({ where: { id } });
  if (!count) throw notFound('Plage de travail');
}
