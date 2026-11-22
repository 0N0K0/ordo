import { MailHeaderActions } from '../components/MailHeaderActions';
import { PAGES, SETTINGS_PARAM } from '../../../app/pages';
import { MailListControls } from '../components/MailListControls';
import { MAIL_SORTS, type DoneFilter } from '../lib/mail-list';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { useSetParams } from '../../../lib/search-params';
import { countOf } from '../../../lib/text';
import { PageHeader } from '../../../components/page/PageHeader';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Badge, Box, Grid, NavLink, Paper, Stack, Text } from '@mantine/core';
import { mapById, joinedKey } from '@ordo/shared';

import { ClockCountdownIcon, EnvelopeSimpleIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useOwnAddresses } from '../hooks/use-own-addresses';
import { useMailAccounts, useMailFolders, useMailLabels, useMailMessages, useScheduledMails } from '../api';
import { AccountFolders } from '../components/MailFolders';
import { mailsDrag, type MailDrag } from '../lib/mail-dnd';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { innermostCollision, suppressClickAfterDrop, useDragSensors } from '../../../components/dnd/drag';
import { DragLabel } from '../../../components/dnd/DragLabel';
import { MailListItem } from '../components/MailListItem';
import { MailListPane } from '../components/MailListPane';
import { MailSettings } from '../components/MailSettings';
import { MailSelectionBar } from '../components/MailOrganizeActions';
import classes from './MailPage.module.css';
import { MailReader } from '../components/MailReader';
import { AdvancedSearchHeader, AdvancedSearchPanel } from '../components/AdvancedSearchPanel';
import { MailSearchFolders, MailSearchList } from '../components/MailSearchFolders';
import { openSearchForm } from '../lib/open-search-form';
import { useMailSearch } from '../hooks/use-mail-search';
import { ScheduledMailsList } from '../components/ScheduledMailsList';
import { MailAccountsManager } from '../components/MailAccountsManager';
import { useMailComposer } from '../hooks/use-mail-composer';
import { PageSettings } from '../../../app/layout/PageSettings';
import { useSettingsOpened } from '../../../app/layout/page-settings';
import { unarchived } from '../../../lib/archive';
import { MailSearchBar } from '../components/MailSearchBar';
import { selectionFlags, usePageSelection } from '../hooks/use-page-selection';
import { taggedKey } from '../../../lib/tagged-key';

/**
 * Mail client: accounts (managed in a dialog, or right in the page without any) and folders (managed, mails dropped in them), search folders (kept in Ordo), scheduled
 * mails, messages of the selected
 * folder (latest first, searchable, filtered on the done state, paged, several selected for the organizing
 * actions and dragged to a folder), and the open message. Everything is read live on the servers. The
 * selection is kept in the URL.
 * @returns {JSX.Element} Page.
 */
