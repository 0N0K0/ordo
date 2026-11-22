import { personNameSchema, optionalColorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Client, Prisma } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { isArchivedAs, findActive } from '../core/archive';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from '../core/icons';
import { BY_POSITION, moveInList, nextPositionIn } from '../core/ordering';
import { requirePro } from '../workspaces/workspaces';
import { findOrNotFound } from '../core/lookup';
import { releaseProjects } from './projects';
import { automated } from '../tasks/task-automation-engine';

/**
 * Loads a client or throws NOT_FOUND.
 * @param {string} id Client id.
 * @returns {Promise<Client>} Client.
 */
function findClient(id: string): Promise<Client> {
  return findOrNotFound(prisma.client, id, 'Client');
}

/**
 * Creates a client at the end of the list.
 * @param {object} input Client input.
 * @param {string} input.name Name.
 * @param {string | null} [input.color] Hex color. Optional.
 * @param {File | null} [input.icon] Icon file. Optional.
 * @returns {Promise<Client>} Created client.
 */
export async function createClient(input: { name: string; color?: string | null; icon?: File | null }): Promise<Client> {
  requirePro('clients');
  const { name, color } = parseInput(z.object({ name: personNameSchema, color: optionalColorSchema.optional() }), {
    name: input.name,
    color: input.color ?? null,
  });
  const iconId = input.icon ? await storeIcon(input.icon) : null;
  return prisma.client.create({ data: { name, color, iconId, position: await nextPositionIn('client') } });
}

/**
 * Updates the name and/or icon of a client (not an archived one: restore it first).
 * @param {string} id Client id.
 * @param {object} input Changes.
 * @param {string | null} [input.name] New name. Optional.
 * @param {string | null} [input.color] New color, null clears it. Optional.
 * @param {File | null} [input.icon] New icon file. Optional.
 * @param {boolean | null} [input.removeIcon] Removes the current icon. Optional.
 * @returns {Promise<Client>} Updated client.
 */
export async function updateClient(id: string, input: { name?: string | null; color?: string | null; icon?: File | null; removeIcon?: boolean | null }): Promise<Client> {
  const client = await findActive(prisma.client, id, 'Client');
  const { name, color } = parseInput(z.object({ name: personNameSchema.optional(), color: optionalColorSchema.optional() }), { name: input.name ?? undefined, color: input.color });
  const iconId = await resolveIconUpdate(client.iconId, input);

  const updated = await prisma.client.update({ where: { id }, data: { name, color, iconId } });
  if (iconId !== undefined) await deleteOrphanIcons([client.iconId]);
  return updated;
}

/**
 * Adds or removes a client from the favorites.
 * @param {string} id Client id.
 * @param {boolean} favorite Favorite flag.
 * @returns {Promise<Client>} Updated client.
 */
export async function setClientFavorite(id: string, favorite: boolean): Promise<Client> {
  await findClient(id);
  return prisma.client.update({ where: { id }, data: { favorite } });
}

/**
 * Writes archiving along with a client (`archivedByCascade`) its active projects, its active contacts and the active
 * contributors linked to them, or restoring those archived along with it (not those archived on their own).
 * @param {string} id Client.
 * @param {boolean} archived Archives (else restores).
 * @param {Date} now Date of the archive.
 * @returns {Prisma.PrismaPromise<unknown>[]} Writes.
 */
function alongClient(id: string, archived: boolean, now: Date): Prisma.PrismaPromise<unknown>[] {
  const data = archived ? { archivedAt: now, archivedByCascade: true } : { archivedAt: null, archivedByCascade: false };
  const touched = archived ? { archivedAt: null } : { archivedByCascade: true };
  return [
    prisma.project.updateMany({ where: { clientId: id, ...touched }, data }),
    prisma.clientContact.updateMany({ where: { clientId: id, ...touched }, data }),
    // « Moi » is never linked to a contact: never archived along.
    prisma.contributor.updateMany({ where: { contact: { is: { clientId: id } }, userId: null, ...touched }, data }),
  ];
}

/**
 * Archives or restores a client, along with its projects, its contacts and the contributors linked to them (those
 * archived with it when restoring). The contributors linked to a contact have no birthday: no routine occurrence is
 * lost.
 * @param {string} id Client id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Client>} Updated client.
 */
export async function setClientArchived(id: string, archived: boolean): Promise<Client> {
  const client = await findClient(id);
  if (isArchivedAs(client, archived)) return client;
  const now = new Date();
  const [updated] = await prisma.$transaction([prisma.client.update({ where: { id }, data: { archivedAt: archived ? now : null } }), ...alongClient(id, archived, now)]);
  return updated;
}

/**
 * Deletes a client; its projects are either deleted (their tasks, their time and their alarms outlive them, `releaseProjects`) or moved to "no
 * client".
 * @param {string} id Client id.
 * @param {boolean} deleteProjects Whether to delete the projects too.
 * @returns {Promise<void>}
 */
export const deleteClient = automated(async function deleteClient(id: string, deleteProjects: boolean): Promise<void> {
  const client = await findClient(id);
  const projects = await prisma.project.findMany({
    where: { clientId: id },
    orderBy: BY_POSITION,
    select: { id: true, iconId: true, parentId: true },
  });

  // The contributors of its contacts archived along with it stay archived, on their own.
  const contributorsAlone = prisma.contributor.updateMany({ where: { contact: { is: { clientId: id } } }, data: { archivedByCascade: false } });
  if (deleteProjects) {
    // Their tasks are not deleted: they leave the projects.
    await releaseProjects(projects.map((project) => project.id));
    await prisma.$transaction([contributorsAlone, prisma.project.deleteMany({ where: { clientId: id } }), prisma.client.delete({ where: { id } })]);
    await deleteOrphanIcons([client.iconId, ...projects.map((project) => project.iconId)]);
    return;
  }

  // Detached trees keep their structure; root projects go to the end of the "no client" list.
  const start = await nextPositionIn('project', { clientId: null, parentId: null });
  const roots = projects.filter((project) => project.parentId === null);
  await prisma.$transaction([
    contributorsAlone,
    prisma.project.updateMany({ where: { clientId: id }, data: { clientId: null, archivedByCascade: false } }),
    ...roots.map((project, index) => prisma.project.update({ where: { id: project.id }, data: { position: start + index } })),
    prisma.client.delete({ where: { id } }),
  ]);
  await deleteOrphanIcons([client.iconId]);
});

/**
 * Moves a client to a new index among the active clients.
 * @param {string} id Client id.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveClient(id: string, index: number): Promise<void> {
  await findClient(id);
  await moveInList('client', id, index, { archivedAt: null });
}
