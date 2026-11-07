import { ActionIcon, Badge, Box, Button, Group, Menu, NavLink, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
  ArchiveIcon,
  CaretDownIcon,
  CaretRightIcon,
  DotsThreeIcon,
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
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useMailActions, useMailFolderMutations, useMailFolders, type MailAccount } from './api';

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

export interface SelectedFolder {
  accountId: string;
  folder: string;
}

let modalCount = 0;

/**
 * Name of a folder to create or rename.
 * @param {{ initial: string, label: string, onSubmit: (name: string) => Promise<unknown>, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function FolderNameForm({ initial, label, onSubmit, onDone }: { initial: string; label: string; onSubmit: (name: string) => Promise<unknown>; onDone: () => void }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setError('Le nom est requis.');
          return;
        }
        setLoading(true);
        onSubmit(name.trim())
          .then(onDone)
          .catch((failure: Error) => setError(failure.message))
          .finally(() => setLoading(false));
      }}
    >
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus value={name} error={error} onChange={(event) => setName(event.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={loading}>
            {label}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

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
 * Folders of an account in the navigation, as a tree whose branches fold and unfold, with their unread counts:
 * create, rename and delete folders (special ones excepted), and drop mails dragged from the list into one of
 * them.
 * @param {AccountFoldersProps} props Component props.
 * @returns {JSX.Element} Folders.
 */
export function AccountFolders({ account, selected, onSelect, dragged, onDropped }: AccountFoldersProps) {
  const { data: folders, isPending, error } = useMailFolders(account.id);
  const { create, rename, remove } = useMailFolderMutations();
  const { move } = useMailActions();
  const [over, setOver] = useState<string | null>(null);
  // Folders whose sub-folders are hidden, remembered in this browser.
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({ key: `ordo.mail.collapsed.${account.id}`, defaultValue: [] });
  const byPath = new Map((folders ?? []).map((folder) => [folder.path, folder]));
  const parents = new Set((folders ?? []).map((folder) => folder.parent).filter((parent): parent is string => parent !== null));
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
    const modalId = `mail-folder-${++modalCount}`;
    modals.open({
      modalId,
      title: parent ? 'Nouveau sous-dossier' : 'Nouveau dossier',
      children: (
        <FolderNameForm
          initial=""
          label="Créer"
          onDone={() => modals.close(modalId)}
          onSubmit={(name) => create.mutateAsync({ accountId: account.id, parent, name }).then(() => notifySuccess('Dossier créé.'))}
        />
      ),
    });
  };

  /**
   * Asks the new name of a folder.
   * @param {{ path: string, name: string }} folder Folder.
   * @returns {void}
   */
  const askRename = (folder: { path: string; name: string }) => {
    const modalId = `mail-folder-${++modalCount}`;
    modals.open({
      modalId,
      title: 'Renommer le dossier',
      children: (
        <FolderNameForm
          initial={folder.name}
          label="Renommer"
          onDone={() => modals.close(modalId)}
          onSubmit={(name) =>
            rename.mutateAsync({ accountId: account.id, path: folder.path, name }).then((path) => {
              notifySuccess('Dossier renommé.');
              if (selected?.accountId === account.id && selected.folder === folder.path) onSelect({ accountId: account.id, folder: path });
            })
          }
        />
      ),
    });
  };

  /**
   * Asks for confirmation before deleting a folder and its mails.
   * @param {{ path: string, name: string }} folder Folder.
   * @returns {void}
   */
  const askDelete = (folder: { path: string; name: string }) => {
    const modalId = `mail-folder-${++modalCount}`;
    modals.open({
      modalId,
      title: 'Supprimer le dossier',
      children: (
        <Stack gap="md">
          <Text size="sm">Le dossier « {folder.name} », ses sous-dossiers et tous leurs mails seront supprimés définitivement du serveur. Cette action est irréversible.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(
                { accountId: account.id, path: folder.path },
                {
                  onSuccess: () => {
                    notifySuccess('Dossier supprimé.');
                    if (selected?.accountId === account.id && selected.folder.startsWith(folder.path)) onSelect({ accountId: account.id, folder: 'INBOX' });
                  },
                  onError: (failure) => notifyError(failure.message),
                },
              );
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <NavLink label={account.name} description={account.email} defaultOpened leftSection={<EnvelopeSimpleIcon aria-hidden />} childrenOffset={8}>
      {isPending && <Skeleton height={28} my={4} />}
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
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    aria-label={folded ? `Développer ${folder.name}` : `Réduire ${folder.name}`}
                    aria-expanded={!folded}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCollapsed(folded ? collapsed.filter((path) => path !== folder.path) : [...collapsed, folder.path]);
                    }}
                  >
                    {folded ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
                  </ActionIcon>
                ) : (
                  <Box w={22} />
                )}
                {FOLDER_ICONS[folder.specialUse ?? ''] ?? <FolderIcon aria-hidden />}
              </Group>
            }
            rightSection={
              <Group gap={2} wrap="nowrap">
                {folder.unseen > 0 && (
                  <Badge size="xs" variant="filled" circle={folder.unseen < 10}>
                    {folder.unseen}
                  </Badge>
                )}
                <Menu position="bottom-end" shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Actions sur le dossier ${folder.name}`} onClick={(event) => event.stopPropagation()}>
                      <DotsThreeIcon weight="bold" aria-hidden />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                    <Menu.Item leftSection={<FolderPlusIcon aria-hidden />} onClick={() => askCreate(folder.path)}>
                      Nouveau sous-dossier
                    </Menu.Item>
                    <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} disabled={special} onClick={() => askRename(folder)}>
                      Renommer
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" disabled={special} onClick={() => askDelete(folder)}>
                      Supprimer
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
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
            onDragOver={(event) => {
              if (!droppable) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOver(folder.path);
            }}
            onDragLeave={() => setOver((current) => (current === folder.path ? null : current))}
            onDrop={(event) => {
              setOver(null);
              if (!droppable || !dragged) return;
              event.preventDefault();
              move.mutate(
                { accountId: account.id, folder: dragged.folder, uids: dragged.uids, target: folder.path },
                {
                  onSuccess: () => {
                    notifySuccess(`${dragged.uids.length > 1 ? `${dragged.uids.length} mails déplacés` : 'Mail déplacé'} dans « ${folder.name} ».`);
                    onDropped();
                  },
                  onError: (failure) => notifyError(failure.message),
                },
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
