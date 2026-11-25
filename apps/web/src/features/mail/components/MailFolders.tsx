import { formCallbacks } from '../../../lib/form';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Box, Group, NavLink, Stack, Text } from '@mantine/core';
import { mailFolderNameSchema } from '@ordo/shared';

import {
  ArchiveIcon,
  ArrowsOutCardinalIcon,
  EnvelopeSimpleIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useDndContext, useDndMonitor, useDraggable, useDroppable } from '@dnd-kit/core';
import type { CSSProperties, ReactNode } from 'react';
import { notifySuccess } from '../../../lib/notify';
import { useMailActions, useMailFolderMutations, useMailFolders, type MailAccount } from '../api';
import { MailCountBadges } from './MailCountBadges';
import { openLabelForm } from '../../../components/dialogs/open-label-form';
import { FoldButton } from '../../../components/actions/FoldButton';
import { ActionButton } from '../../../components/actions/ActionButton';
import { movedMailsMessage, accountLabel } from '../lib/mail-format';
import type { DraggedFolder, DraggedMails, MailDrag, MailDrop } from '../lib/mail-dnd';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { useFoldedIds } from '../../../components/tree/use-folded-ids';
import { taggedKey } from '../../../lib/tagged-key';

const FOLDER_ICONS: Record<string, ReactNode> = {
  '\\Inbox': <TrayIcon aria-hidden />,
  '\\Sent': <PaperPlaneTiltIcon aria-hidden />,
  '\\Drafts': <FileIcon aria-hidden />,
  '\\Trash': <TrashIcon aria-hidden />,
  '\\Junk': <WarningIcon aria-hidden />,
  '\\Archive': <ArchiveIcon aria-hidden />,
};

interface SelectedFolder {
  accountId: string;
  folder: string;
}


interface AccountFoldersProps {
  account: MailAccount;
  selected: SelectedFolder | null;
  onSelect: (folder: SelectedFolder) => void;
  /** Called once dragged mails are dropped in a folder. */
  onDropped: (mails: DraggedMails) => void;
}

/**
 * Folders of an account in the navigation, as a tree whose branches fold and unfold, with their counts of mails
 * to do and unread:
 * create, rename and delete folders (special ones excepted), and drop mails dragged from the list into one of
 * them.
 * @param {AccountFoldersProps} props Component props.
 * @returns {JSX.Element} Folders.
 */
