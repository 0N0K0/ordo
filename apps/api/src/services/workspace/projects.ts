import { dateSchema, descriptionSchema, mapById, MAX_PROJECT_DEPTH, optionalColorSchema, parseOptionalDay, projectLabelSchema } from '@ordo/shared';
import { z } from 'zod';
import { prisma } from '../../db';
import type { Prisma, Project } from '../../generated/prisma/client';
import { clientError, fieldError, notFound, orNotFound, parseInput } from '../../graphql/errors';
import { ARCHIVED_MESSAGE } from '../core/archive';
import { deleteOrphanIcons, resolveIconUpdate, storeIcon } from '../core/icons';
import { BY_POSITION, moveInOrder, nextPositionIn } from '../core/ordering';
import { assertAllExist, assertExists } from '../core/lookup';
import { assertDateRange } from '../core/date-range';
import { connectIds } from '../core/relations';

/** Minimal project shape used to reason about the tree. */
interface TreeProject {
  id: string;
  parentId: string | null;
  clientId: string | null;
  archivedAt: Date | null;
  archivedByCascade: boolean;
  iconId: string | null;
}

/** In-memory view of every project (a single user's data stays small). */
class ProjectTree {
  readonly byId: Map<string, TreeProject>;
  private readonly childrenOf = new Map<string | null, TreeProject[]>();

  /**
   * @param {TreeProject[]} projects Every project.
   */
  constructor(projects: TreeProject[]) {
    this.byId = mapById(projects);
    for (const project of projects) {
      const siblings = this.childrenOf.get(project.parentId) ?? [];
      siblings.push(project);
      this.childrenOf.set(project.parentId, siblings);
    }
  }

  /**
   * Loads the tree from the database.
   * @returns {Promise<ProjectTree>} Tree.
   */
  static async load(): Promise<ProjectTree> {
    return new ProjectTree(
      await prisma.project.findMany({
        select: { id: true, parentId: true, clientId: true, archivedAt: true, archivedByCascade: true, iconId: true },
      }),
    );
  }

  /**
   * Ancestors of a project, closest first.
   * @param {string} id Project id.
   * @returns {TreeProject[]} Ancestors.
   */
  ancestors(id: string): TreeProject[] {
    const result: TreeProject[] = [];
    let parentId = this.byId.get(id)?.parentId ?? null;
    while (parentId) {
      const parent = this.byId.get(parentId);
      if (!parent) break;
      result.push(parent);
      parentId = parent.parentId;
    }
    return result;
  }

  /**
   * Level of a project: 1 for a root project.
   * @param {string} id Project id.
   * @returns {number} Depth.
   */
  depth(id: string): number {
    return this.ancestors(id).length + 1;
  }

  /**
   * Every descendant of a project.
   * @param {string} id Project id.
   * @returns {TreeProject[]} Descendants.
   */
  descendants(id: string): TreeProject[] {
    const result: TreeProject[] = [];
    const queue = [...(this.childrenOf.get(id) ?? [])];
    while (queue.length > 0) {
      const project = queue.shift()!;
      result.push(project);
      queue.push(...(this.childrenOf.get(project.id) ?? []));
    }
    return result;
  }

  /**
   * Number of levels of the sub-tree rooted at a project (1 without children).
   * @param {string} id Project id.
   * @returns {number} Height.
   */
  height(id: string): number {
    const children = this.childrenOf.get(id) ?? [];
    return 1 + Math.max(0, ...children.map((child) => this.height(child.id)));
  }
}

/**
 * Loads a project or throws NOT_FOUND.
 * @param {string} id Project id.
 * @returns {Promise<Project>} Project.
 */
async function findProject(id: string): Promise<Project> {
  const project = await orNotFound(prisma.project.findUnique({ where: { id } }), 'Projet');
  return project;
}

/**
 * Checks that a project can be attached to the given client.
 * @param {string | null} clientId Target client, or null for "no client".
 * @returns {Promise<void>}
 */
async function assertAttachableClient(clientId: string | null): Promise<void> {
  if (!clientId) return;
  const client = await orNotFound(prisma.client.findUnique({ where: { id: clientId }, select: { archivedAt: true } }), 'Client');
  if (client.archivedAt) {
    const message = 'Ce client est archivé.';
    throw fieldError('clientId', message);
  }
}

