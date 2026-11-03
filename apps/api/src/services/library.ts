import { z } from 'zod';
import { prisma } from '../db';
import type { DocumentFolder, LibraryDocument } from '../generated/prisma/client';
import { clientError, notFound, parseInput } from '../graphql/errors';
import { attachmentData } from './attachments';
import { zipFiles } from './zip';

/** Largest file of the library. */
export const MAX_LIBRARY_BYTES = 25 * 1024 * 1024;

const folderNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(100, '100 caractères maximum.');
const noteSchema = z
  .string()
  .trim()
  .max(2000, '2 000 caractères maximum.')
  .transform((value) => value || null)
  .nullable();
const linkSchema = z.object({
  title: z.string().trim().min(1, 'Le titre est requis.').max(200, '200 caractères maximum.'),
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  note: noteSchema,
});

/**
 * Checks that a folder exists (null: the root).
 * @param {string | null} folderId Folder.
 * @returns {Promise<void>}
 */
async function assertFolder(folderId: string | null): Promise<void> {
  if (folderId && !(await prisma.documentFolder.findUnique({ where: { id: folderId }, select: { id: true } }))) throw notFound('Dossier');
}

/**
 * Ids of a folder and its sub-folders.
 * @param {string} folderId Folder.
 * @returns {Promise<string[]>} Ids.
 */
async function folderTree(folderId: string): Promise<string[]> {
  const folders = await prisma.documentFolder.findMany({ select: { id: true, parentId: true } });
  const ids = [folderId];
  for (let index = 0; index < ids.length; index += 1) ids.push(...folders.filter((folder) => folder.parentId === ids[index]).map((folder) => folder.id));
  return ids;
}

/**
 * Creates a folder.
 * @param {string} name Name.
 * @param {string | null} parentId Parent folder, or null at the root.
 * @returns {Promise<DocumentFolder>} Folder.
 */
export async function createFolder(name: string, parentId: string | null): Promise<DocumentFolder> {
  await assertFolder(parentId);
  return prisma.documentFolder.create({ data: { name: parseInput(folderNameSchema, name), parentId } });
}

/**
 * Renames a folder.
 * @param {string} id Folder.
 * @param {string} name Name.
 * @returns {Promise<DocumentFolder>} Folder.
 */
export async function renameFolder(id: string, name: string): Promise<DocumentFolder> {
  await assertFolder(id);
  return prisma.documentFolder.update({ where: { id }, data: { name: parseInput(folderNameSchema, name) } });
}

/**
 * Moves a folder (with its content) into another folder or to the root; never into itself or a sub-folder.
 * @param {string} id Folder.
 * @param {string | null} parentId New parent, or null.
 * @returns {Promise<DocumentFolder>} Folder.
 */
export async function moveFolder(id: string, parentId: string | null): Promise<DocumentFolder> {
  await assertFolder(id);
  await assertFolder(parentId);
  if (parentId && (await folderTree(id)).includes(parentId)) throw clientError('BAD_USER_INPUT', 'Un dossier ne peut pas aller dans lui-même ni dans l’un de ses sous-dossiers.');
  return prisma.documentFolder.update({ where: { id }, data: { parentId } });
}

/**
 * Deletes a folder with its sub-folders and documents (their files too).
 * @param {string} id Folder.
 * @returns {Promise<void>}
 */
export async function deleteFolder(id: string): Promise<void> {
  await assertFolder(id);
  const tree = await folderTree(id);
  const files = await prisma.libraryDocument.findMany({ where: { folderId: { in: tree }, attachmentId: { not: null } }, select: { attachmentId: true } });
  await prisma.$transaction([
    prisma.attachment.deleteMany({ where: { id: { in: files.map((file) => file.attachmentId!) } } }),
    prisma.documentFolder.delete({ where: { id } }),
  ]);
}

/**
 * Adds files to a folder (or the root), titled after their names.
 * @param {string | null} folderId Folder.
 * @param {File[]} files Files.
 * @returns {Promise<LibraryDocument[]>} Documents.
 */
export async function addFiles(folderId: string | null, files: File[]): Promise<LibraryDocument[]> {
  await assertFolder(folderId);
  for (const file of files) {
    if (file.size === 0) throw clientError('BAD_USER_INPUT', `« ${file.name} » est vide.`);
    if (file.size > MAX_LIBRARY_BYTES) throw clientError('BAD_USER_INPUT', `« ${file.name} » est trop lourd (25 Mo maximum).`);
  }
  const created: LibraryDocument[] = [];
  for (const file of files) {
    const attachment = await prisma.attachment.create({ data: attachmentData(file.name, Buffer.from(await file.arrayBuffer())) });
    // The title is the name without its extension.
    const title = attachment.name.replace(/\.[^.]{1,8}$/, '') || attachment.name;
    created.push(await prisma.libraryDocument.create({ data: { kind: 'FILE', title: title.slice(0, 200), attachmentId: attachment.id, folderId } }));
  }
  return created;
}

/**
 * Adds a link (cloud folder, online document…).
 * @param {string | null} folderId Folder.
 * @param {z.input<typeof linkSchema>} input Link.
 * @returns {Promise<LibraryDocument>} Document.
 */
