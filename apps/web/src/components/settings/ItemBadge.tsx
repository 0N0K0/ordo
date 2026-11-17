import { Badge, type BadgeProps, type MantineSize } from '@mantine/core';
import { ArchiveIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ItemAvatar } from './ItemAvatar';

interface ItemBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  /** Item of a settings list (a status, a category, a flag…); none: nothing shown. */
  item: { name: string; color?: string | null; iconUrl?: string | null } | null | undefined;
  /** Shown without an item. Optional. Default = nothing. */
  empty?: ReactNode;
  onClick?: () => void;
}

/**
 * Badge of an item of a settings list, the same everywhere: in its color, its image before its name when it has one
 * (else what is given on the left).
 * @param {ItemBadgeProps} props Component props.
 * @returns {JSX.Element | null} Badge.
 */
export function ItemBadge({ item, empty, leftSection, style, ...props }: ItemBadgeProps) {
  if (!item) return empty ? <>{empty}</> : null;
  return (
    <Badge
      variant="light"
      radius="sm"
      {...props}
      color={item.color ?? 'gray'}
      style={{ textTransform: 'none', ...(typeof style === 'object' ? style : {}) }}
      leftSection={item.iconUrl ? <ItemAvatar name={item.name} iconUrl={item.iconUrl} color={item.color} size={14} /> : leftSection}
    >
      {item.name}
    </Badge>
  );
}

/**
 * « Archivé » badge of an archived thing (a task, a project, a list, an account), the same everywhere.
 * @param {{ feminine?: boolean, size?: MantineSize }} props Agreement with a feminine noun (« Archivée »), size.
 * @returns {JSX.Element} Badge.
 */
export function ArchivedBadge({ feminine = false, size }: { feminine?: boolean; size?: MantineSize }) {
  return (
    <Badge color="gray" variant="light" size={size} leftSection={<ArchiveIcon aria-hidden />}>
      {feminine ? 'Archivée' : 'Archivé'}
    </Badge>
  );
}
