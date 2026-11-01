import { Anchor, Badge, Breadcrumbs, Button, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { FolderPlusIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
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

/**
 * Project detail page.
 * @returns {JSX.Element} Page.
 */
export function ProjectPage() {
  const { id } = useParams();
  const { data, isPending } = useWorkspace();
  const actions = useEntityActions();

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
  );
}
