import { Group, Stack, Text, type MantineSpacing } from '@mantine/core';
import type { ReactNode } from 'react';

interface SubSectionProps {
  /** Title, in small capitals. */
  title: ReactNode;
  /** Action on the right of the title (« Nouvelle alerte »). Optional. */
  action?: ReactNode;
  /** Space between the title and the content. Optional. Default = 4. */
  gap?: MantineSpacing | number;
  children: ReactNode;
}

/**
 * Small section of a panel or a page (a property of a task, a detail of a project, the alarms of a task): its title in
 * small dimmed capitals, an action on the right, then its content.
 * @param {SubSectionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function SubSection({ title, action, gap = 4, children }: SubSectionProps) {
  const caption = (
    <Text size="xs" fw={600} c="dimmed" tt="uppercase">
      {title}
    </Text>
  );
  return (
    <Stack gap={gap}>
      {action ? (
        <Group justify="space-between" gap="xs">
          {caption}
          {action}
        </Group>
      ) : (
        caption
      )}
      {children}
    </Stack>
  );
}
