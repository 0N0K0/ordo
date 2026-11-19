import { Group, Paper, Text } from '@mantine/core';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';

/**
 * What follows the pointer while dragging (in a `DragOverlay`), the same everywhere: a small card with its label.
 * @param {{ label: string }} props Component props: what is dragged (« Courses », « 3 mails »).
 * @returns {JSX.Element} Card.
 */
export function DragLabel({ label }: { label: string }) {
  return (
    <Paper shadow="md" radius="sm" px="sm" py={4} withBorder style={{ cursor: 'grabbing', width: 'max-content' }}>
      <Group gap="xs" wrap="nowrap">
        <DotsSixVerticalIcon weight="bold" aria-hidden />
        <Text size="sm" fw={500}>
          {label}
        </Text>
      </Group>
    </Paper>
  );
}
