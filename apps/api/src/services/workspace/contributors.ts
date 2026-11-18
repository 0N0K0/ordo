import { contributorNameSchema, handleSchema, lineageOf, suggestHandle } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { type Contributor } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from '../core/icons';
import { assertAllExist } from '../core/lookup';
import { assertNoneArchived, assertNotArchived } from '../core/archive';
import { lineageIds } from '../core/trees';
import { connectIds } from '../core/relations';

/** Longest handle (handleSchema). */
const HANDLE_MAX = 39;

/**
 * Handle free in the workspace for a new contributor, made from a name (suggestHandle: letters, digits and « - »,
 * none at an end) so that handleSchema takes it: `fallback` under 2 characters, then `-suffix` and a number until free
 * (« tom », « tom-2 »; with a suffix « tom », « tom-moi », « tom-moi-2 »).
 * @param {string} name Name (or user name) of the contributor.
 * @param {{ fallback?: string, suffix?: string }} [options] Handle of a name too short (default « membre ») and word added when taken (default none). Optional.
 * @returns {Promise<string>} Handle.
 */
export async function freeHandle(name: string, { fallback = 'membre', suffix }: { fallback?: string; suffix?: string } = {}): Promise<string> {
  const suggested = suggestHandle(name);
  const base = suggested.length >= 2 ? suggested : fallback;
  /**
   * Base followed by a tail, the base cut so that the whole fits (and ends with a letter or digit).
   * @param {string} tail End (« -2 »), or none.
   * @returns {string} Handle candidate.
   */
  const fit = (tail: string): string => `${base.slice(0, HANDLE_MAX - tail.length).replace(/-+$/, '')}${tail}`;
  const stem = suffix ? `-${suffix}` : '';
  const taken = new Set((await prisma.contributor.findMany({ where: { handle: { startsWith: base.slice(0, 20) } }, select: { handle: true } })).map((item) => item.handle));
  let handle = fit('');
  if (taken.has(handle) && stem) handle = fit(stem);
  for (let index = 2; taken.has(handle); index += 1) handle = fit(`${stem}-${index}`);
  return handle;
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
export async function createContributor(input: { name: string; handle: string; avatar?: File | null; projectIds?: string[] | null }): Promise<Contributor> {
  const data = parseInput(z.object({ name: contributorNameSchema, handle: handleSchema }), input);
  if (input.projectIds?.length) await assertProjects(input.projectIds);
  const iconId = input.avatar ? await storeIcon(input.avatar) : null;
  try {
    return await prisma.contributor.create({
      data: { ...data, iconId, projects: { connect: connectIds(input.projectIds ?? []) } },
    });
  } catch (error) {
    await deleteOrphanIcons([iconId]);
    return rethrowUnique(error, 'Cet identifiant est déjà utilisé.', 'handle');
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
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id } }), 'Contributeur');
  // Read only when archived.
  await assertNotArchived('contributor', id);
  if (input.projectIds) await assertProjects(input.projectIds);
  const data = parseInput(z.object({ name: contributorNameSchema.optional(), handle: handleSchema.optional() }), {
    name: input.name ?? undefined,
    handle: input.handle ?? undefined,
  });
  const iconId = await resolveIconUpdate(contributor.iconId, { icon: input.avatar, removeIcon: input.removeAvatar });
  try {
    const updated = await prisma.contributor.update({
      where: { id },
      data: { ...data, iconId, ...(input.projectIds && { projects: { set: connectIds(input.projectIds) } }) },
    });
    if (iconId !== undefined) await deleteOrphanIcons([contributor.iconId]);
    return updated;
  } catch (error) {
    if (iconId) await deleteOrphanIcons([iconId]);
    return rethrowUnique(error, 'Cet identifiant est déjà utilisé.', 'handle');
  }
}

/**
 * Deletes a contributor; tasks simply lose this assignee.
 * @param {string} id Contributor id.
 * @returns {Promise<void>}
 */
export async function deleteContributor(id: string): Promise<void> {
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id }, include: { user: { select: { id: true } } } }), 'Contributeur');
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
  await assertAllExist(prisma.project, projectIds, 'Projet');
}

/**
 * Sets the contributors directly attached to a project (not an archived project; an archived contributor is not
 * attached anew). Tasks keep their assignees.
 * @param {string} projectId Project id.
 * @param {string[]} contributorIds Contributors.
 * @returns {Promise<void>}
 */
export async function setProjectContributors(projectId: string, contributorIds: string[]): Promise<void> {
  await assertProjects([projectId]);
  await assertNotArchived('project', projectId);
  await assertAllExist(prisma.contributor, contributorIds, 'Contributeur');
  const current = await prisma.contributor.findMany({ where: { projects: { some: { id: projectId } } }, select: { id: true } });
  await assertNoneArchived('contributor', contributorIds, { keep: current.map((contributor) => contributor.id), field: 'contributorIds' });
  await prisma.project.update({
    where: { id: projectId },
    data: { contributors: { set: connectIds(contributorIds) } },
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
    // Archived ones are read only: not attached.
    where: { id: { in: ids }, user: { is: null }, archivedAt: null },
    select: { id: true, projects: { select: { id: true } } },
  });
  const projects = await prisma.project.findMany({ select: { id: true, parentId: true } });
  const byId = new Map(projects.map((project) => [project.id, project]));

  for (const contributor of contributors) {
    const attached = new Set(contributor.projects.map((project) => project.id));
    const connect: string[] = [];
    for (const { projectId, contributorIds } of assignments) {
      if (!contributorIds.includes(contributor.id)) continue;
      if (lineageOf(byId, projectId).some((project) => attached.has(project.id))) continue;
      attached.add(projectId);
      connect.push(projectId);
    }
    if (connect.length > 0) {
      await prisma.contributor.update({
        where: { id: contributor.id },
        data: { projects: { connect: connectIds(connect) } },
      });
    }
  }
}

/**
 * Checks that contributors may be chosen on an item of a project (routine, event…): "Moi", those attached to the
 * project or to one of its parents, and the ones already chosen (they stay). Anyone without project. An archived
 * contributor is not chosen anew.
 * @param {string | null} projectId Project of the item; none: no restriction.
 * @param {string[]} ids Contributors chosen.
 * @param {string[]} keep Contributors already chosen on the item.
 * @param {string} field Field of the error.
 * @param {boolean} [restoring] Undo giving back former contributors: archived ones accepted. Optional. Default = false.
 * @returns {Promise<void>}
 */
export async function assertProjectContributors(projectId: string | null, ids: string[], keep: string[], field: string, restoring = false): Promise<void> {
  const added = ids.filter((id) => !keep.includes(id));
  if (!restoring) await assertNoneArchived('contributor', added, { field });
  if (!projectId || added.length === 0) return;
  const scope = await lineageIds('project', projectId);
  const allowed = await prisma.contributor.count({ where: { id: { in: added }, OR: [{ userId: { not: null } }, { projects: { some: { id: { in: scope } } } }] } });
  if (allowed !== new Set(added).size) {
    const message = 'Seuls les contributeurs du projet peuvent être choisis.';
    throw fieldError(field, message);
  }
}
