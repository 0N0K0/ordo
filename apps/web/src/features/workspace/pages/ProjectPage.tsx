import { clientPath, projectPath } from '../../../app/pages';
import { SETTINGS_TAB_PARAM, useSettingsTab } from '../../../components/tabs/use-settings-tab';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { SubSection } from '../../../components/page/SubSection';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { useSetParams } from '../../../lib/search-params';
import { ancestorsOf, mapById } from '@ordo/shared';
import { ItemBadge } from '../../../components/items/ItemBadge';
import { TaskSettings } from '../../tasks/components/TaskSettings';
import { ActionButton } from '../../../components/actions/ActionButton';
import { Anchor, Breadcrumbs, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core';
import { SheetsTable } from '../../sheets/components/SheetsTable';
import { PageTabs } from '../../../components/tabs/PageTabs';
import {
  ArrowsClockwiseIcon,
  BasketIcon,
  CheckSquareOffsetIcon,
  ClipboardTextIcon,
  GithubLogoIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  FlagIcon,
  FolderPlusIcon,
  InfoIcon,
  PaperclipIcon,
  PencilSimpleIcon,
  ReceiptIcon,
  TimerIcon,
  UsersIcon,
  ListChecksIcon,
} from '@phosphor-icons/react';
import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DashboardBoard } from '../../dashboards/components/DashboardBoard';
import { ProjectGithubPanel } from '../../github/components/ProjectGithubPanel';
import { MilestonesPanel } from '../../tasks/components/MilestonesPanel';
import { SprintsPanel } from '../../tasks/components/SprintsPanel';
import { ProjectContributors } from '../../tasks/components/ProjectContributors';
import { ProjectBillingPanel } from '../../accounting/components/ProjectBillingPanel';
import { ProjectResourcesPanel } from '../../accounting/components/ProjectResourcesPanel';
import { ProjectMailsPanel } from '../../mail/components/ProjectMailsPanel';
import { ProjectTimePanel } from '../../time/components/ProjectTimePanel';
import { RoutinesPanel } from '../../routines/pages/RoutinesPage';
import { ListsPanel } from '../../shopping/pages/ShoppingPage';
import { TaskBoard } from '../../tasks/components/TaskBoard';
import { useActiveWorkspace } from '../../workspaces/api';
import { descendantIds, useWorkspace, type Project } from '../api';
import { ProjectForm } from '../components/ProjectForm';
import { canHaveChildren } from '../lib/tree';
import { useEntityActions } from '../hooks/use-entity-actions';
import { EntityHeader } from '../components/EntityHeader';
import { EntitySkeleton } from '../components/EntityState';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { ProjectList } from '../components/ProjectList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { SettingsTabPanel, SettingsTabs } from '../../../components/tabs/SettingsTabs';
import { SETTINGS_PARAM } from '../../../app/layout/page-settings';
import * as fmt from '../../../lib/format';

/**
 * Formats a YYYY-MM-DD date for display.
 * @param {string | null} date Calendar date.
 * @returns {string} Formatted date, or a dash.
 */
function formatDate(date: string | null): string {
  return date ? fmt.day(date) : '—';
}

/** Tabs of a project page. */
const PROJECT_TABS = ['overview', 'tasks', 'routines', 'shopping', 'sheets', 'time', 'billing', 'mail', 'resources'] as const;

/** Sections of the settings tab of a project. */
const SETTINGS_SECTIONS = ['taskSettings', 'milestones', 'sprints', 'contributors', 'github', 'project'] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * Settings of a project, in the settings sidebar, one section at a time (chosen above it): the task settings of the
 * workspace, milestones, sprints,
 * contributors, GitHub, and the project itself (title, client, parent, status, dates, color, icon…).
 * @param {{ project: Project, section: SettingsSection, onSection: (section: SettingsSection) => void }} props Project, section shown and its change.
 * @returns {JSX.Element} Settings.
 */
