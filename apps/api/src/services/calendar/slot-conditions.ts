import {
  BIRTHDAY_SLOT_KIND,
  birthdaySlotPerson,
  personBirthdayId,
  conditionCitesBirthdays,
  conditionKinds,
  conditionScheduleIds,
  DEFAULT_SLOT_KIND,
  foreignSlotKind,
  foreignSlotKindWorkspace,
  scheduleSlotsOn,
  type SlotCondition,
  type SlotsOn,
  type WorkScheduleRule,
} from '@ordo/shared';
import { prisma, unscopedPrisma } from '../../db';
import { archivedError } from '../core/archive';
import { fieldError, notFound } from '../../graphql/errors';
import { currentWorkspaceId } from '../../workspace-context';
import { birthdays, peopleChanges, personChange, type PeopleChange } from './birthdays';
import { otherWorkspaceSchedules, scheduleRule, subscribedUnavailability } from './work-schedules';

/** Field of the input the errors of a slot condition show under. */
const FIELD = 'slotCondition';

/** A person newly cited by a slot condition who has no birthday (no birth date, or a contributor linked to a contact or to nothing). */
const NO_BIRTHDAY = 'Cette personne n’a pas d’anniversaire (aucune date de naissance) : elle ne peut pas être citée.';

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
  /**
   * Its subscription to a kind of schedules of another workspace once set « Indisponible » or back (of this
   * workspace only). Optional. Default = unchanged.
   */
  subscription?: { sourceWorkspaceId: string; typeId: string | null; unavailable: boolean };
}

/** What a change does, without its workspace (the current one): its schedules, its people. */
export type ScheduleEdit = Omit<ScheduleChange, 'workspaceId'>;

/**
 * What archiving or restoring some elements does to the slot conditions: schedules, kinds of schedules
 * and people (contributors, relations) give no moment once archived; null when none of them changes.
 * @param {Partial<Record<string, readonly string[]>>} changing Elements whose state changes, by kind (`ArchivableKind`).
 * @param {boolean} archived Archived (else restored).
 * @returns {ScheduleEdit | null} Change.
 */
export function archiveEdit(changing: Partial<Record<string, readonly string[]>>, archived: boolean): ScheduleEdit | null {
  const schedules = new Set(changing.WORK_SCHEDULE ?? []);
  const kinds = new Set(changing.SCHEDULE_TYPE ?? []);
  const people = [
    ...(changing.CONTRIBUTOR ?? []).map((id) => personChange('contributor', id, { archived })),
    ...(changing.TREASURY_RELATION ?? []).map((id) => personChange('relation', id, { archived })),
  ];
  if (!schedules.size && !kinds.size && !people.length) return null;
  return {
    ...((schedules.size > 0 || kinds.size > 0) && {
      apply: (rules: WorkScheduleRule[]) =>
        rules.map((rule) => ({
          ...rule,
          ...(schedules.has(rule.id) && { archived }),
          ...(!!rule.typeId && kinds.has(rule.typeId) && { kindArchived: archived }),
        })),
    }),
    ...(people.length > 0 && { people: peopleChanges(people) }),
  };
}

/**
 * Slots of the schedules of the current workspace (archived ones and those of archived kinds give none), loaded once, those of a day computed when first
 * asked: what the conditions of tasks and routines are evaluated on, and the slots « Indisponible ». The schedules of
 * the other workspaces of the user are loaded too when the conditions name some of them or of their kinds, or when this
 * workspace sets a kind of them « Indisponible » (their « Indisponible » is that of this workspace's subscription), and
 * the birthdays of the people of the workspace when they name some (both always without conditions given: the routines
 * of a request are not known yet).
 * @param {readonly (SlotCondition | null | undefined)[]} [conditions] Conditions evaluated. Optional. Default = unknown.
 * @param {ScheduleChange} [change] The schedules of a workspace (this one or another one) as a change would leave them.
 * Optional. Default = as they are.
 * @returns {Promise<SlotsOn>} Slots of some schedules on a day.
 */
export async function loadSlotsOn(conditions?: readonly (SlotCondition | null | undefined)[], change?: ScheduleChange): Promise<SlotsOn> {
  // With the archiving of their kinds: archived schedules and kinds give no moment.
  const [own, stored] = await Promise.all([
    prisma.workSchedule.findMany({ include: { type: { select: { archivedAt: true } } } }),
    prisma.workScheduleSubscription.findMany({ select: { sourceWorkspaceId: true, typeId: true, unavailable: true } }),
  ]);
  const here = currentWorkspaceId();
  // Its subscriptions as the change leaves them: their « Indisponible » is this workspace's.
  const set = change?.workspaceId === here ? change.subscription : undefined;
  const subscriptions = stored.map((item) => (set && item.sourceWorkspaceId === set.sourceWorkspaceId && item.typeId === set.typeId ? { ...item, unavailable: set.unavailable } : item));
  const unavailableHere = subscribedUnavailability(subscriptions);
  const [loaded, people] = await Promise.all([
    !conditions || subscriptions.some((item) => item.unavailable) || citeOtherWorkspaces(conditions, new Set(own.map((schedule) => schedule.id))) ? otherWorkspaceSchedules() : [],
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
  foreign = foreign.map((item) => ({ ...item, rule: { ...item.rule, unavailable: unavailableHere(item.workspaceId, item.rule) } }));
  return scheduleSlotsOn(apply && change.workspaceId === here ? apply(rules) : rules, foreign, people);
}

/**
 * Whether the current workspace has slots « Indisponible »: a schedule of its own (archived ones aside) or a
 * subscription to a kind of another workspace set so.
 * @returns {Promise<boolean>} It has.
 */
export async function hasUnavailableSlots(): Promise<boolean> {
  const [schedules, subscriptions] = await Promise.all([
    prisma.workSchedule.count({ where: { unavailable: true, archivedAt: null } }),
    prisma.workScheduleSubscription.count({ where: { unavailable: true } }),
  ]);
  return schedules + subscriptions > 0;
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
  const archived = [...schedules.filter((schedule) => schedule.archivedAt).map((schedule) => schedule.id), ...people.archived, ...types.filter(({ typeId }) => archivedKinds.has(typeId)).map(({ kind }) => kind)];
  if (archived.some((id) => !keep.has(id))) throw archivedError(FIELD);
  // A person without birthday is no longer chosen; one already there stays (its birthday gives no moment).
  if (people.withoutBirthday.some((id) => !keep.has(id))) throw fieldError(FIELD, NO_BIRTHDAY);
}

/**
 * People whose birthday some schedules of a condition name (`birthdaySlotId`): they must be contributors or relations
 * of this workspace (« Contributeur » / « Relation » introuvable).
 * @param {readonly string[]} ids Schedule ids and references to birthdays named.
 * @returns {Promise<{ archived: string[], withoutBirthday: string[] }>} References to the birthdays of archived people,
 * and of the people (not archived) without a birthday: no birth date, or a contributor linked to a contact or to nothing.
 */
async function birthdayPeople(ids: readonly string[]): Promise<{ archived: string[]; withoutBirthday: string[] }> {
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
  const active = named.filter((item) => !archived.has(item.id));
  const known = active.length ? new Set((await birthdays()).flatMap((birthday) => [birthday.id, ...birthday.aliases])) : new Set<string>();
  return {
    archived: named.filter((item) => archived.has(item.id)).map((item) => item.ref),
    withoutBirthday: active.filter((item) => !known.has(personBirthdayId(item.person, item.id))).map((item) => item.ref),
  };
}
