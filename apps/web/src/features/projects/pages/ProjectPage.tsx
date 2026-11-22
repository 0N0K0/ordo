import { clientPath, projectPath, SETTINGS_PARAM } from '../../../app/pages';
import { SETTINGS_TAB_PARAM, useSettingsTab } from '../../../components/tabs/use-settings-tab';
import { usePageTab } from '../../../components/tabs/use-page-tab';
import { SubSection } from '../../../components/page/SubSection';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { useSetParams, useSearchParam } from '../../../lib/search-params';
import { ancestorsOf, mapById, subtreeOf } from '@ordo/shared';
import { ItemBadge } from '../../../components/items/ItemBadge';
import { TaskSettings } from '../../tasks/components/TaskSettings';
import { RoutineSettings } from '../../routines/components/RoutineSettings';
import { ShoppingSettings } from '../../shopping/components/ShoppingSettings';
import { SheetsSettings } from '../../sheets/components/SheetsSettings';
import { WeekSettings } from '../../calendar/components/WeekSettings';
import { DocumentStatusSettings } from '../../accounting/components/DocumentStatusSettings';
import { CompanySettings } from '../../accounting/components/CompanySettings';
import { MailSettings } from '../../mail/components/MailSettings';
import { SettingsScopeNote } from '../../../components/settings/SettingsScopeNote';
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
} from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
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
import { useProjectTree, type Project } from '../api';
import { ProjectForm } from '../components/ProjectForm';
import { canHaveChildren } from '../lib/tree';
import { useEntityActions } from '../hooks/use-entity-actions';
import { EntityHeader } from '../components/EntityHeader';
import { EntitySkeleton } from '../components/EntityState';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { ProjectList } from '../components/ProjectList';
import { PageSettings } from '../../../app/layout/PageSettings';
import { SettingsTabPanel, SettingsTabs } from '../../../components/tabs/SettingsTabs';
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
type ProjectTab = (typeof PROJECT_TABS)[number];

/** Label and icon of each tab of a project page (also those of the settings of a tab). */
const TAB_LOOK: Record<ProjectTab, { label: string; icon: ReactNode }> = {
  overview: { label: 'Aperçu', icon: <InfoIcon aria-hidden /> },
  tasks: { label: 'Tâches', icon: <CheckSquareOffsetIcon aria-hidden /> },
  routines: { label: 'Routines', icon: <ArrowsClockwiseIcon aria-hidden /> },
  shopping: { label: 'Achats', icon: <BasketIcon aria-hidden /> },
  sheets: { label: 'Fiches', icon: <ClipboardTextIcon aria-hidden /> },
  time: { label: 'Temps', icon: <ClockIcon aria-hidden /> },
  billing: { label: 'Facturation', icon: <ReceiptIcon aria-hidden /> },
  mail: { label: 'Mails', icon: <EnvelopeSimpleIcon aria-hidden /> },
  resources: { label: 'Ressources', icon: <PaperclipIcon aria-hidden /> },
};

/**
 * Settings of the workspace that matter in a tab of the project, shown in its settings only from that tab: the same
 * components (and the same saving) as on the page of each feature.
 */
const TAB_SETTINGS = {
  tasks: { section: 'taskSettings', render: () => <TaskSettings /> },
  routines: { section: 'routineSettings', render: () => <RoutineSettings /> },
  shopping: { section: 'shoppingSettings', render: () => <ShoppingSettings /> },
  sheets: { section: 'sheetSettings', render: () => <SheetsSettings /> },
  time: { section: 'timeSettings', render: () => <WeekSettings /> },
  billing: {
    section: 'billingSettings',
    render: () => (
      <Stack gap="md">
        <DocumentStatusSettings />
        <CompanySettings />
      </Stack>
    ),
  },
  mail: { section: 'mailSettings', render: () => <MailSettings /> },
} as const satisfies Partial<Record<ProjectTab, { section: string; render: () => ReactNode }>>;
type TabSettings = (typeof TAB_SETTINGS)[keyof typeof TAB_SETTINGS];

