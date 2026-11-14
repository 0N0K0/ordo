import { Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { PageTitle } from '../PageTitle';

/**
 * Header of every page: its title (on a phone: the header of the app shows it from the tablet on), then its actions on
 * the right, the main ones last.
 * @param {{ title: ReactNode, description?: ReactNode, actions?: ReactNode }} props Component props: title, what the page holds (under it), actions (ActionButton). Optional.
 * @returns {JSX.Element} Header.
 */
export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <Group justify="space-between" gap="sm" wrap="wrap" align="flex-end">
      <Stack gap={2}>
        <PageTitle>{title}</PageTitle>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {actions && (
        <Group gap="sm" ml="auto" wrap="wrap">
          {actions}
        </Group>
      )}
    </Group>
  );
}
