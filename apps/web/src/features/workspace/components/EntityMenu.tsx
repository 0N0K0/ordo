import { FolderPlusIcon, PencilSimpleIcon, StarIcon, TrashIcon } from '@phosphor-icons/react';
import { useWorkspace } from '../api';
import { canHaveChildren } from '../lib/tree';
import { entityLabel, useEntityActions, type EntityRef } from '../hooks/use-entity-actions';
import { useTreeExpansion } from '../lib/tree-expansion';
import { foldEntries } from '../lib/fold-entries';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { archiveEntry } from '../../../lib/archive';

interface EntityMenuProps {
  entity: EntityRef;
  opened: boolean;
  onChange: (opened: boolean) => void;
}

/**
 * "⋯" button and its menu of actions on a client or a project.
 * @param {EntityMenuProps} props Component props.
 * @param {EntityRef} props.entity Client or project.
 * @param {boolean} props.opened Whether the menu is open (also opened by right-click).
 * @param {(opened: boolean) => void} props.onChange Open state change.
 * @returns {JSX.Element} Menu.
 */
export function EntityMenu({ entity, opened, onChange }: EntityMenuProps) {
  const actions = useEntityActions();
  const { data: workspace } = useWorkspace();
  const expansion = useTreeExpansion();
  const foldable = expansion?.hasChildren(entity) ?? false;
  const { item } = entity;
  const canAddSubProject = entity.type === 'project' && !item.archived && canHaveChildren(workspace?.projects ?? [], item.id);
  const kind = entity.type === 'client' ? 'le client' : 'le projet';

  return (
    <ActionsMenu
      name={`${kind} ${entityLabel(entity)}`}
      opened={opened}
      onChange={onChange}
      position="bottom-start"
      inRow
      size="sm"
      items={[
        entity.type === 'client' && !item.archived && { label: 'Ajouter un projet', icon: <FolderPlusIcon aria-hidden />, onClick: () => actions.openProjectForm(undefined, { clientId: item.id }) },
        canAddSubProject && { label: 'Ajouter un sous-projet', icon: <FolderPlusIcon aria-hidden />, onClick: () => actions.openProjectForm(undefined, { parentId: item.id }) },
        'divider',
        ...(foldable ? foldEntries((expanded) => expansion!.setSubtreeExpanded(entity, expanded)) : []),
        'divider',
        // An archived client or project is read only: restore it first.
        !item.archived && {
          label: 'Modifier',
          icon: <PencilSimpleIcon aria-hidden />,
          onClick: () => (entity.type === 'client' ? actions.openClientForm(entity.item) : actions.openProjectForm(entity.item)),
        },
        !item.archived && {
          label: item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris',
          icon: <StarIcon weight={item.favorite ? 'fill' : 'regular'} aria-hidden />,
          onClick: () => actions.setFavorite(entity, !item.favorite),
        },
        archiveEntry(
          { archived: item.archived, type: entity.type === 'client' ? 'Client' : 'Projet', label: entityLabel(entity), cascade: entity.type === 'client' ? 'avec ses projets' : undefined },
          actions.archiver(entity),
          item.id,
        ),
        { label: 'Supprimer', icon: <TrashIcon aria-hidden />, onClick: () => actions.confirmDelete(entity), danger: true },
      ]}
    />
  );
}
