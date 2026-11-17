import { InlineActions } from '../../../components/data-table/cells/RowActions';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Avatar, Badge, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TrashIcon, UsersIcon } from '@phosphor-icons/react';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useWorkspace } from '../../workspace/api';
import { useContributorMutations, type Contributor } from '../api';
import { useContributorForm } from '../hooks/use-contributor-form';
import { useTreasurySettings } from '../../treasury/api';


import { countOf } from '../../../lib/text';
import { SettingsSection } from '../../../components/settings/SettingsSection';

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
            {used > 0 ? ` et retiré des ${countOf(used, 'tâche')} qui lui sont assignées` : ''}. Ses mentions
            @{contributor.handle} resteront dans le texte, sans lien. Cette action est irréversible.
          </Text>
</>
), onConfirm: () => { remove.mutate(
                { id: contributor.id },
                {
                  onSuccess: () => {
                    notifySuccess(`${contributor.name} supprimé.`);
                  },
                  onError: onMutationError,
                },
              ); } });
  };

  return (
    <SettingsSection
      title="Contributeurs"
      description={
        <>
          Personnes à qui les tâches peuvent être assignées. Rattachez-les aux projets où elles interviennent : seuls les contributeurs d’un projet (et de ses projets parents) sont proposés dans ses
          tâches.
        </>
      }
      actions={
        <>
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouveau contributeur
          </ActionButton>
        </>
      }
    >
      {contributors.length === 0 ? (
        <Group gap="sm">
          <ThemeIcon variant="light" color="gray" radius="xl">
            <UsersIcon aria-hidden />
          </ThemeIcon>
          <EmptyState compact message="Aucun contributeur pour le moment." />
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
              <InlineActions
                name={contributor.name}
                items={[
                  { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(contributor) },
                  // The user's own profile cannot be deleted.
                  !contributor.isMe && { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(contributor) },
                ]}
              />
            </Group>
          ))}
        </Stack>
      )}
    </SettingsSection>
  );
}
