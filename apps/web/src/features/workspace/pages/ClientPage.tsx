import { Button, Paper, Stack, Tabs, Text, ThemeIcon, Title } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { FolderPlusIcon, FoldersIcon } from '@phosphor-icons/react';
import { useParams } from 'react-router';
import { ClientBillingSection } from '../../accounting/ClientBillingSection';
import { ProjectBillingPanel } from '../../accounting/ProjectBillingPanel';
import { PageSettings } from '../../../layouts/PageSettings';
import { ClientForm } from '../ClientForm';
import { descendantIds, useWorkspace } from '../api';
import { useEntityActions } from '../use-entity-actions';
import { EntityHeader } from './EntityHeader';
import { EntityNotFound, EntitySkeleton } from './EntityState';
import { ProjectList } from './ProjectList';

/** Tabs of the settings sidebar. */
type SettingsTab = 'billing' | 'client';

/**
 * Client detail page: header, its projects, then the accounting documents of the client and of its projects (and
 * sub-projects). Its billing data (details, services, contacts) and its name, color and icon: in the settings
 * sidebar.
 * @returns {JSX.Element} Page.
 */
export function ClientPage() {
  const { id } = useParams();
  const { data, isPending } = useWorkspace();
  const actions = useEntityActions();
  const [settingsTab, setSettingsTab] = useLocalStorage<SettingsTab>({
    key: 'ordo.client.settingsTab',
    defaultValue: 'billing',
  });

  if (isPending) return <EntitySkeleton />;
  const client = data?.clients.find((item) => item.id === id);
  if (!data || !client) return <EntityNotFound what="Ce client" />;

  const projects = data.projects.filter((project) => project.clientId === client.id);
  // Its projects and their sub-projects: their documents show with its own.
  const projectIds = new Set(projects.flatMap((project) => [project.id, ...descendantIds(data.projects, project.id)]));

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

      <PageSettings title="Paramètres du client">
        <Tabs value={settingsTab} onChange={(value) => value && setSettingsTab(value as SettingsTab)}>
          <Tabs.List mb="md">
            <Tabs.Tab value="billing">Facturation</Tabs.Tab>
            <Tabs.Tab value="client">Nom, couleur et icône</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="billing">
            <ClientBillingSection clientId={client.id} />
          </Tabs.Panel>
          <Tabs.Panel value="client">
            <ClientForm key={client.id} client={client} />
          </Tabs.Panel>
        </Tabs>
      </PageSettings>

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
          <ProjectList projects={projects} allProjects={data.projects} rootParentId={null} clientId={client.id} statuses={data.projectStatuses} />
        )}
      </Stack>

      <ProjectBillingPanel clientId={client.id} projectIds={projectIds} />
    </Stack>
  );
}
