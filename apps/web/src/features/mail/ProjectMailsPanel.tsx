import { ActionIcon, Badge, Box, Button, Grid, Group, Paper, ScrollArea, SegmentedControl, Select, Skeleton, Stack, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { EMPTY_MAIL_SEARCH, type MailSearchCriteria } from '@ordo/shared';
import {
  ArrowBendDoubleUpLeftIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowsClockwiseIcon,
  EnvelopeSimpleIcon,
  LinkBreakIcon,
  MagnifyingGlassIcon,
  PaperclipIcon,
  PencilSimpleLineIcon,
  SlidersHorizontalIcon,
} from '@phosphor-icons/react';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useFillHeight } from '../tasks/column-fit';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { useMailAccounts, useMailActions, useMailRefresh, useProjectMails, type LinkedMail } from './api';
import { forwardOptions, replyOptions, type SourceMail } from './compose-options';
import { listDate, senderName } from './mail-format';
import { MailBody } from './MailBody';
import { MailFiles, MailHeader } from './MailHeader';
import classes from './MailPage.module.css';
import { MailReader } from './MailReader';
import { MailSearchList } from './MailSearchFolders';
import { openSearchForm } from './open-search-form';
import panel from './ProjectMailsPanel.module.css';
import { useMailComposer } from './use-mail-composer';

type Source = 'live' | 'copies';
type DoneFilter = 'all' | 'todo' | 'done';
type SortBy = 'date' | 'correspondent' | 'subject';

/** Orders of the mails of the boxes (those of the page Mails, but the size: unknown across folders). */
const SORTS = [
  { value: 'date-desc', label: 'Plus récents' },
  { value: 'date-asc', label: 'Plus anciens' },
  { value: 'correspondent-asc', label: 'Expéditeur (A → Z)' },
  { value: 'correspondent-desc', label: 'Expéditeur (Z → A)' },
  { value: 'subject-asc', label: 'Objet (A → Z)' },
  { value: 'subject-desc', label: 'Objet (Z → A)' },
];

/**
 * Linked copy as a source of reply or forward (its files are not forwarded: they are in Ordo, not on the server).
 * @param {LinkedMail} mail Copy.
 * @returns {SourceMail} Source.
 */
function sourceOf(mail: LinkedMail): SourceMail {
  return { ...mail, date: String(mail.date), location: null };
}

/**
 * Copies of the mails linked to a project (received or sent), kept in Ordo, latest first, readable even when
 * deleted from the mailbox; reply, forward and unlink.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Copies.
 */
function ProjectMailCopies({ projectId }: { projectId: string }) {
  const { data: mails, isPending } = useProjectMails(projectId);
  const { data: accounts } = useMailAccounts();
  const { unlink } = useMailActions();
  const compose = useMailComposer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const own = (accounts ?? []).map((account) => account.email);
  const selected = mails?.find((mail) => mail.id === selectedId) ?? mails?.[0];

  /**
   * Asks for confirmation before unlinking a mail.
   * @param {LinkedMail} mail Copy.
   * @returns {void}
   */
  const confirmUnlink = (mail: LinkedMail) => {
    const modalId = `unlink-mail-${mail.id}`;
    modals.open({
      modalId,
      title: 'Détacher le mail du projet',
      children: (
        <Stack gap="md">
          <Text size="sm">La copie de « {mail.subject} » conservée dans le projet sera supprimée, avec ses pièces jointes. Le mail reste dans la boîte mail s’il n’en a pas été supprimé.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              unlink.mutate(mail.id, {
                onSuccess: () => {
                  notifySuccess('Mail détaché du projet.');
                  setSelectedId(null);
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
    <>
      {isPending ? (
        <Skeleton height={200} />
      ) : !mails?.length ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <EnvelopeSimpleIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun mail rattaché à ce projet.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Grid gap="md">
          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Paper withBorder radius="md">
              <ScrollArea.Autosize mah="calc(100dvh - 320px)">
                {mails.map((mail) => (
                  <UnstyledButton key={mail.id} className={classes.item} data-active={mail.id === selected?.id || undefined} onClick={() => setSelectedId(mail.id)}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="sm" truncate fw={600}>
                        {mail.sent ? `À : ${senderName(mail.to)}` : senderName(mail.from)}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        {mail.attachments.some((file) => !file.inline) && <PaperclipIcon aria-label="Pièces jointes" />}
                        <Text size="xs" c="dimmed">
                          {listDate(String(mail.date))}
                        </Text>
                      </Group>
                    </Group>
                    <Group gap={6} wrap="nowrap">
                      {mail.sent && (
                        <Badge size="xs" variant="light" color="gray">
                          Envoyé
                        </Badge>
                      )}
                      <Text size="sm" truncate c="dimmed">
                        {mail.subject}
                      </Text>
                    </Group>
                  </UnstyledButton>
                ))}
              </ScrollArea.Autosize>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 8 }}>
            {selected && (
              <Paper withBorder radius="md" p="md">
                <Stack gap="md">
                  <MailHeader
                    subject={selected.subject}
                    from={selected.from}
                    to={selected.to}
                    cc={selected.cc}
                    date={String(selected.date)}
                    actions={
                      <Tooltip label="Détacher du projet">
                        <ActionIcon variant="subtle" color="red" aria-label="Détacher le mail du projet" onClick={() => confirmUnlink(selected)}>
                          <LinkBreakIcon aria-hidden />
                        </ActionIcon>
                      </Tooltip>
                    }
                  />
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<ArrowBendUpLeftIcon aria-hidden />}
                      disabled={!accounts?.length}
                      onClick={() => compose(replyOptions(sourceOf(selected), false, own, projectId))}
                    >
                      Répondre
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<ArrowBendDoubleUpLeftIcon aria-hidden />}
                      disabled={!accounts?.length}
                      onClick={() => compose(replyOptions(sourceOf(selected), true, own, projectId))}
                    >
                      Répondre à tous
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<ArrowBendUpRightIcon aria-hidden />}
                      disabled={!accounts?.length}
                      onClick={() => compose(forwardOptions(sourceOf(selected), [], projectId))}
                    >
                      Transférer
                    </Button>
                  </Group>
                  <MailFiles files={selected.attachments.filter((file) => !file.inline).map((file) => ({ key: file.id, name: file.name, size: file.size, url: file.url }))} />
                  <MailBody key={selected.id} html={selected.html} text={selected.text} />
                </Stack>
              </Paper>
            )}
          </Grid.Col>
        </Grid>
      )}
    </>
  );
}

