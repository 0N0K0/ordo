import { Group, Text } from '@mantine/core';
import { ChatCircleIcon } from '@phosphor-icons/react';

/**
 * Number of comments of a row of a table (its description counting as one), with its icon, the same in every table
 *; nothing when none.
 * @param {{ count: number }} props Component props.
 * @returns {JSX.Element | null} Count.
 */
export function CommentCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Group gap={4} wrap="nowrap" c="dimmed">
      <ChatCircleIcon aria-hidden />
      <Text size="sm">{count}</Text>
    </Group>
  );
}