export async function addLink(folderId: string | null, input: z.input<typeof linkSchema>): Promise<LibraryDocument> {
  await assertFolder(folderId);
  return prisma.libraryDocument.create({ data: { ...parseInput(linkSchema, input), kind: 'LINK', folderId } });
}

/**
 * Changes the title and note of a document (and the address of a link); a file can be replaced.
 * @param {string} id Document.
 * @param {{ title: string, url?: string | null, note?: string | null }} input Changes.
 * @param {File | null} file New file (files only), or null.
 * @returns {Promise<LibraryDocument>} Document.
 */
export async function updateDocument(id: string, input: { title: string; url?: string | null; note?: string | null }, file: File | null): Promise<LibraryDocument> {
  const document = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!document) throw notFound('Document');
  const data =
    document.kind === 'LINK'
      ? parseInput(linkSchema, { title: input.title, url: input.url ?? document.url ?? '', note: input.note ?? null })
      : parseInput(linkSchema.omit({ url: true }), { title: input.title, note: input.note ?? null });
  if (file && document.kind === 'FILE') {
    if (file.size === 0 || file.size > MAX_LIBRARY_BYTES) throw clientError('BAD_USER_INPUT', `« ${file.name} » est vide ou trop lourd (25 Mo maximum).`);
    const attachment = await prisma.attachment.create({ data: attachmentData(file.name, Buffer.from(await file.arrayBuffer())) });
    const updated = await prisma.libraryDocument.update({ where: { id }, data: { ...data, attachmentId: attachment.id } });
    if (document.attachmentId) await prisma.attachment.delete({ where: { id: document.attachmentId } });
    return updated;
  }
  return prisma.libraryDocument.update({ where: { id }, data });
}

/**
 * Moves documents into a folder or to the root.
 * @param {string[]} ids Documents.
 * @param {string | null} folderId Folder.
 * @returns {Promise<void>}
 */
export async function moveDocuments(ids: string[], folderId: string | null): Promise<void> {
  await assertFolder(folderId);
  await prisma.libraryDocument.updateMany({ where: { id: { in: ids } }, data: { folderId } });
}

/**
 * Deletes documents (their files too).
 * @param {string[]} ids Documents.
 * @returns {Promise<void>}
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  const documents = await prisma.libraryDocument.findMany({ where: { id: { in: ids } }, select: { id: true, attachmentId: true } });
  if (documents.length !== new Set(ids).size) throw notFound('Document');
  await prisma.$transaction([
    prisma.libraryDocument.deleteMany({ where: { id: { in: ids } } }),
    prisma.attachment.deleteMany({ where: { id: { in: documents.map((document) => document.attachmentId).filter((id): id is string => Boolean(id)) } } }),
  ]);
}

/**
 * Name safe in an archive.
 * @param {string} name Name.
 * @returns {string} Name.
 */
const safe = (name: string) => name.replace(/[\\/:*?"<>|\0]/g, '-').trim() || 'sans-nom';

/**
 * ZIP of documents: a folder with its sub-folders (or the whole library), or chosen documents. Files keep
 * their names, links become Internet shortcuts (.url).
 * @param {{ folderId?: string | null, ids?: string[] }} scope Folder (null: the whole library) or documents.
 * @returns {Promise<{ name: string, content: Buffer }>} Archive and its name.
 */
export async function libraryZip(scope: { folderId?: string | null; ids?: string[] }): Promise<{ name: string; content: Buffer }> {
  const folders = await prisma.documentFolder.findMany();
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const root = scope.folderId ? byId.get(scope.folderId) : null;
  if (scope.folderId && !root) throw notFound('Dossier');
  const tree = root ? await folderTree(root.id) : null;
  const documents = await prisma.libraryDocument.findMany({
    where: scope.ids ? { id: { in: scope.ids } } : tree ? { folderId: { in: tree } } : {},
    include: { attachment: true },
    orderBy: { title: 'asc' },
  });
  /**
   * Path of a folder inside the archive (relative to the exported folder).
   * @param {string | null} folderId Folder.
   * @returns {string} Path, ending with "/" (or empty).
   */
  const pathOf = (folderId: string | null): string => {
    if (scope.ids || !folderId || folderId === root?.id) return '';
    const folder = byId.get(folderId)!;
    return `${pathOf(folder.parentId)}${safe(folder.name)}/`;
  };
  const used = new Set<string>();
  const files = documents.map((document) => {
    const base = document.attachment ? safe(document.attachment.name) : `${safe(document.title)}.url`;
    let name = `${pathOf(document.folderId)}${base}`;
    for (let copy = 2; used.has(name); copy += 1) name = `${pathOf(document.folderId)}${base.replace(/(\.[^.]+)?$/, ` (${copy})$1`)}`;
    used.add(name);
    const data = document.attachment ? document.attachment.data : new Uint8Array(Buffer.from(`[InternetShortcut]\r\nURL=${document.url}\r\n`, 'utf8'));
    return { name, data, date: document.updatedAt };
  });
  if (files.length === 0) throw clientError('BAD_USER_INPUT', 'Aucun document à télécharger.');
  return { name: `${safe(root?.name ?? 'Documents')}.zip`, content: zipFiles(files) };
}
