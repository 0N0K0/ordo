import { ActionIcon, Alert, Badge, Box, Group, Menu, NavLink, Pagination, ScrollArea, Skeleton, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { CheckCircleIcon, DotsThreeIcon, FlagIcon, FunnelIcon, MagnifyingGlassPlusIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useMailAccounts, useMailLabels, useMailSearchMutations, useMailSearchResults, useMailSearches, type MailSearch } from './api';
import { correspondent, listDate } from './mail-format';
import classes from './MailPage.module.css';
import { MailSearchForm } from './MailSearchForm';

let modalCount = 0;

/**
 * Opens the form of a search folder.
 * @param {MailSearch | undefined} search Search edited (none: new).
 * @param {(id: string) => void} [onCreated] Called with the id of a new search. Optional.
 * @returns {void}
 */
function openSearchForm(search: MailSearch | undefined, onCreated?: (id: string) => void): void {
  const modalId = `mail-search-${++modalCount}`;
  modals.open({
    modalId,
    title: search ? 'Modifier le dossier de recherche' : 'Nouveau dossier de recherche',
    size: 'lg',
    children: (
      <MailSearchForm
        search={search}
        onDone={(id) => {
          modals.close(modalId);
          if (id) onCreated?.(id);
        }}
      />
    ),
  });
}

/**
 * Search folders in the navigation: open one, create, edit, delete.
 * @param {{ selectedId: string | null, onSelect: (id: string | null) => void }} props Search shown and its change.
 * @returns {JSX.Element} Folders.
 */
export function MailSearchFolders({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { data: searches } = useMailSearches();
  const { remove } = useMailSearchMutations();

  /**
   * Asks for confirmation before deleting a search folder.
   * @param {MailSearch} search Search.
   * @returns {void}
   */
  const askDelete = (search: MailSearch) => {
    const modalId = `delete-mail-search-${search.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le dossier de recherche',
      children: (
        <Stack gap="md">
          <Text size="sm">Le dossier de recherche « {search.name} » sera supprimé définitivement. Les mails qu’il montre ne sont pas touchés.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(search.id, {
                onSuccess: () => {
                  notifySuccess('Dossier de recherche supprimé.');
                  if (selectedId === search.id) onSelect(null);
                },
                onError: (error) => notifyError(error.message),
              });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <NavLink label="Dossiers de recherche" leftSection={<FunnelIcon aria-hidden />} defaultOpened childrenOffset={8}>
      {(searches ?? []).map((search) => (
        <NavLink
          key={search.id}
          component="div"
          role="button"
          tabIndex={0}
          label={search.name}
          leftSection={<FunnelIcon aria-hidden />}
          active={selectedId === search.id}
          onClick={() => onSelect(search.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(search.id);
            }
          }}
          rightSection={
            <Menu position="bottom-end" shadow="md" withinPortal>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Actions sur ${search.name}`} onClick={(event) => event.stopPropagation()}>
                  <DotsThreeIcon weight="bold" aria-hidden />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
                <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openSearchForm(search)}>
                  Modifier
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={() => askDelete(search)}>
                  Supprimer
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          }
        />
      ))}
      <NavLink component="button" label="Nouveau dossier de recherche" leftSection={<MagnifyingGlassPlusIcon aria-hidden />} c="dimmed" onClick={() => openSearchForm(undefined, onSelect)} />
    </NavLink>
  );
}

interface MailSearchListProps {
  searchId: string;
  page: number;
  onPage: (page: number) => void;
  /** Mail open. */
  open: { accountId: string; folder: string; uid: number } | null;
  onOpen: (mail: { accountId: string; folder: string; uid: number }) => void;
}

/**
 * Mails of a search folder, latest first, with their account and folder.
 * @param {MailSearchListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function MailSearchList({ searchId, page, onPage, open, onOpen }: MailSearchListProps) {
  const results = useMailSearchResults({ id: searchId, page: page - 1 });
  const { data: labels } = useMailLabels();
  const { data: accounts } = useMailAccounts();
  const several = (accounts?.length ?? 0) > 1;
  // Mails sent from one of these show their recipients.
  const ownAddresses = new Set((accounts ?? []).map((account) => account.email.toLowerCase()));
  if (results.error) {
    return (
      <Alert color="red" icon={<ErrorIcon />} m="xs">
        {results.error.message}
      </Alert>
    );
  }
  if (results.isPending) {
    return (
      <Stack gap={4} p="xs">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} height={44} />
        ))}
      </Stack>
    );
  }
  const total = results.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (results.data?.pageSize ?? 50)));
  if (total === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" p="xl">
        Aucun mail ne répond aux critères de ce dossier.
      </Text>
    );
  }
  return (
    <>
      <ScrollArea.Autosize mah="calc(100dvh - 260px)" style={{ opacity: results.isPlaceholderData ? 0.6 : 1 }}>
        {results.data?.messages.map((message) => {
          const active = open?.accountId === message.accountId && open.folder === message.folder && open.uid === message.uid;
          return (
            <div
              key={`${message.accountId}-${message.folder}-${message.uid}`}
              role="button"
              tabIndex={0}
              className={classes.item}
              data-active={active || undefined}
              data-unread={!message.seen || undefined}
              data-done={message.done || undefined}
              onClick={() => onOpen(message)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen(message);
              }}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
                  {message.done && <CheckCircleIcon weight="fill" color="var(--mantine-color-green-6)" aria-label="Traité" style={{ flex: 'none' }} />}
                  <Text size="sm" truncate className={classes.sender}>
                    {correspondent(message, ownAddresses)}
                  </Text>
                </Group>
                <Group gap={4} wrap="nowrap">
                  {message.labelIds
                    .map((id) => labels?.find((label) => label.id === id))
                    .filter((label) => label !== undefined)
                    .map((label) => (
                      <Tooltip key={label.id} label={label.name}>
                        <FlagIcon weight="fill" color={label.color} aria-label={`Drapeau ${label.name}`} />
                      </Tooltip>
                    ))}
                  {message.hasAttachments && <PaperclipIcon aria-label="Pièces jointes" />}
                  <Text size="xs" c="dimmed">
                    {listDate(String(message.date))}
                  </Text>
                </Group>
              </Group>
              <Text size="sm" truncate className={classes.subject}>
                {message.subject}
              </Text>
              <Box>
                <Badge size="xs" variant="light" color="gray">
                  {several ? `${accounts?.find((account) => account.id === message.accountId)?.name ?? ''} · ` : ''}
                  {message.folderName}
                </Badge>
              </Box>
            </div>
          );
        })}
      </ScrollArea.Autosize>
      {pages > 1 && (
        <Group justify="center" p="xs" className={classes.listFooter}>
          <Pagination size="sm" total={pages} value={page} onChange={onPage} />
        </Group>
      )}
    </>
  );
}
