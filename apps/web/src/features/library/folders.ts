import type { DocumentFolder } from './api';

/**
 * Path of each folder ("Administratif › Société"), for the folder pickers.
 * @param {DocumentFolder[]} folders Folders.
 * @returns {Map<string, string>} Path by folder id.
 */
export function folderPaths(folders: DocumentFolder[]): Map<string, string> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const paths = new Map<string, string>();
  const pathOf = (folder: DocumentFolder): string => {
    const cached = paths.get(folder.id);
    if (cached) return cached;
    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    const path = parent ? `${pathOf(parent)} › ${folder.name}` : folder.name;
    paths.set(folder.id, path);
    return path;
  };
  folders.forEach(pathOf);
  return paths;
}

/**
 * Ids of a folder and its sub-folders.
 * @param {DocumentFolder[]} folders Folders.
 * @param {string} folderId Folder.
 * @returns {Set<string>} Ids.
 */
export function folderSubtree(folders: DocumentFolder[], folderId: string): Set<string> {
  const ids = [folderId];
  for (let index = 0; index < ids.length; index += 1) ids.push(...folders.filter((folder) => folder.parentId === ids[index]).map((folder) => folder.id));
  return new Set(ids);
}
