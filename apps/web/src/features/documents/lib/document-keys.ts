import type { LinkedDocumentIds } from '@ordo/shared';
import { taggedIds, taggedKey } from '../../../lib/tagged-key';

/** Document offered: in the library (`place`: its folder) or in a project (`place`: the project). */
export interface DocumentSource {
  source: string;
  id: string;
  label: string;
  place: string;
  projectId?: string | null;
}

/** Documents of a select, grouped by place. */
export interface DocumentGroup {
  group: string;
  items: { value: string; label: string }[];
}

/**
 * Key of a linked document in the selects.
 * @param {{ source: string, id: string }} document Document.
 * @returns {string} "lib:<id>" or "res:<id>".
 */
export const documentKey = (document: { source: string; id: string }) => taggedKey(document.source === 'LIBRARY' ? 'lib' : 'res', document.id);

/**
 * Keys of the linked documents, in the selects.
 * @param {LinkedDocumentIds} documents Documents.
 * @returns {string[]} "lib:<id>" and "res:<id>" keys.
 */
export const documentKeys = ({ libraryDocumentIds, projectResourceIds }: LinkedDocumentIds): string[] => [
  ...libraryDocumentIds.map((id) => documentKey({ source: 'LIBRARY', id })),
  ...projectResourceIds.map((id) => documentKey({ source: 'PROJECT', id })),
];

/**
 * Linked documents chosen in a select, from their keys.
 * @param {readonly string[]} keys "lib:<id>" and "res:<id>" keys.
 * @returns {LinkedDocumentIds} Documents.
 */
export const documentIdsOfKeys = (keys: readonly string[]): LinkedDocumentIds => ({
  // eslint-disable-next-line no-restricted-syntax -- documentIdsOfKeys itself.
  libraryDocumentIds: taggedIds(keys, 'lib'),
  // eslint-disable-next-line no-restricted-syntax -- documentIdsOfKeys itself.
  projectResourceIds: taggedIds(keys, 'res'),
});

/**
 * Documents that can be linked to an item, grouped by place: the library, then each project (the given one first); a
 * library document outside « Documents » named with its folder, each document once.
 * @param {readonly DocumentSource[]} documents Documents.
 * @param {string | null} [projectId] Project of the item, its documents first. Optional.
 * @returns {DocumentGroup[]} Groups.
 */
export function documentGroups(documents: readonly DocumentSource[], projectId?: string | null): DocumentGroup[] {
  const groups = new Map<string, DocumentGroup['items']>();
  const sorted = [...documents].sort((a, b) => Number(b.source === 'LIBRARY') - Number(a.source === 'LIBRARY') || Number(b.projectId === projectId) - Number(a.projectId === projectId));
  for (const document of sorted) {
    const group = document.source === 'LIBRARY' ? 'Bibliothèque' : `Projet ${document.place}`;
    const items = groups.get(group) ?? [];
    if (!items.some((item) => item.value === documentKey(document))) {
      items.push({ value: documentKey(document), label: document.source === 'LIBRARY' && document.place !== 'Documents' ? `${document.label} (${document.place})` : document.label });
    }
    groups.set(group, items);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}

/**
 * Documents of projects an item keeps once in another project: those of its new project tree (an unknown one stays,
 * the API decides), as the API keeps them.
 * @param {readonly string[]} ids Documents of projects linked.
 * @param {readonly DocumentSource[]} documents Documents known (`useDocumentOptions`).
 * @param {(projectId: string | null) => boolean} inTree Whether a project is in the new tree.
 * @returns {string[]} Those kept.
 */
export function resourcesInTree(ids: readonly string[], documents: readonly DocumentSource[], inTree: (projectId: string | null) => boolean): string[] {
  const projectOf = new Map(documents.filter((document) => document.source === 'PROJECT').map((document) => [document.id, document.projectId ?? null]));
  return ids.filter((id) => !projectOf.has(id) || inTree(projectOf.get(id) ?? null));
}
