import { optionalText, requiredText } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { ProjectResource } from '../../generated/prisma/client';
import { clientError, orNotFound, parseInput } from '../../graphql/errors';
import { attachmentData } from '../core/attachments';
import { moveInList, nextPositionIn } from '../core/ordering';

const linkSchema = z.object({
  title: requiredText(200, 'Le titre est requis.'),
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  note: optionalText(1000),
});

/**
 * Next position among the resources of a project.
 * @param {string} projectId Project.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(projectId: string): Promise<number> {
  await orNotFound(prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }), 'Projet');
  return nextPositionIn('projectResource', { projectId });
}

/**
 * Adds a link to a project (mock-up, repository, specifications…).
 * @param {string} projectId Project.
 * @param {z.input<typeof linkSchema>} input Link.
 * @returns {Promise<ProjectResource>} Resource.
 */
export async function addProjectLink(projectId: string, input: z.input<typeof linkSchema>): Promise<ProjectResource> {
  const data = parseInput(linkSchema, input);
  return prisma.projectResource.create({ data: { ...data, kind: 'LINK', projectId, position: await nextPosition(projectId) } });
}

/**
 * Adds files to a project.
 * @param {string} projectId Project.
 * @param {File[]} files Files (10 MB each at most).
 * @returns {Promise<void>}
 */
export async function addProjectFiles(projectId: string, files: File[]): Promise<void> {
  let position = await nextPosition(projectId);
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) throw clientError('BAD_USER_INPUT', `« ${file.name} » est trop lourd (10 Mo maximum).`);
    const attachment = await prisma.attachment.create({ data: attachmentData(file.name, Buffer.from(await file.arrayBuffer())) });
    await prisma.projectResource.create({ data: { kind: 'FILE', title: attachment.name, attachmentId: attachment.id, projectId, position: position++ } });
  }
}

/**
 * Renames a resource and changes its note (and the address of a link).
 * @param {string} id Resource.
 * @param {{ title: string, url?: string | null, note?: string | null }} input Changes.
 * @returns {Promise<ProjectResource>} Resource.
 */
export async function updateProjectResource(id: string, input: { title: string; url?: string | null; note?: string | null }): Promise<ProjectResource> {
  const resource = await orNotFound(prisma.projectResource.findUnique({ where: { id } }), 'Ressource');
  const data =
    resource.kind === 'LINK'
      ? parseInput(linkSchema, { title: input.title, url: input.url ?? resource.url ?? '', note: input.note ?? null })
      : parseInput(linkSchema.omit({ url: true }), { title: input.title, note: input.note ?? null });
  return prisma.projectResource.update({ where: { id }, data });
}

/**
 * Removes a resource (a file is deleted with it).
 * @param {string} id Resource.
 * @returns {Promise<void>}
 */
export async function deleteProjectResource(id: string): Promise<void> {
  const resource = await orNotFound(prisma.projectResource.findUnique({ where: { id } }), 'Ressource');
  if (resource.attachmentId) await prisma.attachment.delete({ where: { id: resource.attachmentId } });
  else await prisma.projectResource.delete({ where: { id } });
}

/**
 * Moves a resource in its project's list.
 * @param {string} id Resource.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveProjectResource(id: string, index: number): Promise<void> {
  const resource = await orNotFound(prisma.projectResource.findUnique({ where: { id } }), 'Ressource');
  await moveInList('projectResource', id, index, { projectId: resource.projectId });
}
