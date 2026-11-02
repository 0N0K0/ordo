import { contributorNameSchema, handleSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import { Prisma, type Contributor } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from './icons';

/**
 * Converts a unique handle violation into a field error.
 * @param {unknown} error Caught error.
 * @returns {never}
 */
function rethrowHandleConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const message = 'Cet identifiant est déjà utilisé.';
    throw clientError('CONFLICT', message, { fields: { handle: message } });
  }
  throw error;
}

/**
 * Creates a contributor.
 * @param {object} input Contributor input.
 * @param {string} input.name Name.
 * @param {string} input.handle Unique mention handle.
 * @param {File | null} [input.avatar] Avatar file. Optional.
 * @param {string[] | null} [input.projectIds] Projects the contributor is attached to. Optional.
 * @returns {Promise<Contributor>} Created contributor.
 */
export async function createContributor(input: {
  name: string;
  handle: string;
  avatar?: File | null;
  projectIds?: string[] | null;
}): Promise<Contributor> {
  const data = parseInput(z.object({ name: contributorNameSchema, handle: handleSchema }), input);
  if (input.projectIds?.length) await assertProjects(input.projectIds);
  const iconId = input.avatar ? await storeIcon(input.avatar) : null;
  try {
    return await prisma.contributor.create({
      data: { ...data, iconId, projects: { connect: (input.projectIds ?? []).map((id) => ({ id })) } },
    });
  } catch (error) {
    await deleteOrphanIcons([iconId]);
    return rethrowHandleConflict(error);
  }
}

/**
 * Updates a contributor.
 * @param {string} id Contributor id.
 * @param {object} input Changes; omitted fields are left unchanged.
 * @param {string | null} [input.name] New name. Optional.
 * @param {string | null} [input.handle] New handle. Optional.
 * @param {File | null} [input.avatar] New avatar. Optional.
 * @param {boolean | null} [input.removeAvatar] Removes the avatar. Optional.
 * @param {string[] | null} [input.projectIds] Projects the contributor is directly attached to. Optional.
 * @returns {Promise<Contributor>} Updated contributor.
 */
export async function updateContributor(
  id: string,
  input: {
    name?: string | null;
    handle?: string | null;
    avatar?: File | null;
    removeAvatar?: boolean | null;
    projectIds?: string[] | null;
  },
): Promise<Contributor> {
  const contributor = await prisma.contributor.findUnique({ where: { id } });
  if (!contributor) throw notFound('Contributeur');
  if (input.projectIds) await assertProjects(input.projectIds);
  const data = parseInput(z.object({ name: contributorNameSchema.optional(), handle: handleSchema.optional() }), {
    name: input.name ?? undefined,
    handle: input.handle ?? undefined,
  });
  const iconId = await resolveIconUpdate(contributor.iconId, { icon: input.avatar, removeIcon: input.removeAvatar });
  try {
    const updated = await prisma.contributor.update({
      where: { id },
      data: { ...data, iconId, ...(input.projectIds && { projects: { set: input.projectIds.map((projectId) => ({ id: projectId })) } }) },
    });
    if (iconId !== undefined) await deleteOrphanIcons([contributor.iconId]);
    return updated;
  } catch (error) {
    if (iconId) await deleteOrphanIcons([iconId]);
    return rethrowHandleConflict(error);
  }
}

/**
 * Deletes a contributor; tasks simply lose this assignee.
 * @param {string} id Contributor id.
 * @returns {Promise<void>}
 */
export async function deleteContributor(id: string): Promise<void> {
  const contributor = await prisma.contributor.findUnique({ where: { id }, include: { user: { select: { id: true } } } });
  if (!contributor) throw notFound('Contributeur');
  if (contributor.user) throw clientError('BAD_USER_INPUT', 'Votre propre profil ne peut pas être supprimé.');
  await prisma.contributor.delete({ where: { id } });
  await deleteOrphanIcons([contributor.iconId]);
}

/**
 * Checks that every project exists.
 * @param {string[]} projectIds Project ids.
 * @returns {Promise<void>}
 */
async function assertProjects(projectIds: string[]): Promise<void> {
  const count = await prisma.project.count({ where: { id: { in: projectIds } } });
  if (count !== new Set(projectIds).size) throw notFound('Projet');
}

/**
 * Sets the contributors directly attached to a project. Tasks keep their assignees.
 * @param {string} projectId Project id.
 * @param {string[]} contributorIds Contributors.
 * @returns {Promise<void>}
 */
export async function setProjectContributors(projectId: string, contributorIds: string[]): Promise<void> {
  await assertProjects([projectId]);
  const count = await prisma.contributor.count({ where: { id: { in: contributorIds } } });
  if (count !== new Set(contributorIds).size) throw notFound('Contributeur');
  await prisma.project.update({
    where: { id: projectId },
    data: { contributors: { set: contributorIds.map((contributorId) => ({ id: contributorId })) } },
  });
}

/**
 * Attaches assignees to the project of their tasks when they are not attached to it yet, directly or
 * through a parent project. The app user ("Moi") belongs to every project and is never attached.
 * @param {{ projectId: string, contributorIds: string[] }[]} assignments Assignees by project.
 * @returns {Promise<void>}
 */
export async function attachAssignees(assignments: { projectId: string; contributorIds: string[] }[]): Promise<void> {
  const ids = [...new Set(assignments.flatMap((assignment) => assignment.contributorIds))];
  if (ids.length === 0) return;
  const contributors = await prisma.contributor.findMany({
    where: { id: { in: ids }, user: { is: null } },
    select: { id: true, projects: { select: { id: true } } },
  });
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(projects.map((project) => [project.id, project.parentId]));

  for (const contributor of contributors) {
    const attached = new Set(contributor.projects.map((project) => project.id));
    const connect: string[] = [];
    for (const { projectId, contributorIds } of assignments) {
      if (!contributorIds.includes(contributor.id)) continue;
      let member = false;
      for (let current: string | null | undefined = projectId; current && !member; current = parentOf.get(current)) {
        member = attached.has(current);
      }
      if (member) continue;
      attached.add(projectId);
      connect.push(projectId);
    }
    if (connect.length > 0) {
      await prisma.contributor.update({
        where: { id: contributor.id },
        data: { projects: { connect: connect.map((projectId) => ({ id: projectId })) } },
      });
    }
  }
}
