import { projectLinkSchema as linkSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { ProjectResource } from '../../generated/prisma/client';
import { parseInput } from '../../graphql/errors';
import { deleteAttachment, storeAttachment } from '../core/attachments';
import { moveInList, nextPositionIn } from '../core/ordering';
import { findOrNotFound } from '../core/lookup';
import { assertActive, assertNotArchived } from '../core/archive';

/**
 * Next position among the resources of a project (not an archived one).
 * @param {string} projectId Project.
 * @returns {Promise<number>} Position.
 */
async function nextPosition(projectId: string): Promise<number> {
  await assertActive(prisma.project, projectId, 'Projet');
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
    const attachment = await storeAttachment(file);
    await prisma.projectResource.create({ data: { kind: 'FILE', label: attachment.filename, attachmentId: attachment.id, projectId, position: position++ } });
  }
}

/**
 * Loads a resource whose project can still take changes (not archived).
 * @param {string} id Resource.
 * @returns {Promise<ProjectResource>} Resource.
 */
async function editableResource(id: string): Promise<ProjectResource> {
  const resource = await findOrNotFound(prisma.projectResource, id, 'Ressource');
  await assertNotArchived('project', resource.projectId);
  return resource;
}

/**
 * Renames a resource and changes its note (and the address of a link).
 * @param {string} id Resource.
 * @param {{ label: string, url?: string | null, note?: string | null }} input Changes (an omitted address or note is kept).
 * @returns {Promise<ProjectResource>} Resource.
 */
export async function updateProjectResource(id: string, input: { label: string; url?: string | null; note?: string | null }): Promise<ProjectResource> {
  const resource = await editableResource(id);
  // Omitted, the note is kept, as the address of a link (null clears it).
  const note = input.note === undefined ? resource.note : input.note;
  const data =
    resource.kind === 'LINK' ? parseInput(linkSchema, { label: input.label, url: input.url ?? resource.url ?? '', note }) : parseInput(linkSchema.omit({ url: true }), { label: input.label, note });
  return prisma.projectResource.update({ where: { id }, data });
}

/**
 * Removes a resource (a file is deleted with it).
 * @param {string} id Resource.
 * @returns {Promise<void>}
 */
export async function deleteProjectResource(id: string): Promise<void> {
  const resource = await editableResource(id);
  // The resource goes with its file (cascade).
  if (resource.attachmentId) await deleteAttachment(resource.attachmentId);
  else await prisma.projectResource.delete({ where: { id } });
}

/**
 * Moves a resource in its project's list.
 * @param {string} id Resource.
 * @param {number} index Target index.
 * @returns {Promise<void>}
 */
export async function moveProjectResource(id: string, index: number): Promise<void> {
  const resource = await editableResource(id);
  await moveInList('projectResource', id, index, { projectId: resource.projectId });
}
