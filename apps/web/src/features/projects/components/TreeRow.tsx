import { clientPath, projectPath } from '../../../app/pages';
import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { Link, useLocation } from 'react-router';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { entityLabel, useEntityActions, type EntityRef } from '../hooks/use-entity-actions';
import { EntityMenu } from './EntityMenu';
import classes from './TreeRow.module.css';
import { FoldButton } from '../../../components/actions/FoldButton';

interface TreeRowProps extends HTMLAttributes<HTMLDivElement> {
  entity: EntityRef;
  /** Indentation level (0 for clients, 1 for their projects). */
  depth?: number;
  /** Second line under the name. */
  subtitle?: string;
  /** Shown lighter: context item, or archived item outside the archive section. Default: archived. */
  muted?: boolean;
  /** Present for clients: expand state and toggle. */
  expansion?: { expanded: boolean; onToggle: () => void };
  draggable?: boolean;
  dragging?: boolean;
}

/**
 * Sidebar tree row: link to the detail page, renamed in the side panel on double-click,
 * action menu on "⋯" and right-click.
 * @param {TreeRowProps} props Component props (extra props and ref go to the row, for drag and drop).
 * @returns {JSX.Element} Row.
 */
export const TreeRow = forwardRef<HTMLDivElement, TreeRowProps>(function TreeRow({ entity, depth = 0, subtitle, muted, expansion, draggable, dragging, style, className, ...rest }, ref) {
  const { item } = entity;
  const actions = useEntityActions();
  const { pathname } = useLocation();
  const [menuOpened, setMenuOpened] = useState(false);
  const label = entityLabel(entity);
  const isProject = entity.type === 'project';
  const href = entity.type === 'client' ? clientPath(item.id) : projectPath(item.id);

  return (
    <div
      ref={ref}
      {...rest}
      className={className ? `${classes.row} ${className}` : classes.row}
      style={{ ...style, '--tree-depth': depth } as CSSProperties}
      data-active={pathname === href || undefined}
      data-muted={(muted ?? item.archived) || undefined}
      data-menu-open={menuOpened || undefined}
      data-draggable={draggable || undefined}
      data-dragging={dragging || undefined}
      data-reveal-host
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpened(true);
      }}
    >
      {expansion ? <FoldButton expanded={expansion.expanded} item={label} onToggle={expansion.onToggle} inRow /> : <span className={classes.spacer} />}

      <Link
        to={href}
        className={classes.link}
        draggable={false}
        onDoubleClick={(event) => {
          event.preventDefault();
          actions.rename(entity);
        }}
      >
        <ItemAvatar name={label} iconUrl={item.iconUrl} color={item.color ?? 'initials'} size={22} radius="sm" contain={!isProject} />
        <span className={classes.name}>
          <span>{label}</span>
          {subtitle && <span className={classes.subtitle}>{subtitle}</span>}
        </span>
      </Link>

      <span className={classes.actions} data-reveal>
        <EntityMenu entity={entity} opened={menuOpened} onChange={setMenuOpened} />
      </span>
    </div>
  );
});