function ProjectSettings({ project, section, onSection }: { project: Project; section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  const projectId = project.id;
  return (
    <SettingsTabs
      value={section}
      onChange={onSection}
      keepMounted={false}
      tabs={[
        { value: 'taskSettings', label: 'Tâches', icon: <ListChecksIcon aria-hidden /> },
        { value: 'milestones', label: 'Jalons', icon: <FlagIcon aria-hidden /> },
        { value: 'sprints', label: 'Sprints', icon: <TimerIcon aria-hidden /> },
        { value: 'contributors', label: 'Contributeurs', icon: <UsersIcon aria-hidden /> },
        { value: 'github', label: 'GitHub', icon: <GithubLogoIcon aria-hidden /> },
        { value: 'project', label: 'Projet', icon: <PencilSimpleIcon aria-hidden /> },
      ]}
    >
      {/* The task settings of the workspace, in every view of tasks. */}
      <SettingsTabPanel value="taskSettings">
        <TaskSettings />
      </SettingsTabPanel>
      <SettingsTabPanel value="milestones">
        <MilestonesPanel projectId={projectId} />
      </SettingsTabPanel>
      <SettingsTabPanel value="sprints">
        <SprintsPanel projectId={projectId} />
      </SettingsTabPanel>
      <SettingsTabPanel value="contributors">
        <ProjectContributors projectId={projectId} />
      </SettingsTabPanel>
      <SettingsTabPanel value="project">
        <ProjectForm key={project.id} project={project} />
      </SettingsTabPanel>
      <SettingsTabPanel value="github">
        <ProjectGithubPanel projectId={projectId} />
      </SettingsTabPanel>
    </SettingsTabs>
  );
}

/**
 * Project detail page.
 * @returns {JSX.Element} Page.
 */
export function ProjectPage() {
  const { context: taskContext } = useTaskContext();
  const { id } = useParams();
  const { data, isPending } = useWorkspace();
  const actions = useEntityActions();
  // No invoicing nor clients in a personal workspace.
  const { perso } = useActiveWorkspace();
  const [params] = useSearchParams();
  const setParams = useSetParams();
  // The former tabs of the settings (links, bookmarks) open their section.
  // The dashboards are in the overview; no billing in a personal workspace.
  const [tab, setTab, asked] = usePageTab(perso ? PROJECT_TABS.filter((item) => item !== 'billing') : PROJECT_TABS);
  const requested = asked ?? 'overview';
  const legacy = (SETTINGS_SECTIONS as readonly string[]).includes(requested);
  // From the tasks tab, the settings open on those of the tasks.
  const [askedSection, setSection] = useSettingsTab(SETTINGS_SECTIONS, tab === 'tasks' ? 'taskSettings' : 'milestones');
  const section: SettingsSection = legacy ? (requested as SettingsSection) : askedSection;
  // The former settings tab (and its sections): the settings, in the sidebar.
  useEffect(() => {
    if (!legacy && requested !== 'settings') return;
    setParams({ [SETTINGS_PARAM]: '1', [SETTINGS_TAB_PARAM]: section }, { only: true });
  }, [legacy, requested, section, setParams]);

  if (isPending) return <EntitySkeleton />;
  const project = data?.projects.find((item) => item.id === id);
  if (!data || !project) return <DetailNotFound what="Ce projet" />;

  const client = data.clients.find((item) => item.id === project.clientId);
  const status = data.projectStatuses.find((item) => item.id === project.statusId);
  // From the root project down to its parent.
  const ancestors = ancestorsOf(mapById(data.projects), project.id).reverse();
  const subtree = descendantIds(data.projects, project.id);
  const subProjects = data.projects.filter((item) => subtree.has(item.id));
  // Routines and shopping lists: those of the project and of its sub-projects.
  const tree = new Set([project.id, ...subtree]);
  const canAddSubProject = !project.archived && canHaveChildren(data.projects, project.id);

  return (
    <Stack gap="xl">
      <EntityHeader
        entity={{ type: 'project', item: project }}
        subtitle={
          <Breadcrumbs separator="›" separatorMargin={6} fz="sm">
            {client ? (
              <Anchor component={Link} to={clientPath(client.id)} size="sm">
                {client.name}
              </Anchor>
            ) : (
              !perso && (
                <Text size="sm" c="dimmed">
                  Sans client
                </Text>
              )
            )}
            {ancestors.map((ancestor) => (
              <Anchor key={ancestor.id} component={Link} to={projectPath(ancestor.id)} size="sm">
                {ancestor.title}
              </Anchor>
            ))}
          </Breadcrumbs>
        }
        extraActions={
          canAddSubProject && (
            <ActionButton icon={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm(undefined, { parentId: project.id })}>
              Nouveau sous-projet
            </ActionButton>
          )
        }
      />

      <PageTabs
        value={tab}
        onChange={(value) => {
          // Changing tab drops the view and the open task of the previous tab; the settings sidebar stays as it is.
          const settings = params.get(SETTINGS_PARAM);
          setTab(value, { [SETTINGS_PARAM]: settings, [SETTINGS_TAB_PARAM]: settings ? section : null }, { only: true });
        }}
        keepMounted={false}
      >
        <PageTabs.List>
          <PageTabs.Tab value="overview" leftSection={<InfoIcon aria-hidden />}>
            Aperçu
          </PageTabs.Tab>
          <PageTabs.Tab value="tasks" leftSection={<CheckSquareOffsetIcon aria-hidden />}>
            Tâches
          </PageTabs.Tab>
          <PageTabs.Tab value="routines" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Routines
          </PageTabs.Tab>
          <PageTabs.Tab value="shopping" leftSection={<BasketIcon aria-hidden />}>
            Achats
          </PageTabs.Tab>
          <PageTabs.Tab value="sheets" leftSection={<ClipboardTextIcon aria-hidden />}>
            Fiches
          </PageTabs.Tab>
          <PageTabs.Tab value="time" leftSection={<ClockIcon aria-hidden />}>
            Temps
          </PageTabs.Tab>
          {!perso && (
            <PageTabs.Tab value="billing" leftSection={<ReceiptIcon aria-hidden />}>
              Facturation
            </PageTabs.Tab>
          )}
          <PageTabs.Tab value="mail" leftSection={<EnvelopeSimpleIcon aria-hidden />}>
            Mails
          </PageTabs.Tab>
          <PageTabs.Tab value="resources" leftSection={<PaperclipIcon aria-hidden />}>
            Ressources
          </PageTabs.Tab>
        </PageTabs.List>
        <PageTabs.Panel value="overview">
          <Stack gap="xl">
            <Paper withBorder p="lg" radius="md">
              <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg">
                <SubSection title="Statut">
                  <ItemBadge item={status} empty={<Text size="sm">—</Text>} />
                </SubSection>
                <SubSection title="Catégories">
                  {project.categories.length > 0 ? (
                    <Group gap={4}>
                      {project.categories.map((category) => (
                        <ItemBadge key={category.id} item={category} />
                      ))}
                    </Group>
                  ) : (
                    <Text size="sm">—</Text>
                  )}
                </SubSection>
                <SubSection title="Début">
                  <Text size="sm">{formatDate(project.startDate)}</Text>
                </SubSection>
                <SubSection title="Fin">
                  <Text size="sm">{formatDate(project.endDate)}</Text>
                </SubSection>
              </SimpleGrid>
            </Paper>

            {subProjects.length > 0 && (
              <Stack gap="sm">
                <SectionHeader title="Sous-projets" />
                <ProjectList projects={subProjects} allProjects={data.projects} rootParentId={project.id} clientId={project.clientId ?? null} statuses={data.projectStatuses} />
              </Stack>
            )}

            <SubSection title="Description" gap="xs">
              <MarkdownView targets={taskContext?.targetsFor(project.id) ?? NO_TARGETS} emptyText="Aucune description.">
                {project.description}
              </MarkdownView>
            </SubSection>

            <DashboardBoard key={project.id} projectId={project.id} title={project.title} />
          </Stack>
        </PageTabs.Panel>
        <PageTabs.Panel value="tasks">
          <TaskBoard
            key={project.id}
            projectId={project.id}
            projectIds={tree}
            title={project.title}
            createProjectId={project.archived ? undefined : project.id}
            emptyMessage="Aucune tâche dans ce projet."
          />
        </PageTabs.Panel>
        <PageTabs.Panel value="routines">
          <RoutinesPanel key={project.id} projectId={project.archived ? undefined : project.id} projectIds={tree} />
        </PageTabs.Panel>
        <PageTabs.Panel value="shopping">
          <ListsPanel key={project.id} projectId={project.id} projectIds={tree} />
        </PageTabs.Panel>
        <PageTabs.Panel value="sheets">
          <SheetsTable key={project.id} projectId={project.id} />
        </PageTabs.Panel>
        <PageTabs.Panel value="time">
          <ProjectTimePanel projectId={project.id} />
        </PageTabs.Panel>
        <PageTabs.Panel value="billing">
          <ProjectBillingPanel projectId={project.id} clientId={project.clientId} />
        </PageTabs.Panel>
        <PageTabs.Panel value="resources">
          <ProjectResourcesPanel projectId={project.id} />
        </PageTabs.Panel>
        <PageTabs.Panel value="mail">
          <ProjectMailsPanel projectId={project.id} />
        </PageTabs.Panel>
      </PageTabs>
      {/* Milestones, sprints, contributors, GitHub and the project itself: in the settings sidebar. */}
      <PageSettings title="Paramètres du projet">
        <ProjectSettings project={project} section={section} onSection={setSection} />
      </PageSettings>
    </Stack>
  );
}
