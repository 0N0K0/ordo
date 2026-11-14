import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: ReactNode;
  /** What the section holds, under its title. Optional. */
  description?: ReactNode;
  /** Its actions (ActionButton), always on the right. Optional. */
  actions?: ReactNode;
}

/**
 * Header of a section of a page or of a side panel, the same everywhere: its title (and description) on the left, its
 * actions — « Nouveau… » first of all — always on the right.
 * @param {SectionHeaderProps} props Component props.
 * @returns {JSX.Element} Header.
 */
export function SectionHeader({ title, description, actions }: SectionHeaderProps) {
  return (
    <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Title order={3} size="h5">
          {title}
        </Title>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {actions && (
        <Group gap="xs" wrap="nowrap" style={{ flex: 'none' }}>
          {actions}
        </Group>
      )}
    </Group>
  );
}
