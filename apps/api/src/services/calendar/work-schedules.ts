import {
  birthdayLookSchema,
  DEFAULT_SCHEDULE_KIND_LABEL,
  defaultScheduleKindSchema,
  formatDay,
  formatOptionalDay,
  fromLegacySchedule,
  normalizedReminders,
  parseDay,
  parseOptionalDay,
  readScheduleDisplay,
  readScheduleCases,
  readScheduleExceptions,
  scheduleSubscriptionLookSchema,
  scheduleTypeSchema,
  workScheduleSchema,
  type BirthdayLookInput,
  type DefaultScheduleKindInput,
  type ScheduleDisplay,
  type ScheduleSubscriptionLook,
  type ScheduleTypeInput,
  type WorkScheduleInput,
  type WorkScheduleRule,
  foreignSlotKind,
  scheduleTypeContextError,
  UNTYPED_EPHEMERIS_LABEL,
} from '@ordo/shared';
import { BY_POSITION } from '../core/ordering';
import { createLabelService } from '../core/labels';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertActive, refuseArchived } from '../core/archive';
import { prisma, unscopedPrisma } from '../../db';
import type { Prisma, ScheduleType, WorkSchedule } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { assertKindContextsKept, syncKindContexts } from '../treasury/treasury-contexts';
import { currentWorkspaceId } from '../../workspace-context';
import { currentWorkspaceFields } from '../workspaces/current-workspace';
import { toJson } from '../core/json';

/**
 * Schedule as the shared functions read it: its cases and exceptions, or, saved before cases, its former slots
 * and pauses converted (invalid stored items left out), archived or of an archived kind (its kind read with it: the
 * slot conditions do not count it).
 * @param {WorkSchedule & { type?: { archivedAt: Date | null } | null }} schedule Stored schedule (with its kind's archiving, optional).
 * @returns {WorkScheduleRule} Rule.
 */
export function scheduleRule(schedule: WorkSchedule & { type?: { archivedAt: Date | null } | null }): WorkScheduleRule {
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
    ephemeris: schedule.ephemeris,
    archived: schedule.archivedAt !== null,
    kindArchived: Boolean(schedule.type?.archivedAt),
  };
}

/**
 * Rule a schedule would have once saved with an input (checked as on saving), to compare the occurrences of the
 * routines before and after a change of it.
 * @param {string} id Schedule (any id for a new one).
 * @param {WorkScheduleInput} input Schedule.
 * @param {boolean} ephemeris An éphéméride (that of its kind, `scheduleData`).
 * @returns {WorkScheduleRule} Rule.
 */
function scheduleRuleOf(id: string, input: WorkScheduleInput, ephemeris: boolean): WorkScheduleRule {
  const schedule = parseInput(workScheduleSchema, input);
  return {
    id,
    label: schedule.label,
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? null,
    cases: schedule.cases,
    exceptions: schedule.exceptions,
    typeId: schedule.typeId ?? null,
    ephemeris,
  };
}

/**
 * Prisma data of a schedule, exceptions by date; the former format is emptied (cases replace it). A kind archived
 * is refused unless it is the current one. With a kind, it is of the nature of its kind (créneau or éphéméride, lot
 * 16); without one, of the nature asked.
 * @param {WorkScheduleInput} input Schedule.
 * @param {string | null} [currentTypeId] Kind of the schedule changed. Optional.
 * @returns {Promise<object>} Data.
 */
async function scheduleData(input: WorkScheduleInput, currentTypeId: string | null = null) {
  const schedule = parseInput(workScheduleSchema, input);
  await assertActive(prisma.scheduleType, schedule.typeId, 'Type de créneau', { keep: currentTypeId, field: 'typeId' });
  const type = schedule.typeId ? await prisma.scheduleType.findUnique({ where: { id: schedule.typeId }, select: { ephemeris: true } }) : null;
  return {
    typeId: schedule.typeId ?? null,
    ephemeris: type ? type.ephemeris : schedule.ephemeris,
    label: schedule.label,
    startDate: parseDay(schedule.startDate),
    endDate: parseOptionalDay(schedule.endDate),
    cases: toJson(schedule.cases),
    exceptions: toJson([...schedule.exceptions].sort((a, b) => a.from.localeCompare(b.from))),
    // Omitted: left unchanged (a change of its hours from the calendar).
    ...(schedule.reminders && { reminders: toJson(normalizedReminders(schedule.reminders)) }),
    intervalWeeks: 1,
    slots: [],
    pauses: [],
  };
}

