import { Button, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { FolderPlusIcon, FoldersIcon } from '@phosphor-icons/react';
import { useParams } from 'react-router';
import { useWorkspace } from '../api';
import { useEntityActions } from '../use-entity-actions';
import { EntityHeader } from './EntityHeader';
import { EntityNotFound, EntitySkeleton } from './EntityState';
import { ProjectList } from './ProjectList';

/**
 * Client detail page: header and list of its projects.
 * @returns {JSX.Element} Page.
 */
export function ClientPage() {
  const { id } = useParams();
  const { data, isPending } = useWorkspace();
  const actions = useEntityActions();

  if (isPending) return <EntitySkeleton />;
  const client = data?.clients.find((item) => item.id === id);
  if (!data || !client) return <EntityNotFound what="Ce client" />;

  const projects = data.projects.filter((project) => project.clientId === client.id);

  return (
    <Stack gap="xl">
      <EntityHeader
        entity={{ type: 'client', item: client }}
        subtitle={
          <Text size="sm" c="dimmed">
            {projects.length} projet{projects.length > 1 ? 's' : ''}
          </Text>
        }
        extraActions={
          !client.archived && (
            <Button
              variant="light"
              leftSection={<FolderPlusIcon aria-hidden />}
              onClick={() => actions.openProjectForm(undefined, { clientId: client.id })}
            >
              Ajouter un projet
            </Button>
          )
        }
      />

      <Stack gap="sm">
        <Title order={2} size="h4">
          Projets
        </Title>
        {projects.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Stack align="center" gap="sm">
              <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
                <FoldersIcon aria-hidden />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                Aucun projet pour ce client.
              </Text>
              {!client.archived && (
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<FolderPlusIcon aria-hidden />}
                  onClick={() => actions.openProjectForm(undefined, { clientId: client.id })}
                >
                  Ajouter un projet
                </Button>
              )}
            </Stack>
          </Paper>
        ) : (
          <ProjectList projects={projects} rootParentId={null} statuses={data.projectStatuses} />
        )}
      </Stack>
    </Stack>
  );
}