export function AccountFolders({ account, selected, onSelect, onDropped }: AccountFoldersProps) {
  const { data: folders, isPending, error } = useMailFolders(account.id);
  const { create, rename, remove, move: moveFolder } = useMailFolderMutations();
  // What is dragged (mails of the list, a folder of this account) and where it is.
  const { active: activeDrag, over: overDrop } = useDndContext();
  const drag = activeDrag?.data.current as MailDrag | undefined;
  const dragged = drag?.kind === 'mails' ? drag.mails : null;
  const draggedFolder = drag?.kind === 'folder' && drag.accountId === account.id ? drag.folder : null;
  const { setNodeRef: setAccountRef } = useDroppable({ id: taggedKey('mail-account', account.id), data: { kind: 'account', accountId: account.id } satisfies MailDrop, disabled: !draggedFolder });

  /**
   * Moves a folder under another one, or to the top; the folder shown follows.
   * @param {{ path: string, name: string }} folder Folder.
   * @param {string | null} parent New parent, or null for the top.
   * @returns {void}
   */
  const placeFolder = (folder: { path: string; name: string }, parent: string | null) =>
    moveFolder.mutate(
      { accountId: account.id, path: folder.path, parent },
      formCallbacks(null, parent ? `« ${folder.name} » rangé dans « ${parent.split(/[./]/).pop()} ».` : `« ${folder.name} » placé au premier niveau.`, (path) => {
        if (selected?.accountId === account.id && selected.folder === folder.path) onSelect({ accountId: account.id, folder: path });
      }),
    );

  const byPath = new Map((folders ?? []).map((folder) => [folder.path, folder]));
  /**
   * Whether a folder is under another one, at any depth.
   * @param {string} path Folder path.
   * @param {string} ancestor Possible ancestor path.
   * @returns {boolean} Under it.
   */
  const within = (path: string, ancestor: string): boolean => {
    for (let current = byPath.get(path)?.parent ?? null; current; current = byPath.get(current)?.parent ?? null) if (current === ancestor) return true;
    return false;
  };

  /**
   * Asks where to move a folder (keyboard alternative to the drag and drop).
   * @param {{ path: string, name: string }} folder Folder.
   * @returns {void}
   */
  const askMove = (folder: { path: string; name: string }) => {
    const choices = (folders ?? []).filter((item) => item.path !== folder.path && !within(item.path, folder.path));
    openFormPanel(`Déplacer « ${folder.name} »`, (close) => (
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          Le dossier, ses sous-dossiers et leurs mails changent de place.
        </Text>
        <ActionButton
          priority="secondary"
          justify="flex-start"
          icon={<FolderIcon aria-hidden />}
          onClick={() => {
            close();
            placeFolder(folder, null);
          }}
        >
          Premier niveau
        </ActionButton>
        {choices.map((item) => (
          <ActionButton
            key={item.path}
            priority="secondary"
            justify="flex-start"
            icon={<FolderIcon aria-hidden />}
            style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${item.depth} * var(--mantine-spacing-md))` }}
            onClick={() => {
              close();
              placeFolder(folder, item.path);
            }}
          >
            {item.name}
          </ActionButton>
        ))}
      </Stack>
    ));
  };
  const { move } = useMailActions();
  // Folders whose sub-folders are hidden, remembered in this browser.
  const { ids: collapsed, toggle: toggleFolded } = useFoldedIds(`ordo.mail.collapsed.${account.id}`);
  const parents = new Set((folders ?? []).map((folder) => folder.parent).filter((parent): parent is string => parent !== null));
  /**
   * Whether the mails or the folder dragged can be dropped in a folder: mails of this account from another folder, a
   * folder anywhere but under itself or where it already is.
   * @param {string} path Folder.
   * @returns {boolean} Droppable.
   */
  const accepts = (path: string): boolean =>
    dragged ? dragged.accountId === account.id && dragged.folder !== path : draggedFolder !== null && path !== draggedFolder.path && !within(path, draggedFolder.path) && path !== draggedFolder.parent;
  // Where the dragged element would go: a folder of this account (its path), the account itself (''), or none.
  const target = overDrop?.data.current as MailDrop | undefined;
  const over = target?.accountId !== account.id ? null : target.kind === 'account' ? '' : accepts(target.path) ? target.path : null;
  useDndMonitor({
    onDragEnd: ({ active: ended, over: dropped }) => {
      const what = ended.data.current as MailDrag | undefined;
      const where = dropped?.data.current as MailDrop | undefined;
      if (!what || where?.accountId !== account.id) return;
      if (what.kind === 'folder') {
        if (what.accountId !== account.id) return;
        if (where.kind === 'account') placeFolder(what.folder, null);
        else if (where.path !== what.folder.path && !within(where.path, what.folder.path) && where.path !== what.folder.parent) placeFolder(what.folder, where.path);
        return;
      }
      if (where.kind !== 'folder' || what.mails.accountId !== account.id || what.mails.folder === where.path) return;
      move.mutate(
        { accountId: account.id, folder: what.mails.folder, uids: what.mails.uids, target: where.path },
        formCallbacks(null, movedMailsMessage(what.mails.uids.length, where.name), () => onDropped(what.mails)),
      );
    },
  });

  /**
   * Whether a folder is hidden by a collapsed ancestor.
   * @param {string | null} parent Parent path.
   * @returns {boolean} Hidden.
   */
  const hidden = (parent: string | null): boolean => {
    for (let current = parent; current; current = byPath.get(current)?.parent ?? null) if (collapsed.has(current)) return true;
    return false;
  };

  /**
   * Asks the name of a new folder.
   * @param {string | null} parent Parent folder path, or null at the top.
   * @returns {void}
   */
  const askCreate = (parent: string | null) => {
    openLabelForm(parent ? 'Nouveau sous-dossier' : 'Nouveau dossier', {
      initial: '',
      fieldLabel: 'Nom',
      schema: mailFolderNameSchema,
      submitLabel: 'Créer',
      onSubmit: (name) => create.mutateAsync({ accountId: account.id, parent, name }).then(() => notifySuccess('Dossier créé.')),
    });
  };

  /**
   * Asks the new name of a folder.
   * @param {{ path: string, name: string }} folder Folder.
   * @returns {void}
   */
  const askRename = (folder: { path: string; name: string }) => {
    openLabelForm('Renommer le dossier', {
      initial: folder.name,
      fieldLabel: 'Nom',
      schema: mailFolderNameSchema,
      submitLabel: 'Renommer',
      onSubmit: (name) =>
        rename.mutateAsync({ accountId: account.id, path: folder.path, name }).then((path) => {
          notifySuccess('Dossier renommé.');
          if (selected?.accountId === account.id && selected.folder === folder.path) onSelect({ accountId: account.id, folder: path });
        }),
    });
  };

  /**
   * Asks for confirmation before deleting a folder and its mails.
   * @param {{ path: string, name: string }} folder Folder.
   * @returns {void}
   */
  const askDelete = (folder: { path: string; name: string }) => {
    confirmDestructive({
      title: 'Supprimer le dossier',
      risks: <>Le dossier « {folder.name} », ses sous-dossiers et tous leurs mails seront supprimés définitivement du serveur.</>,
      run: () =>
        remove.mutateAsync({ accountId: account.id, path: folder.path }).then(() => {
          if (selected?.accountId === account.id && selected.folder.startsWith(folder.path)) onSelect({ accountId: account.id, folder: 'INBOX' });
        }),
      done: 'Dossier supprimé.',
    });
  };

  return (
    <NavLink
      label={account.label}
      description={accountLabel(account)}
      defaultOpened
      leftSection={<EnvelopeSimpleIcon aria-hidden />}
      childrenOffset={8}
      // A folder dropped on the account goes to the top level.
      ref={setAccountRef}
      variant={over === '' ? 'filled' : 'light'}
      active={over === ''}
    >
      {isPending && <ListSkeleton items={4} dense />}
      {error && (
        <ErrorAlert mx="sm" my={4} p="xs">
          {error.message}
        </ErrorAlert>
      )}
      {folders?.map((folder) => {
        if (hidden(folder.parent)) return null;
        const special = folder.specialUse !== null;
        const hasChildren = parents.has(folder.path);
        const folded = collapsed.has(folder.path);
        return (
          <FolderDnd key={folder.path} accountId={account.id} folder={folder} draggable={!special}>
            {(dnd) => (
              <NavLink
                {...dnd}
                component="div"
                role="button"
                tabIndex={0}
                label={folder.name}
                leftSection={
                  <Group gap={2} wrap="nowrap">
                    {hasChildren ? <FoldButton size="xs" expanded={!folded} item={folder.name} inRow onToggle={() => toggleFolded(folder.path)} /> : <Box w={22} />}
                    {FOLDER_ICONS[folder.specialUse ?? ''] ?? <FolderIcon aria-hidden />}
                  </Group>
                }
                rightSection={
                  <Group gap={2} wrap="nowrap">
                    <MailCountBadges todo={folder.todo ?? 0} unread={folder.unseen} compact />
                    <ActionsMenu
                      about={`le dossier « ${folder.name} »`}
                      size="xs"
                      inRow
                      items={[
                        { label: 'Nouveau sous-dossier', icon: <FolderPlusIcon aria-hidden />, onClick: () => askCreate(folder.path) },
                        { label: 'Déplacer vers…', icon: <ArrowsOutCardinalIcon aria-hidden />, disabled: special, onClick: () => askMove(folder) },
                        { label: 'Renommer', icon: <PencilSimpleIcon aria-hidden />, disabled: special, onClick: () => askRename(folder) },
                        { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, disabled: special, onClick: () => askDelete(folder) },
                      ]}
                    />
                  </Group>
                }
                active={(selected?.accountId === account.id && selected.folder === folder.path) || over === folder.path}
                variant={over === folder.path ? 'filled' : 'light'}
                onClick={() => onSelect({ accountId: account.id, folder: folder.path })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect({ accountId: account.id, folder: folder.path });
                  }
                }}
                style={{ ...dnd.style, paddingLeft: `calc(var(--mantine-spacing-sm) + ${folder.depth} * var(--mantine-spacing-md))` }}
              />
            )}
          </FolderDnd>
        );
      })}
      {folders && <NavLink component="button" label="Nouveau dossier" leftSection={<FolderPlusIcon aria-hidden />} c="dimmed" onClick={() => askCreate(null)} />}
    </NavLink>
  );
}

/** What a folder row gets to be dragged and dropped on: its element, its pointer listeners, its look while dragged. */
interface FolderDndProps {
  ref: (element: HTMLElement | null) => void;
  style?: CSSProperties;
}

/**
 * A folder row as a drag source (not a special folder) and a drop target (`components/dnd`): mails and folders go in it.
 * @param {{ accountId: string, folder: DraggedFolder, draggable: boolean, children: (dnd: FolderDndProps) => ReactNode }} props Component props: its account, the folder, whether it moves, the row.
 * @returns {ReactNode} Row.
 */
function FolderDnd({ accountId, folder, draggable, children }: { accountId: string; folder: DraggedFolder; draggable: boolean; children: (dnd: FolderDndProps) => ReactNode }) {
  const id = `mail-folder:${accountId}:${folder.path}`;
  const {
    setNodeRef: setDragRef,
    listeners,
    isDragging,
  } = useDraggable({ id, data: { kind: 'folder', accountId, folder: { path: folder.path, name: folder.name, parent: folder.parent } } satisfies MailDrag, disabled: !draggable });
  const { setNodeRef: setDropRef } = useDroppable({ id, data: { kind: 'folder', accountId, path: folder.path, name: folder.name } satisfies MailDrop });
  /**
   * Gives the row element to both the drag and the drop.
   * @param {HTMLElement | null} element Row element.
   * @returns {void}
   */
  const ref = (element: HTMLElement | null) => {
    setDragRef(element);
    setDropRef(element);
  };
  return children({ ref, ...(draggable ? listeners : {}), style: isDragging ? { opacity: 'var(--onoko-dragging-opacity)' } : undefined } as FolderDndProps);
}
