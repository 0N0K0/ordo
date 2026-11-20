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
import { Prisma, type Contributor, type TreasuryContext, type TreasuryRelation, type WorkSchedule } from '../../generated/prisma/client';
import { scheduleRule, scheduleTypes } from '../calendar/work-schedules';
import { currentWorkspaceId } from '../../workspace-context';
import { clientError, fieldError, isUniqueConflict, orNotFound, parseField, parseInput } from '../../graphql/errors';
import { createContributor, freeHandle } from '../projects/contributors';
import { assertExists, deleteOrNotFound } from '../core/lookup';
import { assertActive } from '../core/archive';

/** Members of the team (professional workspace) or household (personal one): "Moi", then the others. */
const memberWhere = { OR: [{ teamMember: true }, { userId: { not: null } }] } satisfies Prisma.ContributorWhereInput;

/**
 * Tells whether a contributor is a member: flagged as one, or the app user ("Moi", always one).
 * @param {{ teamMember: boolean, userId: string | null }} contributor Contributor.
 * @returns {boolean} Whether they are a member.
 */
export function isMember(contributor: { teamMember: boolean; userId: string | null }): boolean {
  return contributor.teamMember || contributor.userId !== null;
}

/**
 * Members of the team or household, "Moi" first, then by name.
 * @returns {Promise<Contributor[]>} Members.
 */
export async function listMembers(): Promise<Contributor[]> {
  const members = await prisma.contributor.findMany({ where: memberWhere, orderBy: { name: 'asc' } });
  return members.sort((a, b) => Number(b.userId !== null) - Number(a.userId !== null));
}

/**
 * Adds a member: an existing contributor, or a new one created with this name (a member always is a contributor).
 * @param {{ contributorId?: string | null, name?: string | null }} input Contributor, or name of a new one.
 * @returns {Promise<Contributor>} Member.
 */
export async function addMember(input: { contributorId?: string | null; name?: string | null }): Promise<Contributor> {
  if (input.contributorId) {
    await assertExists(prisma.contributor, input.contributorId, 'Contributeur');
    // A contributor is a member or a relation, not both.
    const relation = await prisma.treasuryRelation.findFirst({ where: { contributorId: input.contributorId }, select: { name: true } });
    if (relation) throw clientError('BAD_USER_INPUT', `Ce contributeur est la relation « ${relation.name} » : il ne peut pas aussi être membre.`);
    return prisma.contributor.update({ where: { id: input.contributorId }, data: { teamMember: true } });
  }
  const name = parseField('name', personNameSchema, input.name ?? '');
  const contributor = await createContributor({ name, handle: await freeHandle(name) });
  return prisma.contributor.update({ where: { id: contributor.id }, data: { teamMember: true } });
}

/**
 * Removes a member from the team: they stay a contributor (tasks, projects, past lines kept). "Moi" stays a member.
 * @param {string} contributorId Contributor.
 * @returns {Promise<void>}
 */
export async function removeMember(contributorId: string): Promise<void> {
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id: contributorId }, select: { userId: true } }), 'Contributeur');
  if (contributor.userId) throw clientError('BAD_USER_INPUT', 'Vous êtes toujours membre de votre équipe ou de votre foyer.');
  await prisma.contributor.update({ where: { id: contributorId }, data: { teamMember: false } });
}

/**
 * Saves a context (lot 16: a kind of éphémérides « Sert de contexte au budget »): a new one is such a kind, created
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
 * possibly a contributor too (not a member).
 * @param {string | null} id Relation to change, or null to create one.
 * @param {TreasuryRelationInput} input Name and note.
 * @returns {Promise<TreasuryRelation>} Relation.
 */
export async function saveRelation(id: string | null, input: TreasuryRelationInput): Promise<TreasuryRelation> {
  const parsed = parseInput(treasuryRelationSchema, input);
  await assertActive(prisma.treasuryRelation, id, 'Relation');
  if (parsed.contributorId) {
    const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id: parsed.contributorId }, select: { teamMember: true, userId: true } }), 'Contributeur');
    if (isMember(contributor)) {
      const message = 'Ce contributeur est membre : il n’est pas une relation.';
      throw fieldError('contributorId', message);
    }
  }
  const data = { name: parsed.name, note: parsed.note, contributorId: parsed.contributorId ?? null };
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
 * @returns {Promise<void>}
 */
export async function deleteRelation(id: string): Promise<void> {
  await deleteOrNotFound(prisma.treasuryRelation, id, 'Relation');
}
