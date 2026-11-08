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

/** Schedule of another workspace shown in this one, with its kind and workspace. */
export interface ForeignSchedule {
  rule: WorkScheduleRule;
  typeName: string | null;
  color: string | null;
  workspace: { id: string; name: string };
}

/** Kind of schedules of another workspace (or its schedules without kind), with whether this one shows it. */
export interface ForeignScheduleKind {
  workspace: { id: string; name: string };
  /** None: the schedules without kind (working hours). */
  typeId: string | null;
  name: string;
  color: string | null;
  scheduleCount: number;
  subscribed: boolean;
}

/** Name of the schedules without kind. */
const UNTYPED = 'Horaires de travail';

/**
 * Kinds of schedules of the other workspaces (with their schedules without kind, when there are), by workspace,
 * with whether this one shows them.
 * @returns {Promise<ForeignScheduleKind[]>} Kinds.
 */
export async function foreignScheduleKinds(): Promise<ForeignScheduleKind[]> {
  const subscriptions = await prisma.workScheduleSubscription.findMany({ select: { sourceWorkspaceId: true, typeId: true } });
  const subscribed = new Set(subscriptions.map((item) => `${item.sourceWorkspaceId}|${item.typeId ?? ''}`));
  const workspaces = await unscopedPrisma.workspace.findMany({
    where: { id: { not: currentWorkspaceId() } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      scheduleTypes: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, color: true, _count: { select: { schedules: true } } } },
      workSchedules: { where: { typeId: null }, select: { id: true } },
    },
  });
  return workspaces.flatMap((workspace) => [
    ...(workspace.workSchedules.length
      ? [
          {
            workspace: { id: workspace.id, name: workspace.name },
            typeId: null,
            name: UNTYPED,
            color: null,
            scheduleCount: workspace.workSchedules.length,
            subscribed: subscribed.has(`${workspace.id}|`),
          },
        ]
      : []),
    ...workspace.scheduleTypes.map((type) => ({
      workspace: { id: workspace.id, name: workspace.name },
      typeId: type.id,
      name: type.name,
      color: type.color,
      scheduleCount: type._count.schedules,
      subscribed: subscribed.has(`${workspace.id}|${type.id}`),
    })),
  ]);
}

/**
 * Schedules of the kinds of other workspaces this one shows (those added later too).
 * @returns {Promise<ForeignSchedule[]>} Schedules.
 */
export async function subscribedSchedules(): Promise<ForeignSchedule[]> {
  const subscriptions = await prisma.workScheduleSubscription.findMany({ select: { sourceWorkspaceId: true, typeId: true } });
  if (!subscriptions.length) return [];
  const schedules = await unscopedPrisma.workSchedule.findMany({
    where: { OR: subscriptions.map((item) => ({ workspaceId: item.sourceWorkspaceId, typeId: item.typeId })) },
    include: { type: { select: { name: true, color: true } }, workspace: { select: { id: true, name: true } } },
  });
  return schedules.map((schedule) => ({
    rule: scheduleRule(schedule),
    typeName: schedule.type?.name ?? UNTYPED,
    color: schedule.type?.color ?? null,
    workspace: { id: schedule.workspace.id, name: schedule.workspace.name },
  }));
}

/**
 * Shows a kind of schedules of another workspace (or its schedules without kind) in this one, read only.
 * @param {string} sourceWorkspaceId Workspace of the schedules.
 * @param {string | null} typeId Kind; none: the schedules without kind.
 * @returns {Promise<void>}
 */
export async function subscribeScheduleKind(sourceWorkspaceId: string, typeId: string | null): Promise<void> {
  if (sourceWorkspaceId === currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Ces plages appartiennent déjà à cet espace.');
  if (!(await unscopedPrisma.workspace.findUnique({ where: { id: sourceWorkspaceId }, select: { id: true } }))) throw notFound('Espace');
  if (typeId && !(await unscopedPrisma.scheduleType.findFirst({ where: { id: typeId, workspaceId: sourceWorkspaceId }, select: { id: true } }))) throw notFound('Type de plage');
  // A null kind is not unique for the database: checked here.
  if (await prisma.workScheduleSubscription.findFirst({ where: { sourceWorkspaceId, typeId }, select: { id: true } })) return;
  await prisma.workScheduleSubscription.create({ data: { sourceWorkspaceId, typeId } });
}

/**
 * Stops showing a kind of schedules of another workspace.
 * @param {string} sourceWorkspaceId Workspace of the schedules.
 * @param {string | null} typeId Kind; none: the schedules without kind.
 * @returns {Promise<void>}
 */
export async function unsubscribeScheduleKind(sourceWorkspaceId: string, typeId: string | null): Promise<void> {
  await prisma.workScheduleSubscription.deleteMany({ where: { sourceWorkspaceId, typeId } });
}
