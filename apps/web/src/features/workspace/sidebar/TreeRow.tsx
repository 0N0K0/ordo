import { ActionIcon, TextInput } from '@mantine/core';
import { entityNameSchema, projectTitleSchema } from '@ordo/shared';
import { CaretRightIcon } from '@phosphor-icons/react';
import { forwardRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { notifyError } from '../../../lib/notify';
import { EntityAvatar } from '../EntityAvatar';
import { entityLabel, useEntityActions, type EntityRef } from '../use-entity-actions';
import { EntityMenu } from './EntityMenu';
import classes from './TreeRow.module.css';

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
 * Sidebar tree row: link to the detail page, inline rename on double-click,
 * action menu on "⋯" and right-click.
 * @param {TreeRowProps} props Component props (extra props and ref go to the row, for drag and drop).
 * @returns {JSX.Element} Row.
 */
export const TreeRow = forwardRef<HTMLDivElement, TreeRowProps>(function TreeRow(
  { entity, depth = 0, subtitle, muted, expansion, draggable, dragging, style, className, ...rest },
  ref,
) {
  const { item } = entity;
  const actions = useEntityActions();
  const { pathname } = useLocation();
  const [menuOpened, setMenuOpened] = useState(false);
  const [editing, setEditing] = useState(false);
  const label = entityLabel(entity);
  const isProject = entity.type === 'project';
  const [draft, setDraft] = useState(label);
  const [error, setError] = useState<string | null>(null);
  const href = entity.type === 'client' ? `/clients/${item.id}` : `/projects/${item.id}`;

  /**
   * Starts the inline rename.
   * @returns {void}
   */
  const startEditing = () => {
    setDraft(label);
    setError(null);
    setEditing(true);
  };

  /**
   * Validates and saves the new name (client) or title (project).
   * @param {boolean} fromBlur Whether focus left the field (an invalid value is then dropped).
   * @returns {void}
   */
  const commit = (fromBlur: boolean) => {
    const result = (isProject ? projectTitleSchema : entityNameSchema).safeParse(draft);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? 'Valeur invalide.';
      if (fromBlur) {
        notifyError(`${message} ${isProject ? 'Le titre' : 'Le nom'} n’a pas été modifié.`);
        setEditing(false);
      } else {
        setError(message);
      }
      return;
    }
    actions.rename(entity, result.data);
    setEditing(false);
  };

  /**
   * Enter saves, Escape cancels.
   * @param {KeyboardEvent<HTMLInputElement>} event Key event.
   * @returns {void}
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(false);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(false);
    }
  };

  return (
    <div
      ref={ref}
      {...rest}
      className={className ? `${classes.row} ${className}` : classes.row}
      style={{ ...style, '--tree-depth': depth } as CSSProperties}
      data-active={pathname === href || undefined}
      data-muted={(muted ?? item.archived) || undefined}
      data-menu-open={menuOpened || undefined}
      data-draggable={(draggable && !editing) || undefined}
      data-dragging={dragging || undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpened(true);
      }}
    >
      {expansion ? (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={expansion.expanded ? 'Replier' : 'Déplier'}
          aria-expanded={expansion.expanded}
          onClick={expansion.onToggle}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CaretRightIcon className={classes.chevron} data-expanded={expansion.expanded || undefined} aria-hidden />
        </ActionIcon>
      ) : (
        <span className={classes.spacer} />
      )}

      {editing ? (
        <TextInput
          size="xs"
          value={draft}
          error={error}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(true)}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={isProject ? 'Nouveau titre' : 'Nouveau nom'}
          style={{ flex: 1 }}
        />
      ) : (
        <Link
          to={href}
          className={classes.link}
          draggable={false}
          onDoubleClick={(event) => {
            event.preventDefault();
            startEditing();
          }}
        >
          <EntityAvatar name={label} iconUrl={item.iconUrl} color={item.color} size={22} radius="sm" />
          <span className={classes.name}>
            <span>{label}</span>
            {subtitle && <span className={classes.subtitle}>{subtitle}</span>}
          </span>
        </Link>
      )}

      {!editing && (
        <span className={classes.actions}>
          <EntityMenu entity={entity} opened={menuOpened} onChange={setMenuOpened} />
        </span>
      )}
    </div>
  );
});
