import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { PlusIcon, UsersIcon, XIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { notifyError, notifySuccess } from '../../lib/notify';
import { descendantIds, type Project } from '../workspace/api';
import { useContributorMutations, type Contributor } from './api';
import { useContributorForm } from './settings/use-contributor-form';
import { useTaskContext } from './use-task-context';

/**
 * Contributors of a project: those attached to it, those inherited from a parent project, and "Moi".
 * Only they are offered as assignees of its tasks (and of its sub-projects' tasks).
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectContributors({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { setProjectContributors } = useContributorMutations();
  const openForm = useContributorForm();
  if (!context) return <Skeleton height={48 * 3} radius="md" />;
  const project = context.projectById.get(projectId);
  const subtree = descendantIds(context.projects, projectId);
  subtree.add(projectId);

  const ancestors: Project[] = [];
  for (
    let parentId = project?.parentId;
    parentId;
    parentId = context.projectById.get(parentId)?.parentId
  ) {
    const parent = context.projectById.get(parentId);
    if (parent) ancestors.push(parent);
  }
  const direct = context.contributors.filter((contributor) =>
    contributor.projectIds.includes(projectId),
  );
  const directIds = direct.map((contributor) => contributor.id);
  const members = context.assignableFor([projectId]);
  const others = context.contributors.filter(
    (contributor) => !members.includes(contributor),
  );

  /**
   * Number of tasks of the project and its sub-projects assigned to a contributor.
   * @param {Contributor} contributor Contributor.
   * @returns {number} Count.
   */
  const taskCount = (contributor: Contributor) =>
    context.tasks.filter(
      (task) =>
        !task.archived &&
        subtree.has(task.projectId) &&
        task.assigneeIds.includes(contributor.id),
    ).length;

  /**
   * Saves the contributors directly attached to the project.
   * @param {string[]} contributorIds Contributors.
   * @param {string} message Success message.
   * @returns {void}
   */
  const save = (contributorIds: string[], message: string) =>
    setProjectContributors.mutate(
      { projectId, contributorIds },
      {
        onSuccess: () => notifySuccess(message),
        onError: (error) => notifyError(error.message),
      },
    );

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Group gap="sm">
          <Select
            aria-label="Ajouter un contributeur existant"
            placeholder="Ajouter un contributeur existant"
            data={others.map((contributor) => ({
              value: contributor.id,
              label: contributor.name,
            }))}
            value={null}
            onChange={(id) => {
              const contributor = context.contributorById.get(id ?? '');
              if (contributor)
                save(
                  [...directIds, contributor.id],
                  `${contributor.name} ajouté au projet.`,
                );
            }}
            searchable
            nothingFoundMessage="Aucun autre contributeur"
            disabled={others.length === 0 || project?.archived}
          />
          <Button
            leftSection={<PlusIcon aria-hidden />}
            onClick={() => openForm(undefined, [projectId])}
            disabled={project?.archived}
          >
            Nouveau contributeur
          </Button>
        </Group>
      </Group>

      {members.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <UsersIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun contributeur sur ce projet.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="md">
          <Stack gap="sm">
            {members.map((contributor) => {
              const inheritedFrom = directIds.includes(contributor.id)
                ? undefined
                : ancestors.find((ancestor) =>
                    contributor.projectIds.includes(ancestor.id),
                  );
              const count = taskCount(contributor);
              return (
                <Group key={contributor.id} gap="sm" wrap="nowrap">
                  <Avatar
                    src={contributor.avatarUrl}
                    name={contributor.name}
                    color="initials"
                  />
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap">
                      <Text size="sm" fw={500} truncate>
                        {context.contributorName(contributor)}
                      </Text>
                      {contributor.isMe && (
                        <Badge size="xs" variant="light">
                          Tous les projets
                        </Badge>
                      )}
                      {inheritedFrom && (
                        <Badge size="xs" variant="light" color="gray">
                          Via{' '}
                          <Anchor
                            component={Link}
                            to={`/projects/${inheritedFrom.id}?settings=1&section=contributors`}
                            size="xs"
                            inherit
                          >
                            {inheritedFrom.title}
                          </Anchor>
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      @{contributor.handle}
                      {count > 0 && ` · ${count} tâche${count > 1 ? 's' : ''}`}
                    </Text>
                  </Stack>
                  {/* Inherited contributors are detached from their own project; tasks keep their assignees. */}
                  {directIds.includes(contributor.id) && (
                    <Tooltip label="Retirer du projet (ses tâches restent assignées)">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Retirer ${contributor.name} du projet`}
                        disabled={project?.archived}
                        onClick={() =>
                          save(
                            directIds.filter((id) => id !== contributor.id),
                            `${contributor.name} retiré du projet.`,
                          )
                        }
                      >
                        <XIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
