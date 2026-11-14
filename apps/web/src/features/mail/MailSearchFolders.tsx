import { ListSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { ActionIcon, Alert, Badge, Box, Checkbox, Group, Menu, NavLink, Pagination, Text, Tooltip } from '@mantine/core';
import type { MailSearchCriteria } from '@ordo/shared';
import { CheckCircleIcon, DotsThreeIcon, FlagIcon, FunnelIcon, MagnifyingGlassPlusIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailAccounts, useMailLabels, useMailSearchMutations, useMailSearchResults, useMailSearches, type MailSearch } from './api';
import { correspondent, listDate } from './mail-format';
import { groupMails } from './mail-groups';
import { MailSelectionBar } from './MailOrganizeActions';
import classes from './MailPage.module.css';
import { openSearchForm } from './open-search-form';

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
    confirmDestructive({
      title: 'Supprimer le dossier de recherche',
      risks: (
        <>
          <Text size="sm">Le dossier de recherche « {search.name} » sera supprimé définitivement. Les mails qu’il montre ne sont pas touchés.</Text>
        </>
      ),
      onConfirm: () => {
        remove.mutate(search.id, {
          onSuccess: () => {
            notifySuccess('Dossier de recherche supprimé.');
            if (selectedId === search.id) onSelect(null);
          },
          onError: (error) => notifyError(error.message),
        });
      },
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
  /** Search folder, or criteria of an advanced search (and their order). */
  query: { id: string } | { criteria: MailSearchCriteria; sort?: 'date' | 'correspondent' | 'subject'; ascending?: boolean };
  /** Message without any mail. Optional. */
  empty?: string;
  /** No move to another folder (the mails of a project). Optional. */
  noMove?: boolean;
  page: number;
  onPage: (page: number) => void;
  /** Mail open. */
  open: { accountId: string; folder: string; uid: number } | null;
  onOpen: (mail: { accountId: string; folder: string; uid: number }) => void;
  /** Called when the open mail left its folder (spam, move, deletion). */
  onOpenGone: () => void;
  onManageLabels: () => void;
}

/**
 * Key of a mail found, unique across accounts and folders.
 * @param {{ accountId: string, folder: string, uid: number }} mail Mail.
 * @returns {string} Key.
 */
const mailKey = (mail: { accountId: string; folder: string; uid: number }) => `${mail.accountId}|${mail.folder}|${mail.uid}`;

/**
 * Mails of a search folder or of an advanced search, latest first, with their account and folder; several can be
 * ticked for the actions on the selection (each applied in their folders).
 * @param {MailSearchListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function MailSearchList({ query, empty, noMove, page, onPage, open, onOpen, onOpenGone, onManageLabels }: MailSearchListProps) {
  const results = useMailSearchResults({ ...query, page: page - 1 });
  // Ticked mails, for the page of results shown.
  const pageKey = `${JSON.stringify(query)}|${page}`;
  const [selection, setSelection] = useState<{ key: string; mails: string[] }>({ key: '', mails: [] });
  const selected = selection.key === pageKey ? selection.mails : [];
  const setSelected = (mails: string[]) => setSelection({ key: pageKey, mails });
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
    return <ListSkeleton items={5} dense />;
  }
  const total = results.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (results.data?.pageSize ?? 50)));
  if (total === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" p="xl">
        {empty ?? `Aucun mail ne répond ${'id' in query ? 'aux critères de ce dossier' : 'à la recherche'}.`}
      </Text>
    );
  }
  const messages = results.data?.messages ?? [];
  const selectedMessages = messages.filter((message) => selected.includes(mailKey(message)));
  return (
    <>
      <Group gap="xs" wrap="nowrap" p="xs" className={classes.listHeader} mih={44}>
        <Checkbox
          size="xs"
          aria-label="Tout sélectionner sur la page"
          checked={selected.length > 0 && selected.length === messages.length}
          indeterminate={selected.length > 0 && selected.length < messages.length}
          onChange={(event) => setSelected(event.currentTarget.checked ? messages.map(mailKey) : [])}
        />
        {selected.length > 0 ? (
          <MailSelectionBar
            groups={groupMails(selectedMessages)}
            done={selectedMessages.length > 0 && selectedMessages.every((message) => message.done)}
            labelIds={(labels ?? []).map((label) => label.id).filter((id) => selectedMessages.length > 0 && selectedMessages.every((message) => message.labelIds.includes(id)))}
            onGone={() => {
              if (open && selected.includes(mailKey(open))) onOpenGone();
              setSelected([]);
            }}
            onClear={() => setSelected([])}
            onManageLabels={onManageLabels}
            noMove={noMove}
          />
        ) : (
          <Text size="xs" c="dimmed">
            {total} mail{total > 1 ? 's' : ''}
          </Text>
        )}
      </Group>
      <div className={classes.paneScroll} style={{ opacity: results.isPlaceholderData ? 0.6 : 1 }}>
        {messages.map((message) => {
          const active = open?.accountId === message.accountId && open.folder === message.folder && open.uid === message.uid;
          const ticked = selected.includes(mailKey(message));
          return (
            <div
              key={`${message.accountId}-${message.folder}-${message.uid}`}
              role="button"
              tabIndex={0}
              className={classes.item}
              data-active={active || undefined}
              data-unread={!message.seen || undefined}
              data-done={message.done || undefined}
              data-selected={ticked || undefined}
              onClick={() => onOpen(message)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen(message);
              }}
            >
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Checkbox
                  size="xs"
                  mt={3}
                  aria-label={`Sélectionner « ${message.subject} »`}
                  checked={ticked}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setSelected(event.currentTarget.checked ? [...selected, mailKey(message)] : selected.filter((key) => key !== mailKey(message)))}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
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
                </Box>
              </Group>
            </div>
          );
        })}
      </div>
      {pages > 1 && (
        <Group justify="center" p="xs" className={classes.listFooter}>
          <Pagination size="sm" total={pages} value={page} onChange={onPage} />
        </Group>
      )}
    </>
  );
}