/** Settings of the project that only serve its tasks: shown from the tasks tab only. */
const TASK_SECTIONS = ['milestones', 'sprints'] as const;
/** Settings of the project itself, from every tab. */
const PROJECT_SECTIONS = ['contributors', 'github', 'project'] as const;
type ProjectSection = (typeof TASK_SECTIONS)[number] | (typeof PROJECT_SECTIONS)[number];
/** Former tabs of the project page that were settings (links, bookmarks): they open their section. */
const LEGACY_SECTIONS = ['taskSettings', ...TASK_SECTIONS, ...PROJECT_SECTIONS] as const;
/** Former tabs whose section is shown from the tasks tab only: they open that tab too. */
const TASKS_TAB_SECTIONS: readonly string[] = ['taskSettings', ...TASK_SECTIONS];
type SettingsSection = ProjectSection | TabSettings['section'];

/** Label and icon of each section of the project itself. */
const PROJECT_SECTION_LOOK: Record<ProjectSection, { label: string; icon: ReactNode }> = {
  milestones: { label: 'Jalons', icon: <FlagIcon aria-hidden /> },
  sprints: { label: 'Sprints', icon: <TimerIcon aria-hidden /> },
  contributors: { label: 'Contributeurs', icon: <UsersIcon aria-hidden /> },
  github: { label: 'GitHub', icon: <GithubLogoIcon aria-hidden /> },
  project: { label: 'Projet', icon: <PencilSimpleIcon aria-hidden /> },
};

/**
 * Settings of the workspace shown from a tab of the project, if it has some.
 * @param {ProjectTab} tab Tab of the project page.
 * @returns {TabSettings | undefined} Its settings, nothing for a tab without.
 */
function tabSettingsOf(tab: ProjectTab): TabSettings | undefined {
  return (TAB_SETTINGS as Partial<Record<ProjectTab, TabSettings>>)[tab];
}

/**
 * Sections of the project itself shown from a tab: milestones and sprints from the tasks tab only, then those of every
 * tab.
 * @param {ProjectTab} tab Tab of the project page.
 * @returns {readonly ProjectSection[]} Sections, in their order.
 */
function projectSectionsOf(tab: ProjectTab): readonly ProjectSection[] {
  return tab === 'tasks' ? [...TASK_SECTIONS, ...PROJECT_SECTIONS] : PROJECT_SECTIONS;
}

/**
 * Sections of the settings of a project shown from a tab: those of the workspace that matter in it, then those of the
 * project.
 * @param {ProjectTab} tab Tab of the project page.
 * @returns {readonly SettingsSection[]} Sections, in their order.
 */
function sectionsOf(tab: ProjectTab): readonly SettingsSection[] {
  const tabSection = tabSettingsOf(tab)?.section;
  return tabSection ? [tabSection, ...projectSectionsOf(tab)] : projectSectionsOf(tab);
}

/**
 * Settings of a project, in the settings sidebar, one section at a time (chosen above it): first those of the
 * workspace that matter in the tab shown (only them, with a line saying they are those of the whole workspace), then
 * those of the project: milestones and sprints (from the tasks tab only), contributors, GitHub, and the project itself
 * (title, client, parent, status, dates, color, icon…).
 * @param {{ project: Project, tab: ProjectTab, section: SettingsSection, onSection: (section: SettingsSection) => void }} props Project, tab of the page, section shown and its change.
 * @returns {JSX.Element} Settings.
 */