/**
 * Before a change of the schedules is saved, once checked: what it does to the routines (their occurrences it makes
 * disappear, `settleScheduleChange`), given the schedules of the workspace as it leaves them.
 */
export type ScheduleChangeSettler = (change: (own: WorkScheduleRule[]) => WorkScheduleRule[]) => Promise<void>;

/** No settling (internal changes). */
const NO_SETTLER: ScheduleChangeSettler = async () => {};

/**
 * Creates a schedule.
 * @param {WorkScheduleInput} input Schedule.
 * @param {ScheduleChangeSettler} [settle] Run once checked, before it is saved. Optional. Default = none.
 * @returns {Promise<WorkSchedule>} Schedule.
 */
export async function createWorkSchedule(input: WorkScheduleInput, settle: ScheduleChangeSettler = NO_SETTLER): Promise<WorkSchedule> {
  const data = await scheduleData(input);
  await settle((own) => [...own, scheduleRuleOf('new', input, data.ephemeris)]);
  return prisma.workSchedule.create({ data });
}

/**
 * Replaces a schedule (its slots and pauses with it).
 * @param {string} id Schedule id.
 * @param {WorkScheduleInput} input Schedule.
 * @param {ScheduleChangeSettler} [settle] Run once checked, before it is saved. Optional. Default = none.
 * @returns {Promise<WorkSchedule>} Schedule.
 */
export async function updateWorkSchedule(id: string, input: WorkScheduleInput, settle: ScheduleChangeSettler = NO_SETTLER): Promise<WorkSchedule> {
  const current = await orNotFound(prisma.workSchedule.findUnique({ where: { id }, select: { id: true, typeId: true, archivedAt: true } }), 'Créneau de travail');
  refuseArchived(current);
  const data = await scheduleData(input, current.typeId);
  // Its kind kept: archived as it is; another one: not archived (checked).
  await settle((own) =>
    own.map((rule) => {
      if (rule.id !== id) return rule;
      const next = scheduleRuleOf(id, input, data.ephemeris);
      return { ...next, kindArchived: Boolean(rule.kindArchived && rule.typeId === next.typeId) };
    }),
  );
  return prisma.workSchedule.update({ where: { id }, data });
}

/**
 * Deletes a schedule.
 * @param {string} id Schedule id.
 * @param {ScheduleChangeSettler} [settle] Run once found, before it is deleted. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function deleteWorkSchedule(id: string, settle: ScheduleChangeSettler = NO_SETTLER): Promise<void> {
  await assertExists(prisma.workSchedule, id, 'Créneau de travail');
  await settle((own) => own.filter((rule) => rule.id !== id));
  await deleteOrNotFound(prisma.workSchedule, id, 'Créneau de travail');
}

/**
 * Turns a schedule into an éphéméride or back into a créneau: its id stays (the slot conditions naming it keep
 * it). A schedule of a kind of the other nature leaves its kind (a whole kind is one or the other). Refused once
 * archived; the occurrences of routines it makes disappear are asked first through `settle`.
 * @param {string} id Schedule.
 * @param {boolean} ephemeris Éphéméride (or créneau).
 * @param {ScheduleChangeSettler} [settle] Run once checked, before it is saved. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function setWorkScheduleEphemeris(id: string, ephemeris: boolean, settle: ScheduleChangeSettler = NO_SETTLER): Promise<void> {
  const current = await orNotFound(
    prisma.workSchedule.findUnique({ where: { id }, select: { archivedAt: true, ephemeris: true, type: { select: { ephemeris: true } } } }),
    'Créneau de travail',
  );
  refuseArchived(current);
  if (current.ephemeris === ephemeris) return;
  const leavesKind = Boolean(current.type && current.type.ephemeris !== ephemeris);
  await settle((own) => own.map((rule) => (rule.id === id ? { ...rule, ephemeris, ...(leavesKind ? { typeId: null, kindArchived: false } : {}) } : rule)));
  await prisma.workSchedule.update({ where: { id }, data: { ephemeris, ...(leavesKind ? { typeId: null } : {}) } });
}

/**
 * Turns a whole kind into a kind of éphémérides or back into a kind of créneaux, its schedules with it: ids
 * stay (the slot conditions naming it or them keep them). Refused once archived, and for a context of the budget back
 * into créneaux; the occurrences of routines it makes disappear are asked first through `settle`.
 * @param {string} id Kind.
 * @param {boolean} ephemeris Éphémérides (or créneaux).
 * @param {ScheduleChangeSettler} [settle] Run once checked, before it is saved. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function setScheduleTypeEphemeris(id: string, ephemeris: boolean, settle: ScheduleChangeSettler = NO_SETTLER): Promise<void> {
  const current = await orNotFound(prisma.scheduleType.findUnique({ where: { id }, select: { archivedAt: true, ephemeris: true, budgetContext: true } }), 'Type de créneau');
  refuseArchived(current);
  if (current.ephemeris === ephemeris) return;
  if (current.budgetContext) throw clientError('BAD_USER_INPUT', 'Ce type sert de contexte au budget : retirez d’abord « Sert de contexte au budget ».');
  await settle((own) => own.map((rule) => (rule.typeId === id ? { ...rule, ephemeris } : rule)));
  await prisma.$transaction([prisma.scheduleType.update({ where: { id }, data: { ephemeris } }), prisma.workSchedule.updateMany({ where: { typeId: id }, data: { ephemeris } })]);
}

/** Kinds of time slots (label, color and display, checked here); the schedules of a deleted one stay, without kind. */
const baseScheduleTypes = createLabelService<ScheduleType>('scheduleType', { notFound: 'Type de créneau', conflict: 'Un type porte déjà ce libellé.' }, { schema: scheduleTypeSchema });

