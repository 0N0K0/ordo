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
 * @returns {Promise<Contributor>} Created contributor.
 */
export async function createContributor(input: { name: string; handle: string; avatar?: File | null }): Promise<Contributor> {
  const data = parseInput(z.object({ name: contributorNameSchema, handle: handleSchema }), input);
  const iconId = input.avatar ? await storeIcon(input.avatar) : null;
  try {
    return await prisma.contributor.create({ data: { ...data, iconId } });
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
 * @returns {Promise<Contributor>} Updated contributor.
 */
export async function updateContributor(
  id: string,
  input: { name?: string | null; handle?: string | null; avatar?: File | null; removeAvatar?: boolean | null },
): Promise<Contributor> {
  const contributor = await prisma.contributor.findUnique({ where: { id } });
  if (!contributor) throw notFound('Contributeur');
  const data = parseInput(z.object({ name: contributorNameSchema.optional(), handle: handleSchema.optional() }), {
    name: input.name ?? undefined,
    handle: input.handle ?? undefined,
  });
  const iconId = await resolveIconUpdate(contributor.iconId, { icon: input.avatar, removeIcon: input.removeAvatar });
  try {
    const updated = await prisma.contributor.update({ where: { id }, data: { ...data, iconId } });
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
  const contributor = await prisma.contributor.findUnique({ where: { id } });
  if (!contributor) throw notFound('Contributeur');
  await prisma.contributor.delete({ where: { id } });
  await deleteOrphanIcons([contributor.iconId]);
}
