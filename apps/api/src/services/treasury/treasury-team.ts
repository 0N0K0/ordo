import {
  DEFAULT_SCHEDULE_DISPLAY,
  treasuryContextSchema,
  treasuryRelationSchema,
  type ContextEphemeris,
  type TreasuryContextInput,
  type TreasuryRelationInput,
  personNameSchema,
} from '@ordo/shared';
import { prisma, unscopedPrisma } from '../../db';
import { type Contributor, type TreasuryContext, type TreasuryRelation, type WorkSchedule } from '../../generated/prisma/client';
import { scheduleRule, scheduleTypes } from '../calendar/work-schedules';
import { currentWorkspaceId } from '../../workspace-context';
import { clientError, fieldError, isUniqueConflict, orNotFound, parseField, parseInput } from '../../graphql/errors';
import { createContributor, freeHandle } from '../projects/contributors';
import { personDetailsData, type PersonDetailsFields } from '../core/person-details';
import { NO_PEOPLE_SETTLER, personChange, type PeopleChangeSettler } from '../calendar/birthdays';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertActive, findActive } from '../core/archive';
import { memberWhere } from '../people/members';
import { assertNoOtherLink, contributorDetails, CONTRIBUTOR_LINK_SELECT } from '../people/contributor-links';

/**
 * Members of the team or household, "Moi" first, then by name.
 * @returns {Promise<Contributor[]>} Members.
 */
export async function listMembers(): Promise<Contributor[]> {
  const members = await prisma.contributor.findMany({ where: memberWhere, orderBy: { name: 'asc' } });
  return members.sort((a, b) => Number(b.userId !== null) - Number(a.userId !== null));
}

/**
 * Adds a member: an existing contributor not linked to a relation nor a contact, or a new one created with this name
 * (a member always is a contributor). Its own details, kept on its row, apply again.
 * @param {{ contributorId?: string | null, name?: string | null }} input Contributor, or name of a new one.
 * @param {PeopleChangeSettler} [settle] Run once checked, before it is saved (its own birthday applies). Optional. Default = none.
 * @returns {Promise<Contributor>} Member.
 */
export async function addMember(input: { contributorId?: string | null; name?: string | null }, settle: PeopleChangeSettler = NO_PEOPLE_SETTLER): Promise<Contributor> {
  if (input.contributorId) {
    await assertExists(prisma.contributor, input.contributorId, 'Contributeur');
    // A contributor is linked to a membership, a relation or a contact, one at most.
    await assertNoOtherLink(input.contributorId, 'MEMBER');
    await settle(personChange('contributor', input.contributorId, { member: true }));
    return prisma.contributor.update({ where: { id: input.contributorId }, data: { teamMember: true } });
  }
  const name = parseField('name', personNameSchema, input.name ?? '');
  const contributor = await createContributor({ name, handle: await freeHandle(name) });
  return prisma.contributor.update({ where: { id: contributor.id }, data: { teamMember: true } });
}

/**
 * Removes a member from the team: they stay a contributor (tasks, projects, past lines kept), without details (its
 * own stay stored, unused). "Moi" stays a member.
 * @param {string} contributorId Contributor.
 * @param {PeopleChangeSettler} [settle] Run once checked, before it is saved (its birthday goes). Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function removeMember(contributorId: string, settle: PeopleChangeSettler = NO_PEOPLE_SETTLER): Promise<void> {
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id: contributorId }, select: { userId: true } }), 'Contributeur');
  if (contributor.userId) throw clientError('BAD_USER_INPUT', 'Vous êtes toujours membre de votre équipe ou de votre foyer.');
  await settle(personChange('contributor', contributorId, { member: false }));
  await prisma.contributor.update({ where: { id: contributorId }, data: { teamMember: false } });
}

/**
 * Changes the details of a member of the team or household (« Moi » included): birth date, birthday reminders, email
 * addresses, phones (omitted: left unchanged). Only a member has details of its own (another contributor has those of
 * its relation or its contact); not an archived one.
 * @param {string} contributorId Member.
 * @param {PersonDetailsFields} input Details.
 * @param {PeopleChangeSettler} [settle] Run once checked when its birth date changes, before it is saved. Optional. Default = none.
 * @returns {Promise<Contributor>} Member.
 */
export async function updateMemberDetails(contributorId: string, input: PersonDetailsFields, settle: PeopleChangeSettler = NO_PEOPLE_SETTLER): Promise<Contributor> {
  const contributor = await findActive(prisma.contributor, contributorId, 'Contributeur');
  const linked = contributorDetails(await prisma.contributor.findUniqueOrThrow({ where: { id: contributorId }, select: CONTRIBUTOR_LINK_SELECT }));
  if (linked.link !== 'MEMBER') throw clientError('BAD_USER_INPUT', 'Seul un membre de l’équipe ou du foyer a ses propres coordonnées : modifiez celles de sa relation ou de son contact.');
  const data = personDetailsData(input);
  if (data.birthDate !== undefined && data.birthDate !== contributor.birthDate) await settle(personChange('contributor', contributorId, { birthDate: data.birthDate }));
  return prisma.contributor.update({ where: { id: contributorId }, data });
}

