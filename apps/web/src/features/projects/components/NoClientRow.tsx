import { FoldChevron } from '../../../components/actions/FoldChevron';
import { UnstyledButton } from '@mantine/core';
import { Caption } from '../../../components/page/Caption';
import { FolderPlusIcon } from '@phosphor-icons/react';
import { forwardRef, useState, type CSSProperties } from 'react';
import { useActiveWorkspace } from '../../workspaces/api';
import { useEntityActions } from '../hooks/use-entity-actions';
import { useTreeExpansion } from '../lib/tree-expansion';
import { foldEntries } from '../lib/fold-entries';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
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
export const NoClientRow = forwardRef<HTMLDivElement, NoClientRowProps>(function NoClientRow({ expanded, onToggle, hasChildren, canAddProject = false, style }, ref) {
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
      className={`${rowClasses.row} ${classes.groupRow}`}
      data-menu-open={menuOpened || undefined}
      data-reveal-host
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
        {/* eslint-disable-next-line no-restricted-syntax -- a row of the projects tree: its chevron in the column of the tree's chevrons, none when empty. */}
        <span className={rowClasses.spacer}>{hasChildren && <FoldChevron expanded={expanded} />}</span>
        <Caption>{perso ? 'Tous les projets' : 'Sans client'}</Caption>
      </UnstyledButton>

      {hasMenu && (
        <span className={rowClasses.actions} data-reveal>
          <ActionsMenu
            about="les projets sans client"
            opened={menuOpened}
            onChange={setMenuOpened}
            position="bottom-start"
            inRow
            size="sm"
            items={[
              canAddProject && { label: 'Ajouter un projet', icon: <FolderPlusIcon aria-hidden />, onClick: () => actions.openProjectForm() },
              'divider',
              ...(foldable ? foldEntries((expanded) => expansion!.setNoClientExpanded(expanded)) : []),
            ]}
          />
        </span>
      )}
    </div>
  );
});
