import { entityNameSchema, optionalColorSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../db';
import type { Client } from '../generated/prisma/client';
import { notFound, parseInput } from '../graphql/errors';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from './icons';
import { moveInOrder } from './ordering';

/**
 * Loads a client or throws NOT_FOUND.
 * @param {string} id Client id.
 * @returns {Promise<Client>} Client.
 */
async function findClient(id: string): Promise<Client> {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) throw notFound('Client');
  return client;
}

/**
 * Next position at the end of the client list.
 * @returns {Promise<number>} Position.
 */
async function nextClientPosition(): Promise<number> {
  const { _max } = await prisma.client.aggregate({ _max: { position: true } });
  return (_max.position ?? -1) + 1;
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
  const { name, color } = parseInput(z.object({ name: entityNameSchema, color: optionalColorSchema.optional() }), {
    name: input.name,
    color: input.color ?? null,
  });
  const iconId = input.icon ? await storeIcon(input.icon) : null;
  return prisma.client.create({ data: { name, color, iconId, position: await nextClientPosition() } });
}

/**
 * Updates the name and/or icon of a client.
 * @param {string} id Client id.
 * @param {object} input Changes.
 * @param {string | null} [input.name] New name. Optional.
 * @param {string | null} [input.color] New color, null clears it. Optional.
 * @param {File | null} [input.icon] New icon file. Optional.
 * @param {boolean | null} [input.removeIcon] Removes the current icon. Optional.
 * @returns {Promise<Client>} Updated client.
 */
export async function updateClient(
  id: string,
  input: { name?: string | null; color?: string | null; icon?: File | null; removeIcon?: boolean | null },
): Promise<Client> {
  const client = await findClient(id);
  const { name, color } = parseInput(
    z.object({ name: entityNameSchema.optional(), color: optionalColorSchema.optional() }),
    { name: input.name ?? undefined, color: input.color },
  );
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
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, iconId: true, parentId: true },
  });

  if (deleteProjects) {
    await prisma.$transaction([
      prisma.project.deleteMany({ where: { clientId: id } }),
      prisma.client.delete({ where: { id } }),
    ]);
    await deleteOrphanIcons([client.iconId, ...projects.map((project) => project.iconId)]);
    return;
  }

  // Detached trees keep their structure; root projects go to the end of the "no client" list.
  const { _max } = await prisma.project.aggregate({
    where: { clientId: null, parentId: null },
    _max: { position: true },
  });
  const start = (_max.position ?? -1) + 1;
  const roots = projects.filter((project) => project.parentId === null);
  await prisma.$transaction([
    prisma.project.updateMany({ where: { clientId: id }, data: { clientId: null, archivedByCascade: false } }),
    ...roots.map((project, index) =>
      prisma.project.update({ where: { id: project.id }, data: { position: start + index } }),
    ),
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
  const siblings = await prisma.client.findMany({
    where: { archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const order = moveInOrder(
    siblings.map((client) => client.id),
    id,
    index,
  );
  await prisma.$transaction(
    order.map((clientId, position) => prisma.client.update({ where: { id: clientId }, data: { position } })),
  );
}
