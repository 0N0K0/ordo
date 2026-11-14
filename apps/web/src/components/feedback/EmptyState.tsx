import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** What is empty, and what to do about it. */
  message: ReactNode;
  /** Icon of what is empty. Optional. */
  icon?: ReactNode;
  /** Color of the icon (green: nothing left to do). Optional. Default = 'gray'. */
  iconColor?: string;
  /** What fills it (a button). Optional. */
  action?: ReactNode;
  /** Inside a section or a panel: on one line, without frame. Optional. Default = false (a framed block, centered). */
  compact?: boolean;
}

/**
 * What a list, a table or a section shows with nothing in it, the same everywhere: its icon, its message and its
 * action, when it has them.
 * @param {EmptyStateProps} props Component props.
 * @returns {JSX.Element} Empty state.
 */
export function EmptyState({ message, icon, iconColor = 'gray', action, compact = false }: EmptyStateProps) {
  if (compact) {
    return (
      <Group gap="xs" wrap="nowrap" c="dimmed">
        {icon}
        <Text size="sm" c="dimmed">
          {message}
        </Text>
        {action}
      </Group>
    );
  }
  return (
    <Paper withBorder radius="md" p="xl">
      <Stack align="center" gap="sm">
        {icon && (
          <ThemeIcon size="xl" radius="xl" variant="light" color={iconColor}>
            {icon}
          </ThemeIcon>
        )}
        <Text size="sm" c="dimmed" ta="center">
          {message}
        </Text>
        {action}
      </Stack>
    </Paper>
  );
}
