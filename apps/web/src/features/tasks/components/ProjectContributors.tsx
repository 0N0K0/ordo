import { projectPath } from '../../../app/pages';
import { settingsPath } from '../../../app/layout/page-settings';
import { PersonRow } from '../../../components/people/people-rows';
import { ancestorsOf } from '@ordo/shared';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { Anchor, Badge, Group, Paper, Select, Stack, Text } from '@mantine/core';
import { PlusIcon, UsersIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { toastCallbacks } from '../../../lib/notify';
import { descendantIds, type Project } from '../../workspace/api';
import { useContributorMutations, type Contributor } from '../api';
import { useContributorForm } from '../hooks/use-contributor-form';
import { useTaskContext } from '../hooks/use-task-context';
import { countOf } from '../../../lib/text';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { RemoveButton } from '../../../components/actions/RemoveButton';

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
  if (!context) return <ListSkeleton items={3} avatar />;
  const project = context.projectById.get(projectId);
  const subtree = descendantIds(context.projects, projectId);
  subtree.add(projectId);

  const ancestors: Project[] = ancestorsOf(context.projectById, project?.id);
  const direct = context.contributors.filter((contributor) =>
    contributor.projectIds.includes(projectId),
  );
  const directIds = direct.map((contributor) => contributor.id);
  // The archived ones attached stay listed (with their badge), but are not offered to be added.
  const members = context.assignableFor([projectId], [], true);
  const others = context.contributors.filter(
    (contributor) => !contributor.archived && !members.includes(contributor),
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
        task.projectId !== null &&
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
      toastCallbacks(message),
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
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm(undefined, [projectId])} disabled={project?.archived}>
            Nouveau contributeur
          </ActionButton>
        </Group>
      </Group>

      {members.length === 0 ? (
        <EmptyState icon={<UsersIcon aria-hidden />} message="Aucun contributeur sur ce projet." />
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
                  <PersonRow

                    name={contributor.name} label={context.contributorName(contributor)}

                    avatarUrl={contributor.avatarUrl}

                    badges={

                      <>

                        {contributor.isMe && (
                        <Badge size="xs" variant="light">
                          Tous les projets
                        </Badge>
                      )}
                      {contributor.archived && <ArchivedBadge size="xs" />}
                      {inheritedFrom && (
                        <Badge size="xs" variant="light" color="gray">
                          Via{' '}
                          <Anchor
                            component={Link}
                            to={settingsPath(projectPath(inheritedFrom.id), 'contributors')}
                            size="xs"
                            inherit
                          >
                            {inheritedFrom.title}
                          </Anchor>
                        </Badge>
                      )}

                      </>

                    }

                    details={

                      <>

                        <Text size="xs" c="dimmed">
                      @{contributor.handle}
                      {count > 0 && ` · ${countOf(count, 'tâche')}`}
                    </Text>

                      </>

                    }

                  />
                  {/* Inherited contributors are detached from their own project; tasks keep their assignees. */}
                  {directIds.includes(contributor.id) && (
                    <RemoveButton
                      label="Retirer du projet (ses tâches restent assignées)"
                      aria-label={`Retirer ${contributor.name} du projet`}
                      disabled={project?.archived}
                      onClick={() => save(directIds.filter((id) => id !== contributor.id), `${contributor.name} retiré du projet.`)}
                    />
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
