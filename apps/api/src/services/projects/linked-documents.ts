import { prisma } from '../../db';
import { fieldError } from '../../graphql/errors';
import { assertAllExist } from '../core/lookup';
import { loadProjectRootOf, type ProjectRootOf } from './project-tree';

/** Documents of an item (task, routine, event) as sent: of the library, and of the projects; undefined: unchanged. */
export interface LinkedDocumentsInput {
  libraryDocumentIds?: readonly string[] | null;
  projectResourceIds?: readonly string[] | null;
}

/** What the documents of an item are checked against. */
export interface LinkedDocumentsRules {
  /** Project the item goes by (its own or inherited; none: an item without project). */
  projectId: string | null;
  /** Project documents it already has: one out of its tree stays while its tree does not change. Optional. Default = none. */
  previous?: readonly string[];
  /** Its project tree changes: the project documents out of the new tree are dropped. Optional. Default = false. */
  moved?: boolean;
  /** Root lookup already loaded. Optional. */
  rootOf?: ProjectRootOf;
}

/**
 * Checks the documents linked to a task, a routine or an event, as those of a treasury entry: each must exist
 * (« Document introuvable. », « Document du projet introuvable. »), and a project document must belong to the project
 * tree of the item (none without project). One it already had stays while its tree does not change, and is dropped
 * when it moves to another tree (as a link with a task of another tree).
 * @param {LinkedDocumentsInput} documents Documents given.
 * @param {LinkedDocumentsRules} rules Project of the item, documents it had, move.
 * @returns {Promise<string[] | undefined>} Project documents kept (undefined: none given).
 */
export async function checkLinkedDocuments(documents: LinkedDocumentsInput, rules: LinkedDocumentsRules): Promise<string[] | undefined> {
  await assertAllExist(prisma.libraryDocument, documents.libraryDocumentIds, 'Document');
  const given = documents.projectResourceIds;
  if (!given) return undefined;
  const ids = [...new Set(given)];
  await assertAllExist(prisma.projectResource, ids, 'Document du projet');
  if (!ids.length) return ids;
  const rootOf = rules.rootOf ?? (await loadProjectRootOf());
  const outside = new Set(outOfTree(rootOf, rules.projectId, await prisma.projectResource.findMany({ where: { id: { in: ids } }, select: { id: true, projectId: true } })));
  const previous = new Set(rules.previous ?? []);
  if (ids.some((id) => outside.has(id) && !previous.has(id))) {
    throw fieldError(
      'projectResourceIds',
      rules.projectId ? 'Les documents de projet doivent appartenir au projet de l’élément ou à son arborescence.' : 'Sans projet, seuls des documents de la bibliothèque se lient.',
    );
  }
  return rules.moved ? ids.filter((id) => !outside.has(id)) : ids;
}

/**
 * Project documents out of the project tree of a project (all of them without project).
 * @param {ProjectRootOf} rootOf Root lookup.
 * @param {string | null} projectId Project.
 * @param {readonly { id: string, projectId: string }[]} resources Project documents, with their project.
 * @returns {string[]} Ids of those out of its tree.
 */
export function outOfTree(rootOf: ProjectRootOf, projectId: string | null, resources: readonly { id: string; projectId: string }[]): string[] {
  const root = rootOf(projectId);
  return resources.filter((resource) => rootOf(resource.projectId) !== root).map((resource) => resource.id);
}

/** Selection of the ids of the documents linked to an item. */
export const LINKED_DOCUMENTS_SELECT = {
  libraryDocuments: { select: { id: true } },
  projectResources: { select: { id: true } },
} as const;

/**
 * Ids of the documents linked to a loaded item (`LINKED_DOCUMENTS_SELECT`).
 * @param {{ libraryDocuments: { id: string }[], projectResources: { id: string }[] }} item Item.
 * @returns {{ libraryDocumentIds: string[], projectResourceIds: string[] }} Ids.
 */
export const linkedDocumentIds = (item: { libraryDocuments: { id: string }[]; projectResources: { id: string }[] }) => ({
  libraryDocumentIds: item.libraryDocuments.map((document) => document.id),
  projectResourceIds: item.projectResources.map((resource) => resource.id),
});
