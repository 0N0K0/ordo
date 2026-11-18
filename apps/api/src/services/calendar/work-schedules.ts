import {
  DEFAULT_SCHEDULE_KIND_NAME,
  defaultScheduleKindSchema,
  formatDay,
  formatOptionalDay,
  fromLegacySchedule,
  parseDay,
  parseOptionalDay,
  readScheduleDisplay,
  readScheduleCases,
  readScheduleExceptions,
  scheduleSubscriptionLookSchema,
  scheduleTypeSchema,
  workScheduleSchema,
  type DefaultScheduleKindInput,
  type ScheduleDisplay,
  type ScheduleSubscriptionLook,
  type ScheduleTypeInput,
  type WorkScheduleInput,
  type WorkScheduleRule,
} from '@ordo/shared';
import { BY_POSITION } from '../core/ordering';
import { createLabelService } from '../core/labels';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertNotArchived } from '../core/archive';
import { prisma, unscopedPrisma } from '../../db';
import { Prisma, type ScheduleType, type WorkSchedule } from '../../generated/prisma/client';
import { clientError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { currentWorkspaceId } from '../../workspace-context';

/**
 * Schedule as the shared functions read it: its cases and exceptions, or, saved before cases, its former slots
 * and pauses converted (invalid stored items left out).
 * @param {WorkSchedule} schedule Stored schedule.
 * @returns {WorkScheduleRule} Rule.
 */
export function scheduleRule(schedule: WorkSchedule): WorkScheduleRule {
  const startDate = formatDay(schedule.startDate);
  // Cases of the former form converted (their rhythms count from the start of the period).
  const cases = readScheduleCases(schedule.cases, startDate);
  const current = cases.length ? { cases, exceptions: readScheduleExceptions(schedule.exceptions) } : null;
  return {
    id: schedule.id,
    label: schedule.label,
    startDate,
    endDate: formatOptionalDay(schedule.endDate),
    ...(current ??
      fromLegacySchedule({
        startDate,
        intervalWeeks: schedule.intervalWeeks,
        slots: schedule.slots,
        pauses: schedule.pauses,
      })),
    typeId: schedule.typeId,
  };
}

/**
 * Prisma data of a schedule, exceptions by date; the former format is emptied (cases replace it). A kind archived
 * is refused unless it is the current one.
 * @param {WorkScheduleInput} input Schedule.
 * @param {string | null} [currentTypeId] Kind of the schedule changed. Optional.
 * @returns {Promise<object>} Data.
 */
async function scheduleData(input: WorkScheduleInput, currentTypeId: string | null = null) {
  const schedule = parseInput(workScheduleSchema, input);
  await assertExists(prisma.scheduleType, schedule.typeId, 'Type de plage');
  if (schedule.typeId !== currentTypeId) await assertNotArchived('scheduleType', schedule.typeId);
  return {
    typeId: schedule.typeId ?? null,
    label: schedule.label,
    startDate: parseDay(schedule.startDate),
    endDate: parseOptionalDay(schedule.endDate),
    cases: schedule.cases as Prisma.InputJsonValue,
    exceptions: [...schedule.exceptions].sort((a, b) => a.from.localeCompare(b.from)) as Prisma.InputJsonValue,
    intervalWeeks: 1,
    slots: [],
    pauses: [],
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
  const current = await orNotFound(prisma.workSchedule.findUnique({ where: { id }, select: { id: true, typeId: true } }), 'Plage de travail');
  await assertNotArchived('workSchedule', id);
  const data = await scheduleData(input, current.typeId);
  return prisma.workSchedule.update({ where: { id }, data });
}

/**
 * Deletes a schedule.
 * @param {string} id Schedule id.
 * @returns {Promise<void>}
 */
export async function deleteWorkSchedule(id: string): Promise<void> {
  await deleteOrNotFound(prisma.workSchedule, id, 'Plage de travail');
}

/** Kinds of time slots (label, color and display, checked here); the schedules of a deleted one stay, without kind. */
export const scheduleTypes = createLabelService<ScheduleType>('scheduleType', { notFound: 'Type de plage', conflict: 'Un type porte déjà ce nom.' }, { schema: scheduleTypeSchema });

/**
 * Saves a kind of time slots.
 * @param {string | null} id Kind to change, or null to create one.
 * @param {ScheduleTypeInput} input Label, color and display.
 * @returns {Promise<ScheduleType>} Kind.
 */
export function saveScheduleType(id: string | null, input: ScheduleTypeInput): Promise<ScheduleType> {
  return id ? scheduleTypes.update(id, input) : scheduleTypes.create(input);
}

/** Schedule of another workspace shown in this one, with its kind, workspace, and color and display here. */
export interface ForeignSchedule {
  rule: WorkScheduleRule;
  typeLabel: string | null;
  color: string | null;
  display: ScheduleDisplay;
  workspace: { id: string; label: string };
}

/** Kind of schedules of another workspace (or its schedules without kind), with whether this one shows it. */
export interface ForeignScheduleKind {
  workspace: { id: string; label: string };
  /** None: the schedules without kind (working hours). */
  typeId: string | null;
  label: string;
  /** Color in this workspace: the subscription's, or the kind's. */
  color: string | null;
  /** Color of the kind in its workspace. */
  sourceColor: string | null;
  /** Display in this workspace: the subscription's, or the kind's. */
  display: ScheduleDisplay;
  /** The subscription sets a color or a display of its own. */
  customized: boolean;
  scheduleCount: number;
  subscribed: boolean;
}

/** Look of a subscription as stored. */
type StoredLook = {
  color: string | null;
  dayDisplay: string | null;
  dayBar: boolean | null;
  monthDisplay: string | null;
};
const lookSelect = {
  color: true,
  dayDisplay: true,
  dayBar: true,
  monthDisplay: true,
} as const;

/**
 * Color and display of a kind in this workspace: those of its subscription, or its own.
 * @param {StoredLook | undefined} look Subscription.
 * @param {{ color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string } | null} type Kind (or the default kind of its workspace).
 * @returns {{ color: string | null, display: ScheduleDisplay, customized: boolean }} Look.
 */
function lookOf(
  look: StoredLook | undefined,
  type: {
    color: string | null;
    dayDisplay: string;
    dayBar: boolean;
    monthDisplay: string;
  } | null,
): { color: string | null; display: ScheduleDisplay; customized: boolean } {
  const own = readScheduleDisplay(type);
  return {
    color: look?.color ?? type?.color ?? null,
    display: readScheduleDisplay({
      dayDisplay: look?.dayDisplay ?? own.dayDisplay,
      dayBar: look?.dayBar ?? own.dayBar,
      monthDisplay: look?.monthDisplay ?? own.monthDisplay,
    }),
    customized: Boolean(look && (look.color !== null || look.dayDisplay !== null || look.dayBar !== null || look.monthDisplay !== null)),
  };
}

/** Default kind of a workspace as stored on it: its schedules without kind. */
const defaultKindSelect = {
  scheduleName: true,
  scheduleColor: true,
  scheduleDayDisplay: true,
  scheduleDayBar: true,
  scheduleMonthDisplay: true,
} as const;

/** Default kind of a workspace: name, color and display of its schedules without kind. */
export interface DefaultScheduleKind {
  name: string;
  color: string | null;
  display: ScheduleDisplay;
}

/**
 * Default kind of a workspace read from its columns.
 * @param {{ scheduleName: string | null, scheduleColor: string | null, scheduleDayDisplay: string, scheduleDayBar: boolean, scheduleMonthDisplay: string }} workspace Workspace.
 * @returns {DefaultScheduleKind} Kind.
 */
function defaultKindOf(workspace: {
  scheduleName: string | null;
  scheduleColor: string | null;
  scheduleDayDisplay: string;
  scheduleDayBar: boolean;
  scheduleMonthDisplay: string;
}): DefaultScheduleKind {
  return {
    name: workspace.scheduleName || DEFAULT_SCHEDULE_KIND_NAME,
    color: workspace.scheduleColor,
    display: readScheduleDisplay({
      dayDisplay: workspace.scheduleDayDisplay,
      dayBar: workspace.scheduleDayBar,
      monthDisplay: workspace.scheduleMonthDisplay,
    }),
  };
}

/**
 * Default kind of this workspace: its schedules without kind.
 * @returns {Promise<DefaultScheduleKind>} Kind.
 */
export async function defaultScheduleKind(): Promise<DefaultScheduleKind> {
  const workspace = await orNotFound(unscopedPrisma.workspace.findUnique({ where: { id: currentWorkspaceId() }, select: defaultKindSelect }), 'Espace');
  return defaultKindOf(workspace);
}

/**
 * Saves the default kind of this workspace: name (empty: 'Travail'), color (none: the green of working hours) and
 * display of its schedules without kind.
 * @param {DefaultScheduleKindInput} input Name, color and display.
 * @returns {Promise<DefaultScheduleKind>} Kind.
 */
export async function saveDefaultScheduleKind(input: DefaultScheduleKindInput): Promise<DefaultScheduleKind> {
  const data = parseInput(defaultScheduleKindSchema, input);
  const workspace = await unscopedPrisma.workspace.update({
    where: { id: currentWorkspaceId() },
    data: {
      scheduleName: data.name || null,
      scheduleColor: data.color,
      scheduleDayDisplay: data.dayDisplay,
      scheduleDayBar: data.dayBar,
      scheduleMonthDisplay: data.monthDisplay,
    },
    select: defaultKindSelect,
  });
  return defaultKindOf(workspace);
}

/**
 * Default kind of a workspace as a kind, for the look of its subscriptions.
 * @param {DefaultScheduleKind} kind Default kind.
 * @returns {{ color: string | null, dayDisplay: string, dayBar: boolean, monthDisplay: string }} Kind.
 */
const asKind = (kind: DefaultScheduleKind) => ({
  color: kind.color,
  ...kind.display,
});

/**
 * Kinds of schedules of the other workspaces (with their schedules without kind, when there are), by workspace,
 * with whether this one shows them.
 * @returns {Promise<ForeignScheduleKind[]>} Kinds.
 */
export async function foreignScheduleKinds(): Promise<ForeignScheduleKind[]> {
  const subscriptions = await prisma.workScheduleSubscription.findMany({
    select: { sourceWorkspaceId: true, typeId: true, ...lookSelect },
  });
  const subscribed = new Map(subscriptions.map((item) => [`${item.sourceWorkspaceId}|${item.typeId ?? ''}`, item]));
  const workspaces = await unscopedPrisma.workspace.findMany({
    where: { id: { not: currentWorkspaceId() } },
    orderBy: BY_POSITION,
    select: {
      id: true,
      label: true,
      ...defaultKindSelect,
      scheduleTypes: {
        orderBy: BY_POSITION,
        select: {
          id: true,
          label: true,
          color: true,
          dayDisplay: true,
          dayBar: true,
          monthDisplay: true,
          _count: { select: { schedules: true } },
        },
      },
      workSchedules: { where: { typeId: null }, select: { id: true } },
    },
  });
  return workspaces.flatMap((workspace) => {
    const untyped = defaultKindOf(workspace);
    return [
      ...(workspace.workSchedules.length
        ? [
            {
              workspace: { id: workspace.id, label: workspace.label },
              typeId: null,
              label: untyped.name,
              sourceColor: untyped.color,
              ...lookOf(subscribed.get(`${workspace.id}|`), asKind(untyped)),
              scheduleCount: workspace.workSchedules.length,
              subscribed: subscribed.has(`${workspace.id}|`),
            },
          ]
        : []),
      ...workspace.scheduleTypes.map((type) => ({
        workspace: { id: workspace.id, label: workspace.label },
        typeId: type.id,
        label: type.label,
        sourceColor: type.color,
        ...lookOf(subscribed.get(`${workspace.id}|${type.id}`), type),
        scheduleCount: type._count.schedules,
        subscribed: subscribed.has(`${workspace.id}|${type.id}`),
      })),
    ];
  });
}

/**
 * Schedules of the kinds of other workspaces this one shows (those added later too).
 * @returns {Promise<ForeignSchedule[]>} Schedules.
 */
export async function subscribedSchedules(): Promise<ForeignSchedule[]> {
  const subscriptions = await prisma.workScheduleSubscription.findMany({
    select: { sourceWorkspaceId: true, typeId: true, ...lookSelect },
  });
  if (!subscriptions.length) return [];
  const lookByKind = new Map(subscriptions.map((item) => [`${item.sourceWorkspaceId}|${item.typeId ?? ''}`, item]));
  const schedules = await unscopedPrisma.workSchedule.findMany({
    where: {
      OR: subscriptions.map((item) => ({
        workspaceId: item.sourceWorkspaceId,
        typeId: item.typeId,
      })),
    },
    include: {
      type: {
        select: {
          label: true,
          color: true,
          dayDisplay: true,
          dayBar: true,
          monthDisplay: true,
        },
      },
      workspace: { select: { id: true, label: true, ...defaultKindSelect } },
    },
  });
  return schedules.map((schedule) => {
    const untyped = defaultKindOf(schedule.workspace);
    const { color, display } = lookOf(lookByKind.get(`${schedule.workspaceId}|${schedule.typeId ?? ''}`), schedule.type ?? asKind(untyped));
    return {
      rule: scheduleRule(schedule),
      typeLabel: schedule.type?.label ?? untyped.name,
      color,
      display,
      workspace: { id: schedule.workspace.id, label: schedule.workspace.label },
    };
  });
}

/**
 * Color and display of a kind of schedules subscribed to, in this workspace (none: those of the kind).
 * @param {string} sourceWorkspaceId Workspace of the schedules.
 * @param {string | null} typeId Kind; none: the schedules without kind.
 * @param {ScheduleSubscriptionLook} input Color and display.
 * @returns {Promise<void>}
 */
export async function setScheduleSubscriptionLook(sourceWorkspaceId: string, typeId: string | null, input: ScheduleSubscriptionLook): Promise<void> {
  const data = parseInput(scheduleSubscriptionLookSchema, input);
  const { count } = await prisma.workScheduleSubscription.updateMany({
    where: { sourceWorkspaceId, typeId },
    data,
  });
  if (!count) throw notFound('Abonnement');
}

/**
 * Shows a kind of schedules of another workspace (or its schedules without kind) in this one, read only.
 * @param {string} sourceWorkspaceId Workspace of the schedules.
 * @param {string | null} typeId Kind; none: the schedules without kind.
 * @returns {Promise<void>}
 */
export async function subscribeScheduleKind(sourceWorkspaceId: string, typeId: string | null): Promise<void> {
  if (sourceWorkspaceId === currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Ces plages appartiennent déjà à cet espace.');
  await assertExists(unscopedPrisma.workspace, sourceWorkspaceId, 'Espace');
  if (
    typeId &&
    !(await unscopedPrisma.scheduleType.findFirst({
      where: { id: typeId, workspaceId: sourceWorkspaceId },
      select: { id: true },
    }))
  )
    throw notFound('Type de plage');
  // A null kind is not unique for the database: checked here.
  if (
    await prisma.workScheduleSubscription.findFirst({
      where: { sourceWorkspaceId, typeId },
      select: { id: true },
    })
  )
    return;
  await prisma.workScheduleSubscription.create({
    data: { sourceWorkspaceId, typeId },
  });
}

/**
 * Stops showing a kind of schedules of another workspace.
 * @param {string} sourceWorkspaceId Workspace of the schedules.
 * @param {string | null} typeId Kind; none: the schedules without kind.
 * @returns {Promise<void>}
 */
export async function unsubscribeScheduleKind(sourceWorkspaceId: string, typeId: string | null): Promise<void> {
  await prisma.workScheduleSubscription.deleteMany({
    where: { sourceWorkspaceId, typeId },
  });
}
