import { useSetParams } from '../../../lib/search-params';
import { ancestorsOf, mapById } from '@ordo/shared';
import { ItemBadge } from '../../../components/settings/ItemBadge';
import { TaskSettings } from '../../tasks/components/TaskSettings';
import { ActionButton } from '../../../components/actions/ActionButton';
import { Anchor, Breadcrumbs, Group, Paper, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import { SheetsTable } from '../../sheets/components/SheetsTable';
import { PageTabs } from '../../../components/tabs/PageTabs';
import { ArrowsClockwiseIcon, BasketIcon, CheckSquareOffsetIcon, ClipboardTextIcon, GithubLogoIcon, ClockIcon, EnvelopeSimpleIcon, FlagIcon, FolderPlusIcon, InfoIcon, PaperclipIcon, PencilSimpleIcon, ReceiptIcon, TimerIcon, UsersIcon, ListChecksIcon } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';
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
import { EntityNotFound, EntitySkeleton } from '../components/EntityState';
import { ProjectList } from '../components/ProjectList';
import { PageSettings } from '../../../app/layout/PageSettings';
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

/**
 * Label / value pair of the project details.
 * @param {object} props Component props.
 * @param {string} props.label Label.
 * @param {ReactNode} props.children Value.
 * @returns {JSX.Element} Detail.
 */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
        {label}
      </Text>
      <div>{children}</div>
    </Stack>
  );
}

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
    <Tabs variant="pills" value={section} onChange={(value) => value && onSection(value as SettingsSection)} keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="taskSettings" leftSection={<ListChecksIcon aria-hidden />}>
          Tâches
        </Tabs.Tab>
        <Tabs.Tab value="milestones" leftSection={<FlagIcon aria-hidden />}>
          Jalons
        </Tabs.Tab>
        <Tabs.Tab value="sprints" leftSection={<TimerIcon aria-hidden />}>
          Sprints
        </Tabs.Tab>
        <Tabs.Tab value="contributors" leftSection={<UsersIcon aria-hidden />}>
          Contributeurs
        </Tabs.Tab>
        <Tabs.Tab value="github" leftSection={<GithubLogoIcon aria-hidden />}>
          GitHub
        </Tabs.Tab>
        <Tabs.Tab value="project" leftSection={<PencilSimpleIcon aria-hidden />}>
          Projet
        </Tabs.Tab>
      </Tabs.List>
      {/* The task settings of the workspace, in every view of tasks. */}
      <Tabs.Panel value="taskSettings" style={{ minWidth: 0 }}>
        <TaskSettings />
      </Tabs.Panel>
      <Tabs.Panel value="milestones" style={{ minWidth: 0 }}>
        <MilestonesPanel projectId={projectId} />
      </Tabs.Panel>
      <Tabs.Panel value="sprints" style={{ minWidth: 0 }}>
        <SprintsPanel projectId={projectId} />
      </Tabs.Panel>
      <Tabs.Panel value="contributors" style={{ minWidth: 0 }}>
        <ProjectContributors projectId={projectId} />
      </Tabs.Panel>
      <Tabs.Panel value="project" style={{ minWidth: 0 }}>
        <ProjectForm key={project.id} project={project} />
      </Tabs.Panel>
      <Tabs.Panel value="github" style={{ minWidth: 0 }}>
        <ProjectGithubPanel projectId={projectId} />
      </Tabs.Panel>
    </Tabs>
  );
}

/**
 * Project detail page.
 * @returns {JSX.Element} Page.
 */
export function ProjectPage() {
  const { id } = useParams();
  const { data, isPending } = useWorkspace();
  const actions = useEntityActions();
  // No invoicing nor clients in a personal workspace.
  const { perso } = useActiveWorkspace();
  const [params] = useSearchParams();
  const setParams = useSetParams();
  // The former tabs of the settings (links, bookmarks) open their section.
  const requested = params.get('tab') ?? 'overview';
  const legacy = (SETTINGS_SECTIONS as readonly string[]).includes(requested);
  // The dashboards are in the overview.
  const tab = legacy || requested === 'settings' || requested === 'dashboards' || (perso && requested === 'billing') ? 'overview' : requested;
  const sectionParam = legacy ? requested : params.get('section');
  // From the tasks tab, the settings open on those of the tasks.
  const section: SettingsSection = (SETTINGS_SECTIONS as readonly string[]).includes(sectionParam ?? '') ? (sectionParam as SettingsSection) : tab === 'tasks' ? 'taskSettings' : 'milestones';
  // The former settings tab (and its sections): the settings, in the sidebar.
  useEffect(() => {
    if (!legacy && requested !== 'settings') return;
    setParams({ [SETTINGS_PARAM]: '1', section }, { only: true });
  }, [legacy, requested, section, setParams]);

  if (isPending) return <EntitySkeleton />;
  const project = data?.projects.find((item) => item.id === id);
  if (!data || !project) return <EntityNotFound what="Ce projet" />;

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
              <Anchor component={Link} to={`/clients/${client.id}`} size="sm">
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
              <Anchor key={ancestor.id} component={Link} to={`/projects/${ancestor.id}`} size="sm">
                {ancestor.title}
              </Anchor>
            ))}
          </Breadcrumbs>
        }
        extraActions={
          canAddSubProject && (
            <ActionButton
              icon={<FolderPlusIcon aria-hidden />}
              onClick={() => actions.openProjectForm(undefined, { parentId: project.id })}
            >Nouveau sous-projet</ActionButton>
          )
        }
      />

      <PageTabs
        value={tab}
        onChange={(value) => {
          // Changing tab drops the view and the open task of the previous tab; the settings sidebar stays as it is.
          const settings = params.get(SETTINGS_PARAM);
          setParams({ [SETTINGS_PARAM]: settings, section: settings ? section : null, tab: value && value !== 'overview' ? value : null }, { only: true });
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
                  <Detail label="Statut">
                    <ItemBadge item={status} empty={<Text size="sm">—</Text>} />
                  </Detail>
                  <Detail label="Catégories">
                    {project.categories.length > 0 ? (
                      <Group gap={4}>
                        {project.categories.map((category) => (
                          <ItemBadge key={category.id} item={category} />
                        ))}
                      </Group>
                    ) : (
                      <Text size="sm">—</Text>
                    )}
                  </Detail>
                  <Detail label="Début">
                    <Text size="sm">{formatDate(project.startDate)}</Text>
                  </Detail>
                  <Detail label="Fin">
                    <Text size="sm">{formatDate(project.endDate)}</Text>
                  </Detail>
                </SimpleGrid>
              </Paper>

              {subProjects.length > 0 && (
                <Stack gap="sm">
                  <Title order={2} size="h4">
                    Sous-projets
                  </Title>
                  <ProjectList projects={subProjects} allProjects={data.projects} rootParentId={project.id} clientId={project.clientId ?? null} statuses={data.projectStatuses} />
                </Stack>
              )}

              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">
                  Description
                </Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} c={project.description ? undefined : 'dimmed'}>
                  {project.description ?? 'Aucune description.'}
                </Text>
              </Stack>

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
        <ProjectSettings
          project={project}
          section={section}
          onSection={(next) =>
            setParams({ section: next })
          }
        />
      </PageSettings>
    </Stack>
  );
}
