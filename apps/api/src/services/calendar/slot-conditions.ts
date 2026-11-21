import {
  addDays,
  BIRTHDAY_SLOT_KIND,
  birthdaySlotPerson,
  blockingEvent,
  conditionAllowsAt,
  conditionCitesBirthdays,
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
import { birthdays, personChange, type PeopleChange } from './birthdays';
import { eventOccurrences } from './calendar-events';
import { otherWorkspaceSchedules, scheduleRule } from './work-schedules';
import { effectiveTaskOf, loadTaskInheritance } from '../tasks/task-inheritance';

/** Field of the input the errors of a slot condition show under. */
const FIELD = 'slotCondition';

/**
 * Whether some conditions name a schedule or a kind of another workspace of the user.
 * @param {readonly (SlotCondition | null | undefined)[]} conditions Conditions.
 * @param {ReadonlySet<string>} own Schedules of the workspace.
 * @returns {boolean} Some.
 */
const citeOtherWorkspaces = (conditions: readonly (SlotCondition | null | undefined)[], own: ReadonlySet<string>) =>
  conditions.some(
    (condition) => conditionKinds(condition).some((kind) => foreignSlotKindWorkspace(kind) !== null) || conditionScheduleIds(condition).some((id) => !own.has(id) && birthdaySlotPerson(id) === null),
  );

/**
 * Schedules of a workspace as a change would leave them (created, changed, archived or deleted, not saved yet), or its
 * people (a birthday changed, moved or gone).
 */
export interface ScheduleChange {
  /** Workspace of the schedules changed (this one, or another one of the user whose schedules are named here). */
  workspaceId: string;
  /** Its schedules once changed. Optional. Default = unchanged. */
  apply?: (rules: WorkScheduleRule[]) => WorkScheduleRule[];
  /** Its people once changed (their birthdays: of this workspace only). Optional. Default = unchanged. */
  people?: PeopleChange;
}

/** What a change does, without its workspace (the current one): its schedules, its people. */
export type ScheduleEdit = Omit<ScheduleChange, 'workspaceId'>;

/**
 * What archiving or restoring some elements does to the slot conditions: schedules, kinds of schedules
 * and people give no moment once archived; null for the other kinds.
 * @param {string} kind Kind of the elements (`ArchivableKind`).
 * @param {readonly string[]} ids Elements.
 * @param {boolean} archived Archived (else restored).
 * @returns {ScheduleEdit | null} Change.
 */
export function archiveEdit(kind: string, ids: readonly string[], archived: boolean): ScheduleEdit | null {
  const chosen = new Set(ids);
  const people = (person: 'contributor' | 'relation'): PeopleChange => (rows) => ids.reduce((all, id) => personChange(person, id, { archived })(all), rows);
  switch (kind) {
    case 'WORK_SCHEDULE':
      return { apply: (rules) => rules.map((rule) => (chosen.has(rule.id) ? { ...rule, archived } : rule)) };
    case 'SCHEDULE_TYPE':
      return { apply: (rules) => rules.map((rule) => (rule.typeId && chosen.has(rule.typeId) ? { ...rule, kindArchived: archived } : rule)) };
    case 'CONTRIBUTOR':
      return { people: people('contributor') };
    case 'TREASURY_RELATION':
      return { people: people('relation') };
    default:
      return null;
  }
}

/**
 * Slots of the schedules of the current workspace (archived ones and those of archived kinds give none), loaded once, those of a day computed when first
 * asked: what the conditions of tasks and routines are evaluated on. The schedules of the other workspaces of the user
 * are loaded too when the conditions name some of them or of their kinds, and the birthdays of the people of the
 * workspace when they name some (both always without conditions given: the routines of a request are not
 * known yet).
 * @param {readonly (SlotCondition | null | undefined)[]} [conditions] Conditions evaluated. Optional. Default = unknown.
 * @param {ScheduleChange} [change] The schedules of a workspace (this one or another one) as a change would leave them.
 * Optional. Default = as they are.
 * @returns {Promise<SlotsOn>} Slots of some schedules on a day.
 */
export async function loadSlotsOn(conditions?: readonly (SlotCondition | null | undefined)[], change?: ScheduleChange): Promise<SlotsOn> {
  // With the archiving of their kinds: archived schedules and kinds give no moment.
  const own = await prisma.workSchedule.findMany({ include: { type: { select: { archivedAt: true } } } });
  const here = currentWorkspaceId();
  const [loaded, people] = await Promise.all([
    !conditions || citeOtherWorkspaces(conditions, new Set(own.map((schedule) => schedule.id))) ? otherWorkspaceSchedules() : [],
    // Archived people flagged (no moment); a change of the people is one of this workspace.
    !conditions || conditions.some(conditionCitesBirthdays) ? birthdays({ change: change?.workspaceId === here ? change.people : undefined }) : [],
  ]);
  const rules = own.map(scheduleRule);
  let foreign = loaded.map((schedule) => ({ workspaceId: schedule.workspace.id, rule: schedule.rule }));
  const apply = change?.apply;
  // Those of another workspace changed: as the change leaves them.
  if (change && apply && change.workspaceId !== here && loaded.length) {
    const changed = apply(foreign.filter((item) => item.workspaceId === change.workspaceId).map((item) => item.rule));
    foreign = [...foreign.filter((item) => item.workspaceId !== change.workspaceId), ...changed.map((rule) => ({ workspaceId: change.workspaceId, rule }))];
  }
  return scheduleSlotsOn(apply && change.workspaceId === here ? apply(rules) : rules, foreign, people);
}

/**
 * Checks the schedules and kinds a condition (or several: a routine and its cases) names, of this workspace or of
 * another one of the user, and the people whose birthday it names (of this workspace): they exist, and none
 * is archived but those already there.
 * @param {readonly (SlotCondition | null | undefined)[]} conditions Conditions saved.
 * @param {readonly (SlotCondition | null | undefined)[] | true} kept Conditions already there (their archived schedules
 * and kinds stay), true: every one counts as kept (undo).
 * @returns {Promise<void>}
 */
export async function assertConditionSchedules(conditions: readonly (SlotCondition | null | undefined)[], kept: readonly (SlotCondition | null | undefined)[] | true): Promise<void> {
  const named = [...new Set(conditions.flatMap(conditionScheduleIds))];
  const ids = named.filter((id) => birthdaySlotPerson(id) === null);
  const kinds = [...new Set(conditions.flatMap(conditionKinds))];
  const keep = new Set(kept === true ? [...named, ...kinds] : kept.flatMap((condition) => [...conditionScheduleIds(condition), ...conditionKinds(condition)]));
  const here = currentWorkspaceId();
  // Schedules: of this workspace or of another one of the user.
  const schedules = ids.length ? await unscopedPrisma.workSchedule.findMany({ where: { id: { in: ids } }, select: { id: true, archivedAt: true } }) : [];
  if (schedules.length !== ids.length) throw notFound('Créneau', FIELD);
  const people = await birthdayPeople(named);
  // Kinds: those of this workspace by id (its schedules without kind and its birthdays: always there), those of another
  // one by reference (birthdays are of this workspace only).
  const types = kinds.flatMap((kind) => {
    const workspaceId = foreignSlotKindWorkspace(kind) ?? here;
    const typeId = workspaceId === here ? kind : kind.slice(foreignSlotKind(workspaceId, '').length);
    return typeId === DEFAULT_SLOT_KIND || kind === BIRTHDAY_SLOT_KIND ? [] : [{ kind, workspaceId, typeId }];
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
  const archived = [...schedules.filter((schedule) => schedule.archivedAt).map((schedule) => schedule.id), ...people, ...types.filter(({ typeId }) => archivedKinds.has(typeId)).map(({ kind }) => kind)];
  if (archived.some((id) => !keep.has(id))) throw archivedError(FIELD);
}

/**
 * People whose birthday some schedules of a condition name (`birthdaySlotId`): they must be contributors or relations
 * of this workspace (« Contributeur » / « Relation » introuvable). A person without birth date is accepted (its birthday
 * allows no moment, as a kind without schedule).
 * @param {readonly string[]} ids Schedule ids and references to birthdays named.
 * @returns {Promise<string[]>} References to the birthdays of archived people.
 */
async function birthdayPeople(ids: readonly string[]): Promise<string[]> {
  const named = ids.flatMap((id) => {
    const person = birthdaySlotPerson(id);
    return person ? [{ ...person, ref: id }] : [];
  });
  const of = (person: 'contributor' | 'relation') => named.filter((item) => item.person === person);
  const select = { id: true, archivedAt: true } as const;
  const [contributors, relations] = await Promise.all([
    of('contributor').length ? prisma.contributor.findMany({ where: { id: { in: of('contributor').map((item) => item.id) } }, select }) : [],
    of('relation').length ? prisma.treasuryRelation.findMany({ where: { id: { in: of('relation').map((item) => item.id) } }, select }) : [],
  ]);
  if (contributors.length !== of('contributor').length) throw notFound('Contributeur', FIELD);
  if (relations.length !== of('relation').length) throw notFound('Relation', FIELD);
  const archived = new Set([...contributors, ...relations].filter((person) => person.archivedAt).map((person) => person.id));
  return named.filter((item) => archived.has(item.id)).map((item) => item.ref);
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
 * Open tasks of the current workspace that can be done now: their « Ouverture » (as they go:
 * `effectiveTask`) is not after the user's day, their condition on calendar schedules (their own or inherited; none:
 * any time) allows the user's current moment, and no event keeps their assignees (their own or inherited; none:
 * « Moi ») busy, but one about the task.
 * @param {number} utcOffset User's offset from UTC in minutes.
 * @param {string | null} meId Contributor profile of the user (« Moi »).
 * @returns {Promise<string[]>} Task ids.
 */
export async function doableTaskIds(utcOffset: number, meId: string | null): Promise<string[]> {
  const now = userNow(utcOffset);
  const [open, inheritance, events] = await Promise.all([
    prisma.task.findMany({ where: { closedAt: null, archivedAt: null }, select: { id: true } }),
    loadTaskInheritance(),
    // Archived events (and those of archived calendars) keep nobody busy.
    eventOccurrences(addDays(now.date, -1), now.date, undefined, true),
  ]);
  const tasks = open.map((task) => effectiveTaskOf(inheritance, task.id)).filter((task) => task !== null);
  const conditions = new Map(tasks.map((task) => [task.id, readSlotCondition(task.slotCondition)]));
  const slotsOn = await loadSlotsOn([...conditions.values()]);
  const at = new Date();
  return tasks
    .filter(
      (task) =>
        // Not to be done before its « Ouverture ».
        (task.minDate ?? now.date) <= now.date &&
        conditionAllowsAt(conditions.get(task.id), slotsOn, now.date, now.time) &&
        !blockingEvent(events, { assigneeIds: [...task.assigneeIds], taskId: task.id }, meId, at, now.date),
    )
    .map((task) => task.id);
}
