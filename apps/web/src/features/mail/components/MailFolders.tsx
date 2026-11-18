import { formCallbacks } from '../../../lib/form';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Box, Button, Group, NavLink, Stack, Text } from '@mantine/core';
import { requiredText } from '@ordo/shared';
import { useLocalStorage } from '@mantine/hooks';
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
import { useState, type ReactNode } from 'react';
import { notifySuccess } from '../../../lib/notify';
import { useMailActions, useMailFolderMutations, useMailFolders, type MailAccount } from '../api';
import { MailCountBadges } from './MailCountBadges';
import { openLabelForm } from '../../../components/dialogs/open-label-form';
import { FoldButton } from '../../../components/actions/FoldButton';
import { ActionButton } from '../../../components/actions/ActionButton';

const FOLDER_ICONS: Record<string, ReactNode> = {
  '\\Inbox': <TrayIcon aria-hidden />,
  '\\Sent': <PaperPlaneTiltIcon aria-hidden />,
  '\\Drafts': <FileIcon aria-hidden />,
  '\\Trash': <TrashIcon aria-hidden />,
  '\\Junk': <WarningIcon aria-hidden />,
  '\\Archive': <ArchiveIcon aria-hidden />,
};

/** Mails being dragged, from the list to a folder. */
export interface DraggedMails {
  accountId: string;
  folder: string;
  uids: number[];
}

interface SelectedFolder {
  accountId: string;
  folder: string;
}

/** Rule of the name of a folder. */
const FOLDER_NAME = requiredText(255);

interface AccountFoldersProps {
  account: MailAccount;
  selected: SelectedFolder | null;
  onSelect: (folder: SelectedFolder) => void;
  /** Mails being dragged, if any. */
  dragged: DraggedMails | null;
  /** Called once dragged mails are dropped in a folder. */
  onDropped: () => void;
}

/**
 * Folders of an account in the navigation, as a tree whose branches fold and unfold, with their counts of mails
 * to do and unread:
 * create, rename and delete folders (special ones excepted), and drop mails dragged from the list into one of
 * them.
 * @param {AccountFoldersProps} props Component props.
 * @returns {JSX.Element} Folders.
 */