export function MailPage() {
  const { data: accounts, isPending } = useMailAccounts();
  const [params] = useSearchParams();
  const setParams = useSetParams();
  const compose = useMailComposer();
  // Text and advanced search, in the URL.
  const mailSearch = useMailSearch();
  const { text: search, debouncedText: debouncedSearch, advanced, advancedOpen } = mailSearch;

  // The archived accounts are left out of the page (restored from its settings).
  const active = useMemo(() => unarchived(accounts ?? []), [accounts]);
  // An archived or unknown account asked in the URL: the first active one instead (once the accounts are known).
  const requested = params.get('account');
  const accountId = (requested && (!accounts || active.some((account) => account.id === requested)) ? requested : null) ?? active[0]?.id ?? null;
  const folder = params.get('folder') ?? 'INBOX';
  const uid = params.get('uid') ? Number(params.get('uid')) : null;
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const scheduledView = params.get('view') === 'scheduled';
  // Search folder shown (its mails open in their account and folder).
  const searchId = params.get('search');
  const sortParam = MAIL_SORTS.find((item) => item.value === params.get('sort'))?.value ?? 'date-desc';
  const [sortBy, sortDirection] = sortParam.split('-') as [string, string];
  const doneFilter = (['todo', 'done'].includes(params.get('state') ?? '') ? params.get('state') : 'all') as DoneFilter;
  const messages = useMailMessages(
    accountId && !scheduledView && !searchId && !advanced ? { accountId, folder, page: page - 1, search: debouncedSearch, state: doneFilter, sort: sortBy, ascending: sortDirection === 'asc' } : null,
  );
  const { data: folders } = useMailFolders(accountId);
  const { data: labels } = useMailLabels();
  const { data: scheduled } = useScheduledMails();
  const isDrafts = folders?.find((item) => item.path === folder)?.specialUse === '\\Drafts';
  const labelById = useMemo(() => mapById(labels ?? []), [labels]);
  const ownAddresses = useOwnAddresses();
  // Mails ticked in the list (of the folder shown), and what is dragged (mails to a folder, a folder in its tree).
  const { selected, setSelected, tick } = usePageSelection<number>(joinedKey(accountId, folder, page, doneFilter, debouncedSearch));
  const [dragged, setDragged] = useState<MailDrag | null>(null);
  const sensors = useDragSensors();
  // Accounts and flags are managed in the settings sidebar (the old ?accounts=1 opens it).
  const { setOpened: setSettingsOpened } = useSettingsOpened();
  const openSettings = () => setSettingsOpened(true);
  useEffect(() => {
    if (params.get('accounts') === '1') setParams({ accounts: null, [SETTINGS_PARAM]: '1' });
  }, [params, setParams]);
  const selectedMessages = (messages.data?.messages ?? []).filter((message) => selected.includes(message.uid));

  /**
   * Updates the selection in the URL.
   * @param {Record<string, string | null>} changes Parameters; null removes one.
   * @returns {void}
   */
  const update = (changes: Record<string, string | null>) => setParams(changes);

  if (!isPending && active.length === 0) {
    return (
      <Stack gap="lg">
        <PageHeader title={PAGES.mail.label} />
        <EmptyState
          icon={<EnvelopeSimpleIcon aria-hidden />}
          message={accounts?.length ? 'Toutes les boîtes mail sont archivées : restaurez-en une, ou ajoutez-en une.' : 'Aucune boîte mail configurée : ajoutez-en une.'}
        />
        <MailAccountsManager />
      </Stack>
    );
  }

  const total = messages.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (messages.data?.pageSize ?? 50)));

  // Results of a search (saved or advanced): their pages, the mail opened, the labels managed.
  const searchListProps = {
    page,
    onPage: (value: number) => update({ page: value > 1 ? String(value) : null, uid: null }),
    onOpen: (mail: { accountId: string; folder: string; uid: number }) => update({ account: mail.accountId, folder: mail.folder, uid: String(mail.uid) }),
    onOpenGone: () => update({ uid: null }),
    onManageLabels: openSettings,
  };

  return (
    <Stack gap="md" className={classes.page}>
      {/* Mail accounts and flags: in the settings sidebar. */}
      <PageSettings title="Paramètres des mails">
        <MailSettings />
      </PageSettings>
      <PageHeader
        title={PAGES.mail.label}
        actions={
          <>
            <MailHeaderActions onCompose={() => compose({ accountId })} />
          </>
        }
      />
      <DndContext
        sensors={sensors}
        collisionDetection={innermostCollision}
        onDragStart={({ active }) => setDragged((active.data.current as MailDrag | undefined) ?? null)}
        onDragEnd={() => {
          setDragged(null);
          suppressClickAfterDrop();
        }}
        onDragCancel={() => setDragged(null)}
      >
        <Grid gap="md" classNames={{ root: classes.grid, inner: classes.gridInner }}>
          <Grid.Col span={{ base: 12, md: 3, xl: 2 }} className={classes.column}>
            <Paper withBorder radius="md" p={4} className={`${classes.pane} ${classes.paneScroll}`}>
              <NavLink
                label="Envois programmés"
                leftSection={<ClockCountdownIcon aria-hidden />}
                rightSection={
                  (scheduled?.length ?? 0) > 0 && (
                    <Badge size="xs" variant="light" color={scheduled?.some((mail) => mail.status === 'FAILED') ? 'red' : 'blue'}>
                      {scheduled?.length}
                    </Badge>
                  )
                }
                active={scheduledView}
                onClick={() => update({ view: 'scheduled', uid: null, page: null, search: null, adv: null })}
              />
              <MailSearchFolders selectedId={scheduledView ? null : searchId} onSelect={(id) => update({ search: id, view: null, uid: null, page: null, adv: null })} />
              {isPending ? (
                <ListSkeleton items={5} dense avatar />
              ) : (
                active.map((account) => (
                  <AccountFolders
                    key={account.id}
                    account={account}
                    selected={accountId && !scheduledView && !searchId ? { accountId, folder } : null}
                    onSelect={(next) => update({ account: next.accountId, folder: next.folder, uid: null, page: null, view: null, search: null, adv: null })}
                    onDropped={(mails) => {
                      setSelected([]);
                      if (uid !== null && mails.uids.includes(uid)) update({ uid: null });
                    }}
                  />
                ))
              )}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 9, xl: 4 }} className={classes.column}>
            <Paper withBorder radius="md" className={classes.pane}>
              {scheduledView ? (
                <div className={classes.paneScroll}>
                  <ScheduledMailsList />
                </div>
              ) : advanced && accountId ? (
                <>
                  <AdvancedSearchHeader
                    p="xs"
                    className={classes.listHeader}
                    open={advancedOpen}
                    onToggle={() => mailSearch.setAdvancedOpen(!advancedOpen)}
                    onQuit={() => mailSearch.setAdvanced(null, { page: null, uid: null })}
                  />
                  {advancedOpen && (
                    <Box p="xs" className={classes.listHeader}>
                      <AdvancedSearchPanel
                        accountId={accountId}
                        folder={folder}
                        value={advanced}
                        onSearch={(criteria) => update({ adv: JSON.stringify(criteria), page: null, uid: null })}
                        onClear={() => mailSearch.setAdvanced(null, { page: null, uid: null })}
                        onSave={(criteria) => openSearchForm(undefined, (id) => update({ adv: null, search: id, page: null, uid: null }), criteria)}
                      />
                    </Box>
                  )}
                  <MailSearchList query={{ criteria: advanced }} open={uid !== null ? { accountId, folder, uid } : null} {...searchListProps} />
                </>
              ) : searchId ? (
                <MailSearchList query={{ id: searchId }} open={accountId && uid !== null ? { accountId, folder, uid } : null} {...searchListProps} />
              ) : (
                <MailListPane
                  top={
                    <>
                      <MailSearchBar
                        label="Rechercher dans le dossier"
                        value={search}
                        onChange={(text) => mailSearch.setText(text, { page: null })}
                        advancedOpen={advancedOpen}
                        onToggleAdvanced={() => mailSearch.setAdvancedOpen(!advancedOpen)}
                      />
                      {advancedOpen && accountId && (
                        <AdvancedSearchPanel
                          accountId={accountId}
                          folder={folder}
                          value={null}
                          onSearch={(criteria) => update({ adv: JSON.stringify(criteria), page: null, uid: null })}
                          onClear={() => mailSearch.setAdvancedOpen(false)}
                          onSave={(criteria) => openSearchForm(undefined, (id) => update({ search: id, page: null, uid: null }), criteria)}
                        />
                      )}
                    </>
                  }
                  selection={{
                    count: selected.length,
                    total: messages.data?.messages.length ?? 0,
                    onAll: (checked) => setSelected(checked ? (messages.data?.messages ?? []).map((message) => message.uid) : []),
                  }}
                  toolbar={
                    selected.length > 0 && accountId ? (
                      <MailSelectionBar
                        groups={[{ accountId, folder, uids: selected }]}
                        {...selectionFlags(selectedMessages, labels)}
                        onGone={() => {
                          setSelected([]);
                          if (uid !== null && selected.includes(uid)) update({ uid: null });
                        }}
                        onClear={() => setSelected([])}
                        onManageLabels={openSettings}
                      />
                    ) : (
                      <MailListControls
                        sorts={MAIL_SORTS}
                        sort={sortParam}
                        onSort={(value) => update({ sort: value === 'date-desc' ? null : value, page: null })}
                        done={doneFilter}
                        onDone={(value) => update({ state: value === 'all' ? null : value, page: null, uid: null })}
                      />
                    )
                  }
                  status={
                    messages.error ? (
                      <ErrorAlert m="xs">{messages.error.message}</ErrorAlert>
                    ) : messages.isPending && accountId ? (
                      <ListSkeleton items={6} lines={2} />
                    ) : total === 0 ? (
                      <Box p="xl">
                        <EmptyState
                          plain
                          icon={<EnvelopeSimpleIcon aria-hidden />}
                          message={
                            debouncedSearch
                              ? 'Aucun mail ne correspond à la recherche.'
                              : doneFilter === 'todo'
                                ? 'Aucun mail à traiter.'
                                : doneFilter === 'done'
                                  ? 'Aucun mail traité.'
                                  : 'Aucun mail dans ce dossier.'
                          }
                        />
                      </Box>
                    ) : undefined
                  }
                  stale={messages.isPlaceholderData}
                  page={page}
                  pages={pages}
                  onPage={(value) => update({ page: value > 1 ? String(value) : null, uid: null })}
                >
                  {messages.data?.messages.map((message) => {
                    const ticked = selected.includes(message.uid);
                    return (
                      <MailListItem
                        key={message.uid}
                        message={message}
                        labels={message.labelIds.map((id) => labelById.get(id)).filter((label) => label !== undefined)}
                        ownAddresses={ownAddresses}
                        active={message.uid === uid}
                        ticked={ticked}
                        onTick={(checked) => tick(message.uid, checked)}
                        onOpen={() => update({ uid: String(message.uid) })}
                        // The ticked mails, or this one.
                        drag={accountId ? { id: taggedKey('mail', message.uid), data: mailsDrag({ accountId, folder, uids: ticked ? selected : [message.uid] }) } : undefined}
                      />
                    );
                  })}
                </MailListPane>
              )}
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, xl: 6 }} className={classes.column}>
            <Paper withBorder radius="md" p="md" className={`${classes.pane} ${classes.paneScroll}`}>
              {accountId && uid !== null ? (
                <MailReader
                  key={`${accountId}-${folder}-${uid}`}
                  accountId={accountId}
                  folder={folder}
                  uid={uid}
                  isDraft={isDrafts}
                  onDeleted={() => update({ uid: null })}
                  onManageLabels={openSettings}
                />
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  Sélectionnez un mail pour le lire.
                </Text>
              )}
            </Paper>
          </Grid.Col>
        </Grid>
        <DragOverlay dropAnimation={null}>{dragged && <DragLabel label={dragged.kind === 'mails' ? countOf(dragged.mails.uids.length, 'mail') : dragged.folder.name} />}</DragOverlay>
      </DndContext>
    </Stack>
  );
}
