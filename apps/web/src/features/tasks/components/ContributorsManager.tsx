import { PersonRow } from '../../../components/people/people-rows';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TrashIcon, UsersIcon } from '@phosphor-icons/react';

import { archiveEntry, useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';

import { useWorkspace } from '../../projects/api';
import { useContributorMutations, type Contributor } from '../api';
import { useContributorForm } from '../hooks/use-contributor-form';
import { useTreasurySettings } from '../../treasury/api';
import { useActiveWorkspace } from '../../workspaces/api';
import { relationNoun } from '../../../components/people/people-options';

import { countOf, countWith, plural } from '../../../lib/text';
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
  const setArchived = useSetArchived('CONTRIBUTOR');
  const { shown, toggle: archivedToggle } = useArchivedToggle(contributors);
  const openForm = useContributorForm();
  const { data: workspace } = useWorkspace();
  const { perso } = useActiveWorkspace();

  /**
   * Titles of the projects a contributor is attached to.
   * @param {Contributor} contributor Contributor.
   * @returns {string} Label.
   */
  const projectsLabel = (contributor: Contributor) => {
    const titles = contributor.projectIds.map((id) => workspace?.projects.find((project) => project.id === id)?.label).filter((title): title is string => Boolean(title));
    return titles.length ? `Projets : ${titles.join(', ')}` : 'Aucun projet';
  };

  /**
   * Asks for confirmation before deleting a contributor.
   * @param {Contributor} contributor Contributor.
   * @returns {void}
   */
  const confirmDelete = (contributor: Contributor) => {
    const used = usage.get(contributor.id) ?? 0;
    confirmDestructive({
      title: 'Supprimer le contributeur',
      risks: `${contributor.name} sera supprimé définitivement${used > 0 ? ` et retiré ${countWith(used, 'tâche', ['de la', 'des'])} qui lui ${plural(used, 'est assignée', 'sont assignées')}` : ''}. Ses mentions @${contributor.handle} resteront dans le texte, sans lien.`,
      run: () => remove.mutateAsync({ id: contributor.id }),
      done: `${contributor.name} supprimé.`,
    });
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
          <ShowArchivedSwitch {...archivedToggle} />
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Nouveau contributeur
          </ActionButton>
        </>
      }
    >
      {shown.length === 0 ? (
        <EmptyState compact icon={<UsersIcon aria-hidden />} message="Aucun contributeur pour le moment." />
      ) : (
        <Stack gap="xs">
          {shown.map((contributor) => (
            <Group key={contributor.id} gap="sm" wrap="nowrap">
              <PersonRow
                name={contributor.name}

                avatarUrl={contributor.avatarUrl}

                badges={
                  <>
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
                      <Tooltip label={`${relationNoun(perso)} « ${relationOf.get(contributor.id)} »`}>
                        <Badge size="xs" variant="light" color="grape">
                          {relationNoun(perso)}
                        </Badge>
                      </Tooltip>
                    )}
                    {contributor.archived && <ArchivedBadge size="xs" />}
                  </>
                }

                details={
                  <>
                    <Text size="xs" c="dimmed">
                      @{contributor.handle}
                      {(usage.get(contributor.id) ?? 0) > 0 && ` · ${countOf(usage.get(contributor.id) ?? 0, 'tâche')}`}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {contributor.isMe ? 'Tous les projets' : projectsLabel(contributor)}
                    </Text>
                  </>
                }
              />
              <InlineActions
                name={contributor.name}
                items={[
                  // Archived: read only (restored to be edited).
                  !contributor.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(contributor) },
                  // The user's own profile can be neither archived nor deleted.
                  !contributor.isMe && archiveEntry({ archived: contributor.archived, type: 'Contributeur', label: contributor.name }, setArchived, contributor.id),
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
