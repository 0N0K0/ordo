import { MailHeaderActions } from './MailHeaderActions';
import { settingsPath, PAGES } from '../../../app/pages';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { MailListControls } from './MailListControls';
import { MAIL_SORTS_ACROSS, type DoneFilter } from '../lib/mail-list';

import { Box, Grid, Paper, Stack, Text } from '@mantine/core';

import { EMPTY_MAIL_SEARCH, type MailSearchCriteria } from '@ordo/shared';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { notifySuccess } from '../../../lib/notify';
import { useFillHeight } from '../../../lib/fill-height';
import { AdvancedSearchHeader, AdvancedSearchPanel } from './AdvancedSearchPanel';
import { useMailAccounts } from '../api';
import classes from '../pages/MailPage.module.css';
import { MailReader } from './MailReader';
import { MailSearchList } from './MailSearchFolders';
import { openSearchForm } from '../lib/open-search-form';
import panel from './ProjectMailsPanel.module.css';
import { useMailComposer } from '../hooks/use-mail-composer';
import { useMailSearch } from '../hooks/use-mail-search';
import { unarchived } from '../../../lib/archive';
import { MailSearchBar } from './MailSearchBar';

type SortBy = 'date' | 'correspondent' | 'subject';

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
  // Text and advanced search, in the URL (apart from the other parameters of the project page).
  const mailSearch = useMailSearch('mail');
  const { text: search, debouncedText: debouncedSearch, advanced, advancedOpen, setAdvancedOpen } = mailSearch;
  const [sortParam, setSortParam] = useState('date-desc');
  const [doneFilter, setDoneFilter] = useState<DoneFilter>('all');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<{ accountId: string; folder: string; uid: number } | null>(null);
  const [fillRef, fillHeight] = useFillHeight(400);
  const [sortBy, direction] = sortParam.split('-') as [SortBy, string];
  // The mails of the project, in every folder (the sent ones too); the advanced criteria narrow them.
  const criteria: MailSearchCriteria = advanced ? { ...advanced, projectId } : { ...EMPTY_MAIL_SEARCH, scope: 'all', state: doneFilter, text: debouncedSearch, projectId };
  const firstAccount = unarchived(accounts ?? [])[0]?.id;
  // Flags are managed in the settings of the page Mails.
  const manageLabels = () => void navigate(settingsPath(PAGES.mail.path));

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
      <Grid gap="md" classNames={{ root: panel.grid, inner: classes.gridInner }}>
        <Grid.Col span={{ base: 12, xl: 5 }} className={classes.column}>
          <Paper withBorder radius="md" className={classes.pane}>
            <Stack gap={6} p="xs" className={classes.listHeader}>
              {advanced ? (
                <AdvancedSearchHeader
                  open={advancedOpen}
                  onToggle={() => setAdvancedOpen(!advancedOpen)}
                  onQuit={() => {
                    mailSearch.setAdvanced(null);
                    reset();
                  }}
                />
              ) : (
                <MailSearchBar
                  label="Rechercher dans les mails du projet"
                  value={search}
                  onChange={(text) => {
                    mailSearch.setText(text);
                    reset();
                  }}
                  advancedOpen={advancedOpen}
                  onToggleAdvanced={() => setAdvancedOpen(!advancedOpen)}
                />
              )}
              {advancedOpen && firstAccount && (
                <AdvancedSearchPanel
                  accountId={firstAccount}
                  folder="INBOX"
                  value={advanced ?? { ...EMPTY_MAIL_SEARCH, scope: 'all' }}
                  onSearch={(next) => {
                    mailSearch.setAdvanced(next);
                    reset();
                  }}
                  onClear={() => {
                    mailSearch.setAdvanced(null);
                    reset();
                  }}
                  onSave={(next) => openSearchForm(undefined, () => notifySuccess('Dossier de recherche créé (page Mails).'), { ...next, projectId })}
                />
              )}
              <MailListControls
                sorts={MAIL_SORTS_ACROSS}
                sort={sortParam}
                onSort={(value) => {
                  setSortParam(value);
                  setPage(1);
                }}
                done={doneFilter}
                onDone={
                  advanced
                    ? undefined
                    : (value) => {
                        setDoneFilter(value);
                        reset();
                      }
                }
              />
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
        <Grid.Col span={{ base: 12, xl: 7 }} className={classes.column}>
          <Paper withBorder radius="md" p="md" className={`${classes.pane} ${panel.scroll}`}>
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
  return (
    <Stack gap="md">
      <SectionHeader
        description="Mails rattachés au projet depuis la page Mails, envoyés depuis ce projet, ou faisant suite à une conversation rattachée."
        actions={
          <>
            <MailHeaderActions composeDisabled={!unarchived(accounts ?? []).length} onCompose={() => compose({ projectId })} />
          </>
        }
      />
      <ProjectLiveMails projectId={projectId} />
    </Stack>
  );
}
