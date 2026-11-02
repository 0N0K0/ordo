import { Alert, Badge, Box, Button, Grid, Group, NavLink, Pagination, Paper, ScrollArea, Skeleton, Stack, Text, TextInput, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  ArchiveIcon,
  EnvelopeSimpleIcon,
  FileIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  PencilSimpleLineIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { useMailAccounts, useMailFolders, useMailMessages, type MailAccount } from './api';
import { listDate, senderName } from './mail-format';
import classes from './MailPage.module.css';
import { MailReader } from './MailReader';
import { useMailComposer } from './use-mail-composer';

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

/**
 * Folders of an account in the navigation, with their unread counts.
 * @param {object} props Component props.
 * @param {MailAccount} props.account Account.
 * @param {SelectedFolder | null} props.selected Selected folder.
 * @param {(folder: SelectedFolder) => void} props.onSelect Selection handler.
 * @returns {JSX.Element} Folders.
 */
function AccountFolders({ account, selected, onSelect }: { account: MailAccount; selected: SelectedFolder | null; onSelect: (folder: SelectedFolder) => void }) {
  const { data: folders, isPending, error } = useMailFolders(account.id);
  return (
    <NavLink label={account.name} description={account.email} defaultOpened leftSection={<EnvelopeSimpleIcon aria-hidden />} childrenOffset={8}>
      {isPending && <Skeleton height={28} my={4} />}
      {error && (
        <Text size="xs" c="red" px="sm" py={4}>
          {error.message}
        </Text>
      )}
      {folders?.map((folder) => (
        <NavLink
          key={folder.path}
          label={folder.name}
          leftSection={FOLDER_ICONS[folder.specialUse ?? ''] ?? <FolderIcon aria-hidden />}
          rightSection={
            folder.unseen > 0 && (
              <Badge size="xs" variant="filled" circle={folder.unseen < 10}>
                {folder.unseen}
              </Badge>
            )
          }
          active={selected?.accountId === account.id && selected.folder === folder.path}
          onClick={() => onSelect({ accountId: account.id, folder: folder.path })}
          style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${folder.depth} * var(--mantine-spacing-md))` }}
        />
      ))}
    </NavLink>
  );
}

/**
 * Mail client: accounts and folders, messages of the selected folder (latest first, searchable, paged), and
 * the open message. Everything is read live on the servers. The selection is kept in the URL.
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
  const messages = useMailMessages(accountId ? { accountId, folder, page: page - 1, search: debouncedSearch } : null);
  const { data: folders } = useMailFolders(accountId);
  const isDrafts = folders?.find((item) => item.path === folder)?.specialUse === '\\Drafts';

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
            {isPending ? (
              <Skeleton height={120} />
            ) : (
              accounts?.map((account) => (
                <AccountFolders
                  key={account.id}
                  account={account}
                  selected={accountId ? { accountId, folder } : null}
                  onSelect={(selection) => update({ account: selection.accountId, folder: selection.folder, uid: null, page: null })}
                />
              ))
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9, xl: 4 }}>
          <Paper withBorder radius="md">
            <Box p="xs" className={classes.listHeader}>
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
            </Box>
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
                {debouncedSearch ? 'Aucun mail ne correspond à la recherche.' : 'Aucun mail dans ce dossier.'}
              </Text>
            ) : (
              <ScrollArea.Autosize mah="calc(100dvh - 260px)" style={{ opacity: messages.isPlaceholderData ? 0.6 : 1 }}>
                {messages.data?.messages.map((message) => (
                  <UnstyledButton
                    key={message.uid}
                    className={classes.item}
                    data-active={message.uid === uid || undefined}
                    data-unread={!message.seen || undefined}
                    onClick={() => update({ uid: String(message.uid) })}
                  >
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" truncate className={classes.sender}>
                        {folder === 'INBOX' || !message.to.length ? senderName(message.from) : `À : ${senderName(message.to)}`}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        {message.hasAttachments && <PaperclipIcon aria-label="Pièces jointes" />}
                        <Text size="xs" c="dimmed">
                          {listDate(String(message.date))}
                        </Text>
                      </Group>
                    </Group>
                    <Text size="sm" truncate className={classes.subject}>
                      {message.subject}
                    </Text>
                  </UnstyledButton>
                ))}
              </ScrollArea.Autosize>
            )}
            {pages > 1 && (
              <Group justify="center" p="xs" className={classes.listFooter}>
                <Pagination size="sm" total={pages} value={page} onChange={(value) => update({ page: value > 1 ? String(value) : null, uid: null })} />
              </Group>
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
