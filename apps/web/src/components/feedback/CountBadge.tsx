import { Badge, type MantineColor, type MantineSize } from '@mantine/core';
import type { ComponentPropsWithRef } from 'react';

interface CountBadgeProps extends Omit<ComponentPropsWithRef<'div'>, 'color'> {
  count: number;
  /** Optional. Default = the primary color. */
  color?: MantineColor;
  /** Optional. Default = « filled ». */
  variant?: 'filled' | 'light';
  /** Optional. Default = « xs », round under 10. */
  size?: MantineSize;
  /** What is counted, for the screen readers (« 3 non lus »). Optional. */
  label?: string;
}

/**
 * Small count of a tab, a button or an entry of the navigation (filters, documents to send, unread mails…): round
 * while it holds one digit; nothing for none. Other props (a tooltip's) go to the badge.
 * @param {CountBadgeProps} props Component props.
 * @returns {JSX.Element | null} Badge.
 */
export function CountBadge({ count, color, variant = 'filled', size = 'xs', label, ...others }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <Badge size={size} variant={variant} color={color} circle={size === 'xs' && count < 10} aria-label={label} {...others}>
      {/* eslint-disable-next-line no-restricted-syntax -- CountBadge itself. */}
      {count}
    </Badge>
  );
}
