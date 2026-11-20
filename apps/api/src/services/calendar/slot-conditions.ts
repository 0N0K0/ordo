import {
  addDays,
  blockingEvent,
  conditionAllowsAt,
  conditionKinds,
  conditionScheduleIds,
  dayPart,
  DEFAULT_SLOT_KIND,
  foreignSlotKind,
  foreignSlotKindWorkspace,
  readSlotCondition,
  scheduleSlotsOn,
  type SlotCondition,
  type SlotsOn,
  type WorkScheduleRule,
} from '@ordo/shared';
import { prisma, unscopedPrisma } from '../../db';
import { archivedError } from '../core/archive';
import { notFound } from '../../graphql/errors';
import { currentWorkspaceId } from '../../workspace-context';
import { eventOccurrences } from './calendar-events';
import { otherWorkspaceSchedules, scheduleRule } from './work-schedules';

/** Field of the input the errors of a slot condition show under. */
const FIELD = 'slotCondition';

/**
 * Whether some conditions name a schedule or a kind of another workspace of the user.
 * @param {readonly (SlotCondition | null | undefined)[]} conditions Conditions.
 * @param {ReadonlySet<string>} own Schedules of the workspace.
 * @returns {boolean} Some.
 */
const citeOtherWorkspaces = (conditions: readonly (SlotCondition | null | undefined)[], own: ReadonlySet<string>) =>
  conditions.some((condition) => conditionKinds(condition).some((kind) => foreignSlotKindWorkspace(kind) !== null) || conditionScheduleIds(condition).some((id) => !own.has(id)));

/**
 * Slots of the schedules of the current workspace (archived ones too), loaded once, those of a day computed when first
 * asked: what the conditions of tasks and routines are evaluated on. The schedules of the other workspaces of the user
 * are loaded too when the conditions name some of them or of their kinds (always without conditions given: the
 * routines of a request are not known yet).
 * @param {readonly (SlotCondition | null | undefined)[]} [conditions] Conditions evaluated. Optional. Default = unknown.
 * @param {(own: WorkScheduleRule[]) => WorkScheduleRule[]} [change] The schedules of the workspace as a change would
 * leave them (created, changed or deleted, not saved yet). Optional. Default = as they are.
 * @returns {Promise<SlotsOn>} Slots of some schedules on a day.
 */
export async function loadSlotsOn(conditions?: readonly (SlotCondition | null | undefined)[], change?: (own: WorkScheduleRule[]) => WorkScheduleRule[]): Promise<SlotsOn> {
  const own = await prisma.workSchedule.findMany();
  const foreign = !conditions || citeOtherWorkspaces(conditions, new Set(own.map((schedule) => schedule.id))) ? await otherWorkspaceSchedules() : [];
  const rules = own.map(scheduleRule);
  return scheduleSlotsOn(
    change ? change(rules) : rules,
    foreign.map((schedule) => ({ workspaceId: schedule.workspace.id, rule: schedule.rule })),
  );
}

/**
 * Checks the schedules and kinds a condition (or several: a routine and its cases) names, of this workspace or of
 * another one of the user: they exist, and none is archived but those already there.
 * @param {readonly (SlotCondition | null | undefined)[]} conditions Conditions saved.
 * @param {readonly (SlotCondition | null | undefined)[] | true} kept Conditions already there (their archived schedules
 * and kinds stay), true: every one counts as kept (undo).
 * @returns {Promise<void>}
 */
export async function assertConditionSchedules(conditions: readonly (SlotCondition | null | undefined)[], kept: readonly (SlotCondition | null | undefined)[] | true): Promise<void> {
  const ids = [...new Set(conditions.flatMap(conditionScheduleIds))];
  const kinds = [...new Set(conditions.flatMap(conditionKinds))];
  const keep = new Set(kept === true ? [...ids, ...kinds] : kept.flatMap((condition) => [...conditionScheduleIds(condition), ...conditionKinds(condition)]));
  const here = currentWorkspaceId();
  // Schedules: of this workspace or of another one of the user.
  const schedules = ids.length ? await unscopedPrisma.workSchedule.findMany({ where: { id: { in: ids } }, select: { id: true, archivedAt: true } }) : [];
  if (schedules.length !== ids.length) throw notFound('Créneau', FIELD);
  // Kinds: those of this workspace by id (its schedules without kind: always there), those of another one by reference.
  const types = kinds.flatMap((kind) => {
    const workspaceId = foreignSlotKindWorkspace(kind) ?? here;
    const typeId = workspaceId === here ? kind : kind.slice(foreignSlotKind(workspaceId, '').length);
    return typeId === DEFAULT_SLOT_KIND ? [] : [{ kind, workspaceId, typeId }];
  });
  if (kinds.some((kind) => foreignSlotKindWorkspace(kind) === here)) throw notFound('Type de créneau', FIELD);
  const foreignWorkspaces = [...new Set(kinds.map(foreignSlotKindWorkspace).filter((id): id is string => id !== null))];
  if (foreignWorkspaces.length && (await unscopedPrisma.workspace.count({ where: { id: { in: foreignWorkspaces } } })) !== foreignWorkspaces.length) throw notFound('Espace', FIELD);
  const found = types.length
    ? await unscopedPrisma.scheduleType.findMany({ where: { OR: types.map(({ workspaceId, typeId }) => ({ id: typeId, workspaceId })) }, select: { id: true, workspaceId: true, archivedAt: true } })
    : [];
  if (found.length !== new Set(types.map(({ typeId }) => typeId)).size) throw notFound('Type de créneau', FIELD);
  // Archived ones are no longer chosen; those already there stay.
  const archivedKinds = new Set(found.filter((type) => type.archivedAt).map((type) => type.id));
  const archived = [...schedules.filter((schedule) => schedule.archivedAt).map((schedule) => schedule.id), ...types.filter(({ typeId }) => archivedKinds.has(typeId)).map(({ kind }) => kind)];
  if (archived.some((id) => !keep.has(id))) throw archivedError(FIELD);
}

/**
 * Current moment of the user: their day and time.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @returns {{ date: string, time: string }} YYYY-MM-DD and HH:MM.
 */
function userNow(utcOffset: number): { date: string; time: string } {
  const iso = new Date(Date.now() + utcOffset * 60_000).toISOString();
  return { date: dayPart(iso), time: iso.slice(11, 16) };
}

/**
 * Open tasks of the current workspace that can be done now: their condition on calendar schedules (none: any time)
 * allows the user's current moment, and no event keeps their assignees (none: « Moi ») busy, but one about the task.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @param {string | null} meId Contributor profile of the user (« Moi »).
 * @returns {Promise<string[]>} Task ids.
 */
export async function doableTaskIds(utcOffset: number, meId: string | null): Promise<string[]> {
  const now = userNow(utcOffset);
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null }, select: { id: true, slotCondition: true, assignees: { select: { id: true } } } }),
    // Archived events (and those of archived calendars) keep nobody busy.
    eventOccurrences(addDays(now.date, -1), now.date, undefined, true),
  ]);
  const conditions = new Map(tasks.map((task) => [task.id, readSlotCondition(task.slotCondition)]));
  const slotsOn = await loadSlotsOn([...conditions.values()]);
  const at = new Date();
  return tasks
    .filter(
      (task) =>
        conditionAllowsAt(conditions.get(task.id), slotsOn, now.date, now.time) &&
        !blockingEvent(events, { assigneeIds: task.assignees.map((assignee) => assignee.id), taskId: task.id }, meId, at, now.date),
    )
    .map((task) => task.id);
}