function ProjectSettings({ project, tab, section, onSection }: { project: Project; tab: ProjectTab; section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  const projectId = project.id;
  const tabSettings = tabSettingsOf(tab);
  const projectSections = projectSectionsOf(tab);
  /**
   * Content of a section of the project itself.
   * @param {ProjectSection} value Section.
   * @returns {JSX.Element} Content.
   */
  const renderSection = (value: ProjectSection) => {
    switch (value) {
      case 'milestones':
        return <MilestonesPanel projectId={projectId} />;
      case 'sprints':
        return <SprintsPanel projectId={projectId} />;
      case 'contributors':
        return <ProjectContributors projectId={projectId} />;
      case 'github':
        return <ProjectGithubPanel projectId={projectId} />;
      case 'project':
        return <ProjectForm key={project.id} project={project} />;
    }
  };
  return (
    <SettingsTabs
      value={section}
      onChange={onSection}
      keepMounted={false}
      tabs={[...(tabSettings ? [{ value: tabSettings.section, ...TAB_LOOK[tab] }] : []), ...projectSections.map((value) => ({ value, ...PROJECT_SECTION_LOOK[value] }))]}
    >
      {tabSettings && (
        <SettingsTabPanel value={tabSettings.section}>
          <Stack gap="md">
            <SettingsScopeNote />
            {tabSettings.render()}
          </Stack>
        </SettingsTabPanel>
      )}
      {projectSections.map((value) => (
        <SettingsTabPanel key={value} value={value}>
          {renderSection(value)}
        </SettingsTabPanel>
      ))}
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
  const { data, isPending } = useProjectTree();
  const actions = useEntityActions();
  // No invoicing nor clients in a personal workspace.
  const { perso } = useActiveWorkspace();
  const [settings] = useSearchParam(SETTINGS_PARAM);
  const setParams = useSetParams();
  // The former tabs of the settings (links, bookmarks) open their section.
  // The dashboards are in the overview; no billing in a personal workspace.
  const visibleTabs = perso ? PROJECT_TABS.filter((item) => item !== 'billing') : PROJECT_TABS;
  const [tab, setTab, asked] = usePageTab(visibleTabs);
  const requested = asked ?? 'overview';
  const legacy = (LEGACY_SECTIONS as readonly string[]).includes(requested);
  // The settings of the tab shown, then those of the project; the panel opens on the first one.
  const [askedSection, setSection] = useSettingsTab(sectionsOf(tab));
  const section: SettingsSection = legacy ? (requested as SettingsSection) : askedSection;
  // The former settings tab (and its sections): the settings, in the sidebar (the task settings, milestones and sprints
  // from the tasks tab).
  useEffect(() => {
    if (!legacy && requested !== 'settings') return;
    setParams({ [SETTINGS_PARAM]: '1', [SETTINGS_TAB_PARAM]: section, tab: TASKS_TAB_SECTIONS.includes(section) ? 'tasks' : null }, { only: true });
  }, [legacy, requested, section, setParams]);

  if (isPending) return <EntitySkeleton />;
  const project = data?.projects.find((item) => item.id === id);
  if (!data || !project) return <DetailNotFound what="Ce projet" />;

  const client = data.clients.find((item) => item.id === project.clientId);
  const status = data.projectStatuses.find((item) => item.id === project.statusId);
  // From the root project down to its parent.
  const ancestors = ancestorsOf(mapById(data.projects), project.id).reverse();
  const subtree = subtreeOf(data.projects, project.id, false);
  const subProjects = data.projects.filter((item) => subtree.has(item.id));
  // Routines and shopping lists: those of the project and of its sub-projects.
  const tree = subtreeOf(data.projects, project.id);
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
                {ancestor.label}
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
          // Changing tab drops the view and the open task of the previous tab; the settings sidebar stays open, on the
          // same section of the project when the new tab shows it, or else on the first settings of the new tab.
          const kept = settings && (projectSectionsOf((value ?? 'overview') as ProjectTab) as readonly string[]).includes(section) ? section : null;
          setTab(value, { [SETTINGS_PARAM]: settings, [SETTINGS_TAB_PARAM]: kept }, { only: true });
        }}
        keepMounted={false}
      >
        <PageTabs.List>
          {visibleTabs.map((value) => (
            <PageTabs.Tab key={value} value={value} leftSection={TAB_LOOK[value].icon}>
              {TAB_LOOK[value].label}
            </PageTabs.Tab>
          ))}
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

            <DashboardBoard key={project.id} projectId={project.id} title={project.label} />
          </Stack>
        </PageTabs.Panel>
        <PageTabs.Panel value="tasks">
          <TaskBoard
            key={project.id}
            projectId={project.id}
            projectIds={tree}
            title={project.label}
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
      {/* Settings of the tab shown, milestones and sprints (tasks tab), contributors, GitHub and the project itself: in the settings sidebar. */}
      <PageSettings title="Paramètres du projet">
        <ProjectSettings project={project} tab={tab} section={section} onSection={setSection} />
      </PageSettings>
    </Stack>
  );
}