/**
 * Budget fields of a kind as it would be saved, checked (`scheduleTypeContextError`).
 * @param {{ ephemeris: boolean, budgetContext: boolean, sharedContext: boolean }} type Kind.
 * @returns {void}
 */
function checkKindContext(type: { ephemeris: boolean; budgetContext: boolean; sharedContext: boolean }): void {
  const error = scheduleTypeContextError(type);
  if (error) throw fieldError(error.field, error.message);
}

/**
 * Kinds of time slots: the label service, the nature fixed at the creation (a conversion changes it,
 * `setScheduleTypeEphemeris`), the budget fields checked, and the treasury contexts it is kept with it (one per
 * workspace where it is one, `syncKindContexts`; those it would remove refused while they have lines or budgets).
 */
export const scheduleTypes: typeof baseScheduleTypes = {
  ...baseScheduleTypes,
  /**
   * Creates a kind, and its context when it is one.
   * @param {object} input Kind.
   * @returns {Promise<ScheduleType>} Kind.
   */
  async create(input: object) {
    // Fields left out (null from GraphQL) take their default.
    const data = parseInput(scheduleTypeSchema, Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null)));
    checkKindContext(data);
    const type = await baseScheduleTypes.create(data);
    await syncKindContexts(type.id);
    return type;
  },
  /**
   * Changes a kind (not its nature), and its contexts.
   * @param {string} id Kind.
   * @param {object} input Changed fields.
   * @returns {Promise<ScheduleType>} Kind.
   */
  async update(id: string, input: object) {
    const current = await orNotFound(prisma.scheduleType.findUnique({ where: { id }, select: { ephemeris: true, budgetContext: true, sharedContext: true } }), 'Type de créneau');
    const { ephemeris: _nature, ...changes } = input as { ephemeris?: unknown };
    const patch = changes as { budgetContext?: boolean | null; sharedContext?: boolean | null };
    const budgetContext = patch.budgetContext ?? current.budgetContext;
    const next = { ephemeris: current.ephemeris, budgetContext, sharedContext: budgetContext && (patch.sharedContext ?? current.sharedContext) };
    checkKindContext(next);
    await assertKindContextsKept(id, next);
    const type = await baseScheduleTypes.update(id, { ...changes, sharedContext: next.sharedContext });
    await syncKindContexts(id);
    return type;
  },
};

/**
 * Deletes a kind of time slots: its schedules stay, without kind (the working hours of the workspace), which may make
 * occurrences of routines disappear (asked first through `settle`).
 * @param {string} id Kind.
 * @param {ScheduleChangeSettler} [settle] Run once found, before it is deleted. Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function deleteScheduleType(id: string, settle: ScheduleChangeSettler = NO_SETTLER): Promise<void> {
  await assertExists(prisma.scheduleType, id, 'Type de créneau');
  await settle((own) => own.map((rule) => (rule.typeId === id ? { ...rule, typeId: null, kindArchived: false } : rule)));
  await scheduleTypes.remove(id);
}

/**
 * Saves a kind of time slots.
 * @param {string | null} id Kind to change, or null to create one.
 * @param {ScheduleTypeInput} input Label, color and display.
 * @returns {Promise<ScheduleType>} Kind.
 */
export function saveScheduleType(id: string | null, input: ScheduleTypeInput): Promise<ScheduleType> {
  return id ? scheduleTypes.update(id, input) : scheduleTypes.create(input);
}

