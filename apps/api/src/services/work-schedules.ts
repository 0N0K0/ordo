import { formatDay, parseDay, scheduleTypeSchema, workPauseSchema, workScheduleSchema, workSlotSchema, type ScheduleTypeInput, type WorkScheduleInput, type WorkScheduleRule } from '@ordo/shared';
import { z } from 'zod';
import { prisma, unscopedPrisma } from '../db';
import { Prisma, type ScheduleType, type WorkSchedule } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { currentWorkspaceId } from '../workspace-context';

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
    typeId: schedule.typeId,
  };
}

/**
 * Prisma data of a schedule, slots sorted by day and time and pauses by date.
 * @param {WorkScheduleInput} input Schedule.
 * @returns {Promise<object>} Data.
 */
async function scheduleData(input: WorkScheduleInput) {
  const schedule = parseInput(workScheduleSchema, input);
  if (schedule.typeId && !(await prisma.scheduleType.findUnique({ where: { id: schedule.typeId }, select: { id: true } }))) throw notFound('Type de plage');
  return {
    typeId: schedule.typeId ?? null,
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
  return prisma.workSchedule.create({ data: await scheduleData(input) });
}

/**
 * Replaces a schedule (its slots and pauses with it).
 * @param {string} id Schedule id.
 * @param {WorkScheduleInput} input Schedule.
 * @returns {Promise<WorkSchedule>} Schedule.
 */
export async function updateWorkSchedule(id: string, input: WorkScheduleInput): Promise<WorkSchedule> {
  const data = await scheduleData(input);
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

/**
 * Saves a kind of time slots.
 * @param {string | null} id Kind to change, or null to create one.
 * @param {ScheduleTypeInput} input Name and color.
 * @returns {Promise<ScheduleType>} Kind.
 */
export async function saveScheduleType(id: string | null, input: ScheduleTypeInput): Promise<ScheduleType> {
  const data = parseInput(scheduleTypeSchema, input);
  if (id && !(await prisma.scheduleType.findUnique({ where: { id }, select: { id: true } }))) throw notFound('Type de plage');
  try {
    if (id) return await prisma.scheduleType.update({ where: { id }, data });
    const { _max } = await prisma.scheduleType.aggregate({ _max: { position: true } });
    return await prisma.scheduleType.create({ data: { ...data, position: (_max.position ?? -1) + 1 } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw clientError('BAD_USER_INPUT', 'Un type porte déjà ce nom.', { fields: { name: 'Un type porte déjà ce nom.' } });
    }
    throw error;
  }
}

/**
 * Deletes a kind of time slots: its schedules stay, without kind.
 * @param {string} id Kind.
 * @returns {Promise<void>}
 */
export async function deleteScheduleType(id: string): Promise<void> {
  const { count } = await prisma.scheduleType.deleteMany({ where: { id } });
  if (!count) throw notFound('Type de plage');
}

/** Schedule of another workspace, with its kind and workspace. */
export interface ForeignSchedule {
  rule: WorkScheduleRule;
  typeName: string | null;
  color: string | null;
  workspace: { id: string; name: string };
  subscribed: boolean;
}

/**
 * Schedules of the other workspaces, with whether this one shows them (`only`: those it shows).
 * @param {boolean} only Only the schedules subscribed to.
 * @returns {Promise<ForeignSchedule[]>} Schedules, by workspace and name.
 */
export async function foreignSchedules(only: boolean): Promise<ForeignSchedule[]> {
  const subscribed = new Set((await prisma.workScheduleSubscription.findMany({ select: { scheduleId: true } })).map((item) => item.scheduleId));
  const schedules = await unscopedPrisma.workSchedule.findMany({
    where: { workspaceId: { not: currentWorkspaceId() }, ...(only ? { id: { in: [...subscribed] } } : {}) },
    include: { type: { select: { name: true, color: true } }, workspace: { select: { id: true, name: true, position: true } } },
    orderBy: [{ name: 'asc' }],
  });
  return schedules
    .sort((a, b) => a.workspace.position - b.workspace.position || a.name.localeCompare(b.name))
    .map((schedule) => ({
      rule: scheduleRule(schedule),
      typeName: schedule.type?.name ?? null,
      color: schedule.type?.color ?? null,
      workspace: { id: schedule.workspace.id, name: schedule.workspace.name },
      subscribed: subscribed.has(schedule.id),
    }));
}

/**
 * Shows a schedule of another workspace in this one (read only).
 * @param {string} scheduleId Schedule.
 * @returns {Promise<void>}
 */
export async function subscribeSchedule(scheduleId: string): Promise<void> {
  const schedule = await unscopedPrisma.workSchedule.findUnique({ where: { id: scheduleId }, select: { workspaceId: true } });
  if (!schedule) throw notFound('Plage');
  if (schedule.workspaceId === currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Cette plage appartient déjà à cet espace.');
  if (await prisma.workScheduleSubscription.findFirst({ where: { scheduleId }, select: { id: true } })) return;
  await prisma.workScheduleSubscription.create({ data: { scheduleId } });
}

/**
 * Stops showing a schedule of another workspace.
 * @param {string} scheduleId Schedule.
 * @returns {Promise<void>}
 */
export async function unsubscribeSchedule(scheduleId: string): Promise<void> {
  await prisma.workScheduleSubscription.deleteMany({ where: { scheduleId } });
}
