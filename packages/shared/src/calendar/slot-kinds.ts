/** Kind of the slots without kind of a workspace (its working hours, « Travail »). */
export const DEFAULT_SLOT_KIND = 'default';

/** Start of a reference to a kind of slots of another workspace. */
const FOREIGN_PREFIX = 'ws:';

/**
 * Kind of slots of the workspace: its id, or the one of its slots without kind.
 * @param {string | null | undefined} typeId Kind; none: the slots without kind.
 * @returns {string} Reference.
 */
export const ownSlotKind = (typeId: string | null | undefined) => typeId ?? DEFAULT_SLOT_KIND;

/**
 * Kind of slots of another workspace, shown or named in this one (a subscription, a slot condition).
 * @param {string} workspaceId Workspace of the slots.
 * @param {string | null | undefined} typeId Kind; none: its slots without kind.
 * @returns {string} Reference.
 */
export const foreignSlotKind = (workspaceId: string, typeId: string | null | undefined) => `${FOREIGN_PREFIX}${workspaceId}:${typeId ?? DEFAULT_SLOT_KIND}`;

/**
 * Workspace of a kind of slots of another workspace (`foreignSlotKind`); null for a kind of this workspace.
 * @param {string} kind Reference.
 * @returns {string | null} Workspace id.
 */
export function foreignSlotKindWorkspace(kind: string): string | null {
  if (!kind.startsWith(FOREIGN_PREFIX)) return null;
  const end = kind.indexOf(':', FOREIGN_PREFIX.length);
  return end > FOREIGN_PREFIX.length ? kind.slice(FOREIGN_PREFIX.length, end) : null;
}

/**
 * Kind of a schedule, as a slot condition names it: of this workspace (no workspace given), or of another one. An
 * éphéméride without kind has none (the default kind is the working hours, créneaux only, lot 16).
 * @param {{ typeId?: string | null, ephemeris?: boolean }} schedule Schedule.
 * @param {string | null} [workspaceId] Workspace of a schedule of another workspace. Optional. Default = this one.
 * @returns {string | null} Reference, or none.
 */
export function scheduleSlotKind(schedule: { typeId?: string | null; ephemeris?: boolean }, workspaceId: string | null = null): string | null {
  if (!schedule.typeId && schedule.ephemeris) return null;
  return workspaceId ? foreignSlotKind(workspaceId, schedule.typeId) : ownSlotKind(schedule.typeId);
}

/**
 * Kind of every birthday (lot 16c, decision FP): a slot condition names it as a kind (« Anniversaires (éphéméride) »),
 * the birthdays of the people added later too. Never a kind of créneaux, so never in the free time.
 */
export const BIRTHDAY_SLOT_KIND = 'birthday';
/** Name of the kind of every birthday in a slot condition. */
export const BIRTHDAY_SLOT_KIND_LABEL = 'Anniversaires';

/** Start of the reference to the birthday of a person, as a slot condition names it among the schedules. */
const BIRTHDAY_PREFIX = 'birthday:';
/** Form of a reference to a birthday: its person and its id. */
const BIRTHDAY_PATTERN = /^birthday:(contributor|relation):(.+)$/;

/** Person a birthday is derived from: a contributor (member of the team or household included) or a relation. */
export type BirthdayPerson = 'contributor' | 'relation';

/**
 * Id of the birthday of a person (`contributor:<id>`, `relation:<id>`), as the query `birthdays` gives it.
 * @param {BirthdayPerson} person Contributor or relation.
 * @param {string} id Its id.
 * @returns {string} Birthday id.
 */
export const personBirthdayId = (person: BirthdayPerson, id: string) => `${person}:${id}`;

/**
 * Reference to the birthday of a person among the schedules of a slot condition (`birthday:contributor:<id>`,
 * `birthday:relation:<id>`): stable, derived from the person (a birthday has no row of its own).
 * @param {string} birthdayId Birthday id (`personBirthdayId`).
 * @returns {string} Reference.
 */
export const birthdaySlotId = (birthdayId: string) => `${BIRTHDAY_PREFIX}${birthdayId}`;

/**
 * Person of a reference to a birthday among the schedules of a slot condition; null for a schedule.
 * @param {string} scheduleId Schedule id or reference to a birthday.
 * @returns {{ person: BirthdayPerson, id: string } | null} Person.
 */
export function birthdaySlotPerson(scheduleId: string): { person: BirthdayPerson; id: string } | null {
  const match = BIRTHDAY_PATTERN.exec(scheduleId);
  return match ? { person: match[1] as BirthdayPerson, id: match[2] } : null;
}
