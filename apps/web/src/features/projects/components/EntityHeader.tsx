import { StateButton } from '../../../components/data-table/cells/StateButton';
import { FAVORITE_STATES } from '../../../components/data-table/table/data-table';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { DetailHeader } from '../../../components/page/DetailHeader';
import type { ReactNode } from 'react';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { entityLabel, useEntityActions, type EntityRef } from '../hooks/use-entity-actions';

/**
 * Header of the page of a client or a project, as the other detail pages (`DetailHeader`): avatar, name,
 * state badges, favourite star (a state button) and other actions, then the « … » menu archiving and deleting it (it is edited in the settings
 * sidebar of its page).
 * @param {object} props Component props.
 * @param {EntityRef} props.entity Client or project.
 * @param {ReactNode} [props.subtitle] Line under the name. Optional.
 * @param {ReactNode} [props.extraActions] Additional buttons. Optional.
 * @returns {JSX.Element} Header.
 */
export function EntityHeader({ entity, subtitle, extraActions }: { entity: EntityRef; subtitle?: ReactNode; extraActions?: ReactNode }) {
  const actions = useEntityActions();
  const { item } = entity;
  const label = entityLabel(entity);
  return (
    <DetailHeader
      order={1}
      avatar={<ItemAvatar name={label} iconUrl={item.iconUrl} color={item.color ?? 'initials'} size="xl" radius="md" contain={entity.type === 'client'} />}
      title={label}
      badges={item.archived && <ArchivedBadge />}
      subtitle={subtitle}
      actions={
        <>
          {!item.archived && (
            <StateButton {...FAVORITE_STATES} value={item.favorite} size="md" onChange={(favorite) => actions.setFavorite(entity, favorite)} />
          )}
          {extraActions}
        </>
      }
      menu={{ about: `${entity.type === 'client' ? 'le client' : 'le projet'} « ${label} »`, items: actions.lifecycleEntries(entity) }}
    />
  );
}
