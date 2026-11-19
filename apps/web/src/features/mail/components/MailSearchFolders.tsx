import { EmptyState } from '../../../components/feedback/EmptyState';
import { joinedKey } from '@ordo/shared';
import { formCallbacks } from '../../../lib/form';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { countOf } from '../../../lib/text';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Badge, Box, Group, NavLink, Text } from '@mantine/core';
import type { MailSearchCriteria, MailSearchSortBy } from '@ordo/shared';
import { EnvelopeSimpleIcon, FunnelIcon, MagnifyingGlassPlusIcon, PencilSimpleIcon, TrashIcon } from '@phosphor-icons/react';

import { useOwnAddresses } from '../hooks/use-own-addresses';
import { useMailAccounts, useMailLabels, useMailSearchMutations, useMailSearchResults, useMailSearches, type MailSearch } from '../api';
import { MailListItem } from './MailListItem';
import { MailListPane } from './MailListPane';
import { groupMails } from '../lib/mail-groups';
import { MailSelectionBar } from './MailOrganizeActions';
import { openSearchForm } from '../lib/open-search-form';
import { selectionFlags, usePageSelection } from '../hooks/use-page-selection';

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
      risks: <>Le dossier de recherche « {search.label} » sera supprimé définitivement. Les mails qu’il montre ne sont pas touchés.</>,
      onConfirm: () => {
        remove.mutate(
          search.id,
          formCallbacks(null, 'Dossier de recherche supprimé.', () => {
            if (selectedId === search.id) onSelect(null);
          }),
        );
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
          label={search.label}
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
            <ActionsMenu
              name={search.label}
              size="xs"
              inRow
              items={[
                { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openSearchForm(search) },
                { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => askDelete(search) },
              ]}
            />
          }
        />
      ))}
      <NavLink component="button" label="Nouveau dossier de recherche" leftSection={<MagnifyingGlassPlusIcon aria-hidden />} c="dimmed" onClick={() => openSearchForm(undefined, onSelect)} />
    </NavLink>
  );
}

interface MailSearchListProps {
  /** Search folder, or criteria of an advanced search (and their order). */
  query: { id: string } | { criteria: MailSearchCriteria; sort?: MailSearchSortBy; ascending?: boolean };
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
const mailKey = (mail: { accountId: string; folder: string; uid: number }) => joinedKey(mail.accountId, mail.folder, mail.uid);

/**
 * Mails of a search folder or of an advanced search, latest first, with their account and folder; several can be
 * ticked for the actions on the selection (each applied in their folders).
 * @param {MailSearchListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function MailSearchList({ query, empty, noMove, page, onPage, open, onOpen, onOpenGone, onManageLabels }: MailSearchListProps) {
  const results = useMailSearchResults({ ...query, page: page - 1 });
  // Ticked mails, for the page of results shown.
  const pageKey = joinedKey(JSON.stringify(query), page);
  const { selected, setSelected, tick } = usePageSelection<string>(pageKey);
  const { data: labels } = useMailLabels();
  const { data: accounts } = useMailAccounts();
  const several = (accounts?.length ?? 0) > 1;
  const ownAddresses = useOwnAddresses();
  if (results.error) {
    return <ErrorAlert m="xs">{results.error.message}</ErrorAlert>;
  }
  if (results.isPending) {
    return <ListSkeleton items={5} dense />;
  }
  const total = results.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (results.data?.pageSize ?? 50)));
  if (total === 0) {
    return (
      <Box p="xl">
        <EmptyState plain icon={<EnvelopeSimpleIcon aria-hidden />} message={empty ?? `Aucun mail ne répond ${'id' in query ? 'aux critères de ce dossier' : 'à la recherche'}.`} />
      </Box>
    );
  }
  const messages = results.data?.messages ?? [];
  const selectedMessages = messages.filter((message) => selected.includes(mailKey(message)));
  return (
    <MailListPane
      selection={{ count: selected.length, total: messages.length, onAll: (checked) => setSelected(checked ? messages.map(mailKey) : []) }}
      toolbar={
        // Next to the box (not pushed to the right as the list controls of a folder).
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {selected.length > 0 ? (
            <MailSelectionBar
              groups={groupMails(selectedMessages)}
              {...selectionFlags(selectedMessages, labels)}
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
              {countOf(total, 'mail')}
            </Text>
          )}
        </Group>
      }
      stale={results.isPlaceholderData}
      page={page}
      pages={pages}
      onPage={onPage}
    >
      {messages.map((message) => {
        const key = mailKey(message);
        const ticked = selected.includes(key);
        return (
          <MailListItem
            key={key}
            message={message}
            labels={message.labelIds.map((id) => labels?.find((label) => label.id === id)).filter((label) => label !== undefined)}
            ownAddresses={ownAddresses}
            active={open?.accountId === message.accountId && open.folder === message.folder && open.uid === message.uid}
            ticked={ticked}
            onTick={(checked) => tick(key, checked)}
            onOpen={() => onOpen(message)}
            footer={
              <Box>
                <Badge size="xs" variant="light" color="gray">
                  {several ? `${accounts?.find((account) => account.id === message.accountId)?.label ?? ''} · ` : ''}
                  {message.folderName}
                </Badge>
              </Box>
            }
          />
        );
      })}
    </MailListPane>
  );
}
