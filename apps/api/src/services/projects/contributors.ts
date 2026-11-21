import { HANDLE_MAX, handleSchema, lineageOf, personNameSchema, suggestHandle } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import { type Contributor } from '../../generated/prisma/client';
import { clientError, fieldError, orNotFound, parseInput, rethrowUnique } from '../../graphql/errors';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from '../core/icons';
import { activeIds, assertActive, assertNoneArchived, findActive } from '../core/archive';
import { lineageIds } from '../core/trees';
import { connectIds } from '../core/relations';
import { NO_PEOPLE_SETTLER, personChange, type PeopleChangeSettler } from '../calendar/birthdays';
import { contributorLink } from '../people/contributor-links';
import type { ContributorLinkInput } from '@ordo/shared';

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
 * Creates a contributor. It has no details of its own: they come from what it is linked to (a membership of the team
 * or household, a relation, a contact, or nothing).
 * @param {object} input Contributor input.
 * @param {string} input.name Name.
 * @param {string} input.handle Unique mention handle.
 * @param {File | null} [input.avatar] Avatar file. Optional.
 * @param {string[] | null} [input.projectIds] Projects the contributor is attached to. Optional.
 * @param {ContributorLinkInput | null} [input.link] What its details come from. Optional. Default = nothing.
 * @param {PeopleChangeSettler} [settle] Run once checked when its link changes the birthdays, before it is saved. Optional. Default = none.
 * @returns {Promise<Contributor>} Created contributor.
 */
export async function createContributor(
  input: { name: string; handle: string; avatar?: File | null; projectIds?: string[] | null; link?: ContributorLinkInput | null },
  settle: PeopleChangeSettler = NO_PEOPLE_SETTLER,
): Promise<Contributor> {
  const data = parseInput(z.object({ name: personNameSchema, handle: handleSchema }), input);
  if (input.projectIds?.length) await assertProjects(input.projectIds);
  const link = input.link ? await contributorLink(null, input.link, settle) : null;
  const iconId = input.avatar ? await storeIcon(input.avatar) : null;
  let created: Contributor;
  try {
    created = await prisma.contributor.create({
      data: { ...data, iconId, projects: { connect: connectIds(input.projectIds ?? []) } },
    });
  } catch (error) {
    await deleteOrphanIcons([iconId]);
    return rethrowUnique(error, 'Cet identifiant est déjà utilisé.', 'handle');
  }
  if (!link) return created;
  await link(created.id);
  return prisma.contributor.findUniqueOrThrow({ where: { id: created.id } });
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
 * @param {ContributorLinkInput | null} [input.link] What its details come from, replacing the link it had. Optional.
 * @param {PeopleChangeSettler} [settle] Run once checked when its link changes the birthdays, before it is saved (the
 * occurrences of routines naming birthdays it makes disappear). Optional. Default = none.
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
    link?: ContributorLinkInput | null;
  },
  settle: PeopleChangeSettler = NO_PEOPLE_SETTLER,
): Promise<Contributor> {
  // Read only when archived.
  const contributor = await findActive(prisma.contributor, id, 'Contributeur');
  if (input.projectIds) await assertProjects(input.projectIds, id);
  const data = parseInput(z.object({ name: personNameSchema.optional(), handle: handleSchema.optional() }), {
    name: input.name ?? undefined,
    handle: input.handle ?? undefined,
  });
  const link = input.link ? await contributorLink(contributor, input.link, settle) : null;
  const iconId = await resolveIconUpdate(contributor.iconId, { icon: input.avatar, removeIcon: input.removeAvatar });
  let updated: Contributor;
  try {
    updated = await prisma.contributor.update({
      where: { id },
      data: { ...data, iconId, ...(input.projectIds && { projects: { set: connectIds(input.projectIds) } }) },
    });
    if (iconId !== undefined) await deleteOrphanIcons([contributor.iconId]);
  } catch (error) {
    if (iconId) await deleteOrphanIcons([iconId]);
    return rethrowUnique(error, 'Cet identifiant est déjà utilisé.', 'handle');
  }
  if (!link) return updated;
  await link(id);
  return prisma.contributor.findUniqueOrThrow({ where: { id } });
}

/**
 * Deletes a contributor; tasks simply lose this assignee.
 * @param {string} id Contributor id.
 * @param {PeopleChangeSettler} [settle] Run once checked, before it is deleted (its birthday goes). Optional. Default = none.
 * @returns {Promise<void>}
 */
export async function deleteContributor(id: string, settle: PeopleChangeSettler = NO_PEOPLE_SETTLER): Promise<void> {
  const contributor = await orNotFound(prisma.contributor.findUnique({ where: { id }, include: { user: { select: { id: true } } } }), 'Contributeur');
  if (contributor.user) throw clientError('BAD_USER_INPUT', 'Votre propre profil ne peut pas être supprimé.');
  await settle(personChange('contributor', id, null));
  await prisma.contributor.delete({ where: { id } });
  await deleteOrphanIcons([contributor.iconId]);
}

/**
 * Checks that every project exists and is not archived (those the contributor is already attached to stay valid).
 * @param {string[]} projectIds Project ids.
 * @param {string | null} [contributorId] Contributor updated: its current projects are kept. Optional.
 * @returns {Promise<void>}
 */
async function assertProjects(projectIds: string[], contributorId: string | null = null): Promise<void> {
  const keep = contributorId ? (await prisma.project.findMany({ where: { contributors: { some: { id: contributorId } } }, select: { id: true } })).map((project) => project.id) : [];
  await activeIds(prisma.project, projectIds, 'Projet', { keep, field: 'projectIds' });
}

/**
 * Sets the contributors directly attached to a project (not an archived project; an archived contributor is not
 * attached anew). Tasks keep their assignees.
 * @param {string} projectId Project id.
 * @param {string[]} contributorIds Contributors.
 * @returns {Promise<void>}
 */
export async function setProjectContributors(projectId: string, contributorIds: string[]): Promise<void> {
  await assertActive(prisma.project, projectId, 'Projet');
  const current = await prisma.contributor.findMany({ where: { projects: { some: { id: projectId } } }, select: { id: true } });
  await activeIds(prisma.contributor, contributorIds, 'Contributeur', { keep: current.map((contributor) => contributor.id), field: 'contributorIds' });
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
 * People of an item (routine, event) that changed project follow it: those not attached to the new project yet,
 * directly or through a parent, are attached to it (`attachAssignees`), as the assignees of a transferred task.
 * Nothing when the project is unchanged or removed.
 * @param {string | null} before Project of the item before the change.
 * @param {string | null} after Project of the item after the change.
 * @param {string[]} contributorIds Assignees (or contributors) of the item.
 * @returns {Promise<void>}
 */
export async function followProject(before: string | null, after: string | null, contributorIds: string[]): Promise<void> {
  if (after && after !== before) await attachAssignees([{ projectId: after, contributorIds }]);
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
