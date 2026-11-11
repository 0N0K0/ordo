import {
  ActionIcon,
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  Checkbox,
  CloseButton,
  Grid,
  Group,
  Menu,
  Paper,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  EyeIcon,
  FileIcon,
  FileImageIcon,
  FilePdfIcon,
  FileZipIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderSimpleIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  TrashIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react';
import { useState, type DragEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useLibrary, useLibraryMutations, useLibraryOptimism, zipUrl, type DocumentFolder, type LibraryDocument } from './api';
import { folderPaths, folderSubtree } from './folders';
import { DocumentForm, FolderNameForm, LinkForm, MoveForm } from './LibraryForms';
import { openFile } from '../files/open-file';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { dndId, libraryCollision } from './library-dnd';
import { DroppableFolderLink, SortableRow } from './LibraryDnd';
import { PageTitle } from '../../components/PageTitle';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
let modalCount = 0;

/**
 * Size in Ko or Mo.
 * @param {number} bytes Size.
 * @returns {string} Size.
 */
function printedSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Icon of a document: PDF, image, link or other file.
 * @param {{ document: LibraryDocument }} props Document.
 * @returns {JSX.Element} Icon.
 */
function DocumentIcon({ document }: { document: LibraryDocument }) {
  const [icon, color] =
    document.kind === 'LINK'
      ? [<LinkIcon key="i" aria-hidden />, 'blue']
      : document.mimeType === 'application/pdf'
        ? [<FilePdfIcon key="i" aria-hidden />, 'red']
        : IMAGE_TYPES.includes(document.mimeType ?? '')
          ? [<FileImageIcon key="i" aria-hidden />, 'grape']
          : [<FileIcon key="i" aria-hidden />, 'gray'];
  return (
    <ThemeIcon variant="light" color={color} size="md" radius="md">
      {icon}
    </ThemeIcon>
  );
}

/**
 * Opens a modal.
 * @param {string} title Title.
 * @param {(close: () => void) => ReactNode} content Content, given the close callback.
 * @param {string} [size] Size. Optional.
 * @returns {void}
 */
function openModal(title: string, content: (close: () => void) => ReactNode, size?: string): void {
  const modalId = `library-${++modalCount}`;
  modals.open({ modalId, title, size, children: content(() => modals.close(modalId)) });
}

/**
 * Asks for confirmation before a deletion.
 * @param {string} title Title.
 * @param {string} message What is deleted.
 * @param {() => void} onConfirm Deletion.
 * @returns {void}
 */
function confirmDeletion(title: string, message: string, onConfirm: () => void): void {
  openModal(title, (close) => (
    <Stack gap="md">
      <Text size="sm">{message}</Text>
      <DestructiveActions
        loading={false}
        onCancel={close}
        onConfirm={() => {
          close();
          onConfirm();
        }}
      />
    </Stack>
  ));
}

/**
 * Shows a document: PDF and images in a modal, links in a new tab; other files are downloaded.
 * @param {LibraryDocument} document Document.
 * @returns {void}
 */
function openDocument(document: LibraryDocument): void {
  if (document.kind === 'LINK') {
    window.open(document.url, '_blank', 'noopener');
    return;
  }
  // PDFs and images in the app's viewer, other files downloaded.
  openFile({ url: document.url, name: document.title, mimeType: document.mimeType });
}

interface FolderTreeProps {
  folders: DocumentFolder[];
  parentId: string | null;
  current: string | null;
  open: Set<string>;
  onSelect: (folderId: string) => void;
  counts: Map<string | null, number>;
}

/**
 * Folders of a level of the tree, with their sub-folders when they are on the way to the current one.
 * @param {FolderTreeProps} props Component props.
 * @returns {JSX.Element[]} Links.
 */
function FolderTree({ folders, parentId, current, open, onSelect, counts }: FolderTreeProps) {
  return (
    <>
      {/* In the order of the library (chosen by drag and drop). */}
      {folders
        .filter((folder) => folder.parentId === parentId)
        .map((folder) => {
          const children = folders.some((item) => item.parentId === folder.id);
          return (
            <DroppableFolderLink
              key={folder.id}
              folderId={folder.id}
              label={folder.name}
              leftSection={<FolderIcon aria-hidden weight={folder.id === current ? 'fill' : 'regular'} />}
              rightSection={
                <Text size="xs" c="dimmed">
                  {counts.get(folder.id) || ''}
                </Text>
              }
              active={folder.id === current}
              onClick={() => onSelect(folder.id)}
              {...(children && { opened: open.has(folder.id), childrenOffset: 16 })}
              // The count is not a chevron: it does not turn when the folder opens.
              disableRightSectionRotation
            >
              {children ? <FolderTree folders={folders} parentId={folder.id} current={current} open={open} onSelect={onSelect} counts={counts} /> : undefined}
            </DroppableFolderLink>
          );
        })}
    </>
  );
}

/**
 * Document library: global documents (Kbis, logo, statutes, certificates…), files or links to a cloud, in
 * nested folders; added (several files at once, by drag and drop too), shown, downloaded alone or as a ZIP,
 * edited, moved, deleted; folders and documents reordered, and moved into folders, by drag and drop. The open
 * folder is kept in the URL (?folder=).
 * @returns {JSX.Element} Page.
 */
export function LibraryPage() {
  const { data, isPending, error } = useLibrary();
  const mutations = useLibraryMutations();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const folders = data?.documentFolders ?? [];
  const documents = data?.libraryDocuments ?? [];
  const current = folders.some((folder) => folder.id === params.get('folder')) ? params.get('folder') : null;
  const paths = folderPaths(folders);

  /**
   * Opens a folder (null: the root).
   * @param {string | null} folderId Folder.
   * @returns {void}
   */
  const select = (folderId: string | null) => {
    setSelected(new Set());
    setSearch('');
    setParams(folderId ? { folder: folderId } : {}, { replace: true });
  };

  // Folders on the way to the current one are open in the tree.
  const open = new Set<string>();
  for (let folder = folders.find((item) => item.id === current); folder; folder = folders.find((item) => item.id === folder!.parentId)) open.add(folder.id);
  const counts = new Map<string | null, number>();
  for (const document of documents) counts.set(document.folderId ?? null, (counts.get(document.folderId ?? null) ?? 0) + 1);

  const query = search.trim().toLowerCase();
  const subfolders = query ? [] : folders.filter((folder) => folder.parentId === current);
  const shown = query
    ? documents.filter((document) => [document.title, document.fileName, document.note].some((value) => value?.toLowerCase().includes(query)))
    : documents.filter((document) => (document.folderId ?? null) === current);
  const chosen = shown.filter((document) => selected.has(document.id));

  /**
   * Uploads files into the open folder.
   * @param {File[]} files Files.
   * @returns {void}
   */
  const upload = (files: File[]) => {
    if (!files.length) return;
    mutations.addFiles.mutate(
      { folderId: current, files },
      { onSuccess: () => notifySuccess(`${files.length} fichier${files.length > 1 ? 's ajoutés' : ' ajouté'}.`), onError: (uploadError) => notifyError(uploadError.message) },
    );
  };

  /**
   * Drops files on the list.
   * @param {DragEvent} event Drop event.
   * @returns {void}
   */
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    upload([...event.dataTransfer.files]);
  };

  /**
   * Actions of a folder row.
   * @param {DocumentFolder} folder Folder.
   * @returns {JSX.Element} Menu.
   */
  const folderMenu = (folder: DocumentFolder) => {
    const tree = folderSubtree(folders, folder.id);
    const inside = documents.filter((document) => document.folderId && tree.has(document.folderId)).length;
    return (
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions sur le dossier ${folder.name}`} onClick={(event) => event.stopPropagation()}>
            <DotsThreeIcon weight="bold" aria-hidden />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
          <Menu.Item
            leftSection={<PencilSimpleIcon aria-hidden />}
            onClick={() =>
              openModal('Renommer le dossier', (close) => (
                <FolderNameForm initial={folder.name} submitLabel="Renommer" onDone={close} onSubmit={(name) => mutations.renameFolder.mutateAsync({ id: folder.id, name })} />
              ))
            }
          >
            Renommer
          </Menu.Item>
          <Menu.Item
            leftSection={<FolderSimpleIcon aria-hidden />}
            onClick={() =>
              openModal('Déplacer le dossier', (close) => (
                <MoveForm folders={folders} excluded={tree} initial={folder.parentId ?? null} onDone={close} onSubmit={(parentId) => mutations.moveFolder.mutateAsync({ id: folder.id, parentId })} />
              ))
            }
          >
            Déplacer
          </Menu.Item>
          <Menu.Item leftSection={<FileZipIcon aria-hidden />} component="a" href={zipUrl({ folderId: folder.id })} disabled={inside === 0}>
            Télécharger (.zip)
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<TrashIcon aria-hidden />}
            onClick={() =>
              confirmDeletion(
                'Supprimer le dossier',
                `« ${folder.name} » sera supprimé définitivement${inside ? `, avec ses sous-dossiers et ses ${inside} document${inside > 1 ? 's' : ''}` : ' avec ses sous-dossiers'}. Cette action est irréversible.`,
                () =>
                  mutations.deleteFolder.mutate(folder.id, {
                    onSuccess: () => {
                      if (current && tree.has(current)) select(folder.parentId ?? null);
                      notifySuccess('Dossier supprimé.');
                    },
                    onError: (deleteError) => notifyError(deleteError.message),
                  }),
              )
            }
          >
            Supprimer
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  };

  /**
   * Actions of a document row.
   * @param {LibraryDocument} document Document.
   * @returns {JSX.Element} Actions.
   */
  const documentActions = (document: LibraryDocument) => (
    <Group gap={2} wrap="nowrap" justify="flex-end">
      {document.kind === 'FILE' ? (
        <Tooltip label="Télécharger">
          <ActionIcon variant="subtle" color="gray" component="a" href={`${document.url}?download=1`} aria-label={`Télécharger ${document.title}`}>
            <DownloadSimpleIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Tooltip label="Ouvrir le lien">
          <ActionIcon variant="subtle" color="gray" component="a" href={document.url} target="_blank" rel="noopener" aria-label={`Ouvrir ${document.title}`}>
            <ArrowSquareOutIcon aria-hidden />
          </ActionIcon>
        </Tooltip>
      )}
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label={`Actions sur ${document.title}`}>
            <DotsThreeIcon weight="bold" aria-hidden />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {document.kind === 'FILE' && (document.mimeType === 'application/pdf' || IMAGE_TYPES.includes(document.mimeType ?? '')) && (
            <Menu.Item leftSection={<EyeIcon aria-hidden />} onClick={() => openDocument(document)}>
              Aperçu
            </Menu.Item>
          )}
          <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openModal('Modifier le document', (close) => <DocumentForm document={document} onDone={close} />)}>
            Modifier
          </Menu.Item>
          <Menu.Item
            leftSection={<FolderSimpleIcon aria-hidden />}
            onClick={() =>
              openModal('Déplacer le document', (close) => (
                <MoveForm folders={folders} initial={document.folderId ?? null} onDone={close} onSubmit={(folderId) => mutations.move.mutateAsync({ ids: [document.id], folderId })} />
              ))
            }
          >
            Déplacer
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<TrashIcon aria-hidden />}
            onClick={() =>
              confirmDeletion('Supprimer le document', `« ${document.title} » sera supprimé définitivement${document.kind === 'FILE' ? ' avec son fichier' : ''}. Cette action est irréversible.`, () =>
                mutations.remove.mutate([document.id], { onSuccess: () => notifySuccess('Document supprimé.'), onError: (deleteError) => notifyError(deleteError.message) }),
              )
            }
          >
            Supprimer
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const showAtOnce = useLibraryOptimism();
  const onMoveError = (moveError: Error) => notifyError(moveError.message);

  /**
   * Drop of a dragged folder or document: reordered among those of its kind in the open folder, or moved into a
   * folder (of the tree, or of the list for documents; the selected documents go together).
   * @param {DragEndEvent} event Drag end.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const dragged = dndId(active.id);
    const target = dndId(over.id);
    const into = target.kind === 'tree' ? (target.id === 'root' ? null : target.id) : target.kind === 'folder' && dragged.kind === 'doc' ? target.id : undefined;

    if (dragged.kind === 'doc' && into !== undefined) {
      if (into === current) return;
      const ids = selected.has(dragged.id) ? [...selected] : [dragged.id];
      showAtOnce((library) => {
        const moved = library.libraryDocuments.filter((document) => ids.includes(document.id)).map((document) => ({ ...document, folderId: into }));
        return { ...library, libraryDocuments: [...library.libraryDocuments.filter((document) => !ids.includes(document.id)), ...moved] };
      });
      setSelected(new Set());
      mutations.move.mutate(
        { ids, folderId: into },
        { onSuccess: () => notifySuccess(`${ids.length > 1 ? `${ids.length} documents déplacés` : 'Document déplacé'}.`), onError: onMoveError },
      );
      return;
    }
    if (dragged.kind === 'doc' && target.kind === 'doc') {
      const order = shown.map((document) => document.id);
      const index = order.indexOf(target.id);
      showAtOnce((library) => {
        const inFolder = arrayMove(order, order.indexOf(dragged.id), index).map((id) => library.libraryDocuments.find((document) => document.id === id)!);
        return { ...library, libraryDocuments: [...library.libraryDocuments.filter((document) => !order.includes(document.id)), ...inFolder] };
      });
      mutations.reorderDocument.mutate({ id: dragged.id, folderId: current, index }, { onError: onMoveError });
      return;
    }
    if (dragged.kind === 'folder' && target.kind === 'tree') {
      const parentId = target.id === 'root' ? null : target.id;
      const folder = folders.find((item) => item.id === dragged.id);
      if (!folder || (folder.parentId ?? null) === parentId) return;
      if (parentId && folderSubtree(folders, folder.id).has(parentId)) {
        notifyError('Un dossier ne peut pas aller dans lui-même ni dans l’un de ses sous-dossiers.');
        return;
      }
      showAtOnce((library) => ({
        ...library,
        documentFolders: [...library.documentFolders.filter((item) => item.id !== folder.id), { ...folder, parentId }],
      }));
      mutations.moveFolder.mutate({ id: folder.id, parentId }, { onSuccess: () => notifySuccess('Dossier déplacé.'), onError: onMoveError });
      return;
    }
    if (dragged.kind === 'folder' && target.kind === 'folder') {
      const order = subfolders.map((folder) => folder.id);
      const index = order.indexOf(target.id);
      showAtOnce((library) => {
        const level = arrayMove(order, order.indexOf(dragged.id), index).map((id) => library.documentFolders.find((folder) => folder.id === id)!);
        return { ...library, documentFolders: [...library.documentFolders.filter((folder) => !order.includes(folder.id)), ...level] };
      });
      mutations.reorderFolder.mutate({ id: dragged.id, parentId: current, index }, { onError: onMoveError });
    }
  };

  const trail: DocumentFolder[] = [];
  for (let folder = folders.find((item) => item.id === current); folder; folder = folders.find((item) => item.id === folder!.parentId)) trail.unshift(folder);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={2}>
          <PageTitle>Documents</PageTitle>
          <Text size="sm" c="dimmed">
            Documents de l’entreprise : Kbis, statuts, logo, attestations… en fichiers ou en liens vers votre cloud.
          </Text>
        </Stack>
        <Group gap="xs">
          <Button
            component="label"
            leftSection={<UploadSimpleIcon aria-hidden />}
            loading={mutations.addFiles.isPending}
          >
            Ajouter des fichiers
            <input type="file" multiple hidden onChange={(event) => {
              upload([...(event.currentTarget.files ?? [])]);
              event.currentTarget.value = '';
            }} />
          </Button>
          <Button variant="light" leftSection={<LinkIcon aria-hidden />} onClick={() => openModal('Ajouter un lien', (close) => <LinkForm folderId={current} onDone={close} />)}>
            Ajouter un lien
          </Button>
          <Button
            variant="default"
            leftSection={<FolderPlusIcon aria-hidden />}
            onClick={() =>
              openModal('Nouveau dossier', (close) => (
                <FolderNameForm
                  initial=""
                  submitLabel="Créer"
                  onDone={close}
                  onSubmit={(name) => mutations.createFolder.mutateAsync({ name, parentId: current }).then((id) => select(id))}
                />
              ))
            }
          >
            Nouveau dossier
          </Button>
        </Group>
      </Group>

      {error ? (
        <Text c="red">{error.message}</Text>
      ) : isPending ? (
        <Skeleton height={320} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={libraryCollision} onDragEnd={handleDragEnd}>
        <Grid gap="md">
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Paper withBorder radius="md" p="xs">
              <DroppableFolderLink
                folderId={null}
                label="Documents"
                leftSection={<FolderIcon aria-hidden weight={current === null ? 'fill' : 'regular'} />}
                rightSection={
                  <Text size="xs" c="dimmed">
                    {counts.get(null) || ''}
                  </Text>
                }
                active={current === null}
                onClick={() => select(null)}
              />
              <Box pl="sm">
                <FolderTree folders={folders} parentId={null} current={current} open={open} onSelect={select} counts={counts} />
              </Box>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 9 }}>
            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Breadcrumbs separator={<CaretRightIcon size={12} aria-hidden />}>
                  <Anchor component="button" size="sm" onClick={() => select(null)} c={current ? undefined : 'inherit'} fw={current ? undefined : 600}>
                    Documents
                  </Anchor>
                  {trail.map((folder) => (
                    <Anchor key={folder.id} component="button" size="sm" onClick={() => select(folder.id)} c={folder.id === current ? 'inherit' : undefined} fw={folder.id === current ? 600 : undefined}>
                      {folder.name}
                    </Anchor>
                  ))}
                </Breadcrumbs>
                <Group gap="xs">
                  <TextInput
                    size="xs"
                    w={240}
                    placeholder="Rechercher dans tous les documents"
                    aria-label="Rechercher un document"
                    leftSection={<MagnifyingGlassIcon aria-hidden />}
                    rightSection={search ? <CloseButton size="sm" aria-label="Effacer" onClick={() => setSearch('')} /> : null}
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                  />
                  <Button size="xs" variant="default" leftSection={<FileZipIcon aria-hidden />} component="a" href={zipUrl({ folderId: current })} disabled={documents.length === 0}>
                    {current ? 'Dossier en .zip' : 'Tout en .zip'}
                  </Button>
                </Group>
              </Group>

              {chosen.length > 0 && (
                <Paper withBorder radius="md" px="sm" py={6} bg="var(--mantine-color-default-hover)">
                  <Group justify="space-between" wrap="wrap" gap="xs">
                    <Text size="sm" fw={600}>
                      {chosen.length} document{chosen.length > 1 ? 's' : ''} sélectionné{chosen.length > 1 ? 's' : ''}
                    </Text>
                    <Group gap="xs">
                      <Button size="xs" variant="default" leftSection={<FileZipIcon aria-hidden />} component="a" href={zipUrl({ ids: chosen.map((document) => document.id) })}>
                        Télécharger (.zip)
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={<FolderSimpleIcon aria-hidden />}
                        onClick={() =>
                          openModal('Déplacer les documents', (close) => (
                            <MoveForm
                              folders={folders}
                              initial={current}
                              onDone={close}
                              onSubmit={(folderId) => mutations.move.mutateAsync({ ids: chosen.map((document) => document.id), folderId }).then(() => setSelected(new Set()))}
                            />
                          ))
                        }
                      >
                        Déplacer
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        leftSection={<TrashIcon aria-hidden />}
                        onClick={() =>
                          confirmDeletion('Supprimer les documents', `${chosen.length} document${chosen.length > 1 ? 's seront supprimés' : ' sera supprimé'} définitivement avec leurs fichiers. Cette action est irréversible.`, () =>
                            mutations.remove.mutate(
                              chosen.map((document) => document.id),
                              {
                                onSuccess: () => {
                                  setSelected(new Set());
                                  notifySuccess('Documents supprimés.');
                                },
                                onError: (deleteError) => notifyError(deleteError.message),
                              },
                            ),
                          )
                        }
                      >
                        Supprimer
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              )}

              <Paper
                withBorder
                radius="md"
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) return;
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
                }}
                onDrop={handleDrop}
                style={{ outline: dragging ? '2px dashed var(--mantine-primary-color-filled)' : undefined, outlineOffset: -4 }}
              >
                {subfolders.length === 0 && shown.length === 0 ? (
                  <Stack align="center" gap="sm" p="xl">
                    <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                      {query ? <MagnifyingGlassIcon aria-hidden /> : <UploadSimpleIcon aria-hidden />}
                    </ThemeIcon>
                    <Text size="sm" c="dimmed" ta="center">
                      {query ? 'Aucun document ne correspond à la recherche.' : 'Dossier vide. Glissez des fichiers ici, ou ajoutez des fichiers et des liens avec les boutons ci-dessus.'}
                    </Text>
                  </Stack>
                ) : (
                  <Table verticalSpacing="xs" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={32} />
                        <Table.Th w={40}>
                          <Checkbox
                            aria-label="Tout sélectionner"
                            checked={shown.length > 0 && chosen.length === shown.length}
                            indeterminate={chosen.length > 0 && chosen.length < shown.length}
                            disabled={shown.length === 0}
                            onChange={() => setSelected(chosen.length === shown.length ? new Set() : new Set(shown.map((document) => document.id)))}
                          />
                        </Table.Th>
                        <Table.Th>Nom</Table.Th>
                        <Table.Th w={140}>Taille</Table.Th>
                        <Table.Th w={140}>Modifié le</Table.Th>
                        <Table.Th w={90} />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      <SortableContext items={subfolders.map((folder) => `folder:${folder.id}`)} strategy={verticalListSortingStrategy}>
                      {subfolders.map((folder) => {
                        const inside = folderSubtree(folders, folder.id);
                        const count = documents.filter((document) => document.folderId && inside.has(document.folderId)).length;
                        return (
                          <SortableRow key={folder.id} id={`folder:${folder.id}`} label={`le dossier ${folder.name}`} onClick={() => select(folder.id)} style={{ cursor: 'pointer' }}>
                            <Table.Td />
                            <Table.Td>
                              <Group gap="sm" wrap="nowrap">
                                <ThemeIcon variant="light" color="yellow" size="md" radius="md">
                                  <FolderIcon weight="fill" aria-hidden />
                                </ThemeIcon>
                                <Text size="sm" fw={600}>
                                  {folder.name}
                                </Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {count} document{count > 1 ? 's' : ''}
                              </Text>
                            </Table.Td>
                            <Table.Td />
                            <Table.Td>
                              <Group justify="flex-end">{folderMenu(folder)}</Group>
                            </Table.Td>
                          </SortableRow>
                        );
                      })}
                      </SortableContext>
                      <SortableContext items={shown.map((document) => `doc:${document.id}`)} strategy={verticalListSortingStrategy}>
                      {shown.map((document) => (
                        // Search results come from several folders: no order to change there.
                        <SortableRow
                          key={document.id}
                          id={`doc:${document.id}`}
                          label={document.title}
                          disabled={Boolean(query)}
                          bg={selected.has(document.id) ? 'var(--mantine-primary-color-light)' : undefined}
                        >
                          <Table.Td>
                            <Checkbox
                              aria-label={`Sélectionner ${document.title}`}
                              checked={selected.has(document.id)}
                              onChange={() =>
                                setSelected((items) => {
                                  const next = new Set(items);
                                  if (next.has(document.id)) next.delete(document.id);
                                  else next.add(document.id);
                                  return next;
                                })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <Group gap="sm" wrap="nowrap">
                              <DocumentIcon document={document} />
                              <Stack gap={0} style={{ minWidth: 0 }}>
                                <Anchor component="button" size="sm" fw={500} ta="left" onClick={() => openDocument(document)} c="inherit">
                                  {document.title}
                                </Anchor>
                                <Text size="xs" c="dimmed" truncate>
                                  {[
                                    query && document.folderId ? paths.get(document.folderId) : query ? 'Documents' : null,
                                    document.kind === 'LINK' ? new URL(document.url).hostname : document.fileName,
                                    document.note,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </Text>
                              </Stack>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {document.size ? printedSize(document.size) : 'Lien'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="dimmed">
                              {dateFormat.format(new Date(document.updatedAt))}
                            </Text>
                          </Table.Td>
                          <Table.Td>{documentActions(document)}</Table.Td>
                        </SortableRow>
                      ))}
                      </SortableContext>
                    </Table.Tbody>
                  </Table>
                )}
              </Paper>
              <Text size="xs" c="dimmed">
                Fichiers de 25 Mo au plus. Glissez-déposez des fichiers sur la liste pour les ajouter au dossier ouvert. Réordonnez dossiers et documents par leur poignée ;
                déposez un document sur un dossier, ou un dossier dans l’arborescence, pour l’y ranger.
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
        </DndContext>
      )}
    </Stack>
  );
}