/**
 * Checks that a project (or a new one) can be placed under a parent, and returns the inherited client.
 * @param {ProjectTree} tree Project tree.
 * @param {string} parentId Target parent.
 * @param {string | null} movedId Moved project, or null for a new project.
 * @returns {string | null} Client of the parent.
 */
function assertParent(tree: ProjectTree, parentId: string, movedId: string | null): string | null {
  const parent = tree.byId.get(parentId);
  if (!parent) throw notFound('Projet parent');
  if (parent.archivedAt) throw fieldError('parentId', 'Ce projet est archivé.');
  if (movedId && (parentId === movedId || tree.ancestors(parentId).some((ancestor) => ancestor.id === movedId))) {
    throw fieldError('parentId', 'Un projet ne peut pas être placé dans l’un de ses sous-projets.');
  }
  const height = movedId ? tree.height(movedId) : 1;
  if (tree.depth(parentId) + height > MAX_PROJECT_DEPTH) {
    throw fieldError('parentId', `Les projets sont limités à ${MAX_PROJECT_DEPTH} niveaux.`);
  }
  return parent.clientId;
}

/**
 * Checks that every category exists.
 * @param {string[]} categoryIds Category ids.
 * @returns {Promise<void>}
 */
async function assertCategories(categoryIds: string[]): Promise<void> {
  await assertAllExist(prisma.projectCategory, categoryIds, 'Catégorie');
}

/**
 * Siblings filter: same parent, or same client for root projects.
 * @param {string | null} parentId Parent project.
 * @param {string | null} clientId Client (used for root projects only).
 * @returns {Prisma.ProjectWhereInput} Where clause.
 */
function siblingsWhere(parentId: string | null, clientId: string | null): Prisma.ProjectWhereInput {
  return parentId ? { parentId } : { parentId: null, clientId };
}

/**
 * Next position at the end of a sibling list.
 * @param {string | null} parentId Parent project.
 * @param {string | null} clientId Client (for root projects).
 * @returns {Promise<number>} Position.
 */
async function nextPosition(parentId: string | null, clientId: string | null): Promise<number> {
  return nextPositionIn('project', siblingsWhere(parentId, clientId));
}

interface ProjectDetailsInput {
  description?: string | null;
  statusId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  color?: string | null;
}

const detailsSchema = z.object({
  description: descriptionSchema.optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  color: optionalColorSchema.optional(),
});

/**
 * Validates the optional details of a project (undefined: unchanged, null: cleared).
 * @param {ProjectDetailsInput} input Raw details.
 * @param {{ startDate: Date | null, endDate: Date | null }} [current] Current dates, to check the range on update. Optional.
 * @returns {Promise<object>} Prisma data for the details.
 */
async function parseDetails(input: ProjectDetailsInput, current?: { startDate: Date | null; endDate: Date | null }) {
  const details = parseInput(detailsSchema, {
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    color: input.color,
  });

  assertDateRange(details, current);

  await assertExists(prisma.projectStatus, input.statusId, 'Statut');

  return {
    description: details.description,
    color: details.color,
    statusId: input.statusId,
    startDate: parseOptionalDay(details.startDate),
    endDate: parseOptionalDay(details.endDate),
  };
}

/**
 * Creates a project at the end of its sibling list. A sub-project inherits the client of its parent.
 * @param {object} input Project input.
 * @param {string} input.label Label.
 * @param {string | null} [input.clientId] Client of a root project. Optional.
 * @param {string | null} [input.parentId] Parent project. Optional.
 * @param {string[] | null} [input.categoryIds] Categories. Optional.
 * @param {File | null} [input.icon] Icon file. Optional.
 * @returns {Promise<Project>} Created project.
 */
