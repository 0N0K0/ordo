import { lineageOf, mapById } from '@ordo/shared';
import { prisma } from '../../db';

/** Root project of a project (the elements without project make a tree of their own: null). */
export type ProjectRootOf = (projectId: string | null) => string | null;

/**
 * Root project of each project, loaded once: tasks and routines are only linked inside the same project tree.
 * @returns {Promise<ProjectRootOf>} Root lookup.
 */
export async function loadProjectRootOf(): Promise<ProjectRootOf> {
  const byId = mapById(await prisma.project.findMany({ select: { id: true, parentId: true } }));
  // eslint-disable-next-line no-restricted-syntax -- loadProjectRootOf itself.
  return (projectId) => (projectId === null ? null : (lineageOf(byId, projectId).at(-1)?.id ?? projectId));
}

/**
 * Whether an element (a task, a routine) is in the project tree of a project, given the project of each element: a
 * link may only join two of the same tree (those without project make one).
 * @param {ProjectRootOf} rootOf Root lookup.
 * @param {string | null} projectId Project whose tree is looked at (none: the elements without project).
 * @param {ReadonlyMap<string, string | null>} projectOf Project of each element (an unknown one counts as without project).
 * @returns {(id: string) => boolean} Whether an element is in the tree.
 */
export function inProjectTree(rootOf: ProjectRootOf, projectId: string | null, projectOf: ReadonlyMap<string, string | null>): (id: string) => boolean {
  const root = rootOf(projectId);
  return (id) => rootOf(projectOf.get(id) ?? null) === root;
}

/**
 * Elements out of the project tree some elements move to, once all moved together (a transfer of a selection): those
 * moved are in it, whatever their project now, so the links between them stay. What a move removes the links with.
 * @param {ProjectRootOf} rootOf Root lookup.
 * @param {readonly { id: string, projectId: string | null }[]} elements Elements (tasks, routines) and their project now.
 * @param {Iterable<string>} moved Elements moved.
 * @param {string | null} projectId Project they move to (none: out of any project).
 * @returns {Set<string>} Elements out of the tree, the moved ones aside.
 */
export function outsideMovedTree(rootOf: ProjectRootOf, elements: readonly { id: string; projectId: string | null }[], moved: Iterable<string>, projectId: string | null): Set<string> {
  const movedSet = new Set(moved);
  const root = rootOf(projectId);
  return new Set(elements.filter((element) => !movedSet.has(element.id) && rootOf(element.projectId) !== root).map((element) => element.id));
}