/** Schedule of another workspace (shown or named in this one), with its kind, workspace, and color and display here. */
export interface ForeignSchedule {
  rule: WorkScheduleRule;
  archived: boolean;
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
  /** Kind archived in its workspace (no longer offered in a slot condition). */
  archived: boolean;
  /** A kind of éphémérides. */
  ephemeris: boolean;
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
  scheduleLabel: true,
  scheduleColor: true,
  scheduleDayDisplay: true,
  scheduleDayBar: true,
  scheduleMonthDisplay: true,
} as const;

/** Default kind of a workspace: label, color and display of its schedules without kind. */
export interface DefaultScheduleKind {
  label: string;
  color: string | null;
  display: ScheduleDisplay;
}

/**
 * Default kind of a workspace read from its columns.
 * @param {{ scheduleLabel: string | null, scheduleColor: string | null, scheduleDayDisplay: string, scheduleDayBar: boolean, scheduleMonthDisplay: string }} workspace Workspace.
 * @returns {DefaultScheduleKind} Kind.
 */
function defaultKindOf(workspace: {
  scheduleLabel: string | null;
  scheduleColor: string | null;
  scheduleDayDisplay: string;
  scheduleDayBar: boolean;
  scheduleMonthDisplay: string;
}): DefaultScheduleKind {
  return {
    label: workspace.scheduleLabel || DEFAULT_SCHEDULE_KIND_LABEL,
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
  const workspace = await currentWorkspaceFields(defaultKindSelect);
  return defaultKindOf(workspace);
}

/**
 * Saves the default kind of this workspace: label (empty: 'Travail'), color (none: the green of working hours) and
 * display of its schedules without kind.
 * @param {DefaultScheduleKindInput} input Label, color and display.
 * @returns {Promise<DefaultScheduleKind>} Kind.
 */
export async function saveDefaultScheduleKind(input: DefaultScheduleKindInput): Promise<DefaultScheduleKind> {
  const data = parseInput(defaultScheduleKindSchema, input);
  const workspace = await unscopedPrisma.workspace.update({
    where: { id: currentWorkspaceId() },
    data: {
      scheduleLabel: data.label || null,
      scheduleColor: data.color,
      scheduleDayDisplay: data.dayDisplay,
      scheduleDayBar: data.dayBar,
      scheduleMonthDisplay: data.monthDisplay,
    },
    select: defaultKindSelect,
  });
  return defaultKindOf(workspace);
}

/** Birthdays display of a workspace as stored on it. */
const birthdayLookSelect = {
  birthdayShown: true,
  birthdayColor: true,
} as const;

/** Birthdays of the people of a workspace in its calendar (all-day events): shown or not, and color. */
export interface BirthdayLook {
  shown: boolean;
  color: string | null;
}

/**
 * Birthdays display of a workspace read from its columns.
 * @param {{ birthdayShown: boolean, birthdayColor: string | null }} workspace Workspace.
 * @returns {BirthdayLook} Display.
 */
function birthdayLookOf(workspace: { birthdayShown: boolean; birthdayColor: string | null }): BirthdayLook {
  return { shown: workspace.birthdayShown, color: workspace.birthdayColor };
}

/**
 * Birthdays display of this workspace.
 * @returns {Promise<BirthdayLook>} Display.
 */
export async function birthdayLook(): Promise<BirthdayLook> {
  return birthdayLookOf(await currentWorkspaceFields(birthdayLookSelect));
}

/**
 * Saves the birthdays display of this workspace: shown or not in its calendar (hidden, their reminders
 * still ring) and color (none: the gray of the éphémérides).
 * @param {BirthdayLookInput} input Shown and color.
 * @returns {Promise<BirthdayLook>} Display.
 */
export async function saveBirthdayLook(input: BirthdayLookInput): Promise<BirthdayLook> {
  const data = parseInput(birthdayLookSchema, input);
  const workspace = await unscopedPrisma.workspace.update({
    where: { id: currentWorkspaceId() },
    data: {
      birthdayShown: data.shown,
      birthdayColor: data.color,
    },
    select: birthdayLookSelect,
  });
  return birthdayLookOf(workspace);
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
  const subscribed = new Map(subscriptions.map((item) => [foreignSlotKind(item.sourceWorkspaceId, item.typeId), item]));
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
          archivedAt: true,
          ephemeris: true,
          _count: { select: { schedules: true } },
        },
      },
      // The working hours: its créneaux without kind (its éphémérides without kind are of no kind).
      workSchedules: { where: { typeId: null, ephemeris: false }, select: { id: true } },
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
              label: untyped.label,
              sourceColor: untyped.color,
              ...lookOf(subscribed.get(foreignSlotKind(workspace.id, null)), asKind(untyped)),
              scheduleCount: workspace.workSchedules.length,
              subscribed: subscribed.has(foreignSlotKind(workspace.id, null)),
              archived: false,
              ephemeris: false,
            },
          ]
        : []),
      ...workspace.scheduleTypes.map((type) => ({
        workspace: { id: workspace.id, label: workspace.label },
        typeId: type.id,
        label: type.label,
        sourceColor: type.color,
        ...lookOf(subscribed.get(foreignSlotKind(workspace.id, type.id)), type),
        scheduleCount: type._count.schedules,
        subscribed: subscribed.has(foreignSlotKind(workspace.id, type.id)),
        archived: type.archivedAt !== null,
        ephemeris: type.ephemeris,
      })),
    ];
  });
}

