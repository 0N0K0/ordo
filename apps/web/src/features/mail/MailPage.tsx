import { ActionIcon, Alert, Badge, Box, Button, Checkbox, Grid, Group, Modal, NavLink, Pagination, Paper, ScrollArea, SegmentedControl, Skeleton, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { CheckCircleIcon, ClockCountdownIcon, EnvelopeOpenIcon, EnvelopeSimpleIcon, FlagIcon, MagnifyingGlassIcon, PaperclipIcon, PencilSimpleLineIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useMailAccounts, useMailActions, useMailFolders, useMailLabels, useMailMessages, useScheduledMails } from './api';
import { AccountFolders, type DraggedMails } from './MailFolders';
import { listDate, senderName } from './mail-format';
import { MailLabelsManager } from './MailLabelsManager';
import { MailOrganizeActions } from './MailOrganizeActions';
import classes from './MailPage.module.css';
import { MailReader } from './MailReader';
import { MailSearchFolders, MailSearchList } from './MailSearchFolders';
import { ScheduledMailsList } from './ScheduledMailsList';
import { useMailComposer } from './use-mail-composer';

type DoneFilter = 'all' | 'todo' | 'done';

/**
 * Mail client: accounts and folders (managed, mails dropped in them), search folders (kept in Ordo), scheduled
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
  const doneFilter = (['todo', 'done'].includes(params.get('state') ?? '') ? params.get('state') : 'all') as DoneFilter;
  const messages = useMailMessages(accountId && !scheduledView && !searchId ? { accountId, folder, page: page - 1, search: debouncedSearch, state: doneFilter } : null);
  const { data: folders } = useMailFolders(accountId);
  const { data: labels } = useMailLabels();
  const { data: scheduled } = useScheduledMails();
  const { setSeen, remove } = useMailActions();
  const isDrafts = folders?.find((item) => item.path === folder)?.specialUse === '\\Drafts';
  const labelById = useMemo(() => new Map((labels ?? []).map((label) => [label.id, label])), [labels]);
  // Mails ticked in the list (of the folder shown), and mails being dragged to a folder.
  const [selection, setSelection] = useState<{ key: string; uids: number[] }>({ key: '', uids: [] });
  const selectionKey = `${accountId}|${folder}|${page}|${doneFilter}|${debouncedSearch}`;
  const selected = selection.key === selectionKey ? selection.uids : [];
  const setSelected = (uids: number[]) => setSelection({ key: selectionKey, uids });
  const [dragged, setDragged] = useState<DraggedMails | null>(null);
  const [managingLabels, setManagingLabels] = useState(false);
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
              Aucune boîte mail configurée.
            </Text>
            <Button component={Link} to="/settings?tab=mail" variant="light">
              Configurer une boîte mail
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const total = messages.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (messages.data?.pageSize ?? 50)));

  return (
    <Stack gap="md">
      <Modal opened={managingLabels} onClose={() => setManagingLabels(false)} title="Drapeaux">
        {managingLabels && <MailLabelsManager />}
      </Modal>
      <Group justify="space-between">
        <Title order={1} size="h2">
          Mails
        </Title>
        <Button leftSection={<PencilSimpleLineIcon aria-hidden />} onClick={() => compose({ accountId })}>
          Nouveau mail
        </Button>
      </Group>
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 3, xl: 2 }}>
          <Paper withBorder radius="md" p={4}>
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
              onClick={() => update({ view: 'scheduled', uid: null, page: null, search: null })}
            />
            <MailSearchFolders selectedId={scheduledView ? null : searchId} onSelect={(id) => update({ search: id, view: null, uid: null, page: null })} />
            {isPending ? (
              <Skeleton height={120} />
            ) : (
              accounts?.map((account) => (
                <AccountFolders
                  key={account.id}
                  account={account}
                  selected={accountId && !scheduledView && !searchId ? { accountId, folder } : null}
                  onSelect={(next) => update({ account: next.accountId, folder: next.folder, uid: null, page: null, view: null, search: null })}
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
        <Grid.Col span={{ base: 12, md: 9, xl: 4 }}>
          <Paper withBorder radius="md">
            {scheduledView ? (
              <ScheduledMailsList />
            ) : searchId ? (
              <MailSearchList
                searchId={searchId}
                page={page}
                onPage={(value) => update({ page: value > 1 ? String(value) : null, uid: null })}
                open={accountId && uid !== null ? { accountId, folder, uid } : null}
                onOpen={(mail) => update({ account: mail.accountId, folder: mail.folder, uid: String(mail.uid) })}
              />
            ) : (
              <>
            <Stack gap={6} p="xs" className={classes.listHeader}>
              <TextInput
                size="xs"
                placeholder="Rechercher (objet, expéditeur, texte)"
                aria-label="Rechercher dans le dossier"
                leftSection={<MagnifyingGlassIcon aria-hidden />}
                value={search}
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                  update({ page: null, q: event.currentTarget.value || null });
                }}
              />
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
                  <Group gap={4} wrap="nowrap" style={{ flex: 1 }} justify="flex-end">
                    <Text size="xs" c="dimmed" mr="auto">
                      {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
                    </Text>
                    <MailOrganizeActions
                      accountId={accountId}
                      folder={folder}
                      uids={selected}
                      done={selectedMessages.length > 0 && selectedMessages.every((message) => message.done)}
                      labelIds={(labels ?? []).map((label) => label.id).filter((id) => selectedMessages.length > 0 && selectedMessages.every((message) => message.labelIds.includes(id)))}
                      onMoved={() => {
                        setSelected([]);
                        if (uid !== null && selected.includes(uid)) update({ uid: null });
                      }}
                      onManageLabels={() => setManagingLabels(true)}
                    />
                    <Tooltip label="Marquer comme lu">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Marquer comme lu"
                        onClick={() => setSeen.mutate({ accountId, folder, uids: selected, seen: true }, { onError: (error) => notifyError(error.message) })}
                      >
                        <EnvelopeOpenIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Marquer comme non lu">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Marquer comme non lu"
                        onClick={() => setSeen.mutate({ accountId, folder, uids: selected, seen: false }, { onError: (error) => notifyError(error.message) })}
                      >
                        <EnvelopeSimpleIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Supprimer">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Supprimer les mails sélectionnés"
                        onClick={() => {
                          const modalId = 'delete-selected-mails';
                          const uids = [...selected];
                          modals.open({
                            modalId,
                            title: 'Supprimer les mails',
                            children: (
                              <Stack gap="md">
                                <Text size="sm">
                                  {uids.length} mail{uids.length > 1 ? 's seront placés' : ' sera placé'} dans la corbeille de la boîte (supprimé{uids.length > 1 ? 's' : ''} définitivement
                                  s’ils y sont déjà). Leurs copies rattachées à des projets sont conservées.
                                </Text>
                                <DestructiveActions
                                  loading={false}
                                  onCancel={() => modals.close(modalId)}
                                  onConfirm={() => {
                                    modals.close(modalId);
                                    remove.mutate(
                                      { accountId, folder, uids },
                                      {
                                        onSuccess: () => {
                                          notifySuccess(uids.length > 1 ? 'Mails supprimés.' : 'Mail supprimé.');
                                          setSelected([]);
                                          if (uid !== null && uids.includes(uid)) update({ uid: null });
                                        },
                                        onError: (error) => notifyError(error.message),
                                      },
                                    );
                                  }}
                                />
                              </Stack>
                            ),
                          });
                        }}
                      >
                        <TrashIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Désélectionner">
                      <ActionIcon variant="subtle" color="gray" aria-label="Désélectionner" onClick={() => setSelected([])}>
                        <XIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                ) : (
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
              <ScrollArea.Autosize mah="calc(100dvh - 260px)" style={{ opacity: messages.isPlaceholderData ? 0.6 : 1 }}>
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
                                {folder === 'INBOX' || !message.to.length ? senderName(message.from) : `À : ${senderName(message.to)}`}
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
              </ScrollArea.Autosize>
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
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <Paper withBorder radius="md" p="md">
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