export async function createProject(
  input: ProjectDetailsInput & {
    label: string;
    clientId?: string | null;
    parentId?: string | null;
    categoryIds?: string[] | null;
    icon?: File | null;
  },
): Promise<Project> {
  const { label } = parseInput(z.object({ label: projectLabelSchema }), input);
  const parentId = input.parentId ?? null;
  const clientId = parentId ? assertParent(await ProjectTree.load(), parentId, null) : (input.clientId ?? null);
  if (!parentId) await assertAttachableClient(clientId);
  const categoryIds = input.categoryIds ?? [];
  await assertCategories(categoryIds);
  const details = await parseDetails(input);
  const iconId = input.icon ? await storeIcon(input.icon) : null;

  return prisma.project.create({
    data: {
      ...details,
      label,
      clientId,
      parentId,
      iconId,
      position: await nextPosition(parentId, clientId),
      categories: { connect: connectIds(categoryIds) },
    },
  });
}

/**
 * Places a project (and its sub-tree) under a new parent or client, at an index among its new siblings.
 * @param {ProjectTree} tree Project tree.
 * @param {Project} project Moved project.
 * @param {string | null} parentId New parent.
 * @param {string | null} clientId New client (ignored when a parent is given).
 * @param {number} index Target index among the active siblings.
 * @returns {Promise<void>}
 */
async function placeProject(tree: ProjectTree, project: Project, parentId: string | null, clientId: string | null, index: number): Promise<void> {
  const targetClientId = parentId ? assertParent(tree, parentId, project.id) : clientId;
  if (!parentId && targetClientId !== project.clientId) await assertAttachableClient(targetClientId);

  const siblings = await prisma.project.findMany({
    where: { ...siblingsWhere(parentId, targetClientId), archivedAt: null },
    orderBy: BY_POSITION,
    select: { id: true },
  });
  const order = moveInOrder(
    siblings.map((sibling) => sibling.id),
    project.id,
    index,
  );
  const descendantIds = tree.descendants(project.id).map((descendant) => descendant.id);

  await prisma.$transaction([
    ...order.map((id, position) =>
      prisma.project.update({
        where: { id },
        data: id === project.id ? { position, parentId, clientId: targetClientId, archivedByCascade: false } : { position },
      }),
    ),
    // Sub-projects follow the client of their root.
    prisma.project.updateMany({ where: { id: { in: descendantIds } }, data: { clientId: targetClientId } }),
  ]);
}

/**
 * Updates a project (not an archived one: restore it first). Changing its parent or client moves it, with its sub-projects, to the end of the new list.
 * @param {string} id Project id.
 * @param {object} input Changes; undefined leaves a field unchanged, null clears it.
 * @param {string | null} [input.label] New label. Optional.
 * @param {string | null} [input.clientId] New client of a root project, null for no client. Optional.
 * @param {string | null} [input.parentId] New parent, null to make it a root project. Optional.
 * @param {string[] | null} [input.categoryIds] New categories. Optional.
 * @param {File | null} [input.icon] New icon file. Optional.
 * @param {boolean | null} [input.removeIcon] Removes the current icon. Optional.
 * @returns {Promise<Project>} Updated project.
 */
export async function updateProject(
  id: string,
  input: ProjectDetailsInput & {
    label?: string | null;
    clientId?: string | null;
    parentId?: string | null;
    categoryIds?: string[] | null;
    icon?: File | null;
    removeIcon?: boolean | null;
  },
): Promise<Project> {
  const project = await findProject(id);
  if (project.archivedAt) throw clientError('BAD_USER_INPUT', ARCHIVED_MESSAGE);
  const { label } = parseInput(z.object({ label: projectLabelSchema.optional() }), { label: input.label ?? undefined });

  const parentId = input.parentId === undefined ? project.parentId : input.parentId;
  const clientId = parentId ? project.clientId : input.clientId === undefined ? project.clientId : input.clientId;
  if (parentId !== project.parentId || (!parentId && clientId !== project.clientId)) {
    await placeProject(await ProjectTree.load(), project, parentId, clientId, Number.MAX_SAFE_INTEGER);
  }

  if (input.categoryIds) await assertCategories(input.categoryIds);
  const details = await parseDetails(input, project);
  const iconId = await resolveIconUpdate(project.iconId, input);

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...details,
      label,
      iconId,
      ...(input.categoryIds && { categories: { set: connectIds(input.categoryIds) } }),
    },
  });
  if (iconId !== undefined) await deleteOrphanIcons([project.iconId]);
  return updated;
}

