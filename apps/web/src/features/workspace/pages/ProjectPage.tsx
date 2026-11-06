import { Anchor, Badge, Breadcrumbs, Button, Group, Paper, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import { ChartBarIcon, CheckSquareOffsetIcon, GearIcon, GithubLogoIcon, ClockIcon, EnvelopeSimpleIcon, FlagIcon, FolderPlusIcon, InfoIcon, PaperclipIcon, ReceiptIcon, TimerIcon, UsersIcon } from '@phosphor-icons/react';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, type ReactNode } from 'react';
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
import { TaskBoard } from '../../tasks/TaskBoard';
import { descendantIds, useWorkspace } from '../api';
import { canHaveChildren } from '../tree';
import { useEntityActions } from '../use-entity-actions';
import { EntityHeader } from './EntityHeader';
import { EntityNotFound, EntitySkeleton } from './EntityState';
import { ProjectList } from './ProjectList';

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
const SETTINGS_SECTIONS = ['milestones', 'sprints', 'contributors', 'github'] as const;
type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * Settings of a project, one section at a time from a side menu: milestones, sprints, contributors, GitHub.
 * @param {{ projectId: string, section: SettingsSection, onSection: (section: SettingsSection) => void }} props Project, section shown and its change.
 * @returns {JSX.Element} Settings.
 */
function ProjectSettings({ projectId, section, onSection }: { projectId: string; section: SettingsSection; onSection: (section: SettingsSection) => void }) {
  // Side menu on wide screens, above the section on narrow ones.
  const wide = useMediaQuery('(min-width: 48em)', true);
  return (
    <Tabs orientation={wide ? 'vertical' : 'horizontal'} variant="pills" value={section} onChange={(value) => value && onSection(value as SettingsSection)} keepMounted={false}>
      <Tabs.List {...(wide ? { mr: 'lg', miw: 180 } : { mb: 'md' })}>
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
  const [params, setParams] = useSearchParams();
  // The former tabs of the settings (links, bookmarks) open their section.
  const requested = params.get('tab') ?? 'overview';
  const legacy = (SETTINGS_SECTIONS as readonly string[]).includes(requested);
  const tab = legacy ? 'settings' : requested;
  const sectionParam = legacy ? requested : params.get('section');
  const section: SettingsSection = (SETTINGS_SECTIONS as readonly string[]).includes(sectionParam ?? '') ? (sectionParam as SettingsSection) : 'milestones';
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
              <Text size="sm" c="dimmed">
                Sans client
              </Text>
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
          // Changing tab drops the view and the open task of the previous tab.
          setParams(value && value !== 'overview' ? { tab: value } : {}, { replace: true });
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
          <Tabs.Tab value="dashboards" leftSection={<ChartBarIcon aria-hidden />}>
            Tableaux de bord
          </Tabs.Tab>
          <Tabs.Tab value="time" leftSection={<ClockIcon aria-hidden />}>
            Temps
          </Tabs.Tab>
          <Tabs.Tab value="billing" leftSection={<ReceiptIcon aria-hidden />}>
            Facturation
          </Tabs.Tab>
          <Tabs.Tab value="resources" leftSection={<PaperclipIcon aria-hidden />}>
            Ressources
          </Tabs.Tab>
          <Tabs.Tab value="mail" leftSection={<EnvelopeSimpleIcon aria-hidden />}>
            Mails
          </Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<GearIcon aria-hidden />}>
            Paramètres
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
        <Tabs.Panel value="dashboards">
          <DashboardBoard key={project.id} projectId={project.id} baseFilter={baseFilter} title={project.title} />
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
        <Tabs.Panel value="settings">
          <ProjectSettings projectId={project.id} section={section} onSection={(next) => setParams({ tab: 'settings', section: next }, { replace: true })} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
