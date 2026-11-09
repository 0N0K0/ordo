import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { LibraryQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type DocumentFolder = LibraryQuery['documentFolders'][number];
export type LibraryDocument = LibraryQuery['libraryDocuments'][number];

const libraryKey = ['library'] as const;

const LibraryQueryDocument = graphql(`
  query Library {
    documentFolders {
      id
      name
      parentId
    }
    libraryDocuments {
      id
      folderId
      kind
      title
      note
      url
      fileName
      mimeType
      size
      updatedAt
    }
  }
`);

const CreateFolder = graphql(`
  mutation CreateDocumentFolder($name: String!, $parentId: ID) {
    createDocumentFolder(name: $name, parentId: $parentId)
  }
`);
const RenameFolder = graphql(`
  mutation RenameDocumentFolder($id: ID!, $name: String!) {
    renameDocumentFolder(id: $id, name: $name)
  }
`);
const MoveFolder = graphql(`
  mutation MoveDocumentFolder($id: ID!, $parentId: ID) {
    moveDocumentFolder(id: $id, parentId: $parentId)
  }
`);
const DeleteFolder = graphql(`
  mutation DeleteDocumentFolder($id: ID!) {
    deleteDocumentFolder(id: $id)
  }
`);
const AddFiles = graphql(`
  mutation AddLibraryFiles($folderId: ID, $files: [File!]!) {
    addLibraryFiles(folderId: $folderId, files: $files)
  }
`);
const AddLink = graphql(`
  mutation AddLibraryLink($folderId: ID, $title: String!, $url: String!, $note: String) {
    addLibraryLink(folderId: $folderId, title: $title, url: $url, note: $note)
  }
`);
const UpdateDocument = graphql(`
  mutation UpdateLibraryDocument($id: ID!, $title: String!, $url: String, $note: String, $file: File) {
    updateLibraryDocument(id: $id, title: $title, url: $url, note: $note, file: $file)
  }
`);
const MoveDocuments = graphql(`
  mutation MoveLibraryDocuments($ids: [ID!]!, $folderId: ID) {
    moveLibraryDocuments(ids: $ids, folderId: $folderId)
  }
`);
const ReorderFolder = graphql(`
  mutation ReorderDocumentFolder($id: ID!, $parentId: ID, $index: Int!) {
    reorderDocumentFolder(id: $id, parentId: $parentId, index: $index)
  }
`);
const ReorderDocument = graphql(`
  mutation ReorderLibraryDocument($id: ID!, $folderId: ID, $index: Int!) {
    reorderLibraryDocument(id: $id, folderId: $folderId, index: $index)
  }
`);
const DeleteDocuments = graphql(`
  mutation DeleteLibraryDocuments($ids: [ID!]!) {
    deleteLibraryDocuments(ids: $ids)
  }
`);

/**
 * Folders and documents of the library.
 * @returns {UseQueryResult} Query state.
 */
export function useLibrary() {
  return useQuery({ queryKey: libraryKey, queryFn: () => execute(LibraryQueryDocument) });
}

/**
 * Mutation refreshing the library once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useLibraryMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKey }) });
}

/**
 * Folders and documents edition.
 * @returns {object} Mutations.
 */
export function useLibraryMutations() {
  return {
    createFolder: useLibraryMutation(async (variables: { name: string; parentId: string | null }) => (await execute(CreateFolder, variables)).createDocumentFolder),
    renameFolder: useLibraryMutation(async (variables: { id: string; name: string }) => (await execute(RenameFolder, variables)).renameDocumentFolder),
    moveFolder: useLibraryMutation(async (variables: { id: string; parentId: string | null }) => (await execute(MoveFolder, variables)).moveDocumentFolder),
    deleteFolder: useLibraryMutation(async (id: string) => (await execute(DeleteFolder, { id })).deleteDocumentFolder),
    addFiles: useLibraryMutation(async (variables: { folderId: string | null; files: File[] }) => (await execute(AddFiles, variables)).addLibraryFiles),
    addLink: useLibraryMutation(
      async (variables: { folderId: string | null; title: string; url: string; note: string | null }) => (await execute(AddLink, variables)).addLibraryLink,
    ),
    update: useLibraryMutation(
      async (variables: { id: string; title: string; url: string | null; note: string | null; file: File | null }) => (await execute(UpdateDocument, variables)).updateLibraryDocument,
    ),
    move: useLibraryMutation(async (variables: { ids: string[]; folderId: string | null }) => (await execute(MoveDocuments, variables)).moveLibraryDocuments),
    remove: useLibraryMutation(async (ids: string[]) => (await execute(DeleteDocuments, { ids })).deleteLibraryDocuments),
    reorderFolder: useLibraryMutation(async (variables: { id: string; parentId: string | null; index: number }) => (await execute(ReorderFolder, variables)).reorderDocumentFolder),
    reorderDocument: useLibraryMutation(async (variables: { id: string; folderId: string | null; index: number }) => (await execute(ReorderDocument, variables)).reorderLibraryDocument),
  };
}

/**
 * Shows a new order of the library at once (a drag and drop), before the server confirms it.
 * @returns {(change: (library: LibraryQuery) => LibraryQuery) => void} Updater of the library in cache.
 */
export function useLibraryOptimism() {
  const queryClient = useQueryClient();
  return (change: (library: LibraryQuery) => LibraryQuery) => queryClient.setQueryData<LibraryQuery>(libraryKey, (library) => (library ? change(library) : library));
}

/**
 * URL of the ZIP of a folder (null: the whole library) or of documents.
 * @param {{ folderId?: string | null, ids?: string[] }} scope Folder or documents.
 * @returns {string} URL.
 */
export function zipUrl(scope: { folderId?: string | null; ids?: string[] }): string {
  if (scope.ids) return `/api/library/zip?ids=${scope.ids.map(encodeURIComponent).join(',')}`;
  return scope.folderId ? `/api/library/zip?folderId=${encodeURIComponent(scope.folderId)}` : '/api/library/zip';
}