/**
 * Adds or removes a project from the favorites.
 * @param {string} id Project id.
 * @param {boolean} favorite Favorite flag.
 * @returns {Promise<Project>} Updated project.
 */
export async function setProjectFavorite(id: string, favorite: boolean): Promise<Project> {
  await findProject(id);
  return prisma.project.update({ where: { id }, data: { favorite } });
}

/**
 * Archives a project with its active sub-projects, or restores it with the sub-projects archived along.
 * Restoring a project inside an archived parent or client restores those ancestors too (alone).
 * @param {string} id Project id.
 * @param {boolean} archived Target state.
 * @returns {Promise<Project>} Updated project.
 */
export async function setProjectArchived(id: string, archived: boolean): Promise<Project> {
  const project = await findProject(id);
  if ((project.archivedAt !== null) === archived) return project;
  const tree = await ProjectTree.load();
  const descendantIds = tree.descendants(id).map((descendant) => descendant.id);

  if (archived) {
    const now = new Date();
    const [, updated] = await prisma.$transaction([
      prisma.project.updateMany({
        where: { id: { in: descendantIds }, archivedAt: null },
        data: { archivedAt: now, archivedByCascade: true },
      }),
      prisma.project.update({ where: { id }, data: { archivedAt: now, archivedByCascade: false } }),
    ]);
    return updated;
  }

  // Archived ancestors come back alone: their other sub-projects stay archived on their own.
  const archivedAncestorIds = tree
    .ancestors(id)
    .filter((ancestor) => ancestor.archivedAt)
    .map((ancestor) => ancestor.id);
  const client = project.clientId ? await prisma.client.findUnique({ where: { id: project.clientId }, select: { archivedAt: true } }) : null;
  const clientArchived = Boolean(project.clientId && client?.archivedAt);

  const [, , , updated] = await prisma.$transaction([
    prisma.project.updateMany({
      where: { id: { in: descendantIds }, archivedByCascade: true },
      data: { archivedAt: null, archivedByCascade: false },
    }),
    prisma.project.updateMany({
      where: { id: { in: archivedAncestorIds } },
      data: { archivedAt: null, archivedByCascade: false },
    }),
    prisma.project.updateMany({
      // Projects archived by the cascade of a restored ancestor now stay archived on their own.
      where: {
        archivedByCascade: true,
        id: { notIn: [id, ...descendantIds] },
        OR: [{ parentId: { in: archivedAncestorIds } }, ...(clientArchived ? [{ clientId: project.clientId }] : [])],
      },
      data: { archivedByCascade: false },
    }),
    prisma.project.update({ where: { id }, data: { archivedAt: null, archivedByCascade: false } }),
    ...(clientArchived ? [prisma.client.update({ where: { id: project.clientId! }, data: { archivedAt: null } })] : []),
  ]);
  return updated;
}

/**
 * Deletes a project and its whole sub-tree.
 * @param {string} id Project id.
 * @returns {Promise<void>}
 */
export async function deleteProject(id: string): Promise<void> {
  const project = await findProject(id);
  const tree = await ProjectTree.load();
  const iconIds = [project.iconId, ...tree.descendants(id).map((descendant) => descendant.iconId)];
  // Sub-projects are removed by the ON DELETE CASCADE of the parent relation.
  await prisma.project.delete({ where: { id } });
  await deleteOrphanIcons(iconIds);
}

/**
 * Moves a project, with its sub-projects, to an index under a parent project or at the root of a client.
 * @param {string} id Project id.
 * @param {object} target Destination.
 * @param {string | null} target.parentId Parent project, or null for a root project.
 * @param {string | null} target.clientId Client of a root project (ignored when a parent is given).
 * @param {number} target.index Target index among the active siblings.
 * @returns {Promise<void>}
 */
export async function moveProject(id: string, { parentId, clientId, index }: { parentId: string | null; clientId: string | null; index: number }): Promise<void> {
  const project = await findProject(id);
  await placeProject(await ProjectTree.load(), project, parentId, clientId, index);
}
