import { prisma } from '../../db';
import * as library from '../../services/library';
import { builder } from '../builder';

builder.prismaObject('DocumentFolder', {
  description: 'Folder of the document library.',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    parentId: t.exposeID('parentId', { nullable: true }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

builder.prismaObject('LibraryDocument', {
  description: 'Document of the library: a file, or a link.',
  fields: (t) => ({
    id: t.exposeID('id'),
    folderId: t.exposeID('folderId', { nullable: true }),
    kind: t.exposeString('kind', { description: 'FILE or LINK.' }),
    title: t.exposeString('title'),
    note: t.exposeString('note', { nullable: true }),
    url: t.string({
      description: 'Link address, or URL of the file.',
      select: { attachment: { select: { id: true, name: true } } },
      resolve: (document) =>
        document.kind === 'LINK' ? (document.url ?? '') : `/api/attachments/${document.attachment?.id}/${encodeURIComponent(document.attachment?.name ?? 'fichier')}`,
    }),
    fileName: t.string({ nullable: true, select: { attachment: { select: { name: true } } }, resolve: (document) => document.attachment?.name ?? null }),
    mimeType: t.string({ nullable: true, select: { attachment: { select: { mimeType: true } } }, resolve: (document) => document.attachment?.mimeType ?? null }),
    size: t.int({ nullable: true, select: { attachment: { select: { size: true } } }, resolve: (document) => document.attachment?.size ?? null }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

builder.queryFields((t) => ({
  documentFolders: t.prismaField({
    type: ['DocumentFolder'],
    resolve: (query) => prisma.documentFolder.findMany({ ...query, orderBy: [{ position: 'asc' }, { name: 'asc' }] }),
  }),
  libraryDocuments: t.prismaField({
    type: ['LibraryDocument'],
    description: 'Every document of the library (content of the files left out).',
    resolve: (query) => prisma.libraryDocument.findMany({ ...query, orderBy: [{ position: 'asc' }, { title: 'asc' }] }),
  }),
}));

builder.mutationFields((t) => ({
  createDocumentFolder: t.id({
    args: { name: t.arg.string({ required: true }), parentId: t.arg.id() },
    resolve: async (_root, { name, parentId }) => (await library.createFolder(name, parentId ?? null)).id,
  }),
  renameDocumentFolder: t.boolean({
    args: { id: t.arg.id({ required: true }), name: t.arg.string({ required: true }) },
    resolve: async (_root, { id, name }) => {
      await library.renameFolder(id, name);
      return true;
    },
  }),
  moveDocumentFolder: t.boolean({
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id() },
    resolve: async (_root, { id, parentId }) => {
      await library.moveFolder(id, parentId ?? null);
      return true;
    },
  }),
  deleteDocumentFolder: t.boolean({
    description: 'Deletes a folder with its sub-folders and documents.',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await library.deleteFolder(id);
      return true;
    },
  }),
  addLibraryFiles: t.idList({
    args: { folderId: t.arg.id(), files: t.arg({ type: ['File'], required: true }) },
    resolve: async (_root, { folderId, files }) => (await library.addFiles(folderId ?? null, files)).map((document) => document.id),
  }),
  addLibraryLink: t.id({
    args: { folderId: t.arg.id(), title: t.arg.string({ required: true }), url: t.arg.string({ required: true }), note: t.arg.string() },
    resolve: async (_root, { folderId, title, url, note }) => (await library.addLink(folderId ?? null, { title, url, note: note ?? null })).id,
  }),
  updateLibraryDocument: t.boolean({
    args: { id: t.arg.id({ required: true }), title: t.arg.string({ required: true }), url: t.arg.string(), note: t.arg.string(), file: t.arg({ type: 'File' }) },
    resolve: async (_root, { id, title, url, note, file }) => {
      await library.updateDocument(id, { title, url, note }, file ?? null);
      return true;
    },
  }),
  moveLibraryDocuments: t.boolean({
    args: { ids: t.arg.idList({ required: true }), folderId: t.arg.id() },
    resolve: async (_root, { ids, folderId }) => {
      await library.moveDocuments(ids, folderId ?? null);
      return true;
    },
  }),
  reorderDocumentFolder: t.boolean({
    description: 'Moves a folder among the folders of a parent (into that parent first when it is another one).',
    args: { id: t.arg.id({ required: true }), parentId: t.arg.id(), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, parentId, index }) => {
      await library.reorderFolder(id, parentId ?? null, index);
      return true;
    },
  }),
  reorderLibraryDocument: t.boolean({
    description: 'Moves a document among the documents of a folder (into that folder first when it is another one).',
    args: { id: t.arg.id({ required: true }), folderId: t.arg.id(), index: t.arg.int({ required: true }) },
    resolve: async (_root, { id, folderId, index }) => {
      await library.reorderDocument(id, folderId ?? null, index);
      return true;
    },
  }),
  deleteLibraryDocuments: t.boolean({
    args: { ids: t.arg.idList({ required: true }) },
    resolve: async (_root, { ids }) => {
      await library.deleteDocuments(ids);
      return true;
    },
  }),
}));
