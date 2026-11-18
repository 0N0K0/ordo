import { personNameSchema, optionalColorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Client } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { ARCHIVED_MESSAGE } from '../core/archive';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from '../core/icons';
import { BY_POSITION, moveInList, nextPositionIn } from '../core/ordering';
import { requirePro } from './workspaces';

/**
 * Loads a client or throws NOT_FOUND.
 * @param {string} id Client id.
 * @returns {Promise<Client>} Client.
 */
async function findClient(id: string): Promise<Client> {
  const client = await orNotFound(prisma.client.findUnique({ where: { id } }), 'Client');
  return client;
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
  const client = await findClient(id);
  if (client.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
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
 * Archives or restores a client, along with the projects archived with it.
 * @param {string} id Client id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Client>} Updated client.
 */
export async function setClientArchived(id: string, archived: boolean): Promise<Client> {
  const client = await findClient(id);
  if ((client.archivedAt !== null) === archived) return client;

  if (archived) {
    const now = new Date();
    const [, updated] = await prisma.$transaction([
      prisma.project.updateMany({
        where: { clientId: id, archivedAt: null },
        data: { archivedAt: now, archivedByCascade: true },
      }),
      prisma.client.update({ where: { id }, data: { archivedAt: now } }),
    ]);
    return updated;
  }

  const [, updated] = await prisma.$transaction([
    prisma.project.updateMany({
      where: { clientId: id, archivedByCascade: true },
      data: { archivedAt: null, archivedByCascade: false },
    }),
    prisma.client.update({ where: { id }, data: { archivedAt: null } }),
  ]);
  return updated;
}

/**
 * Deletes a client; its projects are either deleted or moved to "no client".
 * @param {string} id Client id.
 * @param {boolean} deleteProjects Whether to delete the projects too.
 * @returns {Promise<void>}
 */
export async function deleteClient(id: string, deleteProjects: boolean): Promise<void> {
  const client = await findClient(id);
  const projects = await prisma.project.findMany({
    where: { clientId: id },
    orderBy: BY_POSITION,
    select: { id: true, iconId: true, parentId: true },
  });

  if (deleteProjects) {
    await prisma.$transaction([prisma.project.deleteMany({ where: { clientId: id } }), prisma.client.delete({ where: { id } })]);
    await deleteOrphanIcons([client.iconId, ...projects.map((project) => project.iconId)]);
    return;
  }

  // Detached trees keep their structure; root projects go to the end of the "no client" list.
  const start = await nextPositionIn('project', { clientId: null, parentId: null });
  const roots = projects.filter((project) => project.parentId === null);
  await prisma.$transaction([
    prisma.project.updateMany({ where: { clientId: id }, data: { clientId: null, archivedByCascade: false } }),
    ...roots.map((project, index) => prisma.project.update({ where: { id: project.id }, data: { position: start + index } })),
    prisma.client.delete({ where: { id } }),
  ]);
  await deleteOrphanIcons([client.iconId]);
}

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
