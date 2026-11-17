import { Group, Paper, Stack, Title } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Titled section of the editor.
 * @param {{ title: string, children: ReactNode, actions?: ReactNode }} props Component props.
 * @returns {JSX.Element} Section.
 */
export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md" component="section">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} size="h5">
            {title}
          </Title>
          {actions}
        </Group>
        {children}
      </Stack>
    </Paper>
  );
}
