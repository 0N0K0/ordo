import { IconAction } from '../../../components/actions/IconAction';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { Group, Stack, Title } from '@mantine/core';
import { StarIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { entityLabel, useEntityActions, type EntityRef } from '../hooks/use-entity-actions';

/**
 * Detail page header: avatar, name or title, state badges, favorite and other actions (a client or a project is
 * edited in the settings sidebar of its page).
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
    <Group justify="space-between" align="flex-start" gap="md">
      <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
        <ItemAvatar name={label} iconUrl={item.iconUrl} color={item.color ?? 'initials'} size="xl" radius="md" contain={entity.type === 'client'} />
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Title order={1} size="h2">
              {label}
            </Title>
            {item.archived && <ArchivedBadge />}
          </Group>
          {subtitle}
        </Stack>
      </Group>
      <Group gap="xs">
        {!item.archived && (
          <IconAction
            label={item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            variant={item.favorite ? 'light' : 'default'}
            color={item.favorite ? 'yellow' : undefined}
            size="input-sm"
            aria-pressed={item.favorite}
            onClick={() => actions.setFavorite(entity, !item.favorite)}
          >
            <StarIcon weight={item.favorite ? 'fill' : 'regular'} aria-hidden />
          </IconAction>
        )}
        {extraActions}
      </Group>
    </Group>
  );
}