/**
 * Saves a context (a kind of éphémérides « Sert de contexte au budget »): a new one is such a kind, created
 * with this label and color (default display); a context changed changes its kind, one of this workspace only (a
 * context shared by another workspace is changed there).
 * @param {string | null} id Context to change, or null to create one.
 * @param {TreasuryContextInput} input Label and color.
 * @returns {Promise<TreasuryContext>} Context of this workspace.
 */
export async function saveContext(id: string | null, input: TreasuryContextInput): Promise<TreasuryContext> {
  const data = parseInput(treasuryContextSchema, input);
  if (!id) {
    const type = await scheduleTypes.create({ ...data, ...DEFAULT_SCHEDULE_DISPLAY, ephemeris: true, budgetContext: true, sharedContext: false });
    return prisma.treasuryContext.findFirstOrThrow({ where: { scheduleTypeId: type.id } });
  }
  const context = await orNotFound(prisma.treasuryContext.findUnique({ where: { id }, include: { scheduleType: { select: { workspaceId: true } } } }), 'Contexte');
  if (context.scheduleType.workspaceId !== currentWorkspaceId()) throw clientError('BAD_USER_INPUT', 'Ce contexte est partagé par un autre espace : modifiez-le dans son agenda.');
  await scheduleTypes.update(context.scheduleTypeId, data);
  return context;
}

/**
 * Éphémérides of the contexts of this workspace (those of their kinds, of other workspaces too for a shared one,
 * archived ones included): the periods of the contexts, what `contextPlanner` proposes from.
 * @returns {Promise<(ContextEphemeris & { schedule: WorkSchedule })[]>} Éphémérides (rule and row), with their context here.
 */
export async function contextEphemerides(): Promise<(ContextEphemeris & { schedule: WorkSchedule })[]> {
  const contexts = await prisma.treasuryContext.findMany({ select: { id: true, scheduleTypeId: true } });
  if (!contexts.length) return [];
  const contextOf = new Map(contexts.map((context) => [context.scheduleTypeId, context.id]));
  const schedules = await unscopedPrisma.workSchedule.findMany({ where: { typeId: { in: [...contextOf.keys()] }, ephemeris: true }, orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }] });
  return schedules.map((schedule) => ({ contextId: contextOf.get(schedule.typeId!)!, rule: scheduleRule(schedule), schedule }));
}

/**
 * Saves a relation: a person out of the team or household (friend, family, partner…) lines and budgets can be for,
 * possibly a contributor too (one not a member nor linked to a contact), whose details are then the relation's.
 * @param {string | null} id Relation to change, or null to create one.
 * @param {TreasuryRelationInput} input Name, note, contributor, and its details (birth date, birthday reminders, email addresses, phones: omitted, left unchanged).
 * @param {PeopleChangeSettler} [settle] Run once checked when its birth date or its contributor changes (the birthday
 * that applies to it), before it is saved. Optional. Default = none.
 * @returns {Promise<TreasuryRelation>} Relation.
 */
export async function saveRelation(
  id: string | null,
  input: Pick<TreasuryRelationInput, 'name' | 'note' | 'contributorId'> & PersonDetailsFields,
  settle: PeopleChangeSettler = NO_PEOPLE_SETTLER,
): Promise<TreasuryRelation> {
  const parsed = parseInput(treasuryRelationSchema.pick({ name: true, note: true, contributorId: true }), input);
  await assertActive(prisma.treasuryRelation, id, 'Relation');
  const current = id ? await prisma.treasuryRelation.findUnique({ where: { id }, select: { birthDate: true, contributorId: true } }) : null;
  // A contributor is linked to a membership, a relation or a contact, one at most.
  if (parsed.contributorId) await assertNoOtherLink(parsed.contributorId, 'RELATION', id);
  const data = { name: parsed.name, note: parsed.note, contributorId: parsed.contributorId ?? null, ...personDetailsData(input) };
  // Its birthday, or the one that applies to it (its contributor's), changes.
  const birthDate = data.birthDate === undefined ? (current?.birthDate ?? null) : data.birthDate;
  if (birthDate !== (current?.birthDate ?? null) || data.contributorId !== (current?.contributorId ?? null))
    await settle(personChange('relation', id ?? '', { name: data.name, birthDate, contributorId: data.contributorId }));
  try {
    return id ? await prisma.treasuryRelation.update({ where: { id }, data }) : await prisma.treasuryRelation.create({ data });
  } catch (error) {
    if (isUniqueConflict(error)) {
      const contributor = String(error.meta?.target ?? '').includes('contributorId') || JSON.stringify(error.meta ?? {}).includes('contributorId');
      const message = contributor ? 'Ce contributeur est déjà une relation.' : 'Une relation porte déjà ce nom.';
      throw fieldError(contributor ? 'contributorId' : 'name', message);
    }
    throw error;
  }
}

/**
 * Deletes a relation: its budgets go with it, its lines become the app user's.
 * @param {string} id Relation.
 * @param {PeopleChangeSettler} [settle] Run once found, before it is deleted (its birthday goes). Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function deleteRelation(id: string, settle: PeopleChangeSettler = NO_PEOPLE_SETTLER): Promise<void> {
  await assertExists(prisma.treasuryRelation, id, 'Relation');
  await settle(personChange('relation', id, null));
  await deleteOrNotFound(prisma.treasuryRelation, id, 'Relation');
}
