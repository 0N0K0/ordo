import { ActionIcon, Menu, Text, UnstyledButton } from '@mantine/core';
import {
  ArrowsInLineVerticalIcon,
  ArrowsOutLineVerticalIcon,
  CaretRightIcon,
  DotsThreeIcon,
  FolderPlusIcon,
} from '@phosphor-icons/react';
import { forwardRef, useState, type CSSProperties } from 'react';
import { useActiveWorkspace } from '../../workspaces/api';
import { useEntityActions } from '../use-entity-actions';
import { useTreeExpansion } from './tree-expansion';
import rowClasses from './TreeRow.module.css';
import classes from './Tree.module.css';

interface NoClientRowProps {
  expanded: boolean;
  onToggle: () => void;
  /** Whether the group has projects (no chevron when empty, e.g. while dragging into it). */
  hasChildren: boolean;
  /** Offers "Ajouter un projet" in the menu (main tree only). */
  canAddProject?: boolean;
  style?: CSSProperties;
}

/**
 * Foldable "Sans client" group header (projects without client; "Tous les projets" in a personal workspace), with
 * a menu on "⋯" and right-click.
 * @param {NoClientRowProps} props Component props; the ref goes to the row, for drag and drop.
 * @returns {JSX.Element} Row.
 */
export const NoClientRow = forwardRef<HTMLDivElement, NoClientRowProps>(function NoClientRow(
  { expanded, onToggle, hasChildren, canAddProject = false, style },
  ref,
) {
  const actions = useEntityActions();
  // Without clients (personal workspace), the group holds every project.
  const { perso } = useActiveWorkspace();
  const expansion = useTreeExpansion();
  const [menuOpened, setMenuOpened] = useState(false);
  const foldable = expansion?.noClientFoldable ?? false;
  const hasMenu = canAddProject || foldable;

  return (
    <div
      ref={ref}
      style={style}
      className={classes.groupRow}
      data-menu-open={menuOpened || undefined}
      role="treeitem"
      aria-level={1}
      aria-expanded={hasChildren ? expanded : undefined}
      onContextMenu={(event) => {
        if (!hasMenu) return;
        event.preventDefault();
        setMenuOpened(true);
      }}
    >
      <UnstyledButton className={classes.groupToggle} onClick={onToggle} disabled={!hasChildren}>
        <span className={rowClasses.spacer}>
          {hasChildren && (
            <CaretRightIcon className={rowClasses.chevron} data-expanded={expanded || undefined} aria-hidden />
          )}
        </span>
        <Text size="xs" fw={600} c="dimmed" tt="uppercase">
          {perso ? 'Tous les projets' : 'Sans client'}
        </Text>
      </UnstyledButton>

      {hasMenu && (
        <span className={classes.groupActions}>
          <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal shadow="md" width={220}>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Actions sur les projets sans client"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <DotsThreeIcon weight="bold" aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {canAddProject && (
                <Menu.Item leftSection={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm()}>
                  Ajouter un projet
                </Menu.Item>
              )}
              {canAddProject && foldable && <Menu.Divider />}
              {foldable && (
                <>
                  <Menu.Item
                    leftSection={<ArrowsOutLineVerticalIcon aria-hidden />}
                    onClick={() => expansion!.setNoClientExpanded(true)}
                  >
                    Tout déplier
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<ArrowsInLineVerticalIcon aria-hidden />}
                    onClick={() => expansion!.setNoClientExpanded(false)}
                  >
                    Tout replier
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </span>
      )}
    </div>
  );
});
