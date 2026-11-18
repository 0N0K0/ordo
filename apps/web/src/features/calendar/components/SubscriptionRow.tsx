import { Group, Switch, Text, type MantineSpacing } from '@mantine/core';
import type { ReactNode } from 'react';
import { ItemAvatar } from '../../../components/items/ItemAvatar';

interface SubscriptionRowProps {
  /** What is subscribed to (a calendar, a kind of slots). */
  label: string;
  color: string | null;
  /** Workspace it comes from, for the screen readers. */
  workspaceLabel: string;
  /** Detail after the label, dimmed. Optional. */
  hint?: ReactNode;
  subscribed: boolean;
  onChange: (subscribed: boolean) => void;
  /** Buttons before the switch. Optional. */
  actions?: ReactNode;
  /** Left padding. Optional. */
  pl?: MantineSpacing;
}

/**
 * Row of something of another workspace this one can subscribe to (a calendar, a kind of slots): its avatar, its label,
 * and the « Abonné » switch.
 * @param {SubscriptionRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function SubscriptionRow({ label, color, workspaceLabel, hint, subscribed, onChange, actions, pl }: SubscriptionRowProps) {
  return (
    <Group gap="sm" wrap="nowrap" pl={pl}>
      <ItemAvatar name={label} color={color} />
      <Text size="sm" style={{ flex: 1 }} truncate>
        {label}
        {hint && (
          <Text span size="xs" c="dimmed">
            {' '}
            · {hint}
          </Text>
        )}
      </Text>
      {actions}
      <Switch label="Abonné" aria-label={`Abonnement à ${label} (${workspaceLabel})`} checked={subscribed} onChange={(event) => onChange(event.currentTarget.checked)} />
    </Group>
  );
}