/**
 * Subscriptions of this workspace to the kinds of schedules of other workspaces, with their look.
 * @returns {Promise<({ sourceWorkspaceId: string, typeId: string | null } & StoredLook)[]>} Subscriptions.
 */
const scheduleSubscriptions = () => prisma.workScheduleSubscription.findMany({ select: { sourceWorkspaceId: true, typeId: true, ...lookSelect } });

/**
 * Schedules of the kinds of other workspaces this one shows (those added later too).
 * @returns {Promise<ForeignSchedule[]>} Schedules.
 */
export async function subscribedSchedules(): Promise<ForeignSchedule[]> {
  const subscriptions = await scheduleSubscriptions();
  if (!subscriptions.length) return [];
  // Without kind: the working hours, its créneaux only.
  return foreignSchedules(
    { OR: subscriptions.map((item) => ({ workspaceId: item.sourceWorkspaceId, typeId: item.typeId, ...(item.typeId ? {} : { ephemeris: false }) })) },
    subscriptions,
  );
}

/**
 * Every schedule of the other workspaces of the user (archived ones too), shown or not: what a slot condition can
 * name of them.
 * @returns {Promise<ForeignSchedule[]>} Schedules.
 */
export async function otherWorkspaceSchedules(): Promise<ForeignSchedule[]> {
  return foreignSchedules({ workspaceId: { not: currentWorkspaceId() } }, await scheduleSubscriptions());
}

/**
 * Schedules of other workspaces, with their color and display here (those of their subscription, else of their kind).
 * @param {Prisma.WorkScheduleWhereInput} where Schedules wanted (of other workspaces).
 * @param {readonly ({ sourceWorkspaceId: string, typeId: string | null } & StoredLook)[]} subscriptions Subscriptions of this workspace.
 * @returns {Promise<ForeignSchedule[]>} Schedules.
 */
async function foreignSchedules(where: Prisma.WorkScheduleWhereInput, subscriptions: readonly ({ sourceWorkspaceId: string; typeId: string | null } & StoredLook)[]): Promise<ForeignSchedule[]> {
  const lookByKind = new Map(subscriptions.map((item) => [foreignSlotKind(item.sourceWorkspaceId, item.typeId), item]));
  const schedules = await unscopedPrisma.workSchedule.findMany({
    where,
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    include: {
      type: {
        select: {
          label: true,
          color: true,
          dayDisplay: true,
          dayBar: true,
          monthDisplay: true,
          archivedAt: true,
        },
      },
      workspace: { select: { id: true, label: true, ...defaultKindSelect } },
    },
  });
  return schedules.map((schedule) => {
    const untyped = defaultKindOf(schedule.workspace);
    // An éphéméride without kind: none (no default kind, no color: the web gives it its own).
    const loose = !schedule.type && schedule.ephemeris;
    const { color, display } = lookOf(lookByKind.get(foreignSlotKind(schedule.workspaceId, schedule.typeId)), schedule.type ?? (loose ? null : asKind(untyped)));
    return {
      rule: scheduleRule(schedule),
      archived: schedule.archivedAt !== null,
      typeLabel: schedule.type?.label ?? (loose ? UNTYPED_EPHEMERIS_LABEL : untyped.label),
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
  if (sourceWorkspaceId === currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Ces créneaux appartiennent déjà à cet espace.');
  await assertExists(unscopedPrisma.workspace, sourceWorkspaceId, 'Espace');
  if (
    typeId &&
    !(await unscopedPrisma.scheduleType.findFirst({
      where: { id: typeId, workspaceId: sourceWorkspaceId },
      select: { id: true },
    }))
  )
    throw notFound('Type de créneau');
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
