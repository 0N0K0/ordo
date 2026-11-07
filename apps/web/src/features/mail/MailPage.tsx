import { ActionIcon, Alert, Badge, Box, Button, Checkbox, Grid, Group, Modal, NavLink, Pagination, Paper, SegmentedControl, Select, Skeleton, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { mailSearchCriteriaSchema } from '@ordo/shared';
import { useDebouncedValue } from '@mantine/hooks';
import { CheckCircleIcon, ClockCountdownIcon, EnvelopeSimpleIcon, FlagIcon, GearSixIcon, MagnifyingGlassIcon, PaperclipIcon, PencilSimpleLineIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { useMailAccounts, useMailFolders, useMailLabels, useMailMessages, useScheduledMails } from './api';
import { AccountFolders, type DraggedMails } from './MailFolders';
import { correspondent, listDate } from './mail-format';
import { MailLabelsManager } from './MailLabelsManager';
import { MailSelectionBar } from './MailOrganizeActions';
import classes from './MailPage.module.css';
import { MailReader } from './MailReader';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { MailSearchFolders, MailSearchList } from './MailSearchFolders';
import { openSearchForm } from './open-search-form';
import { ScheduledMailsList } from './ScheduledMailsList';
import { MailAccountsManager } from './settings/MailAccountsManager';
import { useMailComposer } from './use-mail-composer';

type DoneFilter = 'all' | 'todo' | 'done';

const SORTS = [
  { value: 'date-desc', label: 'Plus récents' },
  { value: 'date-asc', label: 'Plus anciens' },
  { value: 'correspondent-asc', label: 'Expéditeur (A → Z)' },
  { value: 'correspondent-desc', label: 'Expéditeur (Z → A)' },
  { value: 'subject-asc', label: 'Objet (A → Z)' },
  { value: 'subject-desc', label: 'Objet (Z → A)' },
  { value: 'size-desc', label: 'Plus lourds' },
  { value: 'size-asc', label: 'Plus légers' },
];

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
  const [params, setParams] = useSearchParams();
  const compose = useMailComposer();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debouncedSearch] = useDebouncedValue(search, 400);

  const accountId = params.get('account') ?? accounts?.[0]?.id ?? null;
  const folder = params.get('folder') ?? 'INBOX';
  const uid = params.get('uid') ? Number(params.get('uid')) : null;
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const scheduledView = params.get('view') === 'scheduled';
  // Search folder shown (its mails open in their account and folder).
  const searchId = params.get('search');
  // Advanced search applied (criteria in the URL).
  const advanced = useMemo(() => {
    try {
      const parsed = mailSearchCriteriaSchema.safeParse(JSON.parse(params.get('adv') ?? 'null'));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }, [params]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const sortParam = SORTS.find((item) => item.value === params.get('sort'))?.value ?? 'date-desc';
  const [sortBy, sortDirection] = sortParam.split('-') as [string, string];
  const doneFilter = (['todo', 'done'].includes(params.get('state') ?? '') ? params.get('state') : 'all') as DoneFilter;
  const messages = useMailMessages(
    accountId && !scheduledView && !searchId && !advanced
      ? { accountId, folder, page: page - 1, search: debouncedSearch, state: doneFilter, sort: sortBy, ascending: sortDirection === 'asc' }
      : null,
  );
  const { data: folders } = useMailFolders(accountId);
  const { data: labels } = useMailLabels();
  const { data: scheduled } = useScheduledMails();
  const isDrafts = folders?.find((item) => item.path === folder)?.specialUse === '\\Drafts';
  const labelById = useMemo(() => new Map((labels ?? []).map((label) => [label.id, label])), [labels]);
  // Mails sent from one of these show their recipients.
  const ownAddresses = useMemo(() => new Set((accounts ?? []).map((account) => account.email.toLowerCase())), [accounts]);
  // Mails ticked in the list (of the folder shown), and mails being dragged to a folder.
  const [selection, setSelection] = useState<{ key: string; uids: number[] }>({ key: '', uids: [] });
  const selectionKey = `${accountId}|${folder}|${page}|${doneFilter}|${debouncedSearch}`;
  const selected = selection.key === selectionKey ? selection.uids : [];
  const setSelected = (uids: number[]) => setSelection({ key: selectionKey, uids });
  const [dragged, setDragged] = useState<DraggedMails | null>(null);
  const [managingLabels, setManagingLabels] = useState(false);
  // Management of the mail accounts, opened from the URL too (?accounts=1).
  const accountsOpen = params.get('accounts') === '1';
  const selectedMessages = (messages.data?.messages ?? []).filter((message) => selected.includes(message.uid));

  /**
   * Updates the selection in the URL.
   * @param {Record<string, string | null>} changes Parameters; null removes one.
   * @returns {void}
   */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  };

  if (!isPending && accounts?.length === 0) {
    return (
      <Stack gap="lg">
        <Title order={1} size="h2">
          Mails
        </Title>
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <EnvelopeSimpleIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucune boîte mail configurée : ajoutez-en une.
            </Text>
          </Stack>
        </Paper>
        <MailAccountsManager />
      </Stack>
    );
  }

  const total = messages.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (messages.data?.pageSize ?? 50)));

  return (
    <Stack gap="md" className={classes.page}>
      <Modal opened={managingLabels} onClose={() => setManagingLabels(false)} title="Drapeaux">
        {managingLabels && <MailLabelsManager />}
      </Modal>
      <Modal opened={accountsOpen} onClose={() => update({ accounts: null })} title="Boîtes mail" size="xl">
        {accountsOpen && <MailAccountsManager />}
      </Modal>
      <Group justify="space-between">
        <Title order={1} size="h2">
          Mails
        </Title>
        <Group gap="sm">
          <Tooltip label="Ajouter, modifier ou retirer une boîte mail">
            <Button variant="default" leftSection={<GearSixIcon aria-hidden />} onClick={() => update({ accounts: '1' })}>
              Boîtes mail
            </Button>
          </Tooltip>
          <Button leftSection={<PencilSimpleLineIcon aria-hidden />} onClick={() => compose({ accountId })}>
            Nouveau mail
          </Button>
        </Group>
      </Group>
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
              <Skeleton height={120} />
            ) : (
              accounts?.map((account) => (
                <AccountFolders
                  key={account.id}
                  account={account}
                  selected={accountId && !scheduledView && !searchId ? { accountId, folder } : null}
                  onSelect={(next) => update({ account: next.accountId, folder: next.folder, uid: null, page: null, view: null, search: null, adv: null })}
                  dragged={dragged}
                  onDropped={() => {
                    setDragged(null);
                    setSelected([]);
                    if (uid !== null && dragged?.uids.includes(uid)) update({ uid: null });
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
                <Group justify="space-between" p="xs" gap="xs" className={classes.listHeader}>
                  <Text size="sm" fw={600}>
                    Recherche avancée
                  </Text>
                  <Group gap={4}>
                    <Button size="compact-xs" variant="subtle" onClick={() => setAdvancedOpen((open) => !open)}>
                      {advancedOpen ? 'Masquer les critères' : 'Modifier'}
                    </Button>
                    <Button size="compact-xs" variant="subtle" color="gray" onClick={() => update({ adv: null, page: null, uid: null })}>
                      Quitter
                    </Button>
                  </Group>
                </Group>
                {advancedOpen && (
                  <Box p="xs" className={classes.listHeader}>
                    <AdvancedSearchPanel
                      accountId={accountId}
                      folder={folder}
                      value={advanced}
                      onSearch={(criteria) => update({ adv: JSON.stringify(criteria), page: null, uid: null })}
                      onClear={() => {
                        setAdvancedOpen(false);
                        update({ adv: null, page: null, uid: null });
                      }}
                      onSave={(criteria) => openSearchForm(undefined, (id) => update({ adv: null, search: id, page: null, uid: null }), criteria)}
                    />
                  </Box>
                )}
                <MailSearchList
                  query={{ criteria: advanced }}
                  page={page}
                  onPage={(value) => update({ page: value > 1 ? String(value) : null, uid: null })}
                  open={uid !== null ? { accountId, folder, uid } : null}
                  onOpen={(mail) => update({ account: mail.accountId, folder: mail.folder, uid: String(mail.uid) })}
                  onOpenGone={() => update({ uid: null })}
                  onManageLabels={() => setManagingLabels(true)}
                />
              </>
            ) : searchId ? (
              <MailSearchList
                query={{ id: searchId }}
                page={page}
                onPage={(value) => update({ page: value > 1 ? String(value) : null, uid: null })}
                open={accountId && uid !== null ? { accountId, folder, uid } : null}
                onOpen={(mail) => update({ account: mail.accountId, folder: mail.folder, uid: String(mail.uid) })}
                  onOpenGone={() => update({ uid: null })}
                  onManageLabels={() => setManagingLabels(true)}
              />
            ) : (
              <>
            <Stack gap={6} p="xs" className={classes.listHeader}>
              <Group gap={4} wrap="nowrap">
                <TextInput
                  size="xs"
                  style={{ flex: 1 }}
                  placeholder="Rechercher (objet, expéditeur, texte)"
                  aria-label="Rechercher dans le dossier"
                  leftSection={<MagnifyingGlassIcon aria-hidden />}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.currentTarget.value);
                    update({ page: null, q: event.currentTarget.value || null });
                  }}
                />
                <Tooltip label="Recherche avancée">
                  <ActionIcon variant={advancedOpen ? 'light' : 'subtle'} color="gray" aria-label="Recherche avancée" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
                    <SlidersHorizontalIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
              {advancedOpen && accountId && (
                <AdvancedSearchPanel
                  accountId={accountId}
                  folder={folder}
                  value={null}
                  onSearch={(criteria) => update({ adv: JSON.stringify(criteria), page: null, uid: null })}
                  onClear={() => setAdvancedOpen(false)}
                  onSave={(criteria) => openSearchForm(undefined, (id) => update({ search: id, page: null, uid: null }), criteria)}
                />
              )}
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Checkbox
                  size="xs"
                  aria-label="Tout sélectionner sur la page"
                  checked={selected.length > 0 && selected.length === (messages.data?.messages.length ?? 0)}
                  indeterminate={selected.length > 0 && selected.length < (messages.data?.messages.length ?? 0)}
                  disabled={!messages.data?.messages.length}
                  onChange={(event) => setSelected(event.currentTarget.checked ? (messages.data?.messages ?? []).map((message) => message.uid) : [])}
                />
                {selected.length > 0 && accountId ? (
                  <MailSelectionBar
                    groups={[{ accountId, folder, uids: selected }]}
                    done={selectedMessages.length > 0 && selectedMessages.every((message) => message.done)}
                    labelIds={(labels ?? []).map((label) => label.id).filter((id) => selectedMessages.length > 0 && selectedMessages.every((message) => message.labelIds.includes(id)))}
                    onGone={() => {
                      setSelected([]);
                      if (uid !== null && selected.includes(uid)) update({ uid: null });
                    }}
                    onClear={() => setSelected([])}
                    onManageLabels={() => setManagingLabels(true)}
                  />
                ) : (
                  <Group gap={4} wrap="nowrap">
                  <Select
                    size="xs"
                    w={150}
                    aria-label="Trier"
                    data={SORTS}
                    value={sortParam}
                    allowDeselect={false}
                    onChange={(value) => value && update({ sort: value === 'date-desc' ? null : value, page: null })}
                  />
                  <SegmentedControl
                    size="xs"
                    aria-label="Mails traités"
                    data={[
                      { value: 'all', label: 'Tous' },
                      { value: 'todo', label: 'À traiter' },
                      { value: 'done', label: 'Traités' },
                    ]}
                    value={doneFilter}
                    onChange={(value) => update({ state: value === 'all' ? null : value, page: null, uid: null })}
                  />
                  </Group>
                )}
              </Group>
            </Stack>
            {messages.error ? (
              <Alert color="red" icon={<ErrorIcon />} m="xs">
                {messages.error.message}
              </Alert>
            ) : messages.isPending && accountId ? (
              <Stack gap={4} p="xs">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <Skeleton key={index} height={44} />
                ))}
              </Stack>
            ) : total === 0 ? (
              <Text size="sm" c="dimmed" ta="center" p="xl">
                {debouncedSearch ? 'Aucun mail ne correspond à la recherche.' : doneFilter === 'todo' ? 'Aucun mail à traiter.' : doneFilter === 'done' ? 'Aucun mail traité.' : 'Aucun mail dans ce dossier.'}
              </Text>
            ) : (
              <div className={classes.paneScroll} style={{ opacity: messages.isPlaceholderData ? 0.6 : 1 }}>
                {messages.data?.messages.map((message) => {
                  const ticked = selected.includes(message.uid);
                  const messageLabels = message.labelIds.map((id) => labelById.get(id)).filter((label) => label !== undefined);
                  return (
                    <div
                      key={message.uid}
                      role="button"
                      tabIndex={0}
                      className={classes.item}
                      data-active={message.uid === uid || undefined}
                      data-unread={!message.seen || undefined}
                      data-done={message.done || undefined}
                      data-selected={ticked || undefined}
                      draggable={Boolean(accountId)}
                      onDragStart={(event) => {
                        if (!accountId) return;
                        // The ticked mails, or this one.
                        const uids = ticked ? selected : [message.uid];
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', `${uids.length} mail(s)`);
                        setDragged({ accountId, folder, uids });
                      }}
                      onDragEnd={() => setDragged(null)}
                      onClick={() => update({ uid: String(message.uid) })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') update({ uid: String(message.uid) });
                      }}
                    >
                      <Group gap="xs" wrap="nowrap" align="flex-start">
                        <Checkbox
                          size="xs"
                          mt={3}
                          aria-label={`Sélectionner « ${message.subject} »`}
                          checked={ticked}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setSelected(event.currentTarget.checked ? [...selected, message.uid] : selected.filter((item) => item !== message.uid))}
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
                              {messageLabels.map((label) => (
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
                        </Box>
                      </Group>
                    </div>
                  );
                })}
              </div>
            )}
            {pages > 1 && (
              <Group justify="center" p="xs" className={classes.listFooter}>
                <Pagination size="sm" total={pages} value={page} onChange={(value) => update({ page: value > 1 ? String(value) : null, uid: null })} />
              </Group>
            )}
              </>
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
                onManageLabels={() => setManagingLabels(true)}
              />
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Sélectionnez un mail pour le lire.
              </Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
