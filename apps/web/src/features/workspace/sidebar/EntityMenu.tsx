import { ActionIcon, Menu } from '@mantine/core';
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowsInLineVerticalIcon,
  ArrowsOutLineVerticalIcon,
  DotsThreeIcon,
  FolderPlusIcon,
  PencilSimpleIcon,
  StarIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useWorkspace } from '../api';
import { canHaveChildren } from '../tree';
import { entityLabel, useEntityActions, type EntityRef } from '../use-entity-actions';
import { useTreeExpansion } from './tree-expansion';

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
  const canAddSubProject =
    entity.type === 'project' && !item.archived && canHaveChildren(workspace?.projects ?? [], item.id);
  const kind = entity.type === 'client' ? 'le client' : 'le projet';

  return (
    <Menu opened={opened} onChange={onChange} position="bottom-start" withinPortal shadow="md" width={220}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`Actions sur ${kind} ${entityLabel(entity)}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DotsThreeIcon weight="bold" aria-hidden />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        {entity.type === 'client' && !item.archived && (
          <Menu.Item
            leftSection={<FolderPlusIcon aria-hidden />}
            onClick={() => actions.openProjectForm(undefined, { clientId: item.id })}
          >
            Ajouter un projet
          </Menu.Item>
        )}
        {canAddSubProject && (
          <Menu.Item
            leftSection={<FolderPlusIcon aria-hidden />}
            onClick={() => actions.openProjectForm(undefined, { parentId: item.id })}
          >
            Ajouter un sous-projet
          </Menu.Item>
        )}
        {foldable && (
          <>
            <Menu.Item
              leftSection={<ArrowsOutLineVerticalIcon aria-hidden />}
              onClick={() => expansion!.setSubtreeExpanded(entity, true)}
            >
              Tout déplier
            </Menu.Item>
            <Menu.Item
              leftSection={<ArrowsInLineVerticalIcon aria-hidden />}
              onClick={() => expansion!.setSubtreeExpanded(entity, false)}
            >
              Tout replier
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item
          leftSection={<PencilSimpleIcon aria-hidden />}
          onClick={() =>
            entity.type === 'client' ? actions.openClientForm(entity.item) : actions.openProjectForm(entity.item)
          }
        >
          Modifier
        </Menu.Item>
        {!item.archived && (
          <Menu.Item
            leftSection={<StarIcon weight={item.favorite ? 'fill' : 'regular'} aria-hidden />}
            onClick={() => actions.setFavorite(entity, !item.favorite)}
          >
            {item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          </Menu.Item>
        )}
        <Menu.Item
          leftSection={item.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
          onClick={() => actions.setArchived(entity, !item.archived)}
        >
          {item.archived ? 'Désarchiver' : 'Archiver'}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<TrashIcon aria-hidden />} onClick={() => actions.confirmDelete(entity)}>
          Supprimer
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
