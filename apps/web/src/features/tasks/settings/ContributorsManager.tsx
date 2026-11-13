import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { ActionIcon, Avatar, Badge, Button, Group, Paper, Stack, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TrashIcon, UsersIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../../lib/notify';
import { useWorkspace } from '../../workspace/api';
import { useContributorMutations, type Contributor } from '../api';
import { useContributorForm } from './use-contributor-form';
import { useTreasurySettings } from '../../treasury/api';
import { useQueryClient } from '@tanstack/react-query';
import { accountingQueryKey } from '../../accounting/api';

interface ContributorsManagerProps {
  contributors: Contributor[];
  /** Number of tasks assigned to each contributor. */
  usage: Map<string, number>;
}

/**
 * List of the contributors that tasks can be assigned to, with whether each is a member of the team or household, or a
 * relation (never both).
 * @param {ContributorsManagerProps} props Component props.
 * @returns {JSX.Element} Manager.
 */
export function ContributorsManager({ contributors, usage }: ContributorsManagerProps) {
  const { data: treasury } = useTreasurySettings();
  const queryClient = useQueryClient();
  const memberIds = new Set((treasury?.treasuryMembers ?? []).map((member) => member.id));
  // Contributor → name of the relation they are.
  const relationOf = new Map((treasury?.treasuryRelations ?? []).filter((relation) => relation.contributorId).map((relation) => [relation.contributorId as string, relation.name]));
  const { remove } = useContributorMutations();
  const openForm = useContributorForm();
  const { data: workspace } = useWorkspace();

  /**
   * Titles of the projects a contributor is attached to.
   * @param {Contributor} contributor Contributor.
   * @returns {string} Label.
   */
  const projectsLabel = (contributor: Contributor) => {
    const titles = contributor.projectIds
      .map((id) => workspace?.projects.find((project) => project.id === id)?.title)
      .filter((title): title is string => Boolean(title));
    return titles.length ? `Projets : ${titles.join(', ')}` : 'Aucun projet';
  };

  /**
   * Asks for confirmation before deleting a contributor.
   * @param {Contributor} contributor Contributor.
   * @returns {void}
   */
  const confirmDelete = (contributor: Contributor) => {
    const used = usage.get(contributor.id) ?? 0;
    confirmDestructive({ title: 'Supprimer le contributeur', risks: (
<>
<Text size="sm">
            {contributor.name} sera supprimé définitivement
            {used > 0 ? ` et retiré des ${used} tâche${used > 1 ? 's' : ''} qui lui sont assignées` : ''}. Ses mentions
            @{contributor.handle} resteront dans le texte, sans lien. Cette action est irréversible.
          </Text>
</>
), onConfirm: () => { remove.mutate(
                { id: contributor.id },
                {
                  onSuccess: () => {
                    notifySuccess(`${contributor.name} supprimé.`);
                    // Members and relations (treasury) follow: a relation loses its contributor.
                    void queryClient.invalidateQueries({ queryKey: accountingQueryKey });
                  },
                  onError: (error) => notifyError(error.message),
                },
              ); } });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Contributeurs
            </Title>
            <Text size="sm" c="dimmed">
              Personnes à qui les tâches peuvent être assignées. Rattachez-les aux projets où elles interviennent : seuls les contributeurs
              d’un projet (et de ses projets parents) sont proposés dans ses tâches.
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter
          </Button>
        </Group>
        {contributors.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <UsersIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun contributeur pour le moment.
            </Text>
          </Group>
        ) : (
          <Stack gap="xs">
            {contributors.map((contributor) => (
              <Group key={contributor.id} gap="sm" wrap="nowrap">
                <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" />
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500} truncate>
                      {contributor.name}
                    </Text>
                    {contributor.isMe && (
                      <Badge size="xs" variant="light">
                        Moi
                      </Badge>
                    )}
                    {/* A member of the team or household, or a relation: never both. */}
                    {!contributor.isMe && memberIds.has(contributor.id) && (
                      <Badge size="xs" variant="light" color="blue">
                        Membre
                      </Badge>
                    )}
                    {relationOf.has(contributor.id) && (
                      <Tooltip label={`Relation « ${relationOf.get(contributor.id)} »`}>
                        <Badge size="xs" variant="light" color="grape">
                          Relation
                        </Badge>
                      </Tooltip>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    @{contributor.handle}
                    {(usage.get(contributor.id) ?? 0) > 0 && ` · ${usage.get(contributor.id)} tâche(s)`}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {contributor.isMe ? 'Tous les projets' : projectsLabel(contributor)}
                  </Text>
                </Stack>
                <Tooltip label="Modifier">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Modifier ${contributor.name}`}
                    onClick={() => openForm(contributor)}
                  >
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                {/* The user's own profile cannot be deleted. */}
                {!contributor.isMe && (
                  <Tooltip label="Supprimer">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Supprimer ${contributor.name}`}
                      onClick={() => confirmDelete(contributor)}
                    >
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