export function AccountFolders({ account, selected, onSelect, dragged, onDropped }: AccountFoldersProps) {
  const { data: folders, isPending, error } = useMailFolders(account.id);
  const { create, rename, remove, move: moveFolder } = useMailFolderMutations();
  // Folder being dragged to another place of the tree.
  const [draggedFolder, setDraggedFolder] = useState<{ path: string; name: string; parent: string | null } | null>(null);

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
          <Button
            key={item.path}
            variant="subtle"
            justify="flex-start"
            leftSection={<FolderIcon aria-hidden />}
            style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${item.depth} * var(--mantine-spacing-md))` }}
            onClick={() => {
              close();
              placeFolder(folder, item.path);
            }}
          >
            {item.name}
          </Button>
        ))}
      </Stack>
    ));
  };
  const { move } = useMailActions();
  const [over, setOver] = useState<string | null>(null);
  // Folders whose sub-folders are hidden, remembered in this browser.
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({ key: `ordo.mail.collapsed.${account.id}`, defaultValue: [] });
  const byPath = new Map((folders ?? []).map((folder) => [folder.path, folder]));
  const parents = new Set((folders ?? []).map((folder) => folder.parent).filter((parent): parent is string => parent !== null));
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
   * Whether a folder is hidden by a collapsed ancestor.
   * @param {string | null} parent Parent path.
   * @returns {boolean} Hidden.
   */
  const hidden = (parent: string | null): boolean => {
    for (let current = parent; current; current = byPath.get(current)?.parent ?? null) if (collapsed.includes(current)) return true;
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
      schema: FOLDER_NAME,
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
      schema: FOLDER_NAME,
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
      onConfirm: () => {
        remove.mutate(
          { accountId: account.id, path: folder.path },
          formCallbacks(null, 'Dossier supprimé.', () => {
            if (selected?.accountId === account.id && selected.folder.startsWith(folder.path)) onSelect({ accountId: account.id, folder: 'INBOX' });
          }),
        );
      },
    });
  };

  return (
    <NavLink
      label={account.label}
      description={account.email}
      defaultOpened
      leftSection={<EnvelopeSimpleIcon aria-hidden />}
      childrenOffset={8}
      // A folder dropped on the account goes to the top level.
      variant={over === '' ? 'filled' : 'light'}
      active={over === ''}
      onDragOver={(event) => {
        if (!draggedFolder) return;
        event.preventDefault();
        setOver('');
      }}
      onDragLeave={() => setOver((current) => (current === '' ? null : current))}
      onDrop={(event) => {
        setOver(null);
        if (!draggedFolder) return;
        event.preventDefault();
        placeFolder(draggedFolder, null);
        setDraggedFolder(null);
      }}
    >
      {isPending && <ListSkeleton items={4} dense />}
      {error && (
        <Text size="xs" c="red" px="sm" py={4}>
          {error.message}
        </Text>
      )}
      {folders?.map((folder) => {
        if (hidden(folder.parent)) return null;
        const special = folder.specialUse !== null;
        const hasChildren = parents.has(folder.path);
        const folded = collapsed.includes(folder.path);
        // Mails of this account, from another folder, can be dropped here.
        const droppable = dragged !== null && dragged.accountId === account.id && dragged.folder !== folder.path;
        // A folder can go under any folder but itself and its sub-folders.
        const folderDroppable = draggedFolder !== null && folder.path !== draggedFolder.path && !within(folder.path, draggedFolder.path) && folder.path !== draggedFolder.parent;
        return (
          <NavLink
            key={folder.path}
            component="div"
            role="button"
            tabIndex={0}
            label={folder.name}
            leftSection={
              <Group gap={2} wrap="nowrap">
                {hasChildren ? (
                  <FoldButton
                    size="xs"
                    expanded={!folded}
                    item={folder.name}
                    inRow
                    onToggle={() => setCollapsed(folded ? collapsed.filter((path) => path !== folder.path) : [...collapsed, folder.path])}
                  />
                ) : (
                  <Box w={22} />
                )}
                {FOLDER_ICONS[folder.specialUse ?? ''] ?? <FolderIcon aria-hidden />}
              </Group>
            }
            rightSection={
              <Group gap={2} wrap="nowrap">
                <MailCountBadges todo={folder.todo ?? 0} unread={folder.unseen} compact />
                <ActionsMenu
                  name={`le dossier ${folder.name}`}
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
            draggable={!special}
            onDragStart={(event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', folder.name);
              setDraggedFolder({ path: folder.path, name: folder.name, parent: folder.parent });
            }}
            onDragEnd={() => setDraggedFolder(null)}
            onDragOver={(event) => {
              if (folderDroppable) {
                event.preventDefault();
                event.stopPropagation();
                setOver(folder.path);
                return;
              }
              if (!droppable) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOver(folder.path);
            }}
            onDragLeave={() => setOver((current) => (current === folder.path ? null : current))}
            onDrop={(event) => {
              setOver(null);
              if (folderDroppable && draggedFolder) {
                event.preventDefault();
                event.stopPropagation();
                placeFolder(draggedFolder, folder.path);
                setDraggedFolder(null);
                return;
              }
              if (!droppable || !dragged) return;
              event.preventDefault();
              move.mutate(
                { accountId: account.id, folder: dragged.folder, uids: dragged.uids, target: folder.path },
                formCallbacks(null, `${dragged.uids.length > 1 ? `${dragged.uids.length} mails déplacés` : 'Mail déplacé'} dans « ${folder.name} ».`, onDropped),
              );
            }}
            style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${folder.depth} * var(--mantine-spacing-md))` }}
          />
        );
      })}
      {folders && <NavLink component="button" label="Nouveau dossier" leftSection={<FolderPlusIcon aria-hidden />} c="dimmed" onClick={() => askCreate(null)} />}
    </NavLink>
  );
}
