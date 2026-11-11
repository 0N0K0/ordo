import { ActionIcon, Badge, Button, Group, Stack, Title, Tooltip } from '@mantine/core';
import { ArchiveIcon, PencilSimpleIcon, StarIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { EntityAvatar } from '../EntityAvatar';
import { entityLabel, useEntityActions, type EntityRef } from '../use-entity-actions';

/**
 * Detail page header: avatar, name or title, state badges, favorite and edit actions (a project only: a client is
 * edited in the settings sidebar of its page).
 * @param {object} props Component props.
 * @param {EntityRef} props.entity Client or project.
 * @param {ReactNode} [props.subtitle] Line under the name. Optional.
 * @param {ReactNode} [props.extraActions] Additional buttons. Optional.
 * @returns {JSX.Element} Header.
 */
export function EntityHeader({
  entity,
  subtitle,
  extraActions,
}: {
  entity: EntityRef;
  subtitle?: ReactNode;
  extraActions?: ReactNode;
}) {
  const actions = useEntityActions();
  const { item } = entity;
  const label = entityLabel(entity);

  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
        <EntityAvatar name={label} iconUrl={item.iconUrl} color={item.color} size="xl" radius="md" contain={entity.type === 'client'} />
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Title order={1} size="h2">
              {label}
            </Title>
            {item.archived && (
              <Badge color="gray" variant="light" leftSection={<ArchiveIcon aria-hidden />}>
                Archivé
              </Badge>
            )}
          </Group>
          {subtitle}
        </Stack>
      </Group>
      <Group gap="xs">
        {!item.archived && (
          <Tooltip label={item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <ActionIcon
              variant={item.favorite ? 'light' : 'default'}
              color={item.favorite ? 'yellow' : undefined}
              size="input-sm"
              aria-label={item.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              aria-pressed={item.favorite}
              onClick={() => actions.setFavorite(entity, !item.favorite)}
            >
              <StarIcon weight={item.favorite ? 'fill' : 'regular'} aria-hidden />
            </ActionIcon>
          </Tooltip>
        )}
        {extraActions}
        {entity.type === 'project' && (
          <Button variant="default" leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => actions.openProjectForm(entity.item)}>
            Modifier
          </Button>
        )}
      </Group>
    </Group>
  );
}
