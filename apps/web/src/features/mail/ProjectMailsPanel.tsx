import { ActionIcon, Box, Button, Grid, Group, Paper, SegmentedControl, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { EMPTY_MAIL_SEARCH, type MailSearchCriteria } from '@ordo/shared';
import { ArrowsClockwiseIcon, MagnifyingGlassIcon, PencilSimpleLineIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { notifySuccess } from '../../lib/notify';
import { useFillHeight } from '../tasks/column-fit';
import { AdvancedSearchPanel } from './AdvancedSearchPanel';
import { useMailAccounts, useMailRefresh } from './api';
import classes from './MailPage.module.css';
import { MailReader } from './MailReader';
import { MailSearchList } from './MailSearchFolders';
import { openSearchForm } from './open-search-form';
import panel from './ProjectMailsPanel.module.css';
import { useMailComposer } from './use-mail-composer';

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
              noMove
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 7 }} className={panel.column}>
          <Paper withBorder radius="md" p="md" className={`${panel.pane} ${panel.scroll}`}>
            {open ? (
              <MailReader key={`${open.accountId}-${open.folder}-${open.uid}`} {...open} projectId={projectId} onDeleted={() => setOpen(null)} onManageLabels={manageLabels} />
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
 * Mails tab of a project: its mails read live in the boxes, with the options of the page Mails (but the boxes,
 * folders and moves); a refresh, and new mails linked to the project.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectMailsPanel({ projectId }: { projectId: string }) {
  const { data: accounts } = useMailAccounts();
  const compose = useMailComposer();
  const { refresh, fetching } = useMailRefresh();
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" gap="sm">
        <Text size="sm" c="dimmed" maw={640}>
          Mails rattachés au projet depuis la page Mails, envoyés depuis ce projet, ou faisant suite à une conversation rattachée.
        </Text>
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
      <ProjectLiveMails projectId={projectId} />
    </Stack>
  );
}