/**
 * Mails of a project read live in the boxes (every folder, the sent ones too: those whose copy is in the
 * project), with the options of the page Mails but the boxes and folders: search, advanced search, order, done
 * state, selection and its actions (done, flags, move, spam, delete…), paging, and the reader of the mail open.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Mails.
 */
function ProjectLiveMails({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: accounts } = useMailAccounts();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [advanced, setAdvanced] = useState<MailSearchCriteria | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortParam, setSortParam] = useState('date-desc');
  const [doneFilter, setDoneFilter] = useState<DoneFilter>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ accountId: string; folder: string; uid: number } | null>(null);
  const [fillRef, fillHeight] = useFillHeight(400);
  const [sortBy, direction] = sortParam.split('-') as [SortBy, string];
  // The mails of the project, in every folder (the sent ones too); the advanced criteria narrow them.
  const criteria: MailSearchCriteria = advanced ? { ...advanced, projectId } : { ...EMPTY_MAIL_SEARCH, scope: 'all', state: doneFilter, text: debouncedSearch, projectId };
  const firstAccount = accounts?.[0]?.id;
  // Flags are managed in the settings of the page Mails.
  const manageLabels = () => void navigate('/mail?settings=1');

  /**
   * Back to the first page, the mail open closed (another list).
   * @returns {void}
   */
  const reset = () => {
    setPage(1);
    setOpen(null);
  };

  return (
    <div ref={fillRef} className={panel.panes} style={{ '--fill-height': fillHeight ? `${fillHeight}px` : undefined } as CSSProperties}>
      <Grid gap="md" classNames={{ root: panel.grid, inner: panel.gridInner }}>
        <Grid.Col span={{ base: 12, xl: 5 }} className={panel.column}>
          <Paper withBorder radius="md" className={panel.pane}>
            <Stack gap={6} p="xs" className={classes.listHeader}>
              {advanced ? (
                <Group justify="space-between" gap="xs">
                  <Text size="sm" fw={600}>
                    Recherche avancée
                  </Text>
                  <Group gap={4}>
                    <Button size="compact-xs" variant="subtle" onClick={() => setAdvancedOpen((value) => !value)}>
                      {advancedOpen ? 'Masquer les critères' : 'Modifier'}
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => {
                        setAdvanced(null);
                        setAdvancedOpen(false);
                        reset();
                      }}
                    >
                      Quitter
                    </Button>
                  </Group>
                </Group>
              ) : (
                <Group gap={4} wrap="nowrap">
                  <TextInput
                    size="xs"
                    style={{ flex: 1 }}
                    placeholder="Rechercher (objet, expéditeur, texte)"
                    aria-label="Rechercher dans les mails du projet"
                    leftSection={<MagnifyingGlassIcon aria-hidden />}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.currentTarget.value);
                      reset();
                    }}
                  />
                  <Tooltip label="Recherche avancée">
                    <ActionIcon variant={advancedOpen ? 'light' : 'subtle'} color="gray" aria-label="Recherche avancée" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((value) => !value)}>
                      <SlidersHorizontalIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
              {advancedOpen && firstAccount && (
                <AdvancedSearchPanel
                  accountId={firstAccount}
                  folder="INBOX"
                  value={advanced ?? { ...EMPTY_MAIL_SEARCH, scope: 'all' }}
                  onSearch={(next) => {
                    setAdvanced(next);
                    reset();
                  }}
                  onClear={() => {
                    setAdvanced(null);
                    setAdvancedOpen(false);
                    reset();
                  }}
                  onSave={(next) => openSearchForm(undefined, () => notifySuccess('Dossier de recherche créé (page Mails).'), { ...next, projectId })}
                />
              )}
              <Group gap={4} wrap="nowrap" justify="flex-end">
                <Select
                  size="xs"
                  w={150}
                  aria-label="Trier"
                  data={SORTS}
                  value={sortParam}
                  allowDeselect={false}
                  onChange={(value) => {
                    if (!value) return;
                    setSortParam(value);
                    setPage(1);
                  }}
                />
                {!advanced && (
                  <SegmentedControl
                    size="xs"
                    aria-label="Mails traités"
                    data={[
                      { value: 'all', label: 'Tous' },
                      { value: 'todo', label: 'À traiter' },
                      { value: 'done', label: 'Traités' },
                    ]}
                    value={doneFilter}
                    onChange={(value) => {
                      setDoneFilter(value as DoneFilter);
                      reset();
                    }}
                  />
                )}
              </Group>
            </Stack>
            <MailSearchList
              query={{ criteria, sort: sortBy, ascending: direction === 'asc' }}
              empty={
                debouncedSearch || advanced
                  ? 'Aucun mail du projet ne répond à la recherche.'
                  : doneFilter === 'todo'
                    ? 'Aucun mail à traiter.'
                    : doneFilter === 'done'
                      ? 'Aucun mail traité.'
                      : 'Aucun mail du projet dans les boîtes.'
              }
              page={page}
              onPage={(value) => {
                setPage(value);
                setOpen(null);
              }}
              open={open}
              onOpen={(mail) => setOpen({ accountId: mail.accountId, folder: mail.folder, uid: mail.uid })}
              onOpenGone={() => setOpen(null)}
              onManageLabels={manageLabels}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 7 }} className={panel.column}>
          <Paper withBorder radius="md" p="md" className={`${panel.pane} ${panel.scroll}`}>
            {open ? (
              <MailReader key={`${open.accountId}-${open.folder}-${open.uid}`} {...open} onDeleted={() => setOpen(null)} onManageLabels={manageLabels} />
            ) : (
              <Box py="xl">
                <Text size="sm" c="dimmed" ta="center">
                  Sélectionnez un mail pour le lire.
                </Text>
              </Box>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
}

/**
 * Mails tab of a project: its mails read live in the boxes, with the options of the page Mails (but the boxes and
 * folders), or the copies kept in Ordo (readable even when deleted from the box); a refresh, and new mails linked
 * to the project.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectMailsPanel({ projectId }: { projectId: string }) {
  const { data: accounts } = useMailAccounts();
  const compose = useMailComposer();
  const { refresh, fetching } = useMailRefresh();
  const [source, setSource] = useState<Source>('live');
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm">
        <Stack gap={6}>
          <SegmentedControl
            aria-label="Mails affichés"
            data={[
              { value: 'live', label: 'Dans les boîtes' },
              { value: 'copies', label: 'Copies dans Ordo' },
            ]}
            value={source}
            onChange={(value) => setSource(value as Source)}
          />
          <Text size="sm" c="dimmed" maw={640}>
            Mails rattachés au projet depuis la page Mails, envoyés depuis ce projet, ou faisant suite à une conversation rattachée. Une copie est conservée dans Ordo, lisible même supprimée de la
            boîte.
          </Text>
        </Stack>
        <Group gap="sm" ml="auto">
          <Tooltip label="Relever les mails maintenant (sinon toutes les 10 minutes)">
            <Button variant="default" leftSection={<ArrowsClockwiseIcon aria-hidden />} loading={fetching} onClick={refresh}>
              Relever
            </Button>
          </Tooltip>
          <Button leftSection={<PencilSimpleLineIcon aria-hidden />} disabled={!accounts?.length} onClick={() => compose({ projectId })}>
            Nouveau mail
          </Button>
        </Group>
      </Group>
      {source === 'live' ? <ProjectLiveMails projectId={projectId} /> : <ProjectMailCopies projectId={projectId} />}
    </Stack>
  );
}
