import { Anchor, Badge, Breadcrumbs, Button, Group, Paper, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import { ArrowsClockwiseIcon, BasketIcon, CheckSquareOffsetIcon, GithubLogoIcon, ClockIcon, EnvelopeSimpleIcon, FlagIcon, FolderPlusIcon, InfoIcon, PaperclipIcon, PencilSimpleIcon, ReceiptIcon, TimerIcon, UsersIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DashboardBoard } from '../../dashboards/DashboardBoard';
import { ProjectGithubPanel } from '../../github/ProjectGithubPanel';
import { MilestonesPanel } from '../../tasks/MilestonesPanel';
import { SprintsPanel } from '../../tasks/SprintsPanel';
import { ProjectContributors } from '../../tasks/ProjectContributors';
import { ProjectBillingPanel } from '../../accounting/ProjectBillingPanel';
import { ProjectResourcesPanel } from '../../accounting/ProjectResourcesPanel';
import { ProjectMailsPanel } from '../../mail/ProjectMailsPanel';
import { ProjectTimePanel } from '../../time/ProjectTimePanel';
import { RoutinesPanel } from '../../routines/RoutinesPage';
import { ListsPanel } from '../../shopping/ShoppingPage';
import { TaskBoard } from '../../tasks/TaskBoard';
import { useActiveWorkspace } from '../../workspaces/api';
import { descendantIds, useWorkspace, type Project } from '../api';
import { ProjectForm } from '../ProjectForm';
import { canHaveChildren } from '../tree';
import { useEntityActions } from '../use-entity-actions';
import { EntityHeader } from './EntityHeader';
import { EntityNotFound, EntitySkeleton } from './EntityState';
import { ProjectList } from './ProjectList';
import { PageSettings } from '../../../layouts/PageSettings';
import { SETTINGS_PARAM } from '../../../layouts/page-settings';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * Formats a YYYY-MM-DD date for display.
 * @param {string | null} date Calendar date.
 * @returns {string} Formatted date, or a dash.
 */
function formatDate(date: string | null): string {
  return date ? dateFormat.format(new Date(`${date}T00:00:00Z`)) : '—';
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
const SETTINGS_SECTIONS = ['milestones', 'sprints', 'contributors', 'github', 'project'] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * Settings of a project, in the settings sidebar, one section at a time (chosen above it): milestones, sprints,
 * contributors, GitHub, and the project itself (title, client, parent, status, dates, color, icon…).
 * @param {{ project: Project, section: SettingsSection, onSection: (section: SettingsSection) => void }} props Project, section shown and its change.
 * @returns {JSX.Element} Settings.
 */
function ProjectSettings({ project, section, onSection }: { project: Project; section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  const projectId = project.id;
  return (
    <Tabs variant="pills" value={section} onChange={(value) => value && onSection(value as SettingsSection)} keepMounted={false}>
      <Tabs.List mb="md">
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
  const [params, setParams] = useSearchParams();
  // The former tabs of the settings (links, bookmarks) open their section.
  const requested = params.get('tab') ?? 'overview';
  const legacy = (SETTINGS_SECTIONS as readonly string[]).includes(requested);
  // The dashboards are in the overview.
  const tab = legacy || requested === 'settings' || requested === 'dashboards' || (perso && requested === 'billing') ? 'overview' : requested;
  const sectionParam = legacy ? requested : params.get('section');
  const section: SettingsSection = (SETTINGS_SECTIONS as readonly string[]).includes(sectionParam ?? '') ? (sectionParam as SettingsSection) : 'milestones';
  // The former settings tab (and its sections): the settings, in the sidebar.
  useEffect(() => {
    if (!legacy && requested !== 'settings') return;
    setParams({ [SETTINGS_PARAM]: '1', section }, { replace: true });
  }, [legacy, requested, section, setParams]);
  // Tasks of the project and of its sub-projects.
  const baseFilter = useMemo(
    () =>
      id
        ? {
            type: 'group' as const,
            id: 'project',
            combinator: 'and' as const,
            children: [{ type: 'condition' as const, id: 'project', field: 'project' as const, operator: 'inTree', value: [id] }],
          }
        : null,
    [id],
  );

  if (isPending) return <EntitySkeleton />;
  const project = data?.projects.find((item) => item.id === id);
  if (!data || !project) return <EntityNotFound what="Ce projet" />;

  const client = data.clients.find((item) => item.id === project.clientId);
  const status = data.projectStatuses.find((item) => item.id === project.statusId);
  const ancestors = [];
  for (let parent = data.projects.find((item) => item.id === project.parentId); parent; ) {
    ancestors.unshift(parent);
    const parentId = parent.parentId;
    parent = data.projects.find((item) => item.id === parentId);
  }
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
            <Button
              variant="light"
              leftSection={<FolderPlusIcon aria-hidden />}
              onClick={() => actions.openProjectForm(undefined, { parentId: project.id })}
            >
              Ajouter un sous-projet
            </Button>
          )
        }
      />

      <Tabs
        value={tab}
        onChange={(value) => {
          // Changing tab drops the view and the open task of the previous tab; the settings sidebar stays as it is.
          setParams(
            (current) => {
              const next = new URLSearchParams(current.get(SETTINGS_PARAM) ? { [SETTINGS_PARAM]: '1', section } : {});
              if (value && value !== 'overview') next.set('tab', value);
              return next;
            },
            { replace: true },
          );
        }}
        keepMounted={false}
      >
        <Tabs.List mb="lg">
          <Tabs.Tab value="overview" leftSection={<InfoIcon aria-hidden />}>
            Aperçu
          </Tabs.Tab>
          <Tabs.Tab value="tasks" leftSection={<CheckSquareOffsetIcon aria-hidden />}>
            Tâches
          </Tabs.Tab>
          <Tabs.Tab value="routines" leftSection={<ArrowsClockwiseIcon aria-hidden />}>
            Routines
          </Tabs.Tab>
          <Tabs.Tab value="shopping" leftSection={<BasketIcon aria-hidden />}>
            Courses
          </Tabs.Tab>
          <Tabs.Tab value="time" leftSection={<ClockIcon aria-hidden />}>
            Temps
          </Tabs.Tab>
          {!perso && (
            <Tabs.Tab value="billing" leftSection={<ReceiptIcon aria-hidden />}>
              Facturation
            </Tabs.Tab>
          )}
          <Tabs.Tab value="mail" leftSection={<EnvelopeSimpleIcon aria-hidden />}>
            Mails
          </Tabs.Tab>
          <Tabs.Tab value="resources" leftSection={<PaperclipIcon aria-hidden />}>
            Ressources
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Stack gap="xl">
              <Paper withBorder p="lg" radius="md">
                <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="lg">
                  <Detail label="Statut">
                    {status ? (
                      <Badge variant="light" color={status.color}>
                        {status.name}
                      </Badge>
                    ) : (
                      <Text size="sm">—</Text>
                    )}
                  </Detail>
                  <Detail label="Catégories">
                    {project.categories.length > 0 ? (
                      <Group gap={4}>
                        {project.categories.map((category) => (
                          <Badge key={category.id} variant="light" color={category.color}>
                            {category.name}
                          </Badge>
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
                  <ProjectList projects={subProjects} rootParentId={project.id} statuses={data.projectStatuses} />
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

              <DashboardBoard key={project.id} projectId={project.id} baseFilter={baseFilter} title={project.title} />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="tasks">
          <TaskBoard
            key={project.id}
            projectId={project.id}
            baseFilter={baseFilter}
            title={project.title}
            createProjectId={project.archived ? undefined : project.id}
            emptyMessage="Aucune tâche dans ce projet."
          />
        </Tabs.Panel>
        <Tabs.Panel value="routines">
          <RoutinesPanel key={project.id} projectId={project.archived ? undefined : project.id} projectIds={tree} />
        </Tabs.Panel>
        <Tabs.Panel value="shopping">
          <ListsPanel key={project.id} projectIds={tree} />
        </Tabs.Panel>
        <Tabs.Panel value="time">
          <ProjectTimePanel projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="billing">
          <ProjectBillingPanel projectId={project.id} clientId={project.clientId} />
        </Tabs.Panel>
        <Tabs.Panel value="resources">
          <ProjectResourcesPanel projectId={project.id} />
        </Tabs.Panel>
        <Tabs.Panel value="mail">
          <ProjectMailsPanel projectId={project.id} />
        </Tabs.Panel>
      </Tabs>
      {/* Milestones, sprints, contributors, GitHub and the project itself: in the settings sidebar. */}
      <PageSettings title="Paramètres du projet">
        <ProjectSettings
          project={project}
          section={section}
          onSection={(next) =>
            setParams(
              (current) => {
                const updated = new URLSearchParams(current);
                updated.set('section', next);
                return updated;
              },
              { replace: true },
            )
          }
        />
      </PageSettings>
    </Stack>
  );
}
