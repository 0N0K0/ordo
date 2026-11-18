import { Badge, type BadgeProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { ItemAvatar } from './ItemAvatar';

interface ItemBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  /** Item of a settings list (a status, a category, a flag…); none: nothing shown. */
  item: { label: string; color?: string | null; iconUrl?: string | null } | null | undefined;
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
      leftSection={item.iconUrl ? <ItemAvatar name={item.label} iconUrl={item.iconUrl} color={item.color} size={14} /> : leftSection}
    >
      {item.label}
    </Badge>
  );
}
